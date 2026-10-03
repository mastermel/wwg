using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;
using Wwg.Api.Data.Entities;
using Wwg.Api.Infrastructure;

namespace Wwg.Api.Features.Library;

/// <summary>A faction in the library, as the list shows it.</summary>
/// <param name="Id">The faction's ID.</param>
/// <param name="Name">Its name.</param>
/// <param name="Nation">Whose flag it shows (None: a plain one).</param>
/// <param name="UnitCount">How many units it has.</param>
public sealed record FactionSummary(Guid Id, string Name, Nation Nation, int UnitCount);

/// <summary>A faction in the library, with its units.</summary>
/// <param name="Id">The faction's ID.</param>
/// <param name="Name">Its name.</param>
/// <param name="Nation">Whose flag it shows (None: a plain one).</param>
/// <param name="Units">Its units, sorted by name.</param>
public sealed record FactionResponse(
    Guid Id,
    string Name,
    Nation Nation,
    IReadOnlyList<UnitResponse> Units
);

/// <summary>Adds a faction to the library, or changes one.</summary>
/// <param name="Name">Its name (duplicates are allowed).</param>
/// <param name="Nation">Whose flag it shows (None: a plain one).</param>
public sealed record SaveFactionRequest(
    [property: Trimmed, Required, StringLength(100)] string Name,
    [property: JsonRequired, EnumDataType(typeof(Nation))] Nation Nation
);

/// <summary>A unit in the library.</summary>
/// <param name="Id">The unit's ID.</param>
/// <param name="FactionId">Its faction.</param>
/// <param name="Name">Its name.</param>
/// <param name="Type">What kind of troops it is.</param>
/// <param name="FightingFactor">Its Fighting Factor (FF).</param>
/// <param name="Points">What it's worth.</param>
/// <param name="Division">The division it's in; null for none.</param>
/// <param name="Brigade">The brigade it's in; null for none.</param>
/// <param name="Corps">The corps it's in; null for none.</param>
/// <param name="CorpsCommander">Who commands its corps; null for no one named.</param>
/// <param name="DivisionCommander">Who commands its division; null for no one named.</param>
/// <param name="BrigadeCommander">Who commands its brigade; null for no one named.</param>
/// <param name="Notes">Notes on it; null for none.</param>
/// <param name="Status">Whether its figures are painted; null when unknown.</param>
/// <param name="ImportOrder">
/// Its place in the imported file, which orders the faction's formations; null for a unit entered
/// by hand.
/// </param>
public sealed record UnitResponse(
    Guid Id,
    Guid FactionId,
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
    string? Notes,
    UnitStatus? Status,
    int? ImportOrder
);

/// <summary>Adds a unit to a faction in the library, or changes one.</summary>
/// <param name="Name">Its name (duplicates are allowed).</param>
/// <param name="Type">What kind of troops it is.</param>
/// <param name="FightingFactor">Its Fighting Factor (FF).</param>
/// <param name="Points">What it's worth.</param>
/// <param name="Division">The division it's in (left out or empty: none).</param>
/// <param name="Brigade">The brigade it's in (left out or empty: none).</param>
/// <param name="Corps">The corps it's in (left out or empty: none).</param>
/// <param name="CorpsCommander">Who commands its corps (left out or empty: no one named).</param>
/// <param name="DivisionCommander">Who commands its division (left out or empty: no one named).</param>
/// <param name="BrigadeCommander">Who commands its brigade (left out or empty: no one named).</param>
/// <param name="Notes">Notes on it (left out or empty: none).</param>
/// <param name="Status">Whether its figures are painted (left out: unknown).</param>
public sealed record SaveUnitRequest(
    [property: Trimmed, Required, StringLength(100)] string Name,
    [property: JsonRequired, EnumDataType(typeof(UnitType))] UnitType Type,
    [property: JsonRequired, Range(UnitStats.MinFightingFactor, UnitStats.MaxFightingFactor)]
        int FightingFactor,
    [property: JsonRequired, Range(UnitStats.MinPoints, UnitStats.MaxPoints)] int Points,
    [property: Trimmed, StringLength(UnitStats.MaxGroupLength)] string? Division,
    [property: Trimmed, StringLength(UnitStats.MaxGroupLength)] string? Brigade,
    [property: Trimmed, StringLength(UnitStats.MaxGroupLength)] string? Corps,
    [property: Trimmed, StringLength(UnitStats.MaxGroupLength)] string? CorpsCommander,
    [property: Trimmed, StringLength(UnitStats.MaxGroupLength)] string? DivisionCommander,
    [property: Trimmed, StringLength(UnitStats.MaxGroupLength)] string? BrigadeCommander,
    [property: Trimmed, StringLength(UnitStats.MaxNotesLength)] string? Notes,
    [property: EnumDataType(typeof(UnitStatus))] UnitStatus? Status
);
