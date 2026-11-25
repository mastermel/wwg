using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Wwg.Api.Data;
using Wwg.Api.Data.Entities;
using Wwg.Api.Features.Maps;
using Wwg.Api.Infrastructure;
using Wwg.Api.Infrastructure.Auth;

namespace Wwg.Api.Features.Markers;

/// <summary>Each user's own markers on a campaign's map (step 80, decision 0054).</summary>
internal static class MarkerEndpoints
{
    /// <summary>How many markers a user may keep in one campaign.</summary>
    public const int MaxPerCampaign = 100;

    public static IEndpointRouteBuilder MapMarkerEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/campaigns/{id:guid}/markers", ListMarkersAsync)
            .WithName("ListMarkers")
            .WithTags("Markers")
            .RequireCampaignAccess(CampaignAccess.Member);
        app.MapPost("/api/campaigns/{id:guid}/markers", CreateMarkerAsync)
            .WithName("CreateMarker")
            .WithTags("Markers")
            .RequireCampaignAccess(CampaignAccess.Member)
            .ProducesProblem(StatusCodes.Status409Conflict);
        var marker = app.MapGroup("/api/markers/{id:guid}").WithTags("Markers");
        marker
            .MapPut("", UpdateMarkerAsync)
            .WithName("UpdateMarker")
            .RequireCampaignAccess(CampaignAccess.Member, CampaignRouteId.Marker)
            .ProducesProblem(StatusCodes.Status404NotFound);
        marker
            .MapDelete("", DeleteMarkerAsync)
            .WithName("DeleteMarker")
            .RequireCampaignAccess(CampaignAccess.Member, CampaignRouteId.Marker)
            .ProducesProblem(StatusCodes.Status404NotFound);
        return app;
    }

    /// <summary>The viewer's own markers in the campaign, by title. No one else's, ever.</summary>
    internal static async Task<Ok<List<MarkerResponse>>> ListMarkersAsync(
        Guid id,
        WwgDbContext db,
        HttpContext httpContext,
        CancellationToken cancellationToken
    )
    {
        var grid = await CampaignMaps.GridAsync(db, id, cancellationToken);
        if (grid is null)
        {
            return TypedResults.Ok(new List<MarkerResponse>());
        }

        var userId = httpContext.User.GetUserId();
        var markers = await db
            .MapMarkers.AsNoTracking()
            .Where(m => m.CampaignId == id && m.UserId == userId)
            .OrderBy(m => m.Title)
            .ThenBy(m => m.Id)
            .ToListAsync(cancellationToken);
        return TypedResults.Ok(markers.Select(m => ToResponse(grid, m)).ToList());
    }

    /// <summary>Adds a marker of the viewer's own, in a hex of the campaign's grid.</summary>
    internal static async Task<
        Results<Created<MarkerResponse>, ValidationProblem, ProblemHttpResult>
    > CreateMarkerAsync(
        Guid id,
        SaveMarkerRequest request,
        WwgDbContext db,
        HttpContext httpContext,
        CancellationToken cancellationToken
    )
    {
        var grid = await CampaignMaps.GridAsync(db, id, cancellationToken);
        if (grid is null)
        {
            return TypedResults.Problem(
                statusCode: StatusCodes.Status409Conflict,
                title: "No map yet",
                detail: "The Umpire hasn't chosen the campaign's area yet."
            );
        }

        if (!grid.Contains(new Hex(request.Q, request.R)))
        {
            return Outside();
        }

        var userId = httpContext.User.GetUserId();
        var count = await db.MapMarkers.CountAsync(
            m => m.CampaignId == id && m.UserId == userId,
            cancellationToken
        );
        if (count >= MaxPerCampaign)
        {
            return TypedResults.Problem(
                statusCode: StatusCodes.Status409Conflict,
                title: "Too many markers",
                detail: $"You can keep up to {MaxPerCampaign} markers in a campaign. Remove one first."
            );
        }

        var marker = db.MapMarkers.Add(new MapMarker { CampaignId = id, UserId = userId }).Entity;
        Apply(marker, request);
        await db.SaveChangesAsync(cancellationToken);
        return TypedResults.Created($"/api/markers/{marker.Id}", ToResponse(grid, marker));
    }

    /// <summary>Changes or moves one of the viewer's markers; another's is not found.</summary>
    internal static async Task<
        Results<Ok<MarkerResponse>, ValidationProblem, NotFound>
    > UpdateMarkerAsync(
        Guid id,
        SaveMarkerRequest request,
        WwgDbContext db,
        HttpContext httpContext,
        CancellationToken cancellationToken
    )
    {
        var userId = httpContext.User.GetUserId();
        var marker = await db
            .MapMarkers.Where(m => m.Id == id)
            .SingleOrGoneAsync(cancellationToken);
        if (marker.UserId != userId)
        {
            return TypedResults.NotFound();
        }

        // A marker's campaign has an area: it was added in it.
        var grid = (await CampaignMaps.GridAsync(db, marker.CampaignId, cancellationToken))!;
        if (!grid.Contains(new Hex(request.Q, request.R)))
        {
            return Outside();
        }

        Apply(marker, request);
        await db.SaveChangesAsync(cancellationToken);
        return TypedResults.Ok(ToResponse(grid, marker));
    }

    /// <summary>Removes one of the viewer's markers; another's is not found.</summary>
    internal static async Task<Results<NoContent, NotFound>> DeleteMarkerAsync(
        Guid id,
        WwgDbContext db,
        HttpContext httpContext,
        CancellationToken cancellationToken
    )
    {
        var userId = httpContext.User.GetUserId();
        var deleted = await db
            .MapMarkers.Where(m => m.Id == id && m.UserId == userId)
            .ExecuteDeleteAsync(cancellationToken);
        return deleted == 0 ? TypedResults.NotFound() : TypedResults.NoContent();
    }

    private static void Apply(MapMarker marker, SaveMarkerRequest request)
    {
        marker.Title = request.Title;
        var description = request.Description?.Trim();
        marker.Description = string.IsNullOrEmpty(description) ? null : description;
        (marker.Q, marker.R) = (request.Q, request.R);
    }

    private static ValidationProblem Outside() =>
        TypedResults.ValidationProblem(
            new Dictionary<string, string[]>(StringComparer.Ordinal)
            {
                ["q"] = ["That's outside the campaign's area."],
            }
        );

    private static MarkerResponse ToResponse(HexGrid grid, MapMarker marker)
    {
        var (latitude, longitude) = grid.Centre(new Hex(marker.Q, marker.R));
        return new(
            marker.Id,
            marker.Title,
            marker.Description,
            marker.Q,
            marker.R,
            latitude,
            longitude
        );
    }
}
