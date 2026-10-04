namespace Wwg.Api.Data.Entities;

/// <summary>
/// What kind of troops a unit is (stored as its name), grouped by the rule book's movement
/// classes (decision 0014): infantry and foot artillery; light infantry and partisans; light
/// cavalry and scouts; medium and heavy cavalry and horse artillery; supply and siege artillery;
/// and boats, which keep to waterways and lakes (decision 0016). A commander (decision 0024) is
/// the army's general on the map, and rides as light cavalry.
/// </summary>
public enum UnitType
{
    LineInfantry,
    FootArtillery,
    Engineers,
    LightInfantry,
    Partisans,
    LightCavalry,
    Scouts,
    MediumCavalry,
    HeavyCavalry,
    HorseArtillery,
    SupplyTrain,
    SiegeArtillery,
    Boat,
    Commander,
}

/// <summary>
/// Whether a library unit's figures are painted (decision 0025), as the club's workbook records it.
/// Stored by name.
/// </summary>
public enum UnitStatus
{
    Painted,

    /// <summary>On the table, another unit's figures stand in for it.</summary>
    Substitute,
    Unpainted,
}

/// <summary>
/// A unit's corps, division and brigade, and their commanders (decisions 0024 and 0025): free
/// text, grouped on as written.
/// </summary>
internal static class UnitGroups
{
    /// <summary>None for empty: the request trims it, so blank comes as empty.</summary>
    public static string? Normalize(string? value) => string.IsNullOrEmpty(value) ? null : value;
}

/// <summary>The bounds of a unit's numbers, in the library and in a campaign.</summary>
internal static class UnitStats
{
    /// <summary>The lowest and highest Fighting Factor.</summary>
    public const int MinFightingFactor = 1,
        MaxFightingFactor = 9;

    /// <summary>The fewest and most points a unit can be worth.</summary>
    public const int MinPoints = 0,
        MaxPoints = 100;

    /// <summary>
    /// The longest corps, division or brigade name, or commander's (decisions 0024 and 0025).
    /// </summary>
    public const int MaxGroupLength = 100;

    /// <summary>The longest notes on a library unit (decision 0025).</summary>
    public const int MaxNotesLength = 500;

    /// <summary>The longest import key (decision 0025): a path of names, so four groups' worth.</summary>
    public const int MaxImportKeyLength = 400;
}

/// <summary>
/// A unit in an army: a copy of a library unit, taken when it joined the campaign (decision 0015),
/// so what happens in the campaign changes only this; or a boat its troops built (decision 0022). Every member sees it; where it is follows
/// the visibility rule.
/// </summary>
internal sealed class ArmyUnit : Entity
{
    public Guid ArmyId { get; set; }

    public Army Army { get; set; } = null!; // Set by EF Core when loaded.

    /// <summary>The army's campaign, kept here so a library unit is in it at most once.</summary>
    public Guid CampaignId { get; set; }

    public Campaign Campaign { get; set; } = null!; // Set by EF Core when loaded.

    /// <summary>The library unit it was copied from; null for a boat built in the campaign.</summary>
    public Guid? UnitId { get; set; }

    public Unit? Unit { get; set; }

    public required string Name { get; set; }

    public UnitType Type { get; set; }

    /// <summary>The unit's Fighting Factor ("FF"), <see cref="UnitStats.MinFightingFactor"/>–<see cref="UnitStats.MaxFightingFactor"/>.</summary>
    public int FightingFactor { get; set; }

    /// <summary>What the unit is worth, <see cref="UnitStats.MinPoints"/>–<see cref="UnitStats.MaxPoints"/>.</summary>
    public int Points { get; set; }

    /// <summary>The division it's in (decision 0024), free text; null for none.</summary>
    public string? Division { get; set; }

    /// <summary>The brigade it's in (decision 0024), free text; null for none.</summary>
    public string? Brigade { get; set; }

    /// <summary>The corps it's in (decision 0025), free text; null for none.</summary>
    public string? Corps { get; set; }

    /// <summary>Who commands its corps (decision 0025); null for no one named.</summary>
    public string? CorpsCommander { get; set; }

    /// <summary>Who commands its division (decision 0025); null for no one named.</summary>
    public string? DivisionCommander { get; set; }

    /// <summary>Who commands its brigade (decision 0025); null for no one named.</summary>
    public string? BrigadeCommander { get; set; }

    /// <summary>
    /// Its library unit's place in the imported file (decision 0025), which orders the army's
    /// formations; null when it wasn't imported.
    /// </summary>
    public int? ImportOrder { get; set; }

    /// <summary>
    /// The part of a point of attrition owed but not yet lost (decision 0018), 0 to 1: points stay
    /// whole, and the unit loses one once this adds up to it.
    /// </summary>
    public double AttritionCarry { get; set; }

    /// <summary>
    /// Turns in a row it ended out of supply (decision 0019), counted as each turn closes; from
    /// the 7th, each costs attrition.
    /// </summary>
    public int UnsuppliedTurns { get; set; }

    /// <summary>
    /// Whether it's screening (decision 0026): its commander's to turn on or off at any time, for
    /// the light troops that can screen. It hides the rest of its hex from enemy sightings, and
    /// each turn that closes with it on goes in its <see cref="ScreeningTurn"/>s.
    /// </summary>
    public bool Screening { get; set; }
}
