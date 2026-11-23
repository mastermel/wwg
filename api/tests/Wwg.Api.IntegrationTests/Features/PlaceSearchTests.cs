using System.Net;
using Microsoft.Extensions.DependencyInjection;
using Wwg.Api.Features.Maps;
using Wwg.Api.Infrastructure;
using Wwg.Api.Infrastructure.Geocoding;
using Wwg.Api.IntegrationTests.Support;

namespace Wwg.Api.IntegrationTests.Features;

/// <summary>
/// Place search and town search (DESIGN.md §5.3), through the real geocoders with their HTTP
/// stubbed: MapTiler with a key, Photon without.
/// </summary>
public sealed class PlaceSearchTests : ApiTest
{
    private const string MapTilerLeipzig = """
        {
          "type": "FeatureCollection",
          "features": [
            {
              "text": "Leipzig",
              "place_name": "Leipzig, Saxony, Germany",
              "center": [12.37, 51.34],
              "bbox": [12.23, 51.23, 12.54, 51.45]
            },
            { "text": "Nowhere", "place_name": "Nowhere" }
          ]
        }
        """;

    private const string PhotonLeipzig = """
        {
          "type": "FeatureCollection",
          "features": [
            {
              "geometry": { "type": "Point", "coordinates": [12.37, 51.34] },
              "properties": {
                "name": "Leipzig", "state": "Saxony", "country": "Germany",
                "extent": [12.23, 51.45, 12.54, 51.23]
              }
            }
          ]
        }
        """;

    // Waterloo in the area's middle hex, Brussels north of the area, and the other Waterloo.
    private const string PhotonWaterloos = """
        {
          "type": "FeatureCollection",
          "features": [
            {
              "geometry": { "type": "Point", "coordinates": [4.4, 50.7] },
              "properties": { "name": "Waterloo", "state": "Walloon Brabant", "country": "Belgium" }
            },
            {
              "geometry": { "type": "Point", "coordinates": [4.35, 50.85] },
              "properties": { "name": "Brussels", "country": "Belgium" }
            },
            {
              "geometry": { "type": "Point", "coordinates": [-80.52, 43.46] },
              "properties": { "name": "Waterloo", "state": "Ontario", "country": "Canada" }
            }
          ]
        }
        """;

    private StubHttpHandler _geocoder = StubHttpHandler.Json(PhotonLeipzig);
    private string _apiKey = "";
    private int _placesLimit = 100_000;

    // Both read when first used, so a test sets them before its first search.
    public PlaceSearchTests() =>
        App.TestServices.Add(services =>
        {
            services.ConfigureHttpClientDefaults(client =>
                client.ConfigurePrimaryHttpMessageHandler(() => _geocoder)
            );
            services.PostConfigure<GeocodingOptions>(options => options.MapTilerApiKey = _apiKey);
            services.PostConfigure<RateLimitOptions>(options =>
                options.Places = new FixedWindowLimit
                {
                    PermitLimit = _placesLimit,
                    Window = TimeSpan.FromMinutes(1),
                }
            );
        });

    private static async Task<HttpResponseMessage> SearchAsync(
        CampaignScenario scenario,
        string search,
        Role role = Role.Umpire
    ) =>
        await scenario
            .As(role)
            .GetAsync(
                new Uri(
                    $"/api/campaigns/{scenario.CampaignId}/places?search={Uri.EscapeDataString(search)}",
                    UriKind.Relative
                ),
                TestContext.Current.CancellationToken
            );

    private static async Task<HttpResponseMessage> SearchTownsAsync(
        CampaignScenario scenario,
        string search,
        Role role = Role.Player
    ) =>
        await scenario
            .As(role)
            .GetAsync(
                new Uri(
                    $"/api/campaigns/{scenario.CampaignId}/map/towns?search={Uri.EscapeDataString(search)}",
                    UriKind.Relative
                ),
                TestContext.Current.CancellationToken
            );

    [Fact]
    public async Task SearchPlaces_NoMapTilerKey_AsksPhotonAndReturnsWestSouthEastNorth()
    {
        using var scenario = await CreateCampaignScenarioAsync();

        using var response = await SearchAsync(scenario, "Leipzig");

        var place = Assert.Single((await response.Content.ReadAsAsync<List<PlaceResult>>())!);
        Assert.Equal("Leipzig, Saxony, Germany", place.Description);
        Assert.Equal(new MapBounds(12.23, 51.23, 12.54, 51.45), place.Bounds);
        Assert.StartsWith(
            "https://photon.komoot.io/api/?q=Leipzig",
            Assert.Single(_geocoder.Requests).ToString(),
            StringComparison.Ordinal
        );
    }

    [Fact]
    public async Task SearchPlaces_WithAMapTilerKey_AsksMapTilerWithIt()
    {
        _geocoder = StubHttpHandler.Json(MapTilerLeipzig);
        _apiKey = "test-key";
        using var scenario = await CreateCampaignScenarioAsync();

        using var response = await SearchAsync(scenario, "Leipzig");

        // The feature without a centre is left out.
        var place = Assert.Single((await response.Content.ReadAsAsync<List<PlaceResult>>())!);
        Assert.Equal(("Leipzig", 12.37, 51.34), (place.Name, place.Longitude, place.Latitude));
        Assert.Equal(new MapBounds(12.23, 51.23, 12.54, 51.45), place.Bounds);
        var request = Assert.Single(_geocoder.Requests).ToString();
        Assert.StartsWith(
            "https://api.maptiler.com/geocoding/Leipzig.json?key=test-key",
            request,
            StringComparison.Ordinal
        );
    }

    [Fact]
    public async Task SearchPlaces_OverTheLimit_Returns429()
    {
        _placesLimit = 1;
        using var scenario = await CreateCampaignScenarioAsync();

        using var first = await SearchAsync(scenario, "Leipzig");
        using var second = await SearchAsync(scenario, "Dresden");

        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        await second.AssertProblemAsync(HttpStatusCode.TooManyRequests);
    }

    [Fact]
    public async Task SearchPlaces_TheServiceFails_Returns503()
    {
        _geocoder = StubHttpHandler.Json("{}", HttpStatusCode.InternalServerError);
        using var scenario = await CreateCampaignScenarioAsync();

        using var response = await SearchAsync(scenario, "Leipzig");

        await response.AssertProblemAsync(HttpStatusCode.ServiceUnavailable);
    }

    [Fact]
    public async Task SearchPlaces_TooShort_IsAValidationError()
    {
        using var scenario = await CreateCampaignScenarioAsync();

        using var response = await SearchAsync(scenario, "L");

        await response.AssertValidationProblemAsync("search");
        Assert.Empty(_geocoder.Requests);
    }

    [Theory]
    [InlineData(Role.Admin, HttpStatusCode.OK)]
    [InlineData(Role.Umpire, HttpStatusCode.OK)]
    [InlineData(Role.Commander, HttpStatusCode.Forbidden)]
    [InlineData(Role.Player, HttpStatusCode.Forbidden)]
    [InlineData(Role.NonMember, HttpStatusCode.NotFound)]
    public async Task SearchPlaces_ByRole_ReturnsExpectedStatus(Role role, HttpStatusCode expected)
    {
        using var scenario = await CreateCampaignScenarioAsync();

        using var response = await SearchAsync(scenario, "Leipzig", role);

        Assert.Equal(expected, response.StatusCode);
    }

    [Fact]
    public async Task SearchTowns_InTheArea_ReturnsOnlyTheTownsInTheGridWithTheirHexes()
    {
        _geocoder = StubHttpHandler.Json(PhotonWaterloos);
        using var scenario = await CreateCampaignScenarioAsync();
        await TurnSteps.SetAreaAsync(scenario);

        using var response = await SearchTownsAsync(scenario, "Waterloo");

        var town = Assert.Single((await response.Content.ReadAsAsync<List<TownResult>>())!);
        Assert.Equal(
            new TownResult("Waterloo", "Waterloo, Walloon Brabant, Belgium", 0, 0, 4.4, 50.7),
            town
        );
        var request = Assert.Single(_geocoder.Requests).ToString();
        Assert.Contains("&layer=city&", request, StringComparison.Ordinal);
        Assert.Contains("&bbox=4.2,50.6,4.6,50.8", request, StringComparison.Ordinal);
        Assert.DoesNotContain("layer=country", request, StringComparison.Ordinal);
    }

    [Fact]
    public async Task SearchTowns_WithAMapTilerKey_AsksMapTilerForSettlementsInTheArea()
    {
        _geocoder = StubHttpHandler.Json(MapTilerLeipzig);
        _apiKey = "test-key";
        using var scenario = await CreateCampaignScenarioAsync();
        await TurnSteps.SetAreaAsync(scenario);

        using var response = await SearchTownsAsync(scenario, "Leipzig");

        // Leipzig isn't in the area.
        Assert.Empty((await response.Content.ReadAsAsync<List<TownResult>>())!);
        var request = Assert.Single(_geocoder.Requests).ToString();
        Assert.Contains(
            "&types=municipality,municipal_district,locality,place&bbox=4.2,50.6,4.6,50.8",
            request,
            StringComparison.Ordinal
        );
    }

    [Fact]
    public async Task SearchTowns_NoAreaYet_Returns409()
    {
        using var scenario = await CreateCampaignScenarioAsync();

        using var response = await SearchTownsAsync(scenario, "Waterloo");

        await response.AssertProblemAsync(HttpStatusCode.Conflict);
        Assert.Empty(_geocoder.Requests);
    }

    [Fact]
    public async Task SearchTowns_TheServiceFails_Returns503()
    {
        _geocoder = StubHttpHandler.Json("{}", HttpStatusCode.InternalServerError);
        using var scenario = await CreateCampaignScenarioAsync();
        await TurnSteps.SetAreaAsync(scenario);

        using var response = await SearchTownsAsync(scenario, "Waterloo");

        await response.AssertProblemAsync(HttpStatusCode.ServiceUnavailable);
    }

    [Fact]
    public async Task SearchTowns_TooShort_IsAValidationError()
    {
        using var scenario = await CreateCampaignScenarioAsync();
        await TurnSteps.SetAreaAsync(scenario);

        using var response = await SearchTownsAsync(scenario, "W");

        await response.AssertValidationProblemAsync("search");
        Assert.Empty(_geocoder.Requests);
    }

    [Theory]
    [InlineData(Role.Admin, HttpStatusCode.OK)]
    [InlineData(Role.Umpire, HttpStatusCode.OK)]
    [InlineData(Role.Commander, HttpStatusCode.OK)]
    [InlineData(Role.Player, HttpStatusCode.OK)]
    [InlineData(Role.NonMember, HttpStatusCode.NotFound)]
    public async Task SearchTowns_ByRole_ReturnsExpectedStatus(Role role, HttpStatusCode expected)
    {
        _geocoder = StubHttpHandler.Json(PhotonWaterloos);
        using var scenario = await CreateCampaignScenarioAsync();
        await TurnSteps.SetAreaAsync(scenario);

        using var response = await SearchTownsAsync(scenario, "Waterloo", role);

        Assert.Equal(expected, response.StatusCode);
    }
}
