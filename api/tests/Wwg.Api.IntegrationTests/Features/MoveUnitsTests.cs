using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Wwg.Api.Data.Entities;
using Wwg.Api.Features.Maps;
using Wwg.Api.Features.Turns;
using Wwg.Api.IntegrationTests.Support;

namespace Wwg.Api.IntegrationTests.Features;

/// <summary>Moving the units in a hex together in one request (step 66).</summary>
public sealed class MoveUnitsTests : ApiTest
{
    private static CancellationToken Token => TestContext.Current.CancellationToken;

    private static readonly Hex North = new(0, -1);
    private static readonly Hex FarNorth = new(0, -2);

    /// <summary>
    /// Started, with a second line infantry unit ("2nd Division") in the scenario's unit's hex, and
    /// any units <paramref name="others"/> adds and places, before the start.
    /// </summary>
    private async Task<(CampaignScenario Scenario, Guid Second)> StartedAsync(
        Func<CampaignScenario, Task>? others = null
    )
    {
        var scenario = await CreateCampaignScenarioAsync();
        // The scenario's French infantry would march further in turn 1's Morning: not here.
        await TurnSteps.SetCalendarAsync(scenario);
        await TurnSteps.ReadyAsync(scenario);
        var second = await PlacedAsync(scenario, "2nd Division");
        if (others is not null)
        {
            await others(scenario);
        }

        using var started = await TurnSteps.StartAsync(scenario);
        started.EnsureSuccessStatusCode();
        return (scenario, second);
    }

    private static async Task<Guid> PlacedAsync(
        CampaignScenario scenario,
        string name,
        UnitType type = UnitType.LineInfantry,
        Hex? at = null
    )
    {
        var unit = await LibrarySteps.AddUnitAsync(scenario, name, type);
        using var placed = await TurnSteps.PlaceAsync(scenario, unit, at);
        placed.EnsureSuccessStatusCode();
        return unit;
    }

    private static async Task<HttpResponseMessage> MoveAsync(
        CampaignScenario scenario,
        Guid[] unitIds,
        Hex[] path,
        Role role = Role.Commander,
        bool forceMarch = false
    )
    {
        var turn = await TurnSteps.OpenArmyTurnAsync(scenario);
        return await scenario
            .As(role)
            .PostAsJsonAsync(
                new Uri($"/api/army-turns/{turn.Id}/move", UriKind.Relative),
                new MoveUnitsRequest(unitIds, path, forceMarch),
                Token
            );
    }

    [Theory]
    [InlineData(Role.Admin, HttpStatusCode.OK)]
    [InlineData(Role.Umpire, HttpStatusCode.OK)]
    [InlineData(Role.Commander, HttpStatusCode.OK)]
    [InlineData(Role.Player, HttpStatusCode.Forbidden)]
    [InlineData(Role.NonMember, HttpStatusCode.NotFound)]
    public async Task MoveUnits_ByRole_ReturnsExpectedStatus(Role role, HttpStatusCode expected)
    {
        var (scenario, second) = await StartedAsync();
        using var _ = scenario;

        using var response = await MoveAsync(scenario, [scenario.UnitId, second], [North], role);

        Assert.Equal(expected, response.StatusCode);
    }

    [Fact]
    public async Task MoveUnits_TwoUnitsInAHex_MovesEachAlongThePath()
    {
        var (scenario, second) = await StartedAsync();
        using var _ = scenario;

        using var response = await MoveAsync(
            scenario,
            [scenario.UnitId, second],
            [North, FarNorth]
        );

        response.EnsureSuccessStatusCode();
        var orders = (await TurnSteps.OpenArmyTurnAsync(scenario)).Orders;
        Assert.Equal(2, orders.Count);
        Assert.All(orders, o =>
            Assert.Equal(
                (OrderKind.Move, 0, -2, (double?)null, false),
                (o.Kind, o.Q, o.R, o.Progress, o.ByUmpire)
            )
        );
        Assert.All(orders, o => Assert.Equal([North, FarNorth], o.Path));
    }

    [Fact]
    public async Task MoveUnits_TooFarForTheSlowest_ChangesNothingAndNamesIt()
    {
        // Infantry go two flat hexes a turn; supply trains one.
        var (scenario, second) = await StartedAsync(s =>
            PlacedAsync(s, "Train", UnitType.SupplyTrain)
        );
        using var _ = scenario;
        var train = await UnitNamedAsync("Train");

        using var response = await MoveAsync(
            scenario,
            [scenario.UnitId, second, train],
            [North, FarNorth]
        );

        var problem = await response.AssertValidationProblemAsync("unitIds");
        Assert.StartsWith("Train: ", problem.Errors["unitIds"][0], StringComparison.Ordinal);
        Assert.Empty((await TurnSteps.OpenArmyTurnAsync(scenario)).Orders);
    }

    [Fact]
    public async Task MoveUnits_OneWouldStopPartOfTheWayIn_ChangesNothing()
    {
        var (scenario, second) = await StartedAsync();
        using var _ = scenario;
        await HighHillsAsync(scenario, North);

        using var response = await MoveAsync(scenario, [scenario.UnitId, second], [North]);

        var problem = await response.AssertValidationProblemAsync("unitIds");
        Assert.Contains("part of the way", problem.Errors["unitIds"][0], StringComparison.Ordinal);
        Assert.Empty((await TurnSteps.OpenArmyTurnAsync(scenario)).Orders);
    }

    [Fact]
    public async Task MoveUnits_SomeWithOrders_MovesOnlyTheRest()
    {
        var (scenario, second) = await StartedAsync();
        using var _ = scenario;
        var turn = await TurnSteps.OpenArmyTurnAsync(scenario);
        using var held = await TurnSteps.OrderAsync(scenario, turn.Id, TurnSteps.Hold);

        using var response = await MoveAsync(scenario, [scenario.UnitId, second], [North]);

        var moved = Assert.Single(await response.Content.ReadAsAsync<List<UnitPosition>>() ?? []);
        Assert.Equal((second, OrderKind.Move), (moved.UnitId, moved.Kind));
        var orders = (await TurnSteps.OpenArmyTurnAsync(scenario)).Orders;
        Assert.Equal(OrderKind.Hold, orders.Single(o => o.UnitId == scenario.UnitId).Kind);
    }

    [Fact]
    public async Task MoveUnits_OneInAnotherHex_ChangesNothingAndNamesIt()
    {
        var (scenario, second) = await StartedAsync(s =>
            PlacedAsync(s, "Outlier", at: new Hex(1, 0))
        );
        using var _ = scenario;
        var outlier = await UnitNamedAsync("Outlier");

        using var response = await MoveAsync(scenario, [scenario.UnitId, second, outlier], [North]);

        var problem = await response.AssertValidationProblemAsync("unitIds");
        Assert.Equal(
            "Outlier: It isn't in the same hex as the others.",
            problem.Errors["unitIds"][0]
        );
        Assert.Empty((await TurnSteps.OpenArmyTurnAsync(scenario)).Orders);
    }

    [Fact]
    public async Task MoveUnits_ABoatWithUnitsAshore_ChangesNothingAndNamesIt()
    {
        var (scenario, _) = await StartedAsync(s => PlacedAsync(s, "Barge", UnitType.Boat));
        using var _ = scenario;
        var barge = await UnitNamedAsync("Barge");

        using var response = await MoveAsync(scenario, [scenario.UnitId, barge], [North]);

        var problem = await response.AssertValidationProblemAsync("unitIds");
        Assert.StartsWith("Barge: ", problem.Errors["unitIds"][0], StringComparison.Ordinal);
        Assert.Contains("ashore", problem.Errors["unitIds"][0], StringComparison.Ordinal);
    }

    [Fact]
    public async Task MoveUnits_ForceMarch_EveryUnitForceMarches()
    {
        var (scenario, second) = await StartedAsync();
        using var _ = scenario;
        // Three flat hexes east: a flat hex further than a turn's two.
        Hex[] path = [new(1, 0), new(2, -1), new(3, -1)];

        using var response = await MoveAsync(
            scenario,
            [scenario.UnitId, second],
            path,
            forceMarch: true
        );

        response.EnsureSuccessStatusCode();
        var orders = (await TurnSteps.OpenArmyTurnAsync(scenario)).Orders;
        Assert.All(orders, o => Assert.Equal((true, 3, -1), (o.ForceMarch, o.Q, o.R)));
    }

    [Fact]
    public async Task MoveUnits_ByTheUmpire_IsOneEditWithANotePerUnit()
    {
        var (scenario, second) = await StartedAsync();
        using var _ = scenario;

        using var response = await MoveAsync(
            scenario,
            [scenario.UnitId, second],
            [North],
            Role.Umpire
        );

        response.EnsureSuccessStatusCode();
        var after = await TurnSteps.OpenArmyTurnAsync(scenario);
        Assert.All(after.Orders, o => Assert.True(o.ByUmpire));
        var edited = Assert.Single(after.History);
        Assert.Equal(ArmyTurnEventKind.Edited, edited.Kind);
        Assert.Equal(
            [
                new UnitNoteDto(scenario.UnitId, "Set to move."),
                new UnitNoteDto(second, "Set to move."),
            ],
            edited.UnitNotes.OrderBy(n => n.UnitId == second)
        );
    }

    [Fact]
    public async Task MoveUnits_NoPath_IsAValidationError()
    {
        var (scenario, second) = await StartedAsync();
        using var _ = scenario;

        using var response = await MoveAsync(scenario, [scenario.UnitId, second], []);

        await response.AssertValidationProblemAsync("path");
    }

    private async Task<Guid> UnitNamedAsync(string name) =>
        await WithDbAsync(db =>
            db.ArmyUnits.Where(u => u.Name == name).Select(u => u.Id).SingleAsync(Token)
        );

    private static async Task HighHillsAsync(CampaignScenario scenario, Hex hex)
    {
        using var response = await scenario
            .As(Role.Umpire)
            .PutAsJsonAsync(
                new Uri(
                    $"/api/campaigns/{scenario.CampaignId}/grid/cells/{hex.Q}/{hex.R}",
                    UriKind.Relative
                ),
                new UpdateHexCellRequest(Terrain.HighHill, false, HexSettlement.None),
                Token
            );
        response.EnsureSuccessStatusCode();
    }
}
