using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Wwg.Api.Data.Entities;
using Wwg.Api.Features.Armies;
using Wwg.Api.Features.ArmyUnits;
using Wwg.Api.Features.Campaigns;
using Wwg.Api.Features.Library;
using Wwg.Api.IntegrationTests.Support;

namespace Wwg.Api.IntegrationTests.Features;

public sealed class ArmyUnitTests : ApiTest
{
    private static async Task<List<string>> UnitNamesAsync(CampaignScenario scenario)
    {
        var army = await scenario
            .As(Role.Commander)
            .GetAsAsync<ArmyResponse>($"/api/armies/{scenario.ArmyId}");
        return [.. army!.Units.Select(u => u.Name)];
    }

    /// <summary>A library unit in the scenario's faction (which its army takes units from).</summary>
    private static Task<Guid> LibraryUnitAsync(
        CampaignScenario scenario,
        string name,
        UnitType type = UnitType.LineInfantry,
        int fightingFactor = 5,
        int points = 10,
        Guid? factionId = null,
        string? division = null,
        string? brigade = null
    ) =>
        LibrarySteps.CreateUnitAsync(
            scenario.As(Role.Admin),
            factionId ?? scenario.FactionId,
            name,
            type,
            fightingFactor,
            points,
            division,
            brigade
        );

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
                TestContext.Current.CancellationToken
            );
        return (await response.Content.ReadAsAsync<ArmyResponse>())?.Id
            ?? throw new InvalidOperationException("No army.");
    }

    private static async Task<ArmyResponse> ArmyAsync(CampaignScenario scenario) =>
        (
            await scenario
                .As(Role.Umpire)
                .GetAsAsync<ArmyResponse>($"/api/armies/{scenario.ArmyId}")
        )!; // The Umpire sees every army.

    private static UpdateArmyUnitRequest Change(
        string name,
        UnitType type,
        int fightingFactor,
        int points
    ) => new(name, type, fightingFactor, points, null, null, null, null, null, null);

    private static Task<HttpResponseMessage> UpdateAsync(
        CampaignScenario scenario,
        Guid unitId,
        UpdateArmyUnitRequest request
    ) =>
        scenario
            .As(Role.Umpire)
            .PutAsJsonAsync(
                new Uri($"/api/army-units/{unitId}", UriKind.Relative),
                request,
                CancellationToken
            );

    [Fact]
    public async Task AddUnits_FromTheArmysFaction_AddsCopiesOfThem()
    {
        using var scenario = await CreateCampaignScenarioAsync();
        var libraryUnit = await LibraryUnitAsync(
            scenario,
            "Light Division",
            UnitType.LightInfantry,
            fightingFactor: 6,
            points: 35,
            division: "3rd Division",
            brigade: "95th Rifles"
        );

        using var response = await LibrarySteps.AddAsync(
            scenario.As(Role.Umpire),
            scenario.ArmyId,
            libraryUnit
        );

        var added = await response.Content.ReadAsAsync<List<ArmyUnitResponse>>();
        var unit = Assert.Single(added!);
        Assert.NotEqual(libraryUnit, unit.Id);
        Assert.Equal(
            new ArmyUnitResponse(
                unit.Id,
                scenario.ArmyId,
                libraryUnit,
                scenario.FactionId,
                // The faction is French: it marches as France.
                Nation.France,
                "Light Division",
                UnitType.LightInfantry,
                6,
                35,
                "3rd Division",
                "95th Rifles",
                null,
                null,
                null,
                null,
                null
            ),
            unit
        );
    }

    [Fact]
    public async Task AddUnits_FromTheLibrary_CopiesTheCorpsAndCommanders()
    {
        using var scenario = await CreateCampaignScenarioAsync();
        using var created = await scenario
            .As(Role.Admin)
            .PostAsJsonAsync(
                new Uri($"/api/factions/{scenario.FactionId}/units", UriKind.Relative),
                new SaveUnitRequest(
                    "1st Foot Guards",
                    UnitType.LineInfantry,
                    8,
                    44,
                    "1st Division",
                    "1st Brigade",
                    "I Corps",
                    "L.G. Sir John Moore",
                    "L.G. Lord Edward Paget",
                    "M.G. Peregrine Maitland",
                    "sub in V",
                    UnitStatus.Painted
                ),
                CancellationToken
            );
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var libraryUnit = (await created.Content.ReadAsAsync<UnitResponse>())!.Id; // Asserted just above.

        using var response = await LibrarySteps.AddAsync(
            scenario.As(Role.Umpire),
            scenario.ArmyId,
            libraryUnit
        );

        var unit = Assert.Single((await response.Content.ReadAsAsync<List<ArmyUnitResponse>>())!);
        Assert.Equal(
            ("I Corps", "L.G. Sir John Moore", "L.G. Lord Edward Paget", "M.G. Peregrine Maitland"),
            (unit.Corps, unit.CorpsCommander, unit.DivisionCommander, unit.BrigadeCommander)
        );
        Assert.Null(unit.ImportOrder); // Entered by hand, not imported.
    }

    [Fact]
    public async Task AddUnits_Several_AddsThemAllSortedByName()
    {
        using var scenario = await CreateCampaignScenarioAsync();
        var guard = await LibraryUnitAsync(scenario, "Guard");
        var artillery = await LibraryUnitAsync(scenario, "artillery");

        using var response = await LibrarySteps.AddAsync(
            scenario.As(Role.Umpire),
            scenario.ArmyId,
            guard,
            artillery,
            guard
        );

        var added = await response.Content.ReadAsAsync<List<ArmyUnitResponse>>();
        Assert.Equal(["artillery", "Guard"], added!.Select(u => u.Name).ToList());
    }

    [Fact]
    public async Task AddUnits_FromAFactionTheArmyHasntChosen_Returns409()
    {
        using var scenario = await CreateCampaignScenarioAsync();
        var british = await LibrarySteps.CreateFactionAsync(
            scenario.As(Role.Admin),
            "British",
            Nation.Britain
        );
        var rifles = await LibraryUnitAsync(scenario, "95th Rifles", factionId: british);

        using var response = await LibrarySteps.AddAsync(
            scenario.As(Role.Umpire),
            scenario.ArmyId,
            rifles
        );

        await response.AssertProblemAsync(HttpStatusCode.Conflict);
        Assert.Equal(["1st Division"], await UnitNamesAsync(scenario));
    }

    [Fact]
    public async Task AddUnits_AlreadyInAnotherArmyOfTheCampaign_Returns409()
    {
        using var scenario = await CreateCampaignScenarioAsync();
        var reserve = await SecondArmyAsync(scenario);
        var firstDivision = (
            await scenario
                .As(Role.Umpire)
                .GetAsAsync<ArmyResponse>($"/api/armies/{scenario.ArmyId}")
        )!
            .Units[0]
            .UnitId!
            .Value; // Copied from the library.

        using var response = await LibrarySteps.AddAsync(
            scenario.As(Role.Umpire),
            reserve,
            firstDivision
        );

        await response.AssertProblemAsync(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task AddUnits_AlreadyInAnotherCampaign_IsAllowed()
    {
        using var first = await CreateCampaignScenarioAsync();
        var guard = await LibraryUnitAsync(first, "Guard");
        using var added = await LibrarySteps.AddAsync(first.As(Role.Umpire), first.ArmyId, guard);
        added.EnsureSuccessStatusCode();
        using var campaign = await first
            .As(Role.Umpire)
            .PostAsJsonAsync(
                new Uri("/api/campaigns", UriKind.Relative),
                new CreateCampaignRequest("The Hundred Days", null),
                CancellationToken
            );
        var campaignId = (await campaign.Content.ReadAsAsync<CampaignResponse>())!.Id;
        using var army = await first
            .As(Role.Umpire)
            .PostAsJsonAsync(
                new Uri($"/api/campaigns/{campaignId}/armies", UriKind.Relative),
                new CreateArmyRequest(
                    "Armée du Nord",
                    null,
                    // One of the new campaign's own two sides.
                    (
                        await first
                            .As(Role.Umpire)
                            .GetAsAsync<List<Wwg.Api.Features.Sides.SideResponse>>(
                                $"/api/campaigns/{campaignId}/sides"
                            )
                    )![0].Id,
                    FactionIds: [first.FactionId]
                ),
                CancellationToken
            );
        var armyId = (await army.Content.ReadAsAsync<ArmyResponse>())!.Id;

        using var response = await LibrarySteps.AddAsync(first.As(Role.Umpire), armyId, guard);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task AddUnits_UnknownUnit_IsAValidationError()
    {
        using var scenario = await CreateCampaignScenarioAsync();

        using var response = await LibrarySteps.AddAsync(
            scenario.As(Role.Umpire),
            scenario.ArmyId,
            Guid.CreateVersion7()
        );

        await response.AssertValidationProblemAsync("unitIds");
    }

    [Fact]
    public async Task AddUnits_None_IsAValidationError()
    {
        using var scenario = await CreateCampaignScenarioAsync();

        using var response = await LibrarySteps.AddAsync(scenario.As(Role.Umpire), scenario.ArmyId);

        await response.AssertValidationProblemAsync("unitIds");
    }

    [Fact]
    public async Task UpdateLibraryUnit_AfterItJoined_LeavesTheCampaignsCopy()
    {
        using var scenario = await CreateCampaignScenarioAsync();
        var army = await scenario
            .As(Role.Umpire)
            .GetAsAsync<ArmyResponse>($"/api/armies/{scenario.ArmyId}");

        using var response = await scenario
            .As(Role.Admin)
            .PutAsJsonAsync(
                new Uri($"/api/units/{army!.Units[0].UnitId}", UriKind.Relative),
                new SaveUnitRequest(
                    "Old Guard",
                    UnitType.LineInfantry,
                    9,
                    80,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null
                ),
                CancellationToken
            );

        response.EnsureSuccessStatusCode();
        Assert.Equal(["1st Division"], await UnitNamesAsync(scenario));
    }

    [Fact]
    public async Task GetArmy_ListsItsUnitsByNameIgnoringCase()
    {
        using var scenario = await CreateCampaignScenarioAsync();
        await LibrarySteps.AddUnitAsync(scenario, "cavalry brigade");
        await LibrarySteps.AddUnitAsync(scenario, "Artillery");

        Assert.Equal(
            ["1st Division", "Artillery", "cavalry brigade"],
            await UnitNamesAsync(scenario)
        );
    }

    [Fact]
    public async Task UpdateUnit_ChangesEverything()
    {
        using var scenario = await CreateCampaignScenarioAsync();

        using var response = await scenario
            .As(Role.Umpire)
            .PutAsJsonAsync(
                new Uri($"/api/army-units/{scenario.UnitId}", UriKind.Relative),
                new UpdateArmyUnitRequest(
                    " Horse Guards ",
                    UnitType.HeavyCavalry,
                    8,
                    60,
                    " Cavalry Reserve ",
                    " Household Brigade ",
                    " Reserve Corps ",
                    " Uxbridge ",
                    " Somerset ",
                    " Ponsonby "
                ),
                CancellationToken
            );

        var libraryUnit = (
            await scenario
                .As(Role.Umpire)
                .GetAsAsync<ArmyResponse>($"/api/armies/{scenario.ArmyId}")
        )!
            .Units[0]
            .UnitId!
            .Value; // Copied from the library.
        var expected = new ArmyUnitResponse(
            scenario.UnitId,
            scenario.ArmyId,
            libraryUnit,
            scenario.FactionId,
            Nation.France,
            "Horse Guards",
            UnitType.HeavyCavalry,
            8,
            60,
            "Cavalry Reserve",
            "Household Brigade",
            "Reserve Corps",
            "Uxbridge",
            "Somerset",
            "Ponsonby",
            null
        );
        Assert.Equal(expected, await response.Content.ReadAsAsync<ArmyUnitResponse>());
        var army = await scenario
            .As(Role.Commander)
            .GetAsAsync<ArmyResponse>($"/api/armies/{scenario.ArmyId}");
        Assert.Equal(expected, Assert.Single(army!.Units));
        // The library's stays as it was.
        var faction = await scenario
            .As(Role.Commander)
            .GetAsAsync<FactionResponse>($"/api/factions/{scenario.FactionId}");
        Assert.Equal("1st Division", Assert.Single(faction!.Units).Name);
    }

    [Fact]
    public async Task UpdateUnit_OutOfRange_IsAValidationError()
    {
        using var scenario = await CreateCampaignScenarioAsync();

        using var response = await scenario
            .As(Role.Umpire)
            .PutAsJsonAsync(
                new Uri($"/api/army-units/{scenario.UnitId}", UriKind.Relative),
                new UpdateArmyUnitRequest(
                    "Guard",
                    UnitType.LineInfantry,
                    10,
                    101,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null
                ),
                CancellationToken
            );

        await response.AssertValidationProblemAsync("fightingFactor", "points");
    }

    [Fact]
    public async Task UpdateUnit_NoFightingFactor_IsAValidationError()
    {
        using var scenario = await CreateCampaignScenarioAsync();

        using var response = await UpdateAsync(
            scenario,
            scenario.UnitId,
            Change("Guard", UnitType.LineInfantry, 0, 20)
        );

        await response.AssertValidationProblemAsync("fightingFactor");
    }

    [Fact]
    public async Task AddScout_ByTheUmpire_AddsTheArmysOwnScoutWithNoFightingFactorOrPoints()
    {
        using var scenario = await CreateCampaignScenarioAsync();

        using var response = await scenario
            .As(Role.Umpire)
            .PostAsJsonAsync(
                new Uri($"/api/armies/{scenario.ArmyId}/scouts", UriKind.Relative),
                new AddScoutRequest(" Hussar picket "),
                CancellationToken
            );

        var scout = await response.Content.ReadAsAsync<ArmyUnitResponse>();
        var expected = new ArmyUnitResponse(
            scout!.Id,
            scenario.ArmyId,
            null,
            null,
            // No library unit, so no faction: it goes as its army.
            (await ArmyAsync(scenario)).Nation,
            "Hussar picket",
            UnitType.Scouts,
            0,
            0,
            null,
            null,
            null,
            null,
            null,
            null,
            null
        );
        Assert.Equal(expected, scout);
        Assert.Contains(expected, (await ArmyAsync(scenario)).Units);
    }

    [Fact]
    public async Task AddScout_NoName_IsAValidationError()
    {
        using var scenario = await CreateCampaignScenarioAsync();

        using var response = await scenario
            .As(Role.Umpire)
            .PostAsJsonAsync(
                new Uri($"/api/armies/{scenario.ArmyId}/scouts", UriKind.Relative),
                new AddScoutRequest("  "),
                CancellationToken
            );

        await response.AssertValidationProblemAsync("name");
    }

    [Fact]
    public async Task UpdateUnit_AScout_RenamesItAndGroupsIt()
    {
        using var scenario = await CreateCampaignScenarioAsync();
        var scout = await LibrarySteps.AddScoutAsync(scenario);

        using var response = await UpdateAsync(
            scenario,
            scout,
            Change("Uhlan vedette", UnitType.Scouts, 0, 0) with
            {
                Division = "Light Cavalry Division",
            }
        );

        var saved = await response.Content.ReadAsAsync<ArmyUnitResponse>();
        Assert.Equal(
            ("Uhlan vedette", UnitType.Scouts, "Light Cavalry Division"),
            (saved!.Name, saved.Type, saved.Division)
        );
    }

    [Fact]
    public async Task UpdateUnit_AScoutToAnotherType_IsAValidationError()
    {
        using var scenario = await CreateCampaignScenarioAsync();
        var scout = await LibrarySteps.AddScoutAsync(scenario);

        using var response = await UpdateAsync(
            scenario,
            scout,
            Change("Hussar picket", UnitType.LightCavalry, 4, 10)
        );

        await response.AssertValidationProblemAsync("type");
    }

    [Fact]
    public async Task UpdateUnit_AScoutWithFightingFactorOrPoints_IsAValidationError()
    {
        using var scenario = await CreateCampaignScenarioAsync();
        var scout = await LibrarySteps.AddScoutAsync(scenario);

        using var response = await UpdateAsync(
            scenario,
            scout,
            Change("Hussar picket", UnitType.Scouts, 1, 5)
        );

        await response.AssertValidationProblemAsync("fightingFactor", "points");
    }

    [Fact]
    public async Task UpdateUnit_ALibraryUnitToAScout_IsAValidationError()
    {
        using var scenario = await CreateCampaignScenarioAsync();

        using var response = await UpdateAsync(
            scenario,
            scenario.UnitId,
            Change("1st Division", UnitType.Scouts, 0, 0)
        );

        await response.AssertValidationProblemAsync("type");
    }

    [Fact]
    public async Task DeleteUnit_AScout_RemovesIt()
    {
        using var scenario = await CreateCampaignScenarioAsync();
        var scout = await LibrarySteps.AddScoutAsync(scenario);

        using var response = await scenario
            .As(Role.Umpire)
            .DeleteAsync(new Uri($"/api/army-units/{scout}", UriKind.Relative), CancellationToken);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.DoesNotContain(scout, (await ArmyAsync(scenario)).Units.Select(u => u.Id));
    }

    [Fact]
    public async Task DeleteUnit_RemovesIt()
    {
        using var scenario = await CreateCampaignScenarioAsync();

        using var response = await scenario
            .As(Role.Umpire)
            .DeleteAsync(
                new Uri($"/api/army-units/{scenario.UnitId}", UriKind.Relative),
                CancellationToken
            );

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Empty(await UnitNamesAsync(scenario));
        Assert.Equal(1, await WithDbAsync(db => db.Units.CountAsync(CancellationToken)));
    }

    [Fact]
    public async Task DeleteArmy_DeletesItsUnits()
    {
        using var scenario = await CreateCampaignScenarioAsync();

        using var response = await scenario
            .As(Role.Umpire)
            .DeleteAsync(
                new Uri($"/api/armies/{scenario.ArmyId}", UriKind.Relative),
                CancellationToken
            );

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(0, await WithDbAsync(db => db.ArmyUnits.CountAsync(CancellationToken)));
    }

    [Fact]
    public async Task UnassignCommander_KeepsTheUnits()
    {
        using var scenario = await CreateCampaignScenarioAsync();

        using var response = await scenario
            .As(Role.Umpire)
            .DeleteAsync(
                new Uri($"/api/armies/{scenario.ArmyId}/commander", UriKind.Relative),
                CancellationToken
            );

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(1, await WithDbAsync(db => db.ArmyUnits.CountAsync(CancellationToken)));
    }
}
