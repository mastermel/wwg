using Wwg.Api.Data.Entities;
using Wwg.Api.Features.Sightings;
using Wwg.Api.Features.Turns;

namespace Wwg.Api.Features.Intelligence;

/// <summary>The Umpire's reports to an army (step 70, decision 0035).</summary>
internal static class UmpireReports
{
    /// <summary>
    /// Why the request won't do, as a field and a message, or null: positions of the recipient's
    /// side, sightings of the other side's units in one hex, and something to send.
    /// </summary>
    public static (string Field, string Message)? Problem(
        SendUmpireReportRequest request,
        Guid sideId,
        IReadOnlyList<UnitPlace> now
    )
    {
        var places = now.ToDictionary(p => p.UnitId);
        if (request.Positions.Any(id => !places.ContainsKey(id)))
        {
            return ("positions", "Choose units on the map, in this campaign.");
        }
        if (request.Positions.Any(id => places[id].SideId != sideId))
        {
            return (
                "positions",
                "Positions are of the army's own side: send the other side's as sightings."
            );
        }

        foreach (var sighting in request.Sightings)
        {
            if (sighting.UnitIds.Count == 0 || sighting.UnitIds.Any(id => !places.ContainsKey(id)))
            {
                return (
                    "sightings",
                    "Choose units on the map, in this campaign, for each sighting."
                );
            }
            var units = sighting.UnitIds.Select(id => places[id]).ToList();
            if (units.Any(u => u.SideId == sideId))
            {
                return (
                    "sightings",
                    "Sightings are of the other side: send the army's own side as positions."
                );
            }
            if (units.Select(u => u.At).Distinct().Count() > 1)
            {
                return ("sightings", "A sighting's units are all in one hex.");
            }
            if (sighting.Strength == SightingStrength.Rough && sighting.Size is null)
            {
                return ("sightings", "Give a rough size, or show the strength another way.");
            }
        }

        return
            request.Positions.Count == 0
            && request.Sightings.Count == 0
            && string.IsNullOrEmpty(request.Note)
            ? ("note", "Send something: positions, sightings or a note.")
            : null;
    }

    /// <summary>
    /// The report (not added) and its sightings (not added), from where the units stood as the open
    /// turn started, never where its orders take them.
    /// </summary>
    public static (IntelReport Report, List<Sighting> Sightings) New(
        Guid armyId,
        SendUmpireReportRequest request,
        int turn,
        List<UnitPlace> now
    )
    {
        var places = now.ToDictionary(p => p.UnitId);
        var sightings = request
            .Sightings.Select(s =>
            {
                var seen = s.UnitIds.Distinct().Select(id => places[id]).ToList();
                return SightingRecords.New(
                    armyId,
                    turn,
                    seen[0].At,
                    new SightingShape(
                        s.ShowsHex,
                        s.ShowsArmies,
                        s.ShowsTypes,
                        s.Strength,
                        s.Size,
                        s.ShowsAfloat
                    ),
                    seen,
                    now,
                    byUmpire: true
                );
            })
            .ToList();
        var report = new IntelReport
        {
            FromUmpire = true,
            ToArmyId = armyId,
            SentTurn = turn,
            ArrivedTurn = turn,
            Status = CourierStatus.Arrived,
            Note = string.IsNullOrEmpty(request.Note) ? null : request.Note,
            Snapshot =
                request.Positions.Count == 0
                    ? null
                    : Couriers.SnapshotOf(request.Positions.Distinct().Select(id => places[id])),
            SightingIds = [.. sightings.Select(s => s.Id)],
        };
        return (report, sightings);
    }
}
