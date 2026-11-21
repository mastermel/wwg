using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Wwg.Api.Data;
using Wwg.Api.Data.Entities;
using Wwg.Api.Features.Maps;
using Wwg.Api.Features.Turns;

namespace Wwg.Api.Features.Intelligence;

/// <summary>
/// A unit in a report's snapshot, as stored; its army since decision 0035 (before, always the
/// sender's).
/// </summary>
internal sealed record SnapshotUnit(
    string Name,
    UnitType Type,
    int Q,
    int R,
    int Points,
    Guid? ArmyId = null
);

/// <summary>Sending reports, and their couriers' rides as each turn closes (step 49c, decision 0020).</summary>
internal static class Couriers
{
    /// <summary>Within this many turns' ride, a report arrives as the next turn starts (§L: "two moves").</summary>
    public const double CloseByTurns = 2;

    /// <summary>Where the army's Commander in Chief is (decision 0033), or null: none, or not on the map.</summary>
    public static Hex? CommanderInChiefOf(IReadOnlyList<UnitPlace> places, Guid armyId) =>
        places.FirstOrDefault(p => p.ArmyId == armyId && p.IsCommanderInChief)?.At;

    /// <summary>A report as it sets out, with what it carries copied in (not added).</summary>
    public static IntelReport NewReport(
        Guid fromArmyId,
        SendReportRequest request,
        int turn,
        IReadOnlyList<UnitPlace> now,
        List<Guid> sightingIds,
        Hex from,
        double? turnsToRide
    ) =>
        new()
        {
            FromArmyId = fromArmyId,
            ToArmyId = request.ToArmyId,
            SentTurn = turn,
            Note = string.IsNullOrEmpty(request.Note) ? null : request.Note,
            Snapshot = request.IncludesSnapshot
                ? SnapshotOf(now.Where(p => p.ArmyId == fromArmyId))
                : null,
            SightingIds = sightingIds,
            Status = CourierStatus.EnRoute,
            CourierQ = from.Q,
            CourierR = from.R,
            ArrivesNext = turnsToRide is { } turns && turns <= CloseByTurns,
        };

    /// <summary>The snapshot a report carries: the units where they are now.</summary>
    public static string SnapshotOf(IEnumerable<UnitPlace> units) =>
        JsonSerializer.Serialize(
            units
                .OrderBy(u => u.Name, StringComparer.Ordinal)
                .Select(u => new SnapshotUnit(u.Name, u.Type, u.At.Q, u.At.R, u.Points, u.ArmyId))
                .ToList()
        );

    public static List<SnapshotUnit> ReadSnapshot(string snapshot) =>
        JsonSerializer.Deserialize<List<SnapshotUnit>>(snapshot) ?? [];

    /// <summary>
    /// Rides every courier on its way a turn on, towards the recipient's Commander in Chief where
    /// the closing turn leaves it (not saved); one that gets next to it (or was close by when
    /// sent) arrives for the turn starting, and the sightings it carries become the recipient's.
    /// With no Commander in Chief to ride to, a courier waits.
    /// </summary>
    public static async Task RideAsync(
        WwgDbContext db,
        Guid campaignId,
        int starting,
        CancellationToken cancellationToken
    )
    {
        var reports = await db
            .IntelReports.Where(r =>
                r.ToArmy.CampaignId == campaignId
                && !r.FromUmpire
                && r.Status == CourierStatus.EnRoute
            )
            .ToListAsync(cancellationToken);
        if (reports.Count == 0)
        {
            return;
        }

        var grid = await CampaignMaps.GridAsync(db, campaignId, cancellationToken);
        var (_, next) = await Whereabouts.LoadAsync(db, campaignId, cancellationToken);
        // Once for every courier: the whole grid's terrain.
        var rides = grid is null
            ? null
            : await CourierRides.LoadAsync(db, grid, campaignId, cancellationToken);
        foreach (var report in reports)
        {
            if (CommanderInChiefOf(next, report.ToArmyId) is not { } to)
            {
                // No one to deliver it to (removed, or another type now): it waits.
                continue;
            }

            if (!report.ArrivesNext && rides is not null)
            {
                var courier = rides.Ride(new Hex(report.CourierQ, report.CourierR), to);
                (report.CourierQ, report.CourierR) = (courier.Q, courier.R);
                report.ArrivesNext = courier.Distance(to) <= 1;
            }

            if (report.ArrivesNext)
            {
                await ArriveAsync(db, report, starting, cancellationToken);
            }
        }
    }

    /// <summary>Delivers a report (not saved): the recipient has it, and its sightings, from this turn.</summary>
    private static async Task ArriveAsync(
        WwgDbContext db,
        IntelReport report,
        int turn,
        CancellationToken cancellationToken
    )
    {
        report.Status = CourierStatus.Arrived;
        report.ArrivedTurn = turn;
        // Not the recipient's own, come back by way of an ally's report: it has them already.
        var sightings = await db
            .Sightings.AsNoTracking()
            .Where(s => report.SightingIds.Contains(s.Id) && s.SharedByArmyId != report.ToArmyId)
            .ToListAsync(cancellationToken);
        db.Sightings.AddRange(
            sightings.Select(s => new Sighting
            {
                ObservingArmyId = report.ToArmyId,
                Turn = s.Turn,
                Q = s.Q,
                R = s.R,
                ShowsHex = s.ShowsHex,
                Whereabouts = s.Whereabouts,
                ArmyIds = s.ArmyIds,
                UnitTypes = s.UnitTypes,
                Strength = s.Strength,
                Size = s.Size,
                Points = s.Points,
                Afloat = s.Afloat,
                ByUmpire = s.ByUmpire,
                SharedByArmyId = s.SharedByArmyId ?? report.FromArmyId,
            })
        );
    }
}
