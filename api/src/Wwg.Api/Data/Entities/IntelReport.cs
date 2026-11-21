namespace Wwg.Api.Data.Entities;

/// <summary>Where a report's courier is (decision 0020).</summary>
public enum CourierStatus
{
    /// <summary>On its way.</summary>
    EnRoute,

    /// <summary>Delivered: the recipient has the report.</summary>
    Arrived,

    /// <summary>Cancelled by the Umpire (captured, lost), with a note: it never arrives.</summary>
    Stopped,
}

/// <summary>
/// Intelligence one army's commander sends an ally (decision 0020): a note (and, before decision
/// 0037, a snapshot of their units and the sightings they'd received), carried by a courier tracked
/// turn by turn, not drawn.
/// Or the Umpire's to an army (decision 0035), with no sender and no courier: it arrives at once.
/// What was sent is copied in as it was then.
/// </summary>
internal sealed class IntelReport : Entity
{
    /// <summary>The sending army: null only for the Umpire's (<see cref="FromUmpire"/>).</summary>
    public Guid? FromArmyId { get; set; }

    public Army? FromArmy { get; set; }

    /// <summary>The Umpire's own report (decision 0035): no sending army, no courier.</summary>
    public bool FromUmpire { get; set; }

    public Guid ToArmyId { get; set; }

    public Army ToArmy { get; set; } = null!; // Set by EF Core when loaded.

    /// <summary>The turn it was sent in.</summary>
    public int SentTurn { get; set; }

    /// <summary>The turn it arrived for (the recipient has it from then), once it has.</summary>
    public int? ArrivedTurn { get; set; }

    public string? Note { get; set; }

    /// <summary>The units as they were (JSON: army, name, type, hex, points), if sent.</summary>
    public string? Snapshot { get; set; }

    /// <summary>
    /// The sightings sent (the sender's, as they were), copied to the recipient on arrival; for the
    /// Umpire's, the recipient's sightings it made.
    /// </summary>
    public List<Guid> SightingIds { get; set; } = [];

    public CourierStatus Status { get; set; }

    /// <summary>The courier's hex.</summary>
    public int CourierQ { get; set; }

    public int CourierR { get; set; }

    /// <summary>Within two turns' ride when sent: it arrives as the next turn starts (§L).</summary>
    public bool ArrivesNext { get; set; }

    /// <summary>The open turn when the Umpire cancelled it, if they did (decision 0033).</summary>
    public int? StoppedTurn { get; set; }

    /// <summary>Why the Umpire cancelled it: theirs and Admins' only.</summary>
    public string? StoppedNote { get; set; }

    /// <summary>Who cancelled it (null once their account is deleted).</summary>
    public Guid? StoppedByUserId { get; set; }

    public AppUser? StoppedByUser { get; set; }
}
