namespace Wwg.Api.Data.Entities;

/// <summary>
/// A turn a unit closed screening (decision 0026): what the sightings for the next turn saw it
/// do. Its commander and the Umpire see them.
/// </summary>
internal sealed class ScreeningTurn : Entity
{
    public Guid ArmyUnitId { get; set; }

    public ArmyUnit ArmyUnit { get; set; } = null!; // Set by EF Core when loaded.

    /// <summary>The turn that closed.</summary>
    public int Turn { get; set; }
}
