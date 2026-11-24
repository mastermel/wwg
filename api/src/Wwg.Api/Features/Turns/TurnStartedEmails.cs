using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Wwg.Api.Data;
using Wwg.Api.Data.Entities;
using Wwg.Api.Features.Campaigns;
using Wwg.Api.Infrastructure.Email;

namespace Wwg.Api.Features.Turns;

/// <summary>
/// The new turn's email (step 52c, decision 0023): to each commander, one for all the armies
/// they command (decision 0036), the turn's number, its day and time of day, and what's new for
/// each army since the last turn.
/// </summary>
internal static class TurnStartedEmails
{
    /// <summary>Queues the email for every commander, as turn <paramref name="number"/> opens.</summary>
    public static async Task QueueAsync(
        WwgDbContext db,
        IEmailQueue emails,
        Uri map,
        Guid campaignId,
        int number,
        CancellationToken cancellationToken
    )
    {
        var commanders = await db
            .Armies.AsNoTracking()
            .Where(a => a.CampaignId == campaignId && a.CommanderId != null)
            .OrderBy(a => a.Name)
            .Select(a => new
            {
                a.Id,
                a.CommanderId,
                Army = a.Name,
                Campaign = a.Campaign.Name,
                To = db
                    .CampaignMembers.Where(m => m.Id == a.CommanderId)
                    .Select(m => new TurnRecipient(
                        m.User.Email ?? "",
                        m.User.FirstName,
                        m.User.LastName,
                        m.User.MutedEmails
                    ))
                    .Single(),
            })
            .ToListAsync(cancellationToken);
        commanders = [.. commanders.Where(c => c.To.Wants(EmailKind.TurnStarted))];
        if (commanders.Count == 0)
        {
            return;
        }

        var calendar = await CalendarEndpoints.LoadAsync(db, campaignId, cancellationToken);
        var when = When(TurnParts.Of(calendar.FirstTurnPart, calendar.StartDate, number));
        // The first turn has nothing before it to report.
        var news =
            number > 1
                ? await TurnNewsBuilder.ForAsync(db, campaignId, number, cancellationToken)
                : [];
        foreach (var commander in commanders.GroupBy(c => c.CommanderId))
        {
            var first = commander.First();
            await emails.QueueAsync(
                Create(
                    first.To,
                    first.Campaign,
                    [
                        .. commander.Select(c => new ArmyNews(
                            c.Army,
                            news.GetValueOrDefault(c.Id) ?? TurnNews.None
                        )),
                    ],
                    number,
                    when,
                    map
                ),
                cancellationToken
            );
        }
    }

    /// <summary>"17 June 1815, Afternoon", or just "Afternoon" without a start date.</summary>
    private static string? When((TurnPart Part, DateOnly? Date)? turn) =>
        turn switch
        {
            null => null,
            { Date: { } date } => string.Create(
                CultureInfo.InvariantCulture,
                $"{date.Day} {date.ToString("MMMM yyyy", CultureInfo.InvariantCulture)}, {turn.Value.Part}"
            ),
            _ => turn.Value.Part.ToString(),
        };

    /// <summary>One of the commander's armies, and what's new for it.</summary>
    internal sealed record ArmyNews(string Army, TurnNews News);

    /// <summary>The email for a commander of <paramref name="armies"/> (by name; at least one).</summary>
    public static EmailMessage Create(
        TurnRecipient to,
        string campaign,
        IReadOnlyList<ArmyNews> armies,
        int number,
        string? when,
        Uri map
    )
    {
        var at = when is null ? "" : $" ({when})";
        var whose = armies.Count == 1 ? "its" : "their";
        var names = Names([.. armies.Select(a => a.Army)]);
        var opening =
            number == 1
                ? $"{campaign} has begun: turn 1{at} is open. Give {names} {whose} first orders."
                : string.Create(
                    CultureInfo.InvariantCulture,
                    $"Turn {number} of {campaign} has started{at}. Give {names} {whose} orders."
                );
        var email = new EmailBuilder(
            TurnEmails.Eyebrow(campaign),
            number == 1
                ? "The campaign has begun"
                : string.Create(CultureInfo.InvariantCulture, $"Turn {number} has started"),
            when
        )
            .Greeting(to.FirstName)
            .Paragraph(opening);
        if (number > 1)
        {
            foreach (var army in armies)
            {
                AppendNews(email, armies.Count == 1 ? null : army.Army, army.News);
            }
        }

        return email
            .Button("Give orders on the map", map)
            .Build(
                to.Email,
                $"{to.FirstName} {to.LastName}",
                when is null
                    ? $"{campaign}: turn {number} has started"
                    : $"{campaign}: turn {number} has started ({when})",
                TurnEmails.Why(EmailKind.TurnStarted),
                TurnEmails.Settings(map)
            );
    }

    /// <summary>"First Corps", "First Corps and Second Corps", "A, B and C".</summary>
    private static string Names(List<string> names) =>
        names.Count == 1 ? names[0] : $"{string.Join(", ", names[..^1])} and {names[^1]}";

    /// <summary>An army's news, under its name when the email is for several (<paramref name="army"/>).</summary>
    private static void AppendNews(EmailBuilder email, string? army, TurnNews news)
    {
        email.Heading(
            army is null ? "New since the last turn" : $"{army}: new since the last turn"
        );
        if (news.IsEmpty)
        {
            email.Paragraph("Nothing new since the last turn.");
            return;
        }

        if (news.UmpireNote is { } note)
        {
            email.Letter("The Umpire on your last orders", note);
        }

        email.Ledger(
            LedgerRow.Of("Enemy sightings", news.Sightings),
            LedgerRow.Of("Supply", news.Supply),
            LedgerRow.Of("Attrition", news.Attrition),
            LedgerRow.Of("Boats", news.Boats),
            new LedgerRow(
                "Reports from allies",
                [
                    .. news.Reports.Select(r => new LedgerEntry(
                        $"From {r.From}",
                        Aside: With(r),
                        Quote: r.Message is { Length: > 0 } message ? message : null
                    )),
                ]
            )
        );
    }

    /// <summary>What a report brings besides its message: "3 sightings, their units' positions".</summary>
    private static string? With(ReportNews report)
    {
        var parts = new List<string>();
        if (report.Sightings > 0)
        {
            parts.Add(
                report.Sightings == 1
                    ? "1 sighting"
                    : string.Create(CultureInfo.InvariantCulture, $"{report.Sightings} sightings")
            );
        }
        if (report.Positions)
        {
            parts.Add("their units' positions");
        }

        return parts.Count == 0 ? null : string.Join(", ", parts);
    }
}
