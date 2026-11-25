namespace Wwg.Api.Data.Entities;

/// <summary>
/// One user's note on a hex of a campaign's map (decision 0054): only they ever see it, and it
/// stays until they remove it.
/// </summary>
internal sealed class MapMarker : Entity
{
    public Guid CampaignId { get; set; }

    public Campaign Campaign { get; set; } = null!; // Set by EF Core when loaded.

    /// <summary>Its owner: the user, not their membership, so Admins who aren't members keep some too.</summary>
    public Guid UserId { get; set; }

    public AppUser User { get; set; } = null!; // Set by EF Core when loaded.

    /// <summary>The hex it's on.</summary>
    public int Q { get; set; }

    public int R { get; set; }

    public string Title { get; set; } = "";

    public string? Description { get; set; }
}
