using System.Text.Json.Serialization;

namespace Wwg.Api.Features.Screening;

/// <summary>Turns a unit's screening on or off (decision 0026).</summary>
/// <param name="Screening">Whether it screens from now on.</param>
public sealed record UpdateScreeningRequest([property: JsonRequired] bool Screening);

/// <summary>A unit's screening (decision 0026), for its commander and the Umpire.</summary>
/// <param name="CanScreen">Whether its type can screen (light infantry, light or medium cavalry).</param>
/// <param name="Screening">Whether it's screening now.</param>
/// <param name="Turns">The turns it closed screening, oldest first.</param>
public sealed record ScreeningResponse(bool CanScreen, bool Screening, IReadOnlyList<int> Turns);
