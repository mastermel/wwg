using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Wwg.Api.Data;
using Wwg.Api.Data.Entities;
using Wwg.Api.Features.Maps;
using Wwg.Api.Features.Turns;
using Wwg.Api.Infrastructure.Auth;

namespace Wwg.Api.Features.Intelligence;

/// <summary>Intelligence between allies, by courier (step 49c, decision 0020).</summary>
internal static class IntelEndpoints
{
    public static IEndpointRouteBuilder MapIntelEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/armies/{id:guid}/reports", SendReportAsync)
            .WithName("SendReport")
            .WithTags("Intelligence")
            .RequireCampaignAccess(CampaignAccess.Commander, CampaignRouteId.Army)
            .ProducesProblem(StatusCodes.Status409Conflict);
        app.MapGet("/api/campaigns/{id:guid}/reports", ListReportsAsync)
            .WithName("ListReports")
            .WithTags("Intelligence")
            .RequireCampaignAccess(CampaignAccess.Member);
        app.MapGet("/api/campaigns/{id:guid}/couriers", ListCouriersAsync)
            .WithName("ListCouriers")
            .WithTags("Intelligence")
            .RequireCampaignAccess(CampaignAccess.Umpire);
        app.MapPost("/api/reports/{id:guid}/stop", StopCourierAsync)
            .WithName("StopCourier")
            .WithTags("Intelligence")
            .RequireCampaignAccess(CampaignAccess.Umpire, CampaignRouteId.Report)
            .ProducesProblem(StatusCodes.Status409Conflict);
        return app;
    }

    /// <summary>
    /// Sends an ally a report (the army's commander, or the Umpire on its behalf): any of a
    /// snapshot of the army's units, every sighting it has received so far, and a note. A courier
    /// sets out from the army's Commander in Chief for the ally's (both armies need one); within
    /// two turns' ride, it arrives as the next turn starts.
    /// </summary>
    internal static async Task<
        Results<Created<ReportResponse>, ValidationProblem, ProblemHttpResult>
    > SendReportAsync(
        Guid id,
        SendReportRequest request,
        WwgDbContext db,
        HttpContext httpContext,
        CancellationToken cancellationToken
    )
    {
        var campaignId = httpContext.CampaignContext().CampaignId;
        if (
            await RecipientProblemAsync(db, campaignId, id, request, cancellationToken) is
            { } problem
        )
        {
            return problem;
        }

        var open = await TurnRules.OpenTurnAsync(db, campaignId, cancellationToken);
        var (now, _) = await Whereabouts.LoadAsync(db, campaignId, cancellationToken);
        var grid = await CampaignMaps.GridAsync(db, campaignId, cancellationToken);
        if (open is not { Number: > 0 } || grid is null)
        {
            return TypedResults.Problem(
                statusCode: StatusCodes.Status409Conflict,
                title: "No way to send it",
                detail: "A courier needs the campaign under way."
            );
        }

        if (
            Couriers.CommanderInChiefOf(now, id) is not { } from
            || Couriers.CommanderInChiefOf(now, request.ToArmyId) is not { } to
        )
        {
            return TypedResults.Problem(
                statusCode: StatusCodes.Status409Conflict,
                title: "No Commander in Chief",
                detail: "A courier rides from your Commander in Chief to theirs: both armies "
                    + "need one on the map, which the Umpire chooses."
            );
        }

        var rides = await CourierRides.LoadAsync(db, grid, campaignId, cancellationToken);
        var sightings = request.IncludesSightings
            ? await db
                .Sightings.Where(s => s.ObservingArmyId == id)
                .Select(s => s.Id)
                .ToListAsync(cancellationToken)
            : [];
        var report = db
            .IntelReports.Add(
                Couriers.NewReport(
                    id,
                    request,
                    open.Number,
                    now,
                    sightings,
                    from,
                    rides.TurnsTo(from, to)
                )
            )
            .Entity;
        await db.SaveChangesAsync(cancellationToken);
        return TypedResults.Created(
            $"/api/reports/{report.Id}",
            ToResponse(grid, report, sender: true)
        );
    }

    /// <summary>
    /// The reports the viewer may see, newest first: those their armies sent (without whether
    /// they've arrived), and those that have reached them; the Umpire's, all.
    /// </summary>
    internal static async Task<Ok<List<ReportResponse>>> ListReportsAsync(
        Guid id,
        WwgDbContext db,
        HttpContext httpContext,
        CancellationToken cancellationToken
    )
    {
        var context = httpContext.CampaignContext();
        var grid = await CampaignMaps.GridAsync(db, id, cancellationToken);
        var reports = await db
            .IntelReports.AsNoTracking()
            .Where(r =>
                r.FromArmy.CampaignId == id
                && (
                    context.CanManage
                    || r.FromArmy.CommanderId == context.MemberId
                    || (
                        r.ToArmy.CommanderId == context.MemberId
                        && r.Status == CourierStatus.Arrived
                    )
                )
            )
            .Select(r => new { Report = r, Sender = r.FromArmy.CommanderId == context.MemberId })
            .ToListAsync(cancellationToken);
        return TypedResults.Ok(
            reports
                .OrderByDescending(r => r.Report.SentTurn)
                .ThenByDescending(r => r.Report.CreatedAt)
                .Select(r => ToResponse(grid, r.Report, r.Sender && !context.CanManage))
                .ToList()
        );
    }

    /// <summary>
    /// Every courier (Umpire or Admin), newest first: where each on its way is, whether the
    /// other side's units are in its hex, how far it has to ride and why it waits, for the Umpire
    /// to cancel it or let it through; and those that arrived or were cancelled, and why.
    /// </summary>
    internal static async Task<Ok<List<CourierResponse>>> ListCouriersAsync(
        Guid id,
        WwgDbContext db,
        CancellationToken cancellationToken
    )
    {
        var grid = await CampaignMaps.GridAsync(db, id, cancellationToken);
        if (grid is null)
        {
            return TypedResults.Ok(new List<CourierResponse>());
        }

        var reports = await db
            .IntelReports.AsNoTracking()
            .Where(r => r.FromArmy.CampaignId == id)
            .Select(r => new CourierRow(
                r,
                r.FromArmy.SideId,
                r.StoppedByUser == null
                    ? null
                    : r.StoppedByUser.FirstName + " " + r.StoppedByUser.LastName
            ))
            .ToListAsync(cancellationToken);
        var chiefs = await db
            .ArmyUnits.AsNoTracking()
            .Where(u => u.CampaignId == id && u.IsCommanderInChief)
            .ToDictionaryAsync(u => u.ArmyId, u => u.Name, cancellationToken);
        var (now, _) = await Whereabouts.LoadAsync(db, id, cancellationToken);
        var rides = reports.Any(r => r.Report.Status == CourierStatus.EnRoute)
            ? await CourierRides.LoadAsync(db, grid, id, cancellationToken)
            : null;
        return TypedResults.Ok(
            reports
                .OrderByDescending(r => r.Report.SentTurn)
                .ThenByDescending(r => r.Report.CreatedAt)
                .Select(r => ToCourier(grid, r, chiefs, now, rides))
                .ToList()
        );
    }

    private sealed record CourierRow(IntelReport Report, Guid SideId, string? StoppedBy);

    /// <summary>A courier as the Umpire sees it: how far it has to ride, and why it waits, as the units are now.</summary>
    private static CourierResponse ToCourier(
        HexGrid grid,
        CourierRow row,
        Dictionary<Guid, string> chiefs,
        List<UnitPlace> now,
        CourierRides? rides
    )
    {
        var report = row.Report;
        var at = new Hex(report.CourierQ, report.CourierR);
        var (latitude, longitude) = grid.Centre(at);
        var enRoute = report.Status == CourierStatus.EnRoute;
        var to = enRoute ? Couriers.CommanderInChiefOf(now, report.ToArmyId) : null;
        var turns = to is { } chief ? rides?.TurnsTo(at, chief) : null;
        CourierWaiting? waiting =
            !enRoute ? null
            : to is null ? CourierWaiting.NoCommanderInChief
            : turns is null ? CourierWaiting.NoWay
            : null;
        return new CourierResponse(
            report.Id,
            report.FromArmyId,
            report.ToArmyId,
            chiefs.GetValueOrDefault(report.FromArmyId),
            chiefs.GetValueOrDefault(report.ToArmyId),
            report.SentTurn,
            report.Status,
            at.Q,
            at.R,
            latitude,
            longitude,
            enRoute && report.ArrivesNext,
            enRoute && now.Any(p => p.At == at && p.SideId != row.SideId),
            turns,
            waiting,
            report.ArrivedTurn,
            report.StoppedTurn,
            report.StoppedNote,
            row.StoppedBy,
            report.Note,
            report.Snapshot is not null,
            report.SightingIds.Count
        );
    }

    /// <summary>
    /// Cancels a courier on its way (Umpire or Admin), with why: captured or lost, it never
    /// arrives. Only the Umpire and Admins see the note.
    /// </summary>
    internal static async Task<Results<NoContent, ProblemHttpResult>> StopCourierAsync(
        Guid id,
        StopCourierRequest request,
        WwgDbContext db,
        HttpContext httpContext,
        TimeProvider time,
        CancellationToken cancellationToken
    )
    {
        var open = await TurnRules.OpenTurnAsync(
            db,
            httpContext.CampaignContext().CampaignId,
            cancellationToken
        );
        var userId = httpContext.User.GetUserId();
        var now = time.GetUtcNow().UtcDateTime;
        var stopped = await db
            .IntelReports.Where(r => r.Id == id && r.Status == CourierStatus.EnRoute)
            .ExecuteUpdateAsync(
                set =>
                    set.SetProperty(x => x.Status, CourierStatus.Stopped)
                        .SetProperty(x => x.StoppedTurn, open == null ? null : open.Number)
                        .SetProperty(x => x.StoppedNote, request.Note)
                        .SetProperty(x => x.StoppedByUserId, userId)
                        .SetProperty(x => x.UpdatedAt, now),
                cancellationToken
            );
        return stopped > 0
            ? TypedResults.NoContent()
            : TypedResults.Problem(
                statusCode: StatusCodes.Status409Conflict,
                title: "Not on its way",
                detail: "That courier has already arrived or been cancelled."
            );
    }

    /// <summary>Why a report to that army won't do, or null: an ally, with something to send.</summary>
    private static async Task<ValidationProblem?> RecipientProblemAsync(
        WwgDbContext db,
        Guid campaignId,
        Guid armyId,
        SendReportRequest request,
        CancellationToken cancellationToken
    )
    {
        var sides = await db
            .Armies.AsNoTracking()
            .Where(a => a.CampaignId == campaignId && (a.Id == armyId || a.Id == request.ToArmyId))
            .ToDictionaryAsync(a => a.Id, a => a.SideId, cancellationToken);
        if (
            request.ToArmyId == armyId
            || !sides.TryGetValue(request.ToArmyId, out var side)
            || side != sides[armyId]
        )
        {
            return Invalid("toArmyId", "Send it to another army of your side.");
        }

        return
            !request.IncludesSnapshot
            && !request.IncludesSightings
            && string.IsNullOrEmpty(request.Note)
            ? Invalid("note", "Send something: your units, your sightings or a note.")
            : null;
    }

    private static ValidationProblem Invalid(string field, string message) =>
        TypedResults.ValidationProblem(
            new Dictionary<string, string[]>(StringComparer.Ordinal) { [field] = [message] }
        );

    private static ReportResponse ToResponse(HexGrid? grid, IntelReport report, bool sender) =>
        new(
            report.Id,
            report.FromArmyId,
            report.ToArmyId,
            report.SentTurn,
            sender ? null : report.ArrivedTurn,
            // A sender isn't told whether it got there.
            sender ? null : report.Status,
            report.Note,
            report.Snapshot is null || grid is null
                ? null
                :
                [
                    .. Couriers
                        .ReadSnapshot(report.Snapshot)
                        .Select(u =>
                        {
                            var (latitude, longitude) = grid.Centre(new Hex(u.Q, u.R));
                            return new SnapshotUnitResponse(
                                u.Name,
                                u.Type,
                                u.Q,
                                u.R,
                                latitude,
                                longitude,
                                u.Points
                            );
                        }),
                ],
            report.SightingIds.Count
        );
}
