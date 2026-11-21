using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Wwg.Api.Data;
using Wwg.Api.Data.Entities;

namespace Wwg.Api.Features.Armies;

/// <summary>The rules for who can command an army (DESIGN.md §5.1).</summary>
internal static class Commanders
{
    /// <summary>
    /// A validation problem on <paramref name="field"/> unless the member is a Player in the
    /// campaign (the Umpire can't command an army); null if they are.
    /// </summary>
    public static async Task<ValidationProblem?> ValidateAsync(
        WwgDbContext db,
        Guid campaignId,
        Guid memberId,
        string field,
        CancellationToken cancellationToken
    )
    {
        var role = await db
            .CampaignMembers.Where(m => m.Id == memberId && m.CampaignId == campaignId)
            .Select(m => (CampaignRole?)m.Role)
            .SingleOrDefaultAsync(cancellationToken);
        return role == CampaignRole.Player
            ? null
            : TypedResults.ValidationProblem(
                new Dictionary<string, string[]>(StringComparer.Ordinal)
                {
                    [field] =
                    [
                        role is null
                            ? "That member isn't in this campaign."
                            : "The Umpire can't command an army.",
                    ],
                }
            );
    }

    /// <summary>
    /// 409 if the member commands an army other than <paramref name="armyId"/> that isn't on
    /// <paramref name="sideId"/>: a Player's armies are all on one side (decision 0036). Null
    /// otherwise. <paramref name="who"/> starts the message ("That Player", "Its commander"). (A
    /// trigger is the final guarantee if two requests race.)
    /// </summary>
    public static async Task<ProblemHttpResult?> ConflictAsync(
        WwgDbContext db,
        Guid memberId,
        Guid? armyId,
        Guid sideId,
        string who,
        CancellationToken cancellationToken
    )
    {
        var other = await db
            .Armies.Where(a => a.CommanderId == memberId && a.Id != armyId && a.SideId != sideId)
            .OrderBy(a => a.Name)
            .Select(a => a.Name)
            .FirstOrDefaultAsync(cancellationToken);
        return other is null
            ? null
            : TypedResults.Problem(
                statusCode: StatusCodes.Status409Conflict,
                title: "Commands the other side",
                detail: $"{who} commands {other}, of the other side. "
                    + "A Player's armies are all on one side."
            );
    }
}
