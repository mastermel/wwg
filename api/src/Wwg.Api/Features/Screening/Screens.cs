using Microsoft.EntityFrameworkCore;
using Wwg.Api.Data;
using Wwg.Api.Data.Entities;

namespace Wwg.Api.Features.Screening;

/// <summary>Screening (the rules, §K.2; decision 0026).</summary>
internal static class Screens
{
    /// <summary>
    /// The types that can screen (§K.2). A unit changed to another type stops screening.
    /// </summary>
    public static readonly IReadOnlySet<UnitType> Types = new HashSet<UnitType>
    {
        UnitType.LightInfantry,
        UnitType.LightCavalry,
        UnitType.MediumCavalry,
    };

    /// <summary>
    /// Records the closing turn for each unit screening as it closes (not saved): the sightings
    /// for the next turn see the units as they stand now.
    /// </summary>
    public static async Task CloseTurnAsync(
        WwgDbContext db,
        Guid campaignId,
        int closing,
        CancellationToken cancellationToken
    )
    {
        var screening = await db
            .ArmyUnits.AsNoTracking()
            .Where(u => u.CampaignId == campaignId && u.Screening)
            .Select(u => u.Id)
            .ToListAsync(cancellationToken);
        db.ScreeningTurns.AddRange(
            screening.Select(id => new ScreeningTurn { ArmyUnitId = id, Turn = closing })
        );
    }
}
