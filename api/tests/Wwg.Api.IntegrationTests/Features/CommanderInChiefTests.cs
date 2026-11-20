using System.Net;
using System.Net.Http.Json;
using Wwg.Api.Data.Entities;
using Wwg.Api.Features.Armies;
using Wwg.Api.Features.ArmyUnits;
using Wwg.Api.IntegrationTests.Support;

namespace Wwg.Api.IntegrationTests.Features;

/// <summary>
/// Each army's Commander in Chief (step 67, decision 0032). Who may choose one is in
/// <see cref="ArmyUnitPermissionTests"/>.
/// </summary>
public sealed class CommanderInChiefTests : ApiTest
{
    private static CancellationToken Token => TestContext.Current.CancellationToken;

    private static Task<HttpResponseMessage> ChooseAsync(
        CampaignScenario scenario,
        Guid? unitId,
        Guid? armyId = null,
        Role role = Role.Umpire
    ) =>
        scenario
            .As(role)
            .PutAsJsonAsync(
                new Uri(
                    $"/api/armies/{armyId ?? scenario.ArmyId}/commander-in-chief",
                    UriKind.Relative
                ),
                new UpdateCommanderInChiefRequest(unitId),
                Token
            );

    /// <summary>The army's Commander in Chief, by the army's units, or null for none.</summary>
    private static async Task<Guid?> ChiefAsync(CampaignScenario scenario, Guid? armyId = null)
    {
        var army = await scenario
            .As(Role.Commander)
            .GetAsAsync<ArmyResponse>($"/api/armies/{armyId ?? scenario.ArmyId}");
        return army!.Units.SingleOrDefault(u => u.IsCommanderInChief)?.Id;
    }

    /// <summary>A second army in the scenario's campaign, taking units from its faction.</summary>
    private static async Task<Guid> SecondArmyAsync(CampaignScenario scenario)
    {
        using var response = await scenario
            .As(Role.Umpire)
            .PostAsJsonAsync(
                new Uri($"/api/campaigns/{scenario.CampaignId}/armies", UriKind.Relative),
                new CreateArmyRequest(
                    "Reserve",
                    null,
                    scenario.SideId,
                    FactionIds: [scenario.FactionId]
                ),
                Token
            );
        return (await response.Content.ReadAsAsync<ArmyResponse>())?.Id
            ?? throw new InvalidOperationException("No army.");
    }

    private static Task<Guid> CommanderAsync(
        CampaignScenario scenario,
        string name,
        Guid? armyId = null
    ) => LibrarySteps.AddUnitAsync(scenario, name, UnitType.Commander, 1, 0, armyId);

    [Fact]
    public async Task UpdateCommanderInChief_ACommander_IsTheArmysChief()
    {
        using var scenario = await CreateCampaignScenarioAsync();
        var napoleon = await CommanderAsync(scenario, "Napoleon");

        using var response = await ChooseAsync(scenario, napoleon);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(napoleon, await ChiefAsync(scenario));
    }

    [Fact]
    public async Task UpdateCommanderInChief_AnotherCommander_ReplacesTheLast()
    {
        using var scenario = await CreateCampaignScenarioAsync();
        var napoleon = await CommanderAsync(scenario, "Napoleon");
        var ney = await CommanderAsync(scenario, "Ney");
        using var first = await ChooseAsync(scenario, napoleon);
        first.EnsureSuccessStatusCode();

        using var response = await ChooseAsync(scenario, ney);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(ney, await ChiefAsync(scenario));
    }

    [Fact]
    public async Task UpdateCommanderInChief_TheSameCommanderAgain_StaysTheChief()
    {
        using var scenario = await CreateCampaignScenarioAsync();
        var napoleon = await CommanderAsync(scenario, "Napoleon");
        using var first = await ChooseAsync(scenario, napoleon);
        first.EnsureSuccessStatusCode();

        using var response = await ChooseAsync(scenario, napoleon);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(napoleon, await ChiefAsync(scenario));
    }

    [Fact]
    public async Task UpdateCommanderInChief_Null_LeavesTheArmyWithNone()
    {
        using var scenario = await CreateCampaignScenarioAsync();
        var napoleon = await CommanderAsync(scenario, "Napoleon");
        using var first = await ChooseAsync(scenario, napoleon);
        first.EnsureSuccessStatusCode();

        using var response = await ChooseAsync(scenario, null);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Null(await ChiefAsync(scenario));
    }

    [Fact]
    public async Task UpdateCommanderInChief_AnotherArmysChief_IsLeftAsItIs()
    {
        using var scenario = await CreateCampaignScenarioAsync();
        var reserve = await SecondArmyAsync(scenario);
        var napoleon = await CommanderAsync(scenario, "Napoleon");
        var murat = await CommanderAsync(scenario, "Murat", reserve);
        using var other = await ChooseAsync(scenario, murat, reserve);
        other.EnsureSuccessStatusCode();

        using var response = await ChooseAsync(scenario, napoleon);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(murat, await ChiefAsync(scenario, reserve));
    }

    [Fact]
    public async Task UpdateCommanderInChief_NotACommander_Conflict()
    {
        using var scenario = await CreateCampaignScenarioAsync();

        using var response = await ChooseAsync(scenario, scenario.UnitId);

        await response.AssertProblemAsync(HttpStatusCode.Conflict);
        Assert.Null(await ChiefAsync(scenario));
    }

    [Fact]
    public async Task UpdateCommanderInChief_AnotherArmysCommander_IsAValidationError()
    {
        using var scenario = await CreateCampaignScenarioAsync();
        var reserve = await SecondArmyAsync(scenario);
        var murat = await CommanderAsync(scenario, "Murat", reserve);

        using var response = await ChooseAsync(scenario, murat);

        await response.AssertValidationProblemAsync("unitId");
        Assert.Null(await ChiefAsync(scenario, reserve));
    }

    [Fact]
    public async Task UpdateCommanderInChief_OnceStarted_IsAllowed()
    {
        using var scenario = await CreateCampaignScenarioAsync();
        var napoleon = await CommanderAsync(scenario, "Napoleon");
        await TurnSteps.ReadyAsync(scenario);
        using var placed = await TurnSteps.PlaceAsync(scenario, napoleon);
        placed.EnsureSuccessStatusCode();
        using var started = await TurnSteps.StartAsync(scenario);
        started.EnsureSuccessStatusCode();

        using var response = await ChooseAsync(scenario, napoleon);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(napoleon, await ChiefAsync(scenario));
    }

    [Fact]
    public async Task UpdateArmyUnit_TheChiefToAnotherType_IsNoLongerTheChief()
    {
        using var scenario = await CreateCampaignScenarioAsync();
        var napoleon = await CommanderAsync(scenario, "Napoleon");
        using var chosen = await ChooseAsync(scenario, napoleon);
        chosen.EnsureSuccessStatusCode();

        using var response = await scenario
            .As(Role.Umpire)
            .PutAsJsonAsync(
                new Uri($"/api/army-units/{napoleon}", UriKind.Relative),
                new UpdateArmyUnitRequest(
                    "Napoleon",
                    UnitType.HeavyCavalry,
                    1,
                    0,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null
                ),
                Token
            );

        response.EnsureSuccessStatusCode();
        Assert.False((await response.Content.ReadAsAsync<ArmyUnitResponse>())!.IsCommanderInChief);
        Assert.Null(await ChiefAsync(scenario));
    }
}
