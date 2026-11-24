using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Http.HttpResults;
using Wwg.Api.Data;
using Wwg.Api.Data.Entities;
using Wwg.Api.Features.Campaigns;
using Wwg.Api.Infrastructure;
using Wwg.Api.Infrastructure.Auth;

namespace Wwg.Api.Features.Intelligence;

/// <summary>A campaign's courier settings (decision 0048).</summary>
/// <param name="Speed">How much faster than light cavalry a courier rides: 1 is the rules' courier.</param>
public sealed record CourierSettingsResponse(double Speed);

/// <summary>The Umpire sets how fast couriers ride.</summary>
/// <param name="Speed">A multiple of light cavalry's speed, 0.25–5 (the rules: 1).</param>
public sealed record UpdateCourierSettingsRequest(
    [property: JsonRequired, Range(CourierRules.MinSpeed, CourierRules.MaxSpeed)] double Speed
);

/// <summary>How fast couriers ride (decision 0048).</summary>
internal static class CourierSettingsEndpoints
{
    public static IEndpointRouteBuilder MapCourierSettingsEndpoints(this IEndpointRouteBuilder app)
    {
        var settings = app.MapGroup("/api/campaigns/{id:guid}/courier-settings")
            .WithTags("Intelligence");
        settings
            .MapGet("", GetCourierSettingsAsync)
            .WithName("GetCourierSettings")
            .RequireCampaignAccess(CampaignAccess.Member);
        settings
            .MapPut("", UpdateCourierSettingsAsync)
            .WithName("UpdateCourierSettings")
            .RequireCampaignAccess(CampaignAccess.Umpire);
        return app;
    }

    /// <summary>How fast couriers ride in the campaign (every member), as a multiple of light cavalry's.</summary>
    internal static async Task<Ok<CourierSettingsResponse>> GetCourierSettingsAsync(
        Guid id,
        WwgDbContext db,
        CancellationToken cancellationToken
    ) =>
        TypedResults.Ok(
            new CourierSettingsResponse(
                (await CalendarEndpoints.LoadAsync(db, id, cancellationToken)).CourierSpeed
            )
        );

    /// <summary>
    /// Changes how fast couriers ride (Umpire or Admin): those on their way ride at it from the
    /// next turn that closes.
    /// </summary>
    internal static async Task<Ok<CourierSettingsResponse>> UpdateCourierSettingsAsync(
        Guid id,
        UpdateCourierSettingsRequest request,
        WwgDbContext db,
        CancellationToken cancellationToken
    )
    {
        var campaign = await db
            .Campaigns.Where(c => c.Id == id)
            .SingleOrGoneAsync(cancellationToken);
        campaign.CourierSpeed = request.Speed;
        await db.SaveChangesAsync(cancellationToken);
        return TypedResults.Ok(new CourierSettingsResponse(campaign.CourierSpeed));
    }
}
