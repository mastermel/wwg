using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace Wwg.Api.Features.Health;

/// <summary>The API's overall health, and the version that's running.</summary>
/// <param name="Status">Healthy or Degraded (200), or Unhealthy (503).</param>
/// <param name="Version">The image tag (e.g. <c>v20260927.143005</c>), or "dev" when not built by
/// the Docker image build.</param>
public sealed record HealthResponse(HealthStatus Status, string Version);
