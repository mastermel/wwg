using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;
using Wwg.Api.Data.Entities;
using Wwg.Api.Infrastructure;

namespace Wwg.Api.Features.ArmyUnits;

/// <summary>Adds library units to an army, from the factions it takes units from.</summary>
/// <param name="UnitIds">The library units: none already in the campaign.</param>
public sealed record AddArmyUnitsRequest(
    [property: Required, MinLength(1), MaxLength(100)] IReadOnlyList<Guid> UnitIds
);

/// <summary>Adds a scout to an army (decision 0028): the campaign's own, with no FF or points.</summary>
/// <param name="Name">The scout's name.</param>
public sealed record AddScoutRequest([property: Trimmed, Required, StringLength(100)] string Name);

// The numbers and type are [JsonRequired]: left out, they'd quietly read as 0 or Line Infantry.
// EnumDataType refuses a type sent as an undefined number (the enum converter accepts numbers).

/// <summary>Changes the campaign's copy of a unit (the library's stays as it is).</summary>
/// <param name="Name">The unit's name.</param>
/// <param name="Type">What kind of troops it is: a scout's stays Scouts, and no other unit becomes one.</param>
/// <param name="FightingFactor">Its Fighting Factor ("FF"), 1–9; 0 for a scout.</param>
/// <param name="Points">What it's worth, 0–100; 0 for a scout.</param>
/// <param name="Division">The division it's in (left out or empty: none).</param>
/// <param name="Brigade">The brigade it's in (left out or empty: none).</param>
/// <param name="Corps">The corps it's in (left out or empty: none).</param>
/// <param name="CorpsCommander">Who commands its corps (left out or empty: no one named).</param>
/// <param name="DivisionCommander">Who commands its division (left out or empty: no one named).</param>
/// <param name="BrigadeCommander">Who commands its brigade (left out or empty: no one named).</param>
public sealed record UpdateArmyUnitRequest(
    [property: Trimmed, Required, StringLength(100)] string Name,
    [property: JsonRequired, EnumDataType(typeof(UnitType))] UnitType Type,
    // A scout's is 0 (decision 0028): the handler holds every other unit to the minimum.
    [property: JsonRequired, Range(0, UnitStats.MaxFightingFactor)] int FightingFactor,
    [property: JsonRequired, Range(UnitStats.MinPoints, UnitStats.MaxPoints)] int Points,
    [property: Trimmed, StringLength(UnitStats.MaxGroupLength)] string? Division,
    [property: Trimmed, StringLength(UnitStats.MaxGroupLength)] string? Brigade,
    [property: Trimmed, StringLength(UnitStats.MaxGroupLength)] string? Corps,
    [property: Trimmed, StringLength(UnitStats.MaxGroupLength)] string? CorpsCommander,
    [property: Trimmed, StringLength(UnitStats.MaxGroupLength)] string? DivisionCommander,
    [property: Trimmed, StringLength(UnitStats.MaxGroupLength)] string? BrigadeCommander
);

/// <summary>A unit in an army: the campaign's copy of a library unit, a boat built or a scout.</summary>
/// <param name="Id">The unit's ID.</param>
/// <param name="ArmyId">The army it's in.</param>
/// <param name="UnitId">The library unit it was copied from; null for a boat built in the campaign, or a scout.</param>
/// <param name="FactionId">That library unit's faction; null for a built boat or a scout.</param>
/// <param name="Nation">The nation it marches as (step 45): its faction's, or its army's when the faction has none.</param>
/// <param name="Name">Its name.</param>
/// <param name="Type">What kind of troops it is.</param>
/// <param name="FightingFactor">Its Fighting Factor ("FF"), 1–9; 0 for a scout, which doesn't fight.</param>
/// <param name="Points">What it's worth, 0–100; 0 for a scout.</param>
/// <param name="Division">The division it's in; null for none.</param>
/// <param name="Brigade">The brigade it's in; null for none.</param>
/// <param name="Corps">The corps it's in; null for none.</param>
/// <param name="CorpsCommander">Who commands its corps; null for no one named.</param>
/// <param name="DivisionCommander">Who commands its division; null for no one named.</param>
/// <param name="BrigadeCommander">Who commands its brigade; null for no one named.</param>
/// <param name="ImportOrder">
/// Its library unit's place in the imported file, which orders the army's formations; null when
/// it wasn't imported.
/// </param>
public sealed record ArmyUnitResponse(
    Guid Id,
    Guid ArmyId,
    Guid? UnitId,
    Guid? FactionId,
    Nation Nation,
    string Name,
    UnitType Type,
    int FightingFactor,
    int Points,
    string? Division,
    string? Brigade,
    string? Corps,
    string? CorpsCommander,
    string? DivisionCommander,
    string? BrigadeCommander,
    int? ImportOrder
);

/// <summary>A change to a unit's points (decision 0018).</summary>
/// <param name="Turn">The turn it belongs to: the one attrition closed, or the one open at an edit.</param>
/// <param name="Change">Points gained (or, below 0, lost).</param>
/// <param name="PointsAfter">What its points came to.</param>
/// <param name="Reason">Attrition, or the Umpire's edit.</param>
/// <param name="Note">What it was for ("Forced march, ×2"), if anything.</param>
/// <param name="ByName">Who made it; null if their account has since been deleted.</param>
/// <param name="At">When (UTC).</param>
public sealed record PointsChangeResponse(
    int Turn,
    int Change,
    int PointsAfter,
    PointsChangeReason Reason,
    string? Note,
    string? ByName,
    DateTime At
);
