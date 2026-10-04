using System.Net;
using System.Net.Http.Json;
using Wwg.Api.Data.Entities;
using Wwg.Api.Features.Library;
using Wwg.Api.IntegrationTests.Support;

namespace Wwg.Api.IntegrationTests.Features;

/// <summary>Importing the club's unit library from CSV (decision 0025).</summary>
public sealed class LibraryImportTests : ApiTest
{
    private const string Header =
        "key,nation,flag,corps,corps_commander,division,division_commander,brigade,"
        + "brigade_commander,unit,notes,type,ff,points,status";

    /// <summary>A row of the file, in <see cref="Header"/>'s order; the key is made from the rest.</summary>
    private static string Row(
        string unit,
        string nation = "British",
        string flag = "Britain",
        string type = "LineInfantry",
        int ff = 6,
        int points = 34,
        string corps = "I Corps",
        string division = "1st Division",
        string brigade = "1st Brigade",
        string notes = "",
        string status = "Painted",
        string? key = null
    ) =>
        string.Join(
            ',',
            key ?? $"{nation} | {corps} | {division} | {brigade} | {unit}",
            nation,
            flag,
            corps,
            "Moore",
            division,
            "Paget",
            brigade,
            "Maitland",
            unit,
            notes,
            type,
            ff,
            points,
            status
        );

    private static string File(params string[] rows) => string.Join("\r\n", [Header, .. rows]);

    private static async Task<HttpResponseMessage> PostAsync(
        HttpClient client,
        string csv,
        bool preview = false
    ) =>
        await client.PostAsJsonAsync(
            new Uri(
                preview ? "/api/library/import/preview" : "/api/library/import",
                UriKind.Relative
            ),
            new ImportLibraryRequest(csv),
            CancellationToken
        );

    private static async Task<LibraryImportResponse> ImportAsync(
        HttpClient client,
        string csv,
        bool preview = false
    )
    {
        using var response = await PostAsync(client, csv, preview);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadAsAsync<LibraryImportResponse>())!; // Asserted just above.
    }

    private static async Task<FactionResponse> FactionAsync(HttpClient client, string name)
    {
        var factions = await client.GetAsAsync<List<FactionSummary>>("/api/factions");
        var id = Assert
            .Single(factions!, f => string.Equals(f.Name, name, StringComparison.Ordinal))
            .Id;
        return (await client.GetAsAsync<FactionResponse>($"/api/factions/{id}"))!;
    }

    [Fact]
    public async Task Import_ANewFile_CreatesItsFactionsAndUnits()
    {
        using var manager = await CreateManagerClientAsync();

        var result = await ImportAsync(
            manager,
            File(
                Row("1/1st Foot Guards", notes: "sub in V"),
                Row("Imperial Guard", nation: "French", flag: "France", ff: 9),
                Row("1/3rd Foot Guards")
            )
        );

        Assert.Equal(3, result.UnitCount);
        Assert.Equal(
            [
                new ImportFactionSummary(null, "British", Nation.Britain, 2, 0, 0),
                new ImportFactionSummary(null, "French", Nation.France, 1, 0, 0),
            ],
            result.Factions
        );
        var british = await FactionAsync(manager, "British");
        Assert.Equal(Nation.Britain, british.Nation);
        var guards = Assert.Single(
            british.Units,
            u => string.Equals(u.Name, "1/1st Foot Guards", StringComparison.Ordinal)
        );
        Assert.Equal(
            (
                UnitType.LineInfantry,
                6,
                34,
                "I Corps",
                "Moore",
                "1st Division",
                "Paget",
                "1st Brigade",
                "Maitland",
                "sub in V",
                (UnitStatus?)UnitStatus.Painted,
                (int?)1
            ),
            (
                guards.Type,
                guards.FightingFactor,
                guards.Points,
                guards.Corps,
                guards.CorpsCommander,
                guards.Division,
                guards.DivisionCommander,
                guards.Brigade,
                guards.BrigadeCommander,
                guards.Notes,
                guards.Status,
                guards.ImportOrder
            )
        );
    }

    [Fact]
    public async Task Import_AnEmptyStatus_LeavesItUnknown()
    {
        using var manager = await CreateManagerClientAsync();

        await ImportAsync(
            manager,
            File(Row("1/1st Foot Guards"), Row("RHA Troop A", type: "HorseArtillery", status: ""))
        );

        var troop = Assert.Single(
            (await FactionAsync(manager, "British")).Units,
            u => string.Equals(u.Name, "RHA Troop A", StringComparison.Ordinal)
        );
        Assert.Equal((null, 2), (troop.Status, troop.ImportOrder));
    }

    [Fact]
    public async Task Preview_ANewFile_SaysWhatItWouldDoAndChangesNothing()
    {
        using var manager = await CreateManagerClientAsync();

        var result = await ImportAsync(manager, File(Row("1/1st Foot Guards")), preview: true);

        Assert.Equal(
            [new ImportFactionSummary(null, "British", Nation.Britain, 1, 0, 0)],
            result.Factions
        );
        Assert.Empty((await manager.GetAsAsync<List<FactionSummary>>("/api/factions"))!);
    }

    [Fact]
    public async Task Import_ANationTheLibraryHas_FillsThatFactionAndKeepsItsFlag()
    {
        using var manager = await CreateManagerClientAsync();
        var older = await LibrarySteps.CreateFactionAsync(manager, "british", Nation.None);
        await LibrarySteps.CreateFactionAsync(manager, "British", Nation.Britain);

        var result = await ImportAsync(manager, File(Row("1/1st Foot Guards")));

        // Matched whatever its case; of two with the name, the older.
        Assert.Equal(
            [new ImportFactionSummary(older, "british", Nation.None, 1, 0, 0)],
            result.Factions
        );
        var faction = await manager.GetAsAsync<FactionResponse>($"/api/factions/{older}");
        Assert.Equal("1/1st Foot Guards", Assert.Single(faction!.Units).Name);
    }

    [Fact]
    public async Task Import_Again_UpdatesWhatChangedAndKeepsTheUnits()
    {
        using var manager = await CreateManagerClientAsync();
        await ImportAsync(manager, File(Row("1/1st Foot Guards"), Row("1/3rd Foot Guards")));
        var before = await FactionAsync(manager, "British");

        var result = await ImportAsync(
            manager,
            File(Row("1/1st Foot Guards", points: 40), Row("1/3rd Foot Guards"))
        );

        Assert.Equal(
            [new ImportFactionSummary(before.Id, "British", Nation.Britain, 0, 1, 1)],
            result.Factions
        );
        var after = await FactionAsync(manager, "British");
        Assert.Equal(before.Units.Select(u => u.Id).Order(), after.Units.Select(u => u.Id).Order());
        Assert.Equal(
            40,
            Assert
                .Single(
                    after.Units,
                    u => string.Equals(u.Name, "1/1st Foot Guards", StringComparison.Ordinal)
                )
                .Points
        );
    }

    [Fact]
    public async Task Import_AUnitRenamedInTheApp_FindsItByItsKey()
    {
        using var manager = await CreateManagerClientAsync();
        await ImportAsync(manager, File(Row("1/1st Foot Guards")));
        var unit = Assert.Single((await FactionAsync(manager, "British")).Units);
        using var renamed = await manager.PutAsJsonAsync(
            new Uri($"/api/units/{unit.Id}", UriKind.Relative),
            new SaveUnitRequest(
                "First Guards",
                unit.Type,
                unit.FightingFactor,
                unit.Points,
                unit.Division,
                unit.Brigade,
                unit.Corps,
                unit.CorpsCommander,
                unit.DivisionCommander,
                unit.BrigadeCommander,
                unit.Notes,
                unit.Status
            ),
            CancellationToken
        );
        renamed.EnsureSuccessStatusCode();

        var result = await ImportAsync(manager, File(Row("1/1st Foot Guards")));

        // The file decides: the import puts its name back on the same unit.
        Assert.Equal(1, Assert.Single(result.Factions).Updated);
        var after = Assert.Single((await FactionAsync(manager, "British")).Units);
        Assert.Equal((unit.Id, "1/1st Foot Guards"), (after.Id, after.Name));
    }

    [Fact]
    public async Task Import_AFactionWithHandEnteredUnits_NeverTouchesThem()
    {
        using var manager = await CreateManagerClientAsync();
        var faction = await LibrarySteps.CreateFactionAsync(manager, "British", Nation.Britain);
        var handEntered = await LibrarySteps.CreateUnitAsync(
            manager,
            faction,
            "1/1st Foot Guards",
            points: 10
        );

        var result = await ImportAsync(manager, File(Row("1/1st Foot Guards")));

        Assert.Equal(1, Assert.Single(result.Factions).Created);
        Assert.Empty(result.Missing);
        var units = (await FactionAsync(manager, "British")).Units;
        Assert.Equal(2, units.Count);
        Assert.Equal(10, Assert.Single(units, u => u.Id == handEntered).Points);
    }

    [Fact]
    public async Task Import_WithoutAUnitItHadImported_KeepsItAndListsItMissing()
    {
        using var manager = await CreateManagerClientAsync();
        await ImportAsync(manager, File(Row("1/1st Foot Guards"), Row("1/3rd Foot Guards")));
        var gone = Assert.Single(
            (await FactionAsync(manager, "British")).Units,
            u => string.Equals(u.Name, "1/3rd Foot Guards", StringComparison.Ordinal)
        );

        var result = await ImportAsync(manager, File(Row("1/1st Foot Guards")));

        Assert.Equal(
            [
                new ImportMissingUnit(
                    gone.Id,
                    gone.FactionId,
                    "1/3rd Foot Guards",
                    "British | I Corps | 1st Division | 1st Brigade | 1/3rd Foot Guards"
                ),
            ],
            result.Missing
        );
        Assert.Equal(2, (await FactionAsync(manager, "British")).Units.Count);
    }

    [Fact]
    public async Task Import_RowsWithErrors_Returns400AndImportsNothing()
    {
        using var manager = await CreateManagerClientAsync();
        var csv = File(
            Row("Good"),
            Row("Too strong", ff: 10),
            Row("Odd", type: "Dragoons"),
            Row("Good again", key: "British | I Corps | 1st Division | 1st Brigade | Good"),
            Row("Wrong flag", flag: "France"),
            Row("No status", status: "Gilded")
        );

        using var response = await PostAsync(manager, csv);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var result = await response.Content.ReadAsAsync<LibraryImportResponse>();
        Assert.Equal(
            [(3, "ff"), (4, "type"), (5, "key"), (6, "flag"), (7, "status")],
            result!.Errors.Select(e => (e.Row, e.Column))
        );
        Assert.Equal(5, result.ErrorCount);
        Assert.Empty((await manager.GetAsAsync<List<FactionSummary>>("/api/factions"))!);
    }

    [Fact]
    public async Task Preview_AScout_IsARowError()
    {
        using var manager = await CreateManagerClientAsync();

        var result = await ImportAsync(
            manager,
            File(Row("Hussar picket", type: "Scouts")),
            preview: true
        );

        var error = Assert.Single(result.Errors);
        Assert.Equal((2, "type"), (error.Row, error.Column));
    }

    [Fact]
    public async Task Preview_AFileWithoutAColumn_SaysWhichIsMissing()
    {
        using var manager = await CreateManagerClientAsync();

        var result = await ImportAsync(
            manager,
            "key,nation,unit,type,ff\r\nx,British,Guards,LineInfantry,5",
            preview: true
        );

        Assert.Equal(
            [
                new ImportRowError(1, "flag", "The file has no \"flag\" column."),
                new ImportRowError(1, "points", "The file has no \"points\" column."),
            ],
            result.Errors
        );
    }

    [Fact]
    public async Task Import_QuotedFields_KeepTheirCommasQuotesAndLineBreaks()
    {
        using var manager = await CreateManagerClientAsync();
        var csv =
            "﻿"
            + Header
            + "\n"
            + "\"British | I Corps | 1st Division | 1st Brigade | 2nd Foot Guards \"\"Coldstream\"\"\","
            + "British,Britain,I Corps,,1st Division,,1st Brigade,,"
            + "\"2nd Foot Guards \"\"Coldstream\"\"\",\"sub: 45th Regt., from II\nsee also V\","
            + "LineInfantry,8,44,Painted\n";

        await ImportAsync(manager, csv);

        var unit = Assert.Single((await FactionAsync(manager, "British")).Units);
        Assert.Equal(
            ("2nd Foot Guards \"Coldstream\"", "sub: 45th Regt., from II\nsee also V"),
            (unit.Name, unit.Notes)
        );
    }

    [Fact]
    public async Task Import_TheClubsLibrary_ImportsEveryUnit()
    {
        using var manager = await CreateManagerClientAsync();
        var csv = await System.IO.File.ReadAllTextAsync(
            Path.Combine(AppContext.BaseDirectory, "testdata", "complete_library.csv"),
            CancellationToken
        );

        var result = await ImportAsync(manager, csv);

        // 1,077 units, and 490 formation commanders (decision 0030).
        Assert.Equal((1567, 0), (result.UnitCount, result.ErrorCount));
        Assert.Equal(
            [
                "British",
                "French",
                "Italy",
                "Polish",
                "Austrian",
                "Prussian",
                "Russian",
                "Swedish",
                "US",
            ],
            result.Factions.Select(f => f.Name).ToList()
        );
        Assert.Equal(1567, result.Factions.Sum(f => f.Created));
        Assert.Equal(Nation.UnitedStates, result.Factions[^1].Nation);
    }

    [Fact]
    public async Task Import_TheClubsLibrary_ImportsEachFormationsCommanderAsACommander()
    {
        using var manager = await CreateManagerClientAsync();
        var csv = await System.IO.File.ReadAllTextAsync(
            Path.Combine(AppContext.BaseDirectory, "testdata", "complete_library.csv"),
            CancellationToken
        );

        await ImportAsync(manager, csv);

        var british = await FactionAsync(manager, "British");
        var commanders = british
            .Units.Where(u => u.Type == UnitType.Commander)
            .OrderBy(u => u.ImportOrder)
            .Take(3);
        Assert.Equal(
            [
                ("L.G. Sir John Moore", 1, 0, "I Corps", null, null),
                ("L.G. Lord Edward Paget", 1, 0, "I Corps", "1st Division", null),
                ("M.G. Peregrine Maitland", 1, 0, "I Corps", "1st Division", "1st Brigade"),
            ],
            commanders.Select(u =>
                (u.Name, u.FightingFactor, u.Points, u.Corps, u.Division, u.Brigade)
            )
        );
    }

    [Theory]
    [InlineData(Role.Umpire)]
    [InlineData(Role.Player)]
    public async Task Import_ByANonEditor_Returns403(Role role)
    {
        using var scenario = await CreateCampaignScenarioAsync();

        using var response = await PostAsync(scenario.As(role), File(Row("Guards")));

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Import_ByAnAdmin_IsAllowed()
    {
        using var admin = await CreateAdminClientAsync();

        await ImportAsync(admin, File(Row("Guards")));
    }
}
