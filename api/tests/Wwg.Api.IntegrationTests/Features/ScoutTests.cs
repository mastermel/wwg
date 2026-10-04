using System.Net.Http.Json;
using Wwg.Api.Data.Entities;
using Wwg.Api.Features.Maps;
using Wwg.Api.Features.Supply;
using Wwg.Api.Features.Turns;
using Wwg.Api.IntegrationTests.Support;

namespace Wwg.Api.IntegrationTests.Features;

/// <summary>
/// Scouts only watch (step 58b, decision 0028): no forced marches, no boat building, no supply or
/// attrition. (Towns are in <see cref="VictoryTests"/>; movement in <see cref="MovementTests"/>.)
/// The scout is placed at the start hex, beside the scenario's unit.
/// </summary>
public sealed class ScoutTests : ApiTest
{
    private static CancellationToken Token => TestContext.Current.CancellationToken;

    private static readonly Hex East = new(1, 0);

    /// <summary>Started, turn 1 a Morning, with a scout placed: its ID.</summary>
    private async Task<(CampaignScenario Scenario, Guid Scout)> StartedAsync()
    {
        var scenario = await CreateCampaignScenarioAsync();
        await TurnSteps.SetCalendarAsync(scenario);
        await TurnSteps.ReadyAsync(scenario);
        var scout = await LibrarySteps.AddScoutAsync(scenario);
        using var placed = await TurnSteps.PlaceAsync(scenario, scout);
        placed.EnsureSuccessStatusCode();
        using var started = await TurnSteps.StartAsync(scenario);
        started.EnsureSuccessStatusCode();
        return (scenario, scout);
    }

    private static async Task<HttpResponseMessage> OrderAsync(
        CampaignScenario scenario,
        Guid scout,
        GiveOrderRequest order
    )
    {
        var turn = await TurnSteps.OpenArmyTurnAsync(scenario);
        return await TurnSteps.OrderAsync(scenario, turn.Id, order, scout);
    }

    [Fact]
    public async Task GiveOrder_AScoutsMove_IsAllowed()
    {
        var (scenario, scout) = await StartedAsync();
        using var _ = scenario;

        using var response = await OrderAsync(scenario, scout, TurnSteps.Move(East));

        response.EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task GiveOrder_AScoutsForceMarch_IsAValidationError()
    {
        var (scenario, scout) = await StartedAsync();
        using var _ = scenario;

        using var response = await OrderAsync(scenario, scout, TurnSteps.ForceMarch(East));

        await response.AssertValidationProblemAsync("forceMarch");
    }

    [Fact]
    public async Task GiveOrder_AScoutBuildingABoat_IsAValidationError()
    {
        var (scenario, scout) = await StartedAsync();
        using var _ = scenario;

        using var response = await OrderAsync(
            scenario,
            scout,
            new GiveOrderRequest(OrderKind.BuildBoat, null)
        );

        await response.AssertValidationProblemAsync("kind");
    }

    [Fact]
    public async Task ListMarches_AfterThreeMoves_LeavesTheScoutOut()
    {
        var (scenario, scout) = await StartedAsync();
        using var _ = scenario;
        var moves = new[] { East, TurnSteps.Start, East };
        foreach (var to in moves)
        {
            using var given = await OrderAsync(scenario, scout, TurnSteps.Move(to));
            given.EnsureSuccessStatusCode();
            await TurnSteps.PlayAsync(scenario, "hold");
        }

        var marches = await scenario
            .As(Role.Commander)
            .GetAsAsync<List<UnitMarchResponse>>($"/api/armies/{scenario.ArmyId}/marches");

        Assert.Equal([scenario.UnitId], marches!.Select(m => m.UnitId));
    }

    [Fact]
    public async Task GetSupply_AScout_IsExemptWhateverTheCampaignExempts()
    {
        var (scenario, scout) = await StartedAsync();
        using var _ = scenario;
        using var settings = await scenario
            .As(Role.Umpire)
            .PutAsJsonAsync(
                new Uri($"/api/campaigns/{scenario.CampaignId}/supply-settings", UriKind.Relative),
                new UpdateCampaignSupplySettingsRequest(1, [], []),
                Token
            );
        settings.EnsureSuccessStatusCode();

        var supply = await scenario
            .As(Role.Commander)
            .GetAsAsync<CampaignSupplyResponse>($"/api/campaigns/{scenario.CampaignId}/supply");

        Assert.Equal(SupplyState.Exempt, supply!.Units.Single(u => u.UnitId == scout).State);
    }
}
