using System.Linq.Expressions;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Wwg.Api.Data;
using Wwg.Api.Data.Entities;
using Wwg.Api.Features.Screening;
using Wwg.Api.Features.Turns;
using Wwg.Api.Infrastructure;
using Wwg.Api.Infrastructure.Auth;

namespace Wwg.Api.Features.ArmyUnits;

internal static class ArmyUnitEndpoints
{
    public static IEndpointRouteBuilder MapArmyUnitEndpoints(this IEndpointRouteBuilder app)
    {
        // Every member sees every unit: with its army (GET /api/armies/{id}), or all the
        // campaign's at once (for the map). Changing them is the Umpire's (or an Admin's) job.
        app.MapGet("/api/campaigns/{id:guid}/units", ListCampaignUnitsAsync)
            .WithName("ListCampaignUnits")
            .WithTags("ArmyUnits")
            .RequireCampaignAccess(CampaignAccess.Member);
        // A campaign only chooses from the library (decision 0015).
        app.MapPost("/api/armies/{id:guid}/units", AddArmyUnitsAsync)
            .WithName("AddArmyUnits")
            .WithTags("ArmyUnits")
            .RequireCampaignAccess(CampaignAccess.Umpire, CampaignRouteId.Army)
            .ProducesProblem(StatusCodes.Status409Conflict);
        // ...but for its scouts, which are its own (decision 0028).
        app.MapPost("/api/armies/{id:guid}/scouts", AddScoutAsync)
            .WithName("AddScout")
            .WithTags("ArmyUnits")
            .RequireCampaignAccess(CampaignAccess.Umpire, CampaignRouteId.Army);
        // Where the player is (decision 0032): the Umpire's to say, not the commander's.
        app.MapPut("/api/armies/{id:guid}/commander-in-chief", UpdateCommanderInChiefAsync)
            .WithName("UpdateCommanderInChief")
            .WithTags("ArmyUnits")
            .RequireCampaignAccess(CampaignAccess.Umpire, CampaignRouteId.Army)
            .ProducesProblem(StatusCodes.Status409Conflict);

        var unit = app.MapGroup("/api/army-units/{id:guid}").WithTags("ArmyUnits");
        unit.MapPut("", UpdateArmyUnitAsync)
            .WithName("UpdateArmyUnit")
            .RequireCampaignAccess(CampaignAccess.Umpire, CampaignRouteId.ArmyUnit);
        unit.MapGet("/points", ListPointsHistoryAsync)
            .WithName("ListPointsHistory")
            .RequireCampaignAccess(CampaignAccess.Member, CampaignRouteId.ArmyUnit);
        unit.MapDelete("", DeleteArmyUnitAsync)
            .WithName("DeleteArmyUnit")
            .RequireCampaignAccess(CampaignAccess.Umpire, CampaignRouteId.ArmyUnit);

        return app;
    }

    /// <summary>
    /// Every unit in the campaign, sorted by army then name (every member): what the map draws
    /// where it may (positions follow the visibility rule).
    /// </summary>
    internal static async Task<Ok<List<ArmyUnitResponse>>> ListCampaignUnitsAsync(
        Guid id,
        WwgDbContext db,
        CancellationToken cancellationToken
    )
    {
        var units = await db
            .ArmyUnits.AsNoTracking()
            .Where(u => u.Army.CampaignId == id)
            .OrderBy(u => u.Army.Name)
            .ThenBy(u => u.Name)
            .ThenBy(u => u.Id)
            .Select(ArmyUnitProjection.ToResponse)
            .ToListAsync(cancellationToken);
        return TypedResults.Ok(units);
    }

    /// <summary>
    /// Adds library units to the army (Umpire or Admin), each as the campaign's own copy. Only
    /// units from the army's factions (409), and none already in the campaign (409).
    /// </summary>
    internal static async Task<
        Results<Ok<List<ArmyUnitResponse>>, ValidationProblem, ProblemHttpResult>
    > AddArmyUnitsAsync(
        Guid id,
        AddArmyUnitsRequest request,
        WwgDbContext db,
        HttpContext httpContext,
        CancellationToken cancellationToken
    )
    {
        var campaignId = httpContext.CampaignContext().CampaignId;
        var ids = request.UnitIds.Distinct().ToList();
        var units = await db
            .Units.AsNoTracking()
            .Where(u => ids.Contains(u.Id))
            .ToListAsync(cancellationToken);
        if (units.Count != ids.Count)
        {
            return TypedResults.ValidationProblem(
                new Dictionary<string, string[]>(StringComparer.Ordinal)
                {
                    ["unitIds"] = ["There's no such unit in the library."],
                }
            );
        }

        if (await RefusedAsync(db, id, campaignId, units, cancellationToken) is { } refused)
        {
            return refused;
        }

        var added = units
            .Select(u => new ArmyUnit
            {
                ArmyId = id,
                CampaignId = campaignId,
                UnitId = u.Id,
                Name = u.Name,
                Type = u.Type,
                FightingFactor = u.FightingFactor,
                Points = u.Points,
                Division = u.Division,
                Brigade = u.Brigade,
                Corps = u.Corps,
                CorpsCommander = u.CorpsCommander,
                DivisionCommander = u.DivisionCommander,
                BrigadeCommander = u.BrigadeCommander,
                ImportOrder = u.ImportOrder,
            })
            .ToList();
        db.ArmyUnits.AddRange(added);
        await db.SaveChangesAsync(cancellationToken);

        var addedIds = added.Select(u => u.Id).ToList();
        return TypedResults.Ok(
            await db
                .ArmyUnits.AsNoTracking()
                .Where(u => addedIds.Contains(u.Id))
                .OrderBy(u => u.Name)
                .ThenBy(u => u.Id)
                .Select(ArmyUnitProjection.ToResponse)
                .ToListAsync(cancellationToken)
        );
    }

    /// <summary>
    /// Adds a scout to the army (Umpire or Admin): the campaign's own unit, with no library unit,
    /// FF or points (decision 0028). Placed like any unit added later.
    /// </summary>
    internal static async Task<Ok<ArmyUnitResponse>> AddScoutAsync(
        Guid id,
        AddScoutRequest request,
        WwgDbContext db,
        HttpContext httpContext,
        CancellationToken cancellationToken
    )
    {
        var scout = new ArmyUnit
        {
            ArmyId = id,
            CampaignId = httpContext.CampaignContext().CampaignId,
            Name = request.Name,
            Type = UnitType.Scouts,
            FightingFactor = 0,
            Points = 0,
        };
        db.ArmyUnits.Add(scout);
        await db.SaveChangesAsync(cancellationToken);
        return TypedResults.Ok(
            await db
                .ArmyUnits.AsNoTracking()
                .Where(u => u.Id == scout.Id)
                .Select(ArmyUnitProjection.ToResponse)
                .SingleAsync(cancellationToken)
        );
    }

    /// <summary>
    /// Makes one of the army's Commander units its Commander in Chief (Umpire or Admin), at any
    /// time; the one before, if any, no longer is. Null leaves the army with none. Another army's
    /// unit is refused (400), as is a unit of another type (409).
    /// </summary>
    internal static async Task<
        Results<NoContent, ValidationProblem, ProblemHttpResult>
    > UpdateCommanderInChiefAsync(
        Guid id,
        UpdateCommanderInChiefRequest request,
        WwgDbContext db,
        TimeProvider time,
        CancellationToken cancellationToken
    )
    {
        if (request.UnitId is { } unitId)
        {
            var type = await db
                .ArmyUnits.Where(u => u.Id == unitId && u.ArmyId == id)
                .Select(u => (UnitType?)u.Type)
                .SingleOrDefaultAsync(cancellationToken);
            if (type is null)
            {
                return TypedResults.ValidationProblem(
                    new Dictionary<string, string[]>(StringComparer.Ordinal)
                    {
                        ["unitId"] = ["There's no such unit in this army."],
                    }
                );
            }
            if (type != UnitType.Commander)
            {
                return TypedResults.Problem(
                    statusCode: StatusCodes.Status409Conflict,
                    title: "Not a commander",
                    detail: "Only a Commander unit can be the Commander in Chief."
                );
            }
        }

        // The last one goes first, or the index (one per army) would refuse the new one.
        var now = time.GetUtcNow().UtcDateTime;
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        await db
            .ArmyUnits.Where(u => u.ArmyId == id && u.IsCommanderInChief && u.Id != request.UnitId)
            .ExecuteUpdateAsync(
                set =>
                    set.SetProperty(u => u.IsCommanderInChief, false)
                        .SetProperty(u => u.UpdatedAt, now),
                cancellationToken
            );
        if (request.UnitId is { } chosen)
        {
            await db
                .ArmyUnits.Where(u => u.Id == chosen && !u.IsCommanderInChief)
                .ExecuteUpdateAsync(
                    set =>
                        set.SetProperty(u => u.IsCommanderInChief, true)
                            .SetProperty(u => u.UpdatedAt, now),
                    cancellationToken
                );
        }
        await transaction.CommitAsync(cancellationToken);
        return TypedResults.NoContent();
    }

    /// <summary>
    /// 409 unless every unit is from the army's factions, and none is in the campaign already.
    /// </summary>
    private static async Task<ProblemHttpResult?> RefusedAsync(
        WwgDbContext db,
        Guid armyId,
        Guid campaignId,
        List<Unit> units,
        CancellationToken cancellationToken
    )
    {
        var factions = await db
            .ArmyFactions.Where(f => f.ArmyId == armyId)
            .Select(f => f.FactionId)
            .ToListAsync(cancellationToken);
        var outside = units
            .Where(u => !factions.Contains(u.FactionId))
            .Select(u => u.Name)
            .ToList();
        if (outside.Count > 0)
        {
            return TypedResults.Problem(
                statusCode: StatusCodes.Status409Conflict,
                title: "Not from the army's factions",
                detail: $"Choose the army's factions first: {string.Join(", ", outside)}."
            );
        }

        var ids = units.Select(u => u.Id).ToList();
        var taken = await db
            .ArmyUnits.Where(u =>
                u.CampaignId == campaignId && u.UnitId != null && ids.Contains(u.UnitId.Value)
            )
            .Select(u => u.Name)
            .ToListAsync(cancellationToken);
        return taken.Count == 0
            ? null
            : TypedResults.Problem(
                statusCode: StatusCodes.Status409Conflict,
                title: "Already in the campaign",
                detail: $"Already in this campaign: {string.Join(", ", taken)}."
            );
    }

    /// <summary>
    /// Changes the campaign's copy of a unit: name, type, Fighting Factor, points, and its corps,
    /// division and brigade with their commanders (Umpire or Admin). The library unit stays as it
    /// is. A scout stays a scout, with no FF or points, and no other unit becomes one; a Commander
    /// has no FF or points either (decision 0034).
    /// </summary>
    internal static async Task<
        Results<Ok<ArmyUnitResponse>, ValidationProblem>
    > UpdateArmyUnitAsync(
        Guid id,
        UpdateArmyUnitRequest request,
        WwgDbContext db,
        HttpContext httpContext,
        CancellationToken cancellationToken
    )
    {
        var unit = await db.ArmyUnits.Where(u => u.Id == id).SingleOrGoneAsync(cancellationToken);
        if (ScoutProblems(unit.Type, request) is { Count: > 0 } problems)
        {
            return TypedResults.ValidationProblem(problems);
        }

        // A Commander has no FF or points (decision 0034), whatever was sent; a scout's are
        // checked to be 0 above.
        var stats = UnitStats.HasStats(request.Type);
        var fightingFactor = stats ? request.FightingFactor : 0;
        var points = stats ? request.Points : 0;

        // Once the campaign has started, a change to its points goes in its history (decision 0018).
        var open = await TurnRules.OpenTurnAsync(db, unit.CampaignId, cancellationToken);
        if (open is { Number: > 0 } && points != unit.Points)
        {
            db.PointsChanges.Add(
                new PointsChange
                {
                    ArmyUnitId = id,
                    Turn = open.Number,
                    Change = points - unit.Points,
                    PointsAfter = points,
                    Reason = PointsChangeReason.Edited,
                    ByUserId = httpContext.User.GetUserId(),
                }
            );
        }

        unit.Name = request.Name;
        unit.Type = request.Type;
        // Only some types screen (decision 0026), and only a Commander leads the army (0032).
        unit.Screening &= Screens.Types.Contains(request.Type);
        unit.IsCommanderInChief &= request.Type == UnitType.Commander;
        unit.FightingFactor = fightingFactor;
        unit.Points = points;
        unit.Division = UnitGroups.Normalize(request.Division);
        unit.Brigade = UnitGroups.Normalize(request.Brigade);
        unit.Corps = UnitGroups.Normalize(request.Corps);
        unit.CorpsCommander = UnitGroups.Normalize(request.CorpsCommander);
        unit.DivisionCommander = UnitGroups.Normalize(request.DivisionCommander);
        unit.BrigadeCommander = UnitGroups.Normalize(request.BrigadeCommander);
        await db.SaveChangesAsync(cancellationToken);
        return TypedResults.Ok(
            await db
                .ArmyUnits.AsNoTracking()
                .Where(u => u.Id == id)
                .Select(ArmyUnitProjection.ToResponse)
                .SingleAsync(cancellationToken)
        );
    }

    /// <summary>
    /// What a change to a unit would break of the scouts' rules (decision 0028): only the
    /// campaign makes scouts, and a scout doesn't fight; every other unit but a Commander has an
    /// FF.
    /// </summary>
    private static Dictionary<string, string[]> ScoutProblems(
        UnitType type,
        UpdateArmyUnitRequest request
    )
    {
        var problems = new Dictionary<string, string[]>(StringComparer.Ordinal);
        var scout = type == UnitType.Scouts;
        if (scout != (request.Type == UnitType.Scouts))
        {
            problems["type"] =
            [
                scout ? "A scout stays a scout." : "Only scouts added to the army are scouts.",
            ];
        }
        else if (scout)
        {
            if (request.FightingFactor != 0)
            {
                problems["fightingFactor"] = ["A scout doesn't fight: its FF is 0."];
            }
            if (request.Points != 0)
            {
                problems["points"] = ["A scout doesn't fight: its points are 0."];
            }
        }
        else if (UnitStats.FightingFactorTooLow(request.Type, request.FightingFactor))
        {
            problems["fightingFactor"] =
            [
                $"The FF is {UnitStats.MinFightingFactor}–{UnitStats.MaxFightingFactor}.",
            ];
        }

        return problems;
    }

    /// <summary>
    /// The unit's points history once the campaign started, oldest first (every member, as they
    /// see its points): each change, its turn, and why.
    /// </summary>
    internal static async Task<Ok<List<PointsChangeResponse>>> ListPointsHistoryAsync(
        Guid id,
        WwgDbContext db,
        CancellationToken cancellationToken
    ) =>
        TypedResults.Ok(
            await db
                .PointsChanges.AsNoTracking()
                .Where(c => c.ArmyUnitId == id)
                .OrderBy(c => c.CreatedAt)
                .ThenBy(c => c.Id)
                .Select(c => new PointsChangeResponse(
                    c.Turn,
                    c.Change,
                    c.PointsAfter,
                    c.Reason,
                    c.Note,
                    c.ByUser == null ? null : c.ByUser.FirstName + " " + c.ByUser.LastName,
                    c.CreatedAt
                ))
                .ToListAsync(cancellationToken)
        );

    /// <summary>
    /// Removes a unit from the army (Umpire or Admin), while the campaign is setting up; the
    /// library unit stays.
    /// </summary>
    internal static async Task<Results<NoContent, ProblemHttpResult>> DeleteArmyUnitAsync(
        Guid id,
        WwgDbContext db,
        HttpContext httpContext,
        CancellationToken cancellationToken
    )
    {
        if (
            await TurnRules.HasStartedAsync(
                db,
                httpContext.CampaignContext().CampaignId,
                cancellationToken
            )
        )
        {
            return TurnRules.CantDeleteAfterTheStart("unit");
        }

        // While setting up, its only history is its placement.
        await db.UnitOrders.Where(o => o.UnitId == id).ExecuteDeleteAsync(cancellationToken);
        await db.ArmyUnits.Where(u => u.Id == id).ExecuteDeleteAsync(cancellationToken);
        return TypedResults.NoContent();
    }
}

/// <summary>An army unit as the API gives it, in queries (EF Core turns it into SQL).</summary>
internal static class ArmyUnitProjection
{
    public static readonly Expression<Func<ArmyUnit, ArmyUnitResponse>> ToResponse =
        u => new ArmyUnitResponse(
            u.Id,
            u.ArmyId,
            u.UnitId,
            u.Unit == null ? null : u.Unit.FactionId,
            // It marches as its faction's nation (step 45), or its army's if the faction has none
            // (or it has no faction: a boat built in the campaign).
            u.Unit != null
            && u.Unit.Faction.Nation != Nation.None
                ? u.Unit.Faction.Nation
                : u.Army.Nation,
            u.Name,
            u.Type,
            u.FightingFactor,
            u.Points,
            u.Division,
            u.Brigade,
            u.Corps,
            u.CorpsCommander,
            u.DivisionCommander,
            u.BrigadeCommander,
            u.ImportOrder,
            u.IsCommanderInChief
        );
}
