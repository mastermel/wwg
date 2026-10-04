using System.Net;
using System.Net.Http.Json;
using Wwg.Api.Data.Entities;
using Wwg.Api.Features.ArmyUnits;
using Wwg.Api.Features.Screening;
using Wwg.Api.IntegrationTests.Support;

namespace Wwg.Api.IntegrationTests.Features;

/// <summary>
/// A unit's screening (decision 0026): its commander turns it on or off, and each turn it closes
/// screening is kept. The scenario's army has hussars beside its division at the start.
/// </summary>
public sealed class ScreeningTests : ApiTest
{
    private static CancellationToken Token => TestContext.Current.CancellationToken;

    private async Task<(CampaignScenario Scenario, Guid Hussars)> StartedAsync()
    {
        var scenario = await CreateCampaignScenarioAsync();
        await TurnSteps.SetCalendarAsync(scenario);
        var hussars = await LibrarySteps.AddUnitAsync(scenario, "Hussars", UnitType.LightCavalry);
        await TurnSteps.ReadyAsync(scenario);
        using var placed = await TurnSteps.PlaceAsync(scenario, hussars);
        placed.EnsureSuccessStatusCode();
        using var started = await TurnSteps.StartAsync(scenario);
        started.EnsureSuccessStatusCode();
        return (scenario, hussars);
    }

    private static Task<HttpResponseMessage> ScreenAsync(
        CampaignScenario scenario,
        Guid unit,
        bool screening = true,
        Role role = Role.Commander
    ) =>
        scenario
            .As(role)
            .PutAsJsonAsync(
                new Uri($"/api/army-units/{unit}/screening", UriKind.Relative),
                new UpdateScreeningRequest(screening),
                Token
            );

    private static async Task<ScreeningResponse> ScreeningAsync(
        CampaignScenario scenario,
        Guid unit
    ) =>
        (
            await scenario
                .As(Role.Commander)
                .GetAsAsync<ScreeningResponse>($"/api/army-units/{unit}/screening")
        )!;

    /// <summary>The army holds, and the next turn starts.</summary>
    private static async Task NextTurnAsync(CampaignScenario scenario, Guid hussars)
    {
        var turn = await TurnSteps.OpenArmyTurnAsync(scenario);
        foreach (var unit in new[] { scenario.UnitId, hussars })
        {
            using var held = await TurnSteps.OrderAsync(scenario, turn.Id, TurnSteps.Hold, unit);
            held.EnsureSuccessStatusCode();
        }
        using var submitted = await TurnSteps.ActAsync(scenario, turn.Id, "submit", Role.Commander);
        submitted.EnsureSuccessStatusCode();
        using var approved = await TurnSteps.ActAsync(scenario, turn.Id, "approve", Role.Umpire);
        approved.EnsureSuccessStatusCode();
        using var next = await TurnSteps.StartNextTurnAsync(scenario);
        next.EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task UpdateScreening_LightCavalry_IsScreening()
    {
        var (scenario, hussars) = await StartedAsync();
        using var _ = scenario;

        using var response = await ScreenAsync(scenario, hussars);

        response.EnsureSuccessStatusCode();
        var screening = await ScreeningAsync(scenario, hussars);
        Assert.True(screening.CanScreen);
        Assert.True(screening.Screening);
        Assert.Empty(screening.Turns);
    }

    [Fact]
    public async Task UpdateScreening_LineInfantry_Conflict()
    {
        var (scenario, _) = await StartedAsync();
        using var _ = scenario;

        using var response = await ScreenAsync(scenario, scenario.UnitId);

        await response.AssertProblemAsync(HttpStatusCode.Conflict);
        Assert.False((await ScreeningAsync(scenario, scenario.UnitId)).CanScreen);
    }

    [Fact]
    public async Task UpdateScreening_AfterTheArmySubmitted_StillChanges()
    {
        var (scenario, hussars) = await StartedAsync();
        using var _ = scenario;
        var turn = await TurnSteps.OpenArmyTurnAsync(scenario);
        foreach (var unit in new[] { scenario.UnitId, hussars })
        {
            using var held = await TurnSteps.OrderAsync(scenario, turn.Id, TurnSteps.Hold, unit);
            held.EnsureSuccessStatusCode();
        }
        using var submitted = await TurnSteps.ActAsync(scenario, turn.Id, "submit", Role.Commander);
        submitted.EnsureSuccessStatusCode();

        using var response = await ScreenAsync(scenario, hussars);

        response.EnsureSuccessStatusCode();
        Assert.True((await ScreeningAsync(scenario, hussars)).Screening);
    }

    [Fact]
    public async Task StartNextTurn_AUnitScreening_KeepsTheTurnItClosed()
    {
        var (scenario, hussars) = await StartedAsync();
        using var _ = scenario;
        using var screened = await ScreenAsync(scenario, hussars);

        await NextTurnAsync(scenario, hussars);
        await NextTurnAsync(scenario, hussars);

        var screening = await ScreeningAsync(scenario, hussars);
        Assert.Equal([1, 2], screening.Turns);
        Assert.True(screening.Screening);
    }

    [Fact]
    public async Task StartNextTurn_ScreeningTurnedOffBeforeTheClose_KeepsNoTurn()
    {
        var (scenario, hussars) = await StartedAsync();
        using var _ = scenario;
        using var on = await ScreenAsync(scenario, hussars);
        using var off = await ScreenAsync(scenario, hussars, screening: false);

        await NextTurnAsync(scenario, hussars);

        Assert.Empty((await ScreeningAsync(scenario, hussars)).Turns);
    }

    [Fact]
    public async Task UpdateArmyUnit_ToATypeThatCantScreen_StopsScreening()
    {
        var (scenario, hussars) = await StartedAsync();
        using var _ = scenario;
        using var on = await ScreenAsync(scenario, hussars);

        using var changed = await scenario
            .As(Role.Umpire)
            .PutAsJsonAsync(
                new Uri($"/api/army-units/{hussars}", UriKind.Relative),
                new UpdateArmyUnitRequest(
                    "Hussars",
                    UnitType.HeavyCavalry,
                    5,
                    20,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null
                ),
                Token
            );

        changed.EnsureSuccessStatusCode();
        Assert.False((await ScreeningAsync(scenario, hussars)).Screening);
    }

    [Theory]
    [InlineData(Role.Admin, HttpStatusCode.OK)]
    [InlineData(Role.Umpire, HttpStatusCode.OK)]
    [InlineData(Role.Commander, HttpStatusCode.OK)]
    [InlineData(Role.Player, HttpStatusCode.Forbidden)]
    [InlineData(Role.NonMember, HttpStatusCode.NotFound)]
    public async Task UpdateScreening_ByRole_TheCommander(Role role, HttpStatusCode expected)
    {
        var (scenario, hussars) = await StartedAsync();
        using var _ = scenario;

        using var response = await ScreenAsync(scenario, hussars, role: role);

        Assert.Equal(expected, response.StatusCode);
    }

    [Theory]
    [InlineData(Role.Admin, HttpStatusCode.OK)]
    [InlineData(Role.Umpire, HttpStatusCode.OK)]
    [InlineData(Role.Commander, HttpStatusCode.OK)]
    [InlineData(Role.Player, HttpStatusCode.Forbidden)]
    [InlineData(Role.NonMember, HttpStatusCode.NotFound)]
    public async Task GetScreening_ByRole_TheCommander(Role role, HttpStatusCode expected)
    {
        var (scenario, hussars) = await StartedAsync();
        using var _ = scenario;

        using var response = await scenario
            .As(role)
            .GetAsync(new Uri($"/api/army-units/{hussars}/screening", UriKind.Relative), Token);

        Assert.Equal(expected, response.StatusCode);
    }
}
