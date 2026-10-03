namespace Wwg.Api.Data.Entities;

/// <summary>
/// A faction in the club's library (decision 0015): a collection of units, such as the French or
/// the British, shared by every campaign. Not a campaign's side (<see cref="Side"/>).
/// </summary>
internal sealed class Faction : Entity
{
    public required string Name { get; set; }

    /// <summary>Whose flag it shows; None for a plain one.</summary>
    public Nation Nation { get; set; }
}

/// <summary>
/// A unit in the club's library (decision 0015), in one faction. A campaign takes a copy of it
/// (<see cref="ArmyUnit"/>); editing it changes only the campaigns it joins afterwards.
/// </summary>
internal sealed class Unit : Entity
{
    public Guid FactionId { get; set; }

    public Faction Faction { get; set; } = null!; // Set by EF Core when loaded.

    public required string Name { get; set; }

    public UnitType Type { get; set; }

    /// <summary>Its Fighting Factor ("FF"), within <see cref="UnitStats"/>.</summary>
    public int FightingFactor { get; set; }

    /// <summary>What it's worth, within <see cref="UnitStats"/>.</summary>
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

    /// <summary>Notes on it, such as which unit's figures stand in for it; null for none.</summary>
    public string? Notes { get; set; }

    /// <summary>Whether its figures are painted (decision 0025); null when unknown.</summary>
    public UnitStatus? Status { get; set; }

    /// <summary>
    /// What an import of the club's CSV knows it by (decision 0025), unique in its faction; null for
    /// a unit entered by hand, which an import never touches.
    /// </summary>
    public string? ImportKey { get; set; }

    /// <summary>Its place in the imported file, which orders the faction's formations.</summary>
    public int? ImportOrder { get; set; }
}
