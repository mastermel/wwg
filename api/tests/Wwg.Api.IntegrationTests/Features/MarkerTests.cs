using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Wwg.Api.Data.Entities;
using Wwg.Api.Features.Markers;
using Wwg.Api.IntegrationTests.Support;

namespace Wwg.Api.IntegrationTests.Features;

/// <summary>Each user's own markers on the map (step 80, decision 0054).</summary>
public sealed class MarkerTests : ApiTest
{
    private static CancellationToken Token => TestContext.Current.CancellationToken;

    private static readonly SaveMarkerRequest Ford = new("Ford", "Hold it by turn 3.", 0, 0);

    private static Task<HttpResponseMessage> CreateAsync(
        CampaignScenario scenario,
        SaveMarkerRequest request,
        Role role = Role.Commander
    ) =>
        scenario
            .As(role)
            .PostAsJsonAsync(
                new Uri($"/api/campaigns/{scenario.CampaignId}/markers", UriKind.Relative),
                request,
                Token
            );

    private static async Task<MarkerResponse> CreatedAsync(
        CampaignScenario scenario,
        Role role = Role.Commander
    )
    {
        using var response = await CreateAsync(scenario, Ford, role);
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadAsAsync<MarkerResponse>())!;
    }

    private static async Task<List<MarkerResponse>> ListAsync(
        CampaignScenario scenario,
        Role role = Role.Commander
    ) =>
        (
            await scenario
                .As(role)
                .GetAsAsync<List<MarkerResponse>>($"/api/campaigns/{scenario.CampaignId}/markers")
        )!;

    private static Task<HttpResponseMessage> UpdateAsync(
        CampaignScenario scenario,
        Guid markerId,
        SaveMarkerRequest request,
        Role role = Role.Commander
    ) =>
        scenario
            .As(role)
            .PutAsJsonAsync(new Uri($"/api/markers/{markerId}", UriKind.Relative), request, Token);

    private static Task<HttpResponseMessage> DeleteAsync(
        CampaignScenario scenario,
        Guid markerId,
        Role role = Role.Commander
    ) =>
        scenario.As(role).DeleteAsync(new Uri($"/api/markers/{markerId}", UriKind.Relative), Token);

    [Fact]
    public async Task CreateMarker_InTheArea_IsListedForTheViewer()
    {
        using var scenario = await CreateCampaignScenarioAsync();
        await TurnSteps.SetAreaAsync(scenario);

        var created = await CreatedAsync(scenario);
        var listed = Assert.Single(await ListAsync(scenario));

        Assert.Equal(
            (created.Id, "Ford", "Hold it by turn 3.", 0, 0),
            (listed.Id, listed.Title, listed.Description, listed.Q, listed.R)
        );
        Assert.NotEqual(0, listed.Latitude);
    }

    [Fact]
    public async Task CreateMarker_BlankDescription_IsNone()
    {
        using var scenario = await CreateCampaignScenarioAsync();
        await TurnSteps.SetAreaAsync(scenario);

        using var response = await CreateAsync(scenario, Ford with { Description = "  " });
        var marker = await response.Content.ReadAsAsync<MarkerResponse>();

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Null(marker!.Description);
    }

    [Fact]
    public async Task CreateMarker_WithoutATitle_IsAValidationError()
    {
        using var scenario = await CreateCampaignScenarioAsync();
        await TurnSteps.SetAreaAsync(scenario);

        using var response = await CreateAsync(scenario, Ford with { Title = " " });

        await response.AssertValidationProblemAsync("title");
    }

    [Fact]
    public async Task CreateMarker_DescriptionOver200_IsAValidationError()
    {
        using var scenario = await CreateCampaignScenarioAsync();
        await TurnSteps.SetAreaAsync(scenario);

        using var response = await CreateAsync(
            scenario,
            Ford with
            {
                Description = new string('a', 201),
            }
        );

        await response.AssertValidationProblemAsync("description");
    }

    [Fact]
    public async Task CreateMarker_OutsideTheArea_IsAValidationError()
    {
        using var scenario = await CreateCampaignScenarioAsync();
        await TurnSteps.SetAreaAsync(scenario);

        using var response = await CreateAsync(scenario, Ford with { Q = 90 });

        await response.AssertValidationProblemAsync("q");
    }

    [Fact]
    public async Task CreateMarker_WithoutAnArea_Returns409()
    {
        using var scenario = await CreateCampaignScenarioAsync();

        using var response = await CreateAsync(scenario, Ford);

        await response.AssertProblemAsync(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task CreateMarker_AtTheLimit_Returns409()
    {
        using var scenario = await CreateCampaignScenarioAsync();
        await TurnSteps.SetAreaAsync(scenario);
        var first = await CreatedAsync(scenario);
        await WithDbAsync(async db =>
        {
            var userId = await db
                .MapMarkers.Where(m => m.Id == first.Id)
                .Select(m => m.UserId)
                .SingleAsync(Token);
            db.MapMarkers.AddRange(
                Enumerable
                    .Range(1, MarkerEndpoints.MaxPerCampaign - 1)
                    .Select(_ => new MapMarker
                    {
                        CampaignId = scenario.CampaignId,
                        UserId = userId,
                        Title = "Another",
                    })
            );
            return await db.SaveChangesAsync(Token);
        });

        using var response = await CreateAsync(scenario, Ford);
        using var others = await CreateAsync(scenario, Ford, Role.Player);

        await response.AssertProblemAsync(HttpStatusCode.Conflict);
        Assert.Equal(HttpStatusCode.Created, others.StatusCode);
    }

    [Theory]
    [InlineData(Role.Admin, HttpStatusCode.Created)]
    [InlineData(Role.Umpire, HttpStatusCode.Created)]
    [InlineData(Role.Commander, HttpStatusCode.Created)]
    [InlineData(Role.Player, HttpStatusCode.Created)]
    [InlineData(Role.NonMember, HttpStatusCode.NotFound)]
    public async Task CreateMarker_ByRole_EveryMember(Role role, HttpStatusCode expected)
    {
        using var scenario = await CreateCampaignScenarioAsync();
        await TurnSteps.SetAreaAsync(scenario);

        using var response = await CreateAsync(scenario, Ford, role);

        Assert.Equal(expected, response.StatusCode);
    }

    [Theory]
    [InlineData(Role.Admin)]
    [InlineData(Role.Umpire)]
    [InlineData(Role.Player)]
    public async Task ListMarkers_AnothersMarkers_AreNotListed(Role role)
    {
        using var scenario = await CreateCampaignScenarioAsync();
        await TurnSteps.SetAreaAsync(scenario);
        await CreatedAsync(scenario);

        Assert.Empty(await ListAsync(scenario, role));
    }

    [Fact]
    public async Task ListMarkers_ByANonMember_Returns404()
    {
        using var scenario = await CreateCampaignScenarioAsync();

        using var response = await scenario
            .As(Role.NonMember)
            .GetAsync(
                new Uri($"/api/campaigns/{scenario.CampaignId}/markers", UriKind.Relative),
                Token
            );

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task UpdateMarker_ChangesAndMovesIt()
    {
        using var scenario = await CreateCampaignScenarioAsync();
        await TurnSteps.SetAreaAsync(scenario);
        var marker = await CreatedAsync(scenario);

        using var response = await UpdateAsync(
            scenario,
            marker.Id,
            new SaveMarkerRequest(" Bridge ", null, 1, 0)
        );
        var changed = Assert.Single(await ListAsync(scenario));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(
            ("Bridge", null, 1, 0),
            (changed.Title, changed.Description, changed.Q, changed.R)
        );
    }

    [Fact]
    public async Task UpdateMarker_OutsideTheArea_IsAValidationError()
    {
        using var scenario = await CreateCampaignScenarioAsync();
        await TurnSteps.SetAreaAsync(scenario);
        var marker = await CreatedAsync(scenario);

        using var response = await UpdateAsync(scenario, marker.Id, Ford with { R = 90 });

        await response.AssertValidationProblemAsync("q");
    }

    [Theory]
    [InlineData(Role.Admin)]
    [InlineData(Role.Umpire)]
    [InlineData(Role.Player)]
    [InlineData(Role.NonMember)]
    public async Task UpdateMarker_AnothersMarker_Returns404(Role role)
    {
        using var scenario = await CreateCampaignScenarioAsync();
        await TurnSteps.SetAreaAsync(scenario);
        var marker = await CreatedAsync(scenario);

        using var response = await UpdateAsync(
            scenario,
            marker.Id,
            Ford with
            {
                Title = "Mine now",
            },
            role
        );

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("Ford", Assert.Single(await ListAsync(scenario)).Title);
    }

    [Fact]
    public async Task DeleteMarker_RemovesIt()
    {
        using var scenario = await CreateCampaignScenarioAsync();
        await TurnSteps.SetAreaAsync(scenario);
        var marker = await CreatedAsync(scenario);

        using var response = await DeleteAsync(scenario, marker.Id);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Empty(await ListAsync(scenario));
    }

    [Theory]
    [InlineData(Role.Admin)]
    [InlineData(Role.Umpire)]
    [InlineData(Role.Player)]
    [InlineData(Role.NonMember)]
    public async Task DeleteMarker_AnothersMarker_Returns404(Role role)
    {
        using var scenario = await CreateCampaignScenarioAsync();
        await TurnSteps.SetAreaAsync(scenario);
        var marker = await CreatedAsync(scenario);

        using var response = await DeleteAsync(scenario, marker.Id, role);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Single(await ListAsync(scenario));
    }

    [Fact]
    public async Task LeaveCampaign_KeepsTheirMarkers()
    {
        using var scenario = await CreateCampaignScenarioAsync();
        await TurnSteps.SetAreaAsync(scenario);
        await CreatedAsync(scenario, Role.Player);

        using var left = await scenario
            .As(Role.Player)
            .DeleteAsync(
                new Uri($"/api/campaigns/{scenario.CampaignId}/members/me", UriKind.Relative),
                Token
            );

        Assert.Equal(HttpStatusCode.NoContent, left.StatusCode);
        Assert.Equal(1, await WithDbAsync(db => db.MapMarkers.CountAsync(Token)));
    }

    [Fact]
    public async Task DeleteCampaign_DeletesItsMarkers()
    {
        using var scenario = await CreateCampaignScenarioAsync();
        await TurnSteps.SetAreaAsync(scenario);
        await CreatedAsync(scenario);

        using var deleted = await scenario
            .As(Role.Umpire)
            .DeleteAsync(new Uri($"/api/campaigns/{scenario.CampaignId}", UriKind.Relative), Token);

        Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);
        Assert.Equal(0, await WithDbAsync(db => db.MapMarkers.CountAsync(Token)));
    }
}
