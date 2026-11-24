using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Wwg.Api.Data;
using Wwg.Api.Features.Boats;
using Wwg.Api.Infrastructure.Auth;

namespace Wwg.Api.Features.Turns;

/// <summary>Each unit's forced marches, and the attrition they cost (step 47, decision 0018).</summary>
internal static class MarchEndpoints
{
    public static IEndpointRouteBuilder MapMarchEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/armies/{id:guid}/marches", ListMarchesAsync)
            .WithName("ListMarches")
            .WithTags("Turns")
            .RequireCampaignAccess(CampaignAccess.Commander, CampaignRouteId.Army);
        app.MapGet("/api/campaigns/{id:guid}/attrition", ListAttritionDueAsync)
            .WithName("ListAttritionDue")
            .WithTags("Turns")
            .RequireCampaignAccess(CampaignAccess.Member);
        return app;
    }

    /// <summary>
    /// The attrition the open turn's orders cost, for each unit that owes any: the Umpire's and
    /// Admins', every army's (what starting the next turn asks them to confirm); a commander's,
    /// their own armies' (decision 0050: they follow its moves); anyone else's, none.
    /// </summary>
    internal static async Task<Ok<List<AttritionDueResponse>>> ListAttritionDueAsync(
        Guid id,
        WwgDbContext db,
        HttpContext httpContext,
        CancellationToken cancellationToken
    )
    {
        var context = httpContext.CampaignContext();
        var due = await Attrition.DueAsync(db, id, cancellationToken);
        if (context.CanManage)
        {
            return TypedResults.Ok(due);
        }

        var mine = await db
            .Armies.AsNoTracking()
            .Where(a => a.CampaignId == id && a.CommanderId == context.MemberId)
            .Select(a => a.Id)
            .ToListAsync(cancellationToken);
        return TypedResults.Ok(due.Where(d => mine.Contains(d.ArmyId)).ToList());
    }

    /// <summary>
    /// Each of the army's units' forced marches as the open turn began, and the attrition moving
    /// this turn would cost, as a multiple of the rules' scale (its commander, the Umpire and
    /// Admins: they follow its moves).
    /// </summary>
    internal static async Task<Ok<List<UnitMarchResponse>>> ListMarchesAsync(
        Guid id,
        WwgDbContext db,
        HttpContext httpContext,
        CancellationToken cancellationToken
    )
    {
        var campaignId = httpContext.CampaignContext().CampaignId;
        var (before, open) = await Marches.LoadAsync(db, campaignId, id, cancellationToken);
        // On boats, moving is rest (decision 0022): it costs what holding does.
        var aboard = (await Embarkation.LoadAsync(db, campaignId, cancellationToken)).Now;
        return TypedResults.Ok(
            before
                .Select(entry =>
                {
                    var state = entry.Value;
                    var order = open.GetValueOrDefault(entry.Key);
                    var moves = !aboard.ContainsKey(entry.Key);
                    return new UnitMarchResponse(
                        entry.Key,
                        state.MovesInRow,
                        state.ForceMarchesInRow,
                        state.ForcedMarchTurns,
                        state.After(moved: moves, forceMarch: false).Multiplier,
                        state.After(moved: moves, forceMarch: true).Multiplier,
                        order is null ? 0 : state.After(order.Moved, order.ForceMarch).Multiplier
                    );
                })
                .OrderBy(m => m.UnitId)
                .ToList()
        );
    }
}
