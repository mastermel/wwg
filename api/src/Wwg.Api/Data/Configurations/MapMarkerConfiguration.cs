using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Wwg.Api.Data.Entities;

namespace Wwg.Api.Data.Configurations;

internal sealed class MapMarkerConfiguration : IEntityTypeConfiguration<MapMarker>
{
    public void Configure(EntityTypeBuilder<MapMarker> builder)
    {
        // Sorted on in the viewer's list.
        builder.Property(m => m.Title).HasMaxLength(100).UseCollation("NOCASE");
        builder.Property(m => m.Description).HasMaxLength(200);

        // Deleting the campaign, or the user, deletes their markers; leaving the campaign doesn't.
        builder
            .HasOne(m => m.Campaign)
            .WithMany()
            .HasForeignKey(m => m.CampaignId)
            .OnDelete(DeleteBehavior.Cascade);
        builder
            .HasOne(m => m.User)
            .WithMany()
            .HasForeignKey(m => m.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        // Each viewer reads only their own, campaign by campaign.
        builder.HasIndex(m => new { m.CampaignId, m.UserId });
    }
}
