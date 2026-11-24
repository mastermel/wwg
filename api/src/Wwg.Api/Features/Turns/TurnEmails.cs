using Wwg.Api.Data.Entities;
using Wwg.Api.Infrastructure.Email;

namespace Wwg.Api.Features.Turns;

/// <summary>Someone a campaign email goes to, and the kinds they've turned off (decision 0023).</summary>
internal sealed record TurnRecipient(
    string Email,
    string FirstName,
    string LastName,
    IReadOnlyCollection<EmailKind> Muted
)
{
    /// <summary>Whether they get emails of this kind.</summary>
    public bool Wants(EmailKind kind) => !Muted.Contains(kind);
}

/// <summary>
/// The emails every turn action sends to the other side (DESIGN.md §3.13): the Umpire when a
/// commander submits; the commander when the Umpire submits for them, approves, sends back or
/// reverts (listing the orders the Umpire set); every commander when a turn starts.
/// </summary>
internal static class TurnEmails
{
    /// <param name="to">Who it's for.</param>
    /// <param name="kind">Which kind it is, for the footer: each kind can be turned off.</param>
    /// <param name="campaign">The campaign's name.</param>
    /// <param name="headline">What happened, briefly: the subject after the campaign, and the title.</param>
    /// <param name="what">What happened, as a sentence.</param>
    /// <param name="action">The button's text: what to do next.</param>
    /// <param name="map">The campaign's map.</param>
    /// <param name="note">The Umpire's note on the turn, if any.</param>
    /// <param name="unitNotes">The Umpire's notes on units, by unit name.</param>
    /// <param name="umpireOrders">The orders the Umpire set for the commander ("Name: move").</param>
    /// <param name="waiting">What's waiting for the Umpire as they start the next turn.</param>
    public static EmailMessage Create(
        TurnRecipient to,
        EmailKind kind,
        string campaign,
        string headline,
        string what,
        string action,
        Uri map,
        string? note = null,
        IReadOnlyList<(string ArmyUnit, string Text)>? unitNotes = null,
        IReadOnlyList<string>? umpireOrders = null,
        IReadOnlyList<string>? waiting = null
    )
    {
        var email = new EmailBuilder(Eyebrow(campaign), Capitalised(headline))
            .Greeting(to.FirstName)
            .Paragraph(what);
        if (note is not null)
        {
            email.Letter("The Umpire's note", note);
        }

        email.Ledger(
            new LedgerRow(
                "Notes on units",
                [.. (unitNotes ?? []).Select(n => new LedgerEntry(n.Text, Lead: n.ArmyUnit))]
            ),
            LedgerRow.Of("Orders the Umpire set", umpireOrders ?? []),
            LedgerRow.Of("Waiting for you", waiting ?? [])
        );
        if (waiting is { Count: 0 })
        {
            email.Paragraph("Nothing else is waiting for you as you start the next turn.");
        }

        return email
            .Button(action, map)
            .Build(
                to.Email,
                $"{to.FirstName} {to.LastName}",
                $"{campaign}: {headline}",
                Why(kind),
                Settings(map)
            );
    }

    /// <summary>The line over a campaign email's title.</summary>
    public static string Eyebrow(string campaign) => $"Wasatch Wargamers · {campaign}";

    /// <summary>Why the recipient got an email of this kind, for its footer.</summary>
    public static string Why(EmailKind kind) =>
        kind switch
        {
            EmailKind.TurnStarted => "You get this email when a new turn starts.",
            EmailKind.TurnReviewed =>
                "You get this email when the Umpire acts on your army's turn.",
            EmailKind.ArmyGiven => "You get this email when you're given an army.",
            EmailKind.ArmySubmitted => "You get this email when an army submits its turn.",
            EmailKind.AllSubmitted => "You get this email when every army has submitted its turn.",
            EmailKind.PlayerJoined => "You get this email when a player joins your campaign.",
            _ => throw new ArgumentOutOfRangeException(nameof(kind), kind, null),
        };

    /// <summary>The account page, where campaign emails are turned off, beside another app link.</summary>
    public static Uri Settings(Uri appLink) => new(appLink, "/account");

    private static string Capitalised(string text) =>
        text.Length == 0 ? text : char.ToUpperInvariant(text[0]) + text[1..];
}
