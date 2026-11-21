using System.Net;
using System.Net.Http.Json;
using Wwg.Api.Data.Entities;
using Wwg.Api.Features.Armies;
using Wwg.Api.Features.ArmyUnits;
using Wwg.Api.Features.Intelligence;
using Wwg.Api.Features.Maps;
using Wwg.Api.Features.Sightings;
using Wwg.Api.Features.Turns;
using Wwg.Api.IntegrationTests.Support;

namespace Wwg.Api.IntegrationTests.Features;

/// <summary>
/// The Umpire's reports to an army (step 70, decision 0035). The scenario's army (the recipient)
/// has its unit at (0, 0); an ally of its side, commanded by the scenario's Player, a unit at
/// (1, 0); and an enemy two units at (-1, 0) and one at (-1, 1). Turn 1 is open.
/// </summary>
public sealed class UmpireReportTests : ApiTest
{
    private static CancellationToken Token => TestContext.Current.CancellationToken;

    private sealed record Units(Guid Ally, Guid Guard, Guid Line, Guid FarOff);

    private async Task<(CampaignScenario Scenario, Units Units)> StartedAsync(bool start = true)
    {
        var scenario = await CreateCampaignScenarioAsync();
        await TurnSteps.SetCalendarAsync(scenario);
        await TurnSteps.SetAreaAsync(scenario);
        using var placed = await TurnSteps.PlaceAsync(scenario, scenario.UnitId);
        placed.EnsureSuccessStatusCode();
        var ally = await ArmyAsync(scenario, "Allies", scenario.SideId, scenario.PlayerMemberId);
        var enemy = await ArmyAsync(scenario, "Enemy", scenario.OtherSideId, null);
        var units = new Units(
            await UnitAsync(scenario, ally, "Allied brigade", new Hex(1, 0)),
            await UnitAsync(scenario, enemy, "Guard", new Hex(-1, 0), points: 30),
            await UnitAsync(scenario, enemy, "Line", new Hex(-1, 0)),
            await UnitAsync(scenario, enemy, "Far off", new Hex(-1, 1))
        );
        if (start)
        {
            using var started = await TurnSteps.StartAsync(scenario);
            started.EnsureSuccessStatusCode();
        }
        return (scenario, units);
    }

    private static async Task<Guid> ArmyAsync(
        CampaignScenario scenario,
        string name,
        Guid side,
        Guid? commander
    )
    {
        using var created = await scenario
            .As(Role.Umpire)
            .PostAsJsonAsync(
                new Uri($"/api/campaigns/{scenario.CampaignId}/armies", UriKind.Relative),
                new CreateArmyRequest(name, commander, side),
                Token
            );
        return (await created.Content.ReadAsAsync<ArmyResponse>())!.Id;
    }

    private static async Task<Guid> UnitAsync(
        CampaignScenario scenario,
        Guid army,
        string name,
        Hex at,
        int points = 20
    )
    {
        var unit = await LibrarySteps.AddUnitAsync(scenario, name, points: points, armyId: army);
        using var placed = await TurnSteps.PlaceAsync(scenario, unit, at);
        placed.EnsureSuccessStatusCode();
        return unit;
    }

    private static Task<HttpResponseMessage> SendAsync(
        CampaignScenario scenario,
        SendUmpireReportRequest request,
        Role role = Role.Umpire
    ) =>
        scenario
            .As(role)
            .PostAsJsonAsync(
                new Uri($"/api/armies/{scenario.ArmyId}/umpire-reports", UriKind.Relative),
                request,
                Token
            );

    private static UmpireSightingRequest Sighting(params Guid[] units) =>
        new(units, true, true, true, SightingStrength.Exact);

    private static SendUmpireReportRequest Everything(Units units) =>
        new("Your allies are to the east.", [units.Ally], [Sighting(units.Guard)]);

    private static async Task<List<ReportResponse>> ReportsAsync(
        CampaignScenario scenario,
        Role role
    ) =>
        (
            await scenario
                .As(role)
                .GetAsAsync<List<ReportResponse>>($"/api/campaigns/{scenario.CampaignId}/reports")
        )!;

    [Fact]
    public async Task SendUmpireReport_TheArmyHasItAtOnce_FromTheUmpire()
    {
        var (scenario, units) = await StartedAsync();
        using var _ = scenario;

        using var sent = await SendAsync(scenario, Everything(units));

        Assert.Equal(HttpStatusCode.Created, sent.StatusCode);
        var report = Assert.Single(await ReportsAsync(scenario, Role.Commander));
        Assert.Equal(
            (true, (Guid?)null, 1, (int?)1, (CourierStatus?)CourierStatus.Arrived, 1),
            (
                report.FromUmpire,
                report.FromArmyId,
                report.SentTurn,
                report.ArrivedTurn,
                report.Status,
                report.SightingCount
            )
        );
        Assert.Equal("Your allies are to the east.", report.Note);
    }

    [Fact]
    public async Task SendUmpireReport_APosition_IsExactAndNamesItsArmy()
    {
        var (scenario, units) = await StartedAsync();
        using var _ = scenario;
        var ally = (
            await scenario
                .As(Role.Umpire)
                .GetAsAsync<List<ArmySummary>>($"/api/campaigns/{scenario.CampaignId}/armies")
        )!.Single(a => string.Equals(a.Name, "Allies", StringComparison.Ordinal));

        using var sent = await SendAsync(scenario, new(null, [units.Ally], []));

        var report = await sent.Content.ReadAsAsync<ReportResponse>();
        var unit = Assert.Single(report!.Snapshot!);
        Assert.Equal(
            ("Allied brigade", 1, 0, 20, ally.Id),
            (unit.Name, unit.Q, unit.R, unit.Points, unit.ArmyId)
        );
    }

    [Fact]
    public async Task SendUmpireReport_APosition_IsWhereTheTurnStarted_NotWhereItsOrdersTakeIt()
    {
        var (scenario, units) = await StartedAsync();
        using var _ = scenario;
        var turns = await scenario
            .As(Role.Umpire)
            .GetAsAsync<List<ArmyTurnDetails>>(
                $"/api/armies/{(await ArmyOfAsync(scenario, units.Ally))}/turns"
            );
        using var moved = await TurnSteps.OrderAsync(
            scenario,
            turns!.Single(t => t.Open).Id,
            TurnSteps.Move(new Hex(2, 0)),
            units.Ally,
            Role.Player
        );
        moved.EnsureSuccessStatusCode();

        using var sent = await SendAsync(scenario, new(null, [units.Ally], []));

        var unit = Assert.Single((await sent.Content.ReadAsAsync<ReportResponse>())!.Snapshot!);
        Assert.Equal((1, 0), (unit.Q, unit.R));
    }

    private static async Task<Guid> ArmyOfAsync(CampaignScenario scenario, Guid unit) =>
        (
            await scenario
                .As(Role.Umpire)
                .GetAsAsync<List<ArmyUnitResponse>>($"/api/campaigns/{scenario.CampaignId}/units")
        )!
            .Single(u => u.Id == unit)
            .ArmyId;

    [Fact]
    public async Task SendUmpireReport_ASighting_IsTheArmysOnTheOpenTurn_OfTheChosenUnitsOnly()
    {
        var (scenario, units) = await StartedAsync();
        using var _ = scenario;

        using var sent = await SendAsync(scenario, new(null, [], [Sighting(units.Guard)]));
        sent.EnsureSuccessStatusCode();

        var sighting = Assert.Single(
            (
                await scenario
                    .As(Role.Commander)
                    .GetAsAsync<List<SightingResponse>>(
                        $"/api/campaigns/{scenario.CampaignId}/sightings"
                    )
            )!
        );
        Assert.Equal(
            (scenario.ArmyId, 1, (int?)-1, (int?)0, (int?)30, true, (Guid?)null),
            (
                sighting.ObservingArmyId,
                sighting.Turn,
                sighting.Q,
                sighting.R,
                sighting.Points,
                sighting.ByUmpire,
                sighting.SharedByArmyId
            )
        );
        Assert.Equal([UnitType.LineInfantry], sighting.UnitTypes);
    }

    [Fact]
    public async Task SendUmpireReport_ARoughSightingWithoutASize_IsAValidationError()
    {
        var (scenario, units) = await StartedAsync();
        using var _ = scenario;

        using var sent = await SendAsync(
            scenario,
            new(null, [], [new([units.Guard], true, true, true, SightingStrength.Rough)])
        );

        await sent.AssertValidationProblemAsync("sightings");
    }

    [Fact]
    public async Task SendUmpireReport_APositionOfTheOtherSide_IsAValidationError()
    {
        var (scenario, units) = await StartedAsync();
        using var _ = scenario;

        using var sent = await SendAsync(scenario, new(null, [units.Guard], []));

        await sent.AssertValidationProblemAsync("positions");
    }

    [Fact]
    public async Task SendUmpireReport_ASightingOfTheArmysOwnSide_IsAValidationError()
    {
        var (scenario, units) = await StartedAsync();
        using var _ = scenario;

        using var sent = await SendAsync(scenario, new(null, [], [Sighting(units.Ally)]));

        await sent.AssertValidationProblemAsync("sightings");
    }

    [Fact]
    public async Task SendUmpireReport_ASightingAcrossTwoHexes_IsAValidationError()
    {
        var (scenario, units) = await StartedAsync();
        using var _ = scenario;

        using var sent = await SendAsync(
            scenario,
            new(null, [], [Sighting(units.Guard, units.FarOff)])
        );

        await sent.AssertValidationProblemAsync("sightings");
    }

    [Fact]
    public async Task SendUmpireReport_WithNothingInIt_IsAValidationError()
    {
        var (scenario, _) = await StartedAsync();
        using var __ = scenario;

        using var sent = await SendAsync(scenario, new("  ", [], []));

        await sent.AssertValidationProblemAsync("note");
    }

    [Fact]
    public async Task SendUmpireReport_WhileSettingUp_IsAConflict()
    {
        var (scenario, units) = await StartedAsync(start: false);
        using var _ = scenario;

        using var sent = await SendAsync(scenario, Everything(units));

        await sent.AssertProblemAsync(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task ListReports_AnotherArmysCommander_DoesntSeeIt()
    {
        var (scenario, units) = await StartedAsync();
        using var _ = scenario;
        using var sent = await SendAsync(scenario, Everything(units));
        sent.EnsureSuccessStatusCode();

        Assert.Empty(await ReportsAsync(scenario, Role.Player));
    }

    [Fact]
    public async Task ListCouriers_LeavesOutTheUmpiresReports()
    {
        var (scenario, units) = await StartedAsync();
        using var _ = scenario;
        using var sent = await SendAsync(scenario, Everything(units));
        sent.EnsureSuccessStatusCode();

        var couriers = await scenario
            .As(Role.Umpire)
            .GetAsAsync<List<CourierResponse>>($"/api/campaigns/{scenario.CampaignId}/couriers");

        Assert.Empty(couriers!);
    }

    [Fact]
    public async Task StopCourier_AnUmpiresReport_IsAConflict()
    {
        var (scenario, units) = await StartedAsync();
        using var _ = scenario;
        using var sent = await SendAsync(scenario, Everything(units));
        var report = await sent.Content.ReadAsAsync<ReportResponse>();

        using var stopped = await scenario
            .As(Role.Umpire)
            .PostAsJsonAsync(
                new Uri($"/api/reports/{report!.Id}/stop", UriKind.Relative),
                new StopCourierRequest("Captured."),
                Token
            );

        await stopped.AssertProblemAsync(HttpStatusCode.Conflict);
    }

    [Theory]
    [InlineData(Role.Admin, HttpStatusCode.Created)]
    [InlineData(Role.Umpire, HttpStatusCode.Created)]
    [InlineData(Role.Commander, HttpStatusCode.Forbidden)]
    [InlineData(Role.Player, HttpStatusCode.Forbidden)]
    [InlineData(Role.NonMember, HttpStatusCode.NotFound)]
    public async Task SendUmpireReport_ByRole_TheUmpire(Role role, HttpStatusCode expected)
    {
        var (scenario, units) = await StartedAsync();
        using var _ = scenario;

        using var sent = await SendAsync(scenario, Everything(units), role);

        Assert.Equal(expected, sent.StatusCode);
    }
}
