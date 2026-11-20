using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Wwg.Api.Data.Entities;
using Wwg.Api.Features.Maps;
using Wwg.Api.Features.Turns;
using Wwg.Api.IntegrationTests.Support;

namespace Wwg.Api.IntegrationTests.Features;

/// <summary>Holding the rest of a formation in one request (step 64).</summary>
public sealed class HoldUnitsTests : ApiTest
{
    private static CancellationToken Token => TestContext.Current.CancellationToken;

    /// <summary>
    /// Started, with a second unit ("2nd Division", also line infantry) in the hex east of the
    /// scenario's unit's (0, 0).
    /// </summary>
    private async Task<(CampaignScenario Scenario, Guid Second)> StartedAsync()
    {
        var scenario = await CreateCampaignScenarioAsync();
        var second = await LibrarySteps.AddUnitAsync(scenario, "2nd Division");
        await TurnSteps.ReadyAsync(scenario);
        using var placed = await TurnSteps.PlaceAsync(scenario, second, new Hex(1, 0));
        placed.EnsureSuccessStatusCode();
        using var started = await TurnSteps.StartAsync(scenario);
        started.EnsureSuccessStatusCode();
        return (scenario, second);
    }

    private static Task<HttpResponseMessage> HoldAsync(
        CampaignScenario scenario,
        Guid armyTurnId,
        Guid[] unitIds,
        Role role = Role.Commander
    ) =>
        scenario
            .As(role)
            .PostAsJsonAsync(
                new Uri($"/api/army-turns/{armyTurnId}/hold", UriKind.Relative),
                new HoldUnitsRequest(unitIds),
                Token
            );

    [Theory]
    [InlineData(Role.Admin, HttpStatusCode.OK)]
    [InlineData(Role.Umpire, HttpStatusCode.OK)]
    [InlineData(Role.Commander, HttpStatusCode.OK)]
    [InlineData(Role.Player, HttpStatusCode.Forbidden)]
    [InlineData(Role.NonMember, HttpStatusCode.NotFound)]
    public async Task HoldUnits_ByRole_ReturnsExpectedStatus(Role role, HttpStatusCode expected)
    {
        var (scenario, second) = await StartedAsync();
        using var _ = scenario;
        var turn = await TurnSteps.OpenArmyTurnAsync(scenario);

        using var response = await HoldAsync(scenario, turn.Id, [scenario.UnitId, second], role);

        Assert.Equal(expected, response.StatusCode);
    }

    [Fact]
    public async Task HoldUnits_SomeWithOrders_HoldsOnlyTheRest()
    {
        var (scenario, second) = await StartedAsync();
        using var _ = scenario;
        var turn = await TurnSteps.OpenArmyTurnAsync(scenario);
        using var moved = await TurnSteps.OrderAsync(
            scenario,
            turn.Id,
            TurnSteps.Move(new Hex(0, -1))
        );

        using var response = await HoldAsync(scenario, turn.Id, [scenario.UnitId, second]);

        var held = Assert.Single(await response.Content.ReadAsAsync<List<UnitPosition>>() ?? []);
        Assert.Equal((second, OrderKind.Hold, 1, 0), (held.UnitId, held.Kind, held.Q, held.R));
        var orders = (await TurnSteps.OpenArmyTurnAsync(scenario)).Orders;
        Assert.Equal(OrderKind.Move, orders.Single(o => o.UnitId == scenario.UnitId).Kind);
        Assert.Equal(OrderKind.Hold, orders.Single(o => o.UnitId == second).Kind);
    }

    [Fact]
    public async Task HoldUnits_OneNotYetPlaced_ChangesNothingAndNamesIt()
    {
        var (scenario, second) = await StartedAsync();
        using var _ = scenario;
        var unplaced = await LibrarySteps.AddUnitAsync(scenario, "Reserve Artillery");
        var turn = await TurnSteps.OpenArmyTurnAsync(scenario);

        using var response = await HoldAsync(scenario, turn.Id, [second, unplaced]);

        var problem = await response.AssertProblemAsync(HttpStatusCode.Conflict);
        Assert.StartsWith("Reserve Artillery: ", problem.Detail, StringComparison.Ordinal);
        Assert.Empty((await TurnSteps.OpenArmyTurnAsync(scenario)).Orders);
    }

    [Fact]
    public async Task HoldUnits_UnitNotInTheArmy_Returns404()
    {
        var (scenario, _) = await StartedAsync();
        using var _ = scenario;
        var turn = await TurnSteps.OpenArmyTurnAsync(scenario);

        using var response = await HoldAsync(scenario, turn.Id, [Guid.CreateVersion7()]);

        await response.AssertProblemAsync(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task HoldUnits_NoUnits_IsAValidationError()
    {
        var (scenario, _) = await StartedAsync();
        using var _ = scenario;
        var turn = await TurnSteps.OpenArmyTurnAsync(scenario);

        using var response = await HoldAsync(scenario, turn.Id, []);

        await response.AssertValidationProblemAsync("unitIds");
    }

    [Fact]
    public async Task HoldUnits_ToASubmittedTurn_Returns409()
    {
        var (scenario, second) = await StartedAsync();
        using var _ = scenario;
        var turn = await TurnSteps.OpenArmyTurnAsync(scenario);
        await WithDbAsync(db =>
            db.ArmyTurns.Where(t => t.Id == turn.Id)
                .ExecuteUpdateAsync(
                    s => s.SetProperty(t => t.Status, ArmyTurnStatus.Submitted),
                    Token
                )
        );

        using var response = await HoldAsync(scenario, turn.Id, [second]);

        await response.AssertProblemAsync(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task HoldUnits_ByTheUmpire_IsOneEditWithANotePerUnit()
    {
        var (scenario, second) = await StartedAsync();
        using var _ = scenario;
        var turn = await TurnSteps.OpenArmyTurnAsync(scenario);

        using var response = await HoldAsync(
            scenario,
            turn.Id,
            [scenario.UnitId, second],
            Role.Umpire
        );

        response.EnsureSuccessStatusCode();
        var after = await TurnSteps.OpenArmyTurnAsync(scenario);
        Assert.All(after.Orders, o => Assert.True(o.ByUmpire));
        var edited = Assert.Single(after.History);
        Assert.Equal(ArmyTurnEventKind.Edited, edited.Kind);
        Assert.Equal(
            [
                new UnitNoteDto(scenario.UnitId, "Set to hold."),
                new UnitNoteDto(second, "Set to hold."),
            ],
            edited.UnitNotes.OrderBy(n => n.UnitId == second)
        );
    }

    [Fact]
    public async Task HoldUnits_UnitLivedOffTheLand_KeepsLivingOffTheLand()
    {
        var (scenario, second) = await StartedAsync();
        using var _ = scenario;
        // Where it was placed (turn 0, Completed), it lived off the land.
        await WithDbAsync(db =>
            db.UnitOrders.Where(o => o.UnitId == second)
                .ExecuteUpdateAsync(s => s.SetProperty(o => o.LivesOffTheLand, true), Token)
        );
        var turn = await TurnSteps.OpenArmyTurnAsync(scenario);

        using var response = await HoldAsync(scenario, turn.Id, [scenario.UnitId, second]);

        response.EnsureSuccessStatusCode();
        var orders = (await TurnSteps.OpenArmyTurnAsync(scenario)).Orders;
        Assert.True(orders.Single(o => o.UnitId == second).LivesOffTheLand);
        Assert.False(orders.Single(o => o.UnitId == scenario.UnitId).LivesOffTheLand);
    }
}
