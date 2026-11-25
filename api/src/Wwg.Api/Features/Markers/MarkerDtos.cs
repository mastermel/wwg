using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;
using Wwg.Api.Infrastructure;

namespace Wwg.Api.Features.Markers;

/// <summary>One of the viewer's own markers on the map (decision 0054).</summary>
/// <param name="Id">The marker's ID.</param>
/// <param name="Title">Its title.</param>
/// <param name="Description">What the viewer noted, if anything.</param>
/// <param name="Q">The hex it's on (axial q).</param>
/// <param name="R">The hex it's on (axial r).</param>
/// <param name="Latitude">The hex's centre, in degrees.</param>
/// <param name="Longitude">The hex's centre, in degrees.</param>
public sealed record MarkerResponse(
    Guid Id,
    string Title,
    string? Description,
    int Q,
    int R,
    double Latitude,
    double Longitude
);

/// <summary>The viewer adds or changes one of their markers.</summary>
/// <param name="Title">Its title.</param>
/// <param name="Description">A note, if any (blank is none).</param>
/// <param name="Q">The hex (axial q), inside the campaign's grid.</param>
/// <param name="R">The hex (axial r).</param>
public sealed record SaveMarkerRequest(
    [property: Trimmed, Required, StringLength(100)] string Title,
    [property: StringLength(200)] string? Description,
    [property: JsonRequired] int Q,
    [property: JsonRequired] int R
);
