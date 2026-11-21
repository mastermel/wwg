using Microsoft.EntityFrameworkCore;
using Wwg.Api.Data;
using Wwg.Api.Data.Entities;
using Wwg.Api.Features.Maps;
using Wwg.Api.Features.Turns;

namespace Wwg.Api.Features.Sightings;

/// <summary>What the Umpire lets a sighting show (decision 0020).</summary>
internal sealed record SightingShape(
    bool ShowsHex,
    bool ShowsArmies,
    bool ShowsTypes,
    SightingStrength Strength,
    ForceSize? Size,
    bool ShowsAfloat
);

/// <summary>Keeping the sightings the Umpire shaped as a turn starts (step 49b, decision 0020).</summary>
internal static class SightingRecords
{
    /// <summary>
    /// Records each sighting the Umpire confirmed for the turn starting (not saved), with what was
    /// seen copied in from where the closing turn left the units, or says why one won't do. A
    /// sighting the app didn't find is the Umpire's own (spies, scouting parties).
    /// </summary>
    public static async Task<string?> ApplyAsync(
        WwgDbContext db,
        Guid campaignId,
        int turn,
        IReadOnlyList<SightingRequest> confirmed,
        CancellationToken cancellationToken
    )
    {
        if (confirmed.Count == 0)
        {
            return null;
        }

        var (_, next) = await Whereabouts.LoadAsync(db, campaignId, cancellationToken);
        var found = (await SightingEndpoints.DueAsync(db, campaignId, cancellationToken))
            .Select(c => (c.ObservingArmyId, c.At))
            .ToHashSet();
        var sides = await db
            .Armies.AsNoTracking()
            .Where(a => a.CampaignId == campaignId)
            .ToDictionaryAsync(a => a.Id, a => a.SideId, cancellationToken);
        foreach (
            var request in confirmed
                .GroupBy(r => (r.ObservingArmyId, r.Q, r.R))
                .Select(g => g.Last())
        )
        {
            if (!sides.TryGetValue(request.ObservingArmyId, out var side))
            {
                return "That army isn't in this campaign.";
            }

            var hex = new Hex(request.Q, request.R);
            var there = next.Where(p => p.At == hex && p.SideId != side).ToList();
            var seen = request.PastScreen ? there : Sight.Screen(there).Seen;
            if (seen.Count == 0)
            {
                return $"Hex ({request.Q}, {request.R}) holds none of the other side's units.";
            }
            if (request.Strength == SightingStrength.Rough && request.Size is null)
            {
                return "Give a rough size, or show the strength another way.";
            }

            db.Sightings.Add(Record(request, turn, hex, PointsNow(db, seen), next, found));
        }

        return null;
    }

    /// <summary>
    /// The seen units with the points this close leaves them: attrition has just changed the
    /// tracked units, not yet saved, which the positions (read from the database) don't show.
    /// </summary>
    private static List<UnitPlace> PointsNow(WwgDbContext db, List<UnitPlace> seen)
    {
        var points = db.ArmyUnits.Local.ToDictionary(u => u.Id, u => u.Points);
        return
        [
            .. seen.Select(p =>
                points.TryGetValue(p.UnitId, out var now) ? p with { Points = now } : p
            ),
        ];
    }

    private static Sighting Record(
        SightingRequest request,
        int turn,
        Hex hex,
        List<UnitPlace> seen,
        List<UnitPlace> places,
        HashSet<(Guid, Hex)> found
    ) =>
        New(
            request.ObservingArmyId,
            turn,
            hex,
            new SightingShape(
                request.ShowsHex,
                request.ShowsArmies,
                request.ShowsTypes,
                request.Strength,
                request.Size,
                request.ShowsAfloat
            ),
            seen,
            places,
            byUmpire: !found.Contains((request.ObservingArmyId, hex))
        );

    /// <summary>
    /// A sighting (not added) of the units seen in a hex, shaped as the Umpire chose: where it was
    /// roughly, from the observing army's nearest unit in <paramref name="places"/>.
    /// </summary>
    public static Sighting New(
        Guid observingArmyId,
        int turn,
        Hex hex,
        SightingShape shape,
        List<UnitPlace> seen,
        List<UnitPlace> places,
        bool byUmpire
    )
    {
        var observer = places
            .Where(p => p.ArmyId == observingArmyId)
            .MinBy(p => p.At.Distance(hex));
        return new Sighting
        {
            ObservingArmyId = observingArmyId,
            Turn = turn,
            Q = hex.Q,
            R = hex.R,
            ShowsHex = shape.ShowsHex,
            Whereabouts = observer is null ? "Reported to the army" : Sight.Roughly(hex, observer),
            ArmyIds = shape.ShowsArmies ? [.. seen.Select(p => p.ArmyId).Distinct()] : null,
            UnitTypes = shape.ShowsTypes ? [.. seen.Select(p => p.Type).Order()] : null,
            Strength = shape.Strength,
            Size = shape.Strength == SightingStrength.Rough ? shape.Size : null,
            Points = shape.Strength == SightingStrength.Exact ? seen.Sum(p => p.Points) : null,
            Afloat = shape.ShowsAfloat ? seen.Any(p => p.Afloat) : null,
            ByUmpire = byUmpire,
        };
    }
}
