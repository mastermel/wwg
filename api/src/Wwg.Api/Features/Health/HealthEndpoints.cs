using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Options;
using Wwg.Api.Infrastructure;

namespace Wwg.Api.Features.Health;

internal static class HealthEndpoints
{
    /// <summary>
    /// Maps <c>GET /health</c>, used by Docker and the reverse proxy. It's a regular endpoint (not
    /// <c>MapHealthChecks</c>) so it's in the OpenAPI document and the generated SDK.
    /// </summary>
    public static IEndpointRouteBuilder MapHealthEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/health", GetHealthAsync)
            .WithName("GetHealth")
            .WithTags("Health")
            .AllowAnonymous()
            .Produces<HealthResponse>(StatusCodes.Status503ServiceUnavailable);

        return app;
    }

    /// <summary>Reports whether the API and its dependencies are healthy, and its version.</summary>
    internal static async Task<
        Results<Ok<HealthResponse>, JsonHttpResult<HealthResponse>>
    > GetHealthAsync(
        HealthCheckService healthChecks,
        IOptions<AppOptions> appOptions,
        CancellationToken cancellationToken
    )
    {
        var report = await healthChecks.CheckHealthAsync(cancellationToken);
        var response = new HealthResponse(report.Status, appOptions.Value.Version);

        return report.Status == HealthStatus.Unhealthy
            ? TypedResults.Json(response, statusCode: StatusCodes.Status503ServiceUnavailable)
            : TypedResults.Ok(response);
    }
}
