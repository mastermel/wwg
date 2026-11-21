using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Wwg.Api.Data;
using Wwg.Api.Data.Entities;
using Wwg.Api.Features.Maps;
using Wwg.Api.Features.Turns;
using Wwg.Api.Infrastructure.Auth;

namespace Wwg.Api.Features.Intelligence;

/// <summary>
/// Intelligence between allies, by courier (step 49c, decision 0020), and from the Umpire (step 70,
/// decision 0035).
/// </summary>
internal static class IntelEndpoints
{
    public static IEndpointRouteBuilder MapIntelEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/armies/{id:guid}/reports", SendReportAsync)
            .WithName("SendReport")
            .WithTags("Intelligence")
            .RequireCampaignAccess(CampaignAccess.Commander, CampaignRouteId.Army)
            .ProducesProblem(StatusCodes.Status409Conflict);
        app.MapPost("/api/armies/{id:guid}/umpire-reports", SendUmpireReportAsync)
            .WithName("SendUmpireReport")
            .WithTags("Intelligence")
            .RequireCampaignAccess(CampaignAccess.Umpire, CampaignRouteId.Army)
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
    /// Sends an ally a report (the army's commander, or the Umpire on its behalf): a hand-written
    /// message (decision 0037). A courier
    /// sets out from the army's Commander in Chief for the ally's (both armies need one); within
    /// two turns' ride, it arrives as the next turn starts. Not to an army with the same commander
    /// (decision 0036).
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
        var report = db
            .IntelReports.Add(
                Couriers.NewReport(id, request, open.Number, from, rides.TurnsTo(from, to))
            )
            .Entity;
        await db.SaveChangesAsync(cancellationToken);
        return TypedResults.Created(
            $"/api/reports/{report.Id}",
            ToResponse(grid, report, sender: true)
        );
    }

    /// <summary>
    /// Sends the army the Umpire's own report (Umpire or Admin; decision 0035), arriving at once
    /// with no courier: a note, where the chosen units of its side are, and sightings of the chosen
    /// units of the other side, each as the open turn started. Only once the campaign is under way.
    /// </summary>
    internal static async Task<
        Results<Created<ReportResponse>, ValidationProblem, ProblemHttpResult>
    > SendUmpireReportAsync(
        Guid id,
        SendUmpireReportRequest request,
        WwgDbContext db,
        HttpContext httpContext,
        CancellationToken cancellationToken
    )
    {
        var campaignId = httpContext.CampaignContext().CampaignId;
        var open = await TurnRules.OpenTurnAsync(db, campaignId, cancellationToken);
        var grid = await CampaignMaps.GridAsync(db, campaignId, cancellationToken);
        if (open is not { Number: > 0 } || grid is null)
        {
            return TypedResults.Problem(
                statusCode: StatusCodes.Status409Conflict,
                title: "Not under way",
                detail: "Intelligence goes out once the campaign is under way."
            );
        }

        var side = await db
            .Armies.Where(a => a.Id == id)
            .Select(a => (Guid?)a.SideId)
            .SingleOrDefaultAsync(cancellationToken);
        if (side is not { } sideId)
        {
            return TypedResults.Problem(statusCode: StatusCodes.Status404NotFound);
        }

        var (now, _) = await Whereabouts.LoadAsync(db, campaignId, cancellationToken);
        if (UmpireReports.Problem(request, sideId, now) is var (field, message))
        {
            return Invalid(field, message);
        }

        var (report, sightings) = UmpireReports.New(id, request, open.Number, now);
        db.Sightings.AddRange(sightings);
        db.IntelReports.Add(report);
        await db.SaveChangesAsync(cancellationToken);
        return TypedResults.Created(
            $"/api/reports/{report.Id}",
            ToResponse(grid, report, sender: false)
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
                r.ToArmy.CampaignId == id
                && (
                    context.CanManage
                    || (r.FromArmy != null && r.FromArmy.CommanderId == context.MemberId)
                    || (
                        r.ToArmy.CommanderId == context.MemberId
                        && r.Status == CourierStatus.Arrived
                    )
                )
            )
            .Select(r => new
            {
                Report = r,
                Sender = r.FromArmy != null && r.FromArmy.CommanderId == context.MemberId,
            })
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
            .Where(r => r.ToArmy.CampaignId == id && !r.FromUmpire)
            .Select(r => new CourierRow(
                r,
                r.ToArmy.SideId,
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
        // Only allies' reports have couriers (the Umpire's are left out above), and they have a sender.
        var from = report.FromArmyId.GetValueOrDefault();
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
            from,
            report.ToArmyId,
            chiefs.GetValueOrDefault(from),
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

    /// <summary>
    /// Why a report to that army won't do, or null: an ally with another commander.
    /// </summary>
    private static async Task<ValidationProblem?> RecipientProblemAsync(
        WwgDbContext db,
        Guid campaignId,
        Guid armyId,
        SendReportRequest request,
        CancellationToken cancellationToken
    )
    {
        var armies = await db
            .Armies.AsNoTracking()
            .Where(a => a.CampaignId == campaignId && (a.Id == armyId || a.Id == request.ToArmyId))
            .ToDictionaryAsync(a => a.Id, a => new { a.SideId, a.CommanderId }, cancellationToken);
        if (
            request.ToArmyId == armyId
            || !armies.TryGetValue(request.ToArmyId, out var to)
            || to.SideId != armies[armyId].SideId
        )
        {
            return Invalid("toArmyId", "Send it to another army of your side.");
        }

        // One Player's armies already know what each other knows (decision 0036).
        return to.CommanderId is not null && to.CommanderId == armies[armyId].CommanderId
            ? Invalid("toArmyId", "You command that army too: it knows what yours does.")
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
            report.FromUmpire,
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
                                u.Points,
                                // Before decision 0035, a snapshot was always of the sender's units.
                                u.ArmyId
                                    ?? report.FromArmyId.GetValueOrDefault()
                            );
                        }),
                ],
            report.SightingIds.Count
        );
}
