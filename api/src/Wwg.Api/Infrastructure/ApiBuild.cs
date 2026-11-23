namespace Wwg.Api.Infrastructure;

/// <summary>
/// The running API build's identity, sent on every response so the front-end can tell when the
/// API has changed under it (it then reloads and drops its saved data; DESIGN.md §3.12).
/// </summary>
internal static class ApiBuild
{
    /// <summary>The response header that carries <see cref="Id"/>.</summary>
    public const string HeaderName = "X-Api-Build";

    /// <summary>
    /// The API assembly's module version ID. Builds are deterministic, so it changes exactly when
    /// the API's code (or the assemblies it references) does: a deploy that only changes the
    /// front-end keeps it.
    /// </summary>
    public static readonly string Id =
        typeof(ApiBuild).Assembly.ManifestModule.ModuleVersionId.ToString("N");

    /// <summary>Adds the <see cref="HeaderName"/> header to every response.</summary>
    public static IApplicationBuilder UseApiBuildHeader(this IApplicationBuilder app) =>
        app.Use(
            (context, next) =>
            {
                // When the response starts, so it survives the error handler clearing the headers.
                context.Response.OnStarting(() =>
                {
                    context.Response.Headers[HeaderName] = Id;
                    return Task.CompletedTask;
                });
                return next(context);
            }
        );
}
