using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Wwg.Api.Data.Entities;
using Wwg.Api.Features.Maps;
using Wwg.Api.Features.Turns;
using Wwg.Api.IntegrationTests.Support;

namespace Wwg.Api.IntegrationTests.Features;

/// <summary>Taking back several units' orders in one request, a hex's stack say.</summary>
public sealed class UndoOrdersTests : ApiTest
{
    private static CancellationToken Token => TestContext.Current.CancellationToken;

    /// <summary>
    /// Started, with a second unit ("2nd Division") in the hex east of the scenario's unit's, and
    /// both told to hold.
    /// </summary>
    private async Task<(CampaignScenario Scenario, Guid Second, Guid TurnId)> HeldAsync()
    {
        var scenario = await CreateCampaignScenarioAsync();
        var second = await LibrarySteps.AddUnitAsync(scenario, "2nd Division");
        await TurnSteps.ReadyAsync(scenario);
        using var placed = await TurnSteps.PlaceAsync(scenario, second, new Hex(1, 0));
        placed.EnsureSuccessStatusCode();
        using var started = await TurnSteps.StartAsync(scenario);
        started.EnsureSuccessStatusCode();
        var turn = await TurnSteps.OpenArmyTurnAsync(scenario);
        using var held = await scenario
            .As(Role.Commander)
            .PostAsJsonAsync(
                new Uri($"/api/army-turns/{turn.Id}/hold", UriKind.Relative),
                new HoldUnitsRequest([scenario.UnitId, second]),
                Token
            );
        held.EnsureSuccessStatusCode();
        return (scenario, second, turn.Id);
    }

    private static Task<HttpResponseMessage> UndoAsync(
        CampaignScenario scenario,
        Guid armyTurnId,
        Guid[] unitIds,
        Role role = Role.Commander
    ) =>
        scenario
            .As(role)
            .PostAsJsonAsync(
                new Uri($"/api/army-turns/{armyTurnId}/undo", UriKind.Relative),
                new UndoOrdersRequest(unitIds),
                Token
            );

    [Theory]
    [InlineData(Role.Admin, HttpStatusCode.NoContent)]
    [InlineData(Role.Umpire, HttpStatusCode.NoContent)]
    [InlineData(Role.Commander, HttpStatusCode.NoContent)]
    [InlineData(Role.Player, HttpStatusCode.Forbidden)]
    [InlineData(Role.NonMember, HttpStatusCode.NotFound)]
    public async Task UndoOrders_ByRole_ReturnsExpectedStatus(Role role, HttpStatusCode expected)
    {
        var (scenario, second, turnId) = await HeldAsync();
        using var _ = scenario;

        using var response = await UndoAsync(scenario, turnId, [scenario.UnitId, second], role);

        Assert.Equal(expected, response.StatusCode);
    }

    [Fact]
    public async Task UndoOrders_TheGivenUnits_TakesBackOnlyTheirs()
    {
        var (scenario, second, turnId) = await HeldAsync();
        using var _ = scenario;

        using var response = await UndoAsync(scenario, turnId, [second]);

        response.EnsureSuccessStatusCode();
        var order = Assert.Single((await TurnSteps.OpenArmyTurnAsync(scenario)).Orders);
        Assert.Equal(scenario.UnitId, order.UnitId);
    }

    [Fact]
    public async Task UndoOrders_SomeWithoutOrders_SkipsThem()
    {
        var (scenario, second, turnId) = await HeldAsync();
        using var _ = scenario;
        using var first = await UndoAsync(scenario, turnId, [second]);
        first.EnsureSuccessStatusCode();

        using var response = await UndoAsync(scenario, turnId, [scenario.UnitId, second]);

        response.EnsureSuccessStatusCode();
        Assert.Empty((await TurnSteps.OpenArmyTurnAsync(scenario)).Orders);
    }

    [Fact]
    public async Task UndoOrders_UnitNotInTheArmy_ChangesNothingAndReturns404()
    {
        var (scenario, second, turnId) = await HeldAsync();
        using var _ = scenario;

        using var response = await UndoAsync(scenario, turnId, [second, Guid.CreateVersion7()]);

        await response.AssertProblemAsync(HttpStatusCode.NotFound);
        Assert.Equal(2, (await TurnSteps.OpenArmyTurnAsync(scenario)).Orders.Count);
    }

    [Fact]
    public async Task UndoOrders_NoUnits_IsAValidationError()
    {
        var (scenario, _, turnId) = await HeldAsync();
        using var _ = scenario;

        using var response = await UndoAsync(scenario, turnId, []);

        await response.AssertValidationProblemAsync("unitIds");
    }

    [Fact]
    public async Task UndoOrders_ToASubmittedTurn_Returns409()
    {
        var (scenario, second, turnId) = await HeldAsync();
        using var _ = scenario;
        await WithDbAsync(db =>
            db.ArmyTurns.Where(t => t.Id == turnId)
                .ExecuteUpdateAsync(
                    s => s.SetProperty(t => t.Status, ArmyTurnStatus.Submitted),
                    Token
                )
        );

        using var response = await UndoAsync(scenario, turnId, [second]);

        await response.AssertProblemAsync(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task UndoOrders_ByTheUmpire_IsOneEditWithANotePerUnit()
    {
        var (scenario, second, turnId) = await HeldAsync();
        using var _ = scenario;

        using var response = await UndoAsync(
            scenario,
            turnId,
            [scenario.UnitId, second],
            Role.Umpire
        );

        response.EnsureSuccessStatusCode();
        var after = await TurnSteps.OpenArmyTurnAsync(scenario);
        Assert.Empty(after.Orders);
        var edited = Assert.Single(after.History);
        Assert.Equal(ArmyTurnEventKind.Edited, edited.Kind);
        Assert.Equal(
            [
                new UnitNoteDto(scenario.UnitId, "Order taken back."),
                new UnitNoteDto(second, "Order taken back."),
            ],
            edited.UnitNotes.OrderBy(n => n.UnitId == second)
        );
    }
}
