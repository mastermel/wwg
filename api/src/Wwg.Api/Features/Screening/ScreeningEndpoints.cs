using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Wwg.Api.Data;
using Wwg.Api.Infrastructure;
using Wwg.Api.Infrastructure.Auth;

namespace Wwg.Api.Features.Screening;

/// <summary>A unit's screening (decision 0026).</summary>
internal static class ScreeningEndpoints
{
    public static IEndpointRouteBuilder MapScreeningEndpoints(this IEndpointRouteBuilder app)
    {
        // Whether a unit screens is its own side's secret: the enemy learns only what's sighted.
        var unit = app.MapGroup("/api/army-units/{id:guid}/screening").WithTags("Screening");
        unit.MapGet("", GetScreeningAsync)
            .WithName("GetScreening")
            .RequireCampaignAccess(CampaignAccess.Commander, CampaignRouteId.ArmyUnit);
        unit.MapPut("", UpdateScreeningAsync)
            .WithName("UpdateScreening")
            .RequireCampaignAccess(CampaignAccess.Commander, CampaignRouteId.ArmyUnit)
            .ProducesProblem(StatusCodes.Status409Conflict);
        return app;
    }

    /// <summary>
    /// The unit's screening (its commander, the Umpire or an Admin): whether it can, whether it
    /// is, and the turns it closed screening.
    /// </summary>
    internal static async Task<Ok<ScreeningResponse>> GetScreeningAsync(
        Guid id,
        WwgDbContext db,
        CancellationToken cancellationToken
    ) => TypedResults.Ok(await ResponseAsync(db, id, cancellationToken));

    /// <summary>
    /// Turns the unit's screening on or off (its commander, the Umpire or an Admin), at any time:
    /// it stays so until turned back. Only light infantry and light or medium cavalry can screen
    /// (409).
    /// </summary>
    internal static async Task<
        Results<Ok<ScreeningResponse>, ProblemHttpResult>
    > UpdateScreeningAsync(
        Guid id,
        UpdateScreeningRequest request,
        WwgDbContext db,
        CancellationToken cancellationToken
    )
    {
        var unit = await db.ArmyUnits.Where(u => u.Id == id).SingleOrGoneAsync(cancellationToken);
        if (request.Screening && !Screens.Types.Contains(unit.Type))
        {
            return TypedResults.Problem(
                statusCode: StatusCodes.Status409Conflict,
                title: "Can't screen",
                detail: "Only light infantry and light or medium cavalry can screen."
            );
        }

        unit.Screening = request.Screening;
        await db.SaveChangesAsync(cancellationToken);
        return TypedResults.Ok(await ResponseAsync(db, id, cancellationToken));
    }

    private static async Task<ScreeningResponse> ResponseAsync(
        WwgDbContext db,
        Guid id,
        CancellationToken cancellationToken
    )
    {
        var unit = await db
            .ArmyUnits.AsNoTracking()
            .Where(u => u.Id == id)
            .Select(u => new { u.Type, u.Screening })
            .SingleOrGoneAsync(cancellationToken);
        var turns = await db
            .ScreeningTurns.AsNoTracking()
            .Where(s => s.ArmyUnitId == id)
            .OrderBy(s => s.Turn)
            .Select(s => s.Turn)
            .ToListAsync(cancellationToken);
        return new(Screens.Types.Contains(unit.Type), unit.Screening, turns);
    }
}
