using System.Globalization;
using System.Text;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Wwg.Api.Data;
using Wwg.Api.Data.Entities;

namespace Wwg.Api.Features.Library;

/// <summary>
/// Importing the club's unit library from CSV (decision 0025): each row a unit, matched to a
/// library faction by its nation's name and to a library unit by its import key. A preview says
/// what the import would do; the import does it in one transaction, or nothing while any row is
/// wrong. Units are created and updated, never deleted.
/// </summary>
internal static class LibraryImport
{
    /// <summary>The longest file, in characters: the club's 1,567 units take about 480,000.</summary>
    public const int MaxCsvLength = 2_000_000;

    /// <summary>How many errors a response lists; the count says how many there are.</summary>
    private const int MaxErrorsListed = 50;

    private const int MaxNameLength = 100;

    private static readonly string[] RequiredColumns =
    [
        "key",
        "nation",
        "flag",
        "unit",
        "type",
        "ff",
        "points",
    ];

    private static readonly Dictionary<string, UnitType> UnitTypes = Enum.GetValues<UnitType>()
        .ToDictionary(t => t.ToString(), StringComparer.Ordinal);

    private static readonly Dictionary<string, Nation> Nations = Enum.GetValues<Nation>()
        .ToDictionary(n => n.ToString(), StringComparer.Ordinal);

    private static readonly Dictionary<string, UnitStatus> Statuses = Enum.GetValues<UnitStatus>()
        .ToDictionary(s => s.ToString(), StringComparer.Ordinal);

    /// <summary>
    /// Says what importing the file would do: its factions and their units to create, update or
    /// leave, imported units it no longer has, and rows it can't take (Manager or Admin). Changes
    /// nothing.
    /// </summary>
    internal static async Task<Ok<LibraryImportResponse>> PreviewLibraryImportAsync(
        ImportLibraryRequest request,
        WwgDbContext db,
        CancellationToken cancellationToken
    )
    {
        var plan = await PlanAsync(request.Csv, db, cancellationToken);
        return TypedResults.Ok(plan.Response);
    }

    /// <summary>
    /// Imports the file into the library (Manager or Admin): creates its new factions, and creates
    /// and updates their units, in one transaction. 400, importing nothing, while any row is wrong.
    /// </summary>
    internal static async Task<
        Results<Ok<LibraryImportResponse>, BadRequest<LibraryImportResponse>>
    > ImportLibraryAsync(
        ImportLibraryRequest request,
        WwgDbContext db,
        CancellationToken cancellationToken
    )
    {
        var plan = await PlanAsync(request.Csv, db, cancellationToken);
        if (plan.Response.ErrorCount > 0)
        {
            return TypedResults.BadRequest(plan.Response);
        }

        db.Factions.AddRange(plan.NewFactions);
        db.Units.AddRange(plan.NewUnits);
        // The units to update were loaded tracked, and changed while planning.
        await db.SaveChangesAsync(cancellationToken);
        return TypedResults.Ok(plan.Response);
    }

    /// <summary>One row of the file, read and checked.</summary>
    private sealed record Row(
        int Number,
        string Key,
        string Nation,
        Nation Flag,
        string Name,
        UnitType Type,
        int FightingFactor,
        int Points,
        string? Corps,
        string? CorpsCommander,
        string? Division,
        string? DivisionCommander,
        string? Brigade,
        string? BrigadeCommander,
        string? Notes,
        UnitStatus? Status
    );

    /// <summary>What the import will do, and the entities it will add (tracked ones change).</summary>
    private sealed record Plan(
        List<Summary> Summaries,
        List<Faction> NewFactions,
        List<Unit> NewUnits
    )
    {
        public LibraryImportResponse Response { get; set; } = new(0, [], [], [], 0);
    }

    private static async Task<Plan> PlanAsync(
        string csv,
        WwgDbContext db,
        CancellationToken cancellationToken
    )
    {
        var errors = new List<ImportRowError>();
        var rows = ReadRows(csv, errors);
        var byName = await FactionsByNameAsync(db, cancellationToken);
        var matchedIds = rows.Select(r => r.Nation)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Select(n => byName.GetValueOrDefault(n)?.Id)
            .OfType<Guid>()
            .ToList();
        // Tracked: the import changes them. Only keyed units: hand-entered ones are never touched.
        var keyed = await db
            .Units.Where(u => matchedIds.Contains(u.FactionId) && u.ImportKey != null)
            .ToListAsync(cancellationToken);
        var existing = keyed.ToDictionary(u => new UnitKey(u.FactionId, u.ImportKey ?? ""));

        var plan = new Plan([], [], []);
        var seen = new HashSet<UnitKey>();
        var order = 0;
        foreach (var row in rows)
        {
            order++;
            var summary = SummaryFor(row, byName, plan);
            var key = new UnitKey(summary.Faction.Id, row.Key);
            seen.Add(key);
            Place(row, order, summary, existing.GetValueOrDefault(key), plan);
        }

        var missing = keyed
            .Where(u => !seen.Contains(new UnitKey(u.FactionId, u.ImportKey ?? "")))
            .OrderBy(u => matchedIds.IndexOf(u.FactionId))
            .ThenBy(u => u.ImportOrder)
            .ThenBy(u => u.Name, StringComparer.Ordinal)
            .Select(u => new ImportMissingUnit(u.Id, u.FactionId, u.Name, u.ImportKey ?? ""))
            .ToList();
        plan.Response = new LibraryImportResponse(
            rows.Count,
            [.. plan.Summaries.Select(s => s.ToResponse())],
            missing,
            [.. errors.Take(MaxErrorsListed)],
            errors.Count
        );
        return plan;
    }

    /// <summary>Plans the row's unit: the library's (keyed) unit updated, or a new one.</summary>
    private static void Place(Row row, int order, Summary summary, Unit? unit, Plan plan)
    {
        var values = ImportedValues.From(row, order);
        if (unit is null)
        {
            unit = new Unit
            {
                FactionId = summary.Faction.Id,
                Name = row.Name,
                ImportKey = row.Key,
            };
            values.ApplyTo(unit);
            plan.NewUnits.Add(unit);
            summary.Created++;
        }
        else if (ImportedValues.From(unit) == values)
        {
            summary.Unchanged++;
        }
        else
        {
            values.ApplyTo(unit);
            summary.Updated++;
        }
    }

    /// <summary>Every faction by name (whatever its case), the oldest of any two that share one.</summary>
    private static async Task<Dictionary<string, Faction>> FactionsByNameAsync(
        WwgDbContext db,
        CancellationToken cancellationToken
    )
    {
        var factions = await db
            .Factions.OrderBy(f => f.CreatedAt)
            .ThenBy(f => f.Id)
            .ToListAsync(cancellationToken);
        var byName = new Dictionary<string, Faction>(StringComparer.OrdinalIgnoreCase);
        foreach (var faction in factions)
        {
            byName.TryAdd(faction.Name, faction);
        }

        return byName;
    }

    /// <summary>The row's faction's summary: a library faction's, or a new one's, made here.</summary>
    private static Summary SummaryFor(Row row, Dictionary<string, Faction> byName, Plan plan)
    {
        if (!byName.TryGetValue(row.Nation, out var faction))
        {
            faction = new Faction { Name = row.Nation, Nation = row.Flag };
            byName.Add(row.Nation, faction);
            plan.NewFactions.Add(faction);
        }

        var summary = plan.Summaries.Find(s => s.Faction == faction);
        if (summary is null)
        {
            summary = new Summary(faction, IsNew: plan.NewFactions.Contains(faction));
            plan.Summaries.Add(summary);
        }

        return summary;
    }

    /// <summary>A unit as an import knows it: its faction and key.</summary>
    private readonly record struct UnitKey(Guid FactionId, string Key);

    /// <summary>How a faction's units fare, counted while planning.</summary>
    private sealed record Summary(Faction Faction, bool IsNew)
    {
        public int Created { get; set; }

        public int Updated { get; set; }

        public int Unchanged { get; set; }

        public ImportFactionSummary ToResponse() =>
            new(
                IsNew ? null : Faction.Id,
                Faction.Name,
                Faction.Nation,
                Created,
                Updated,
                Unchanged
            );
    }

    /// <summary>What an import sets on a unit, compared as a whole to see if it changes it.</summary>
    private sealed record ImportedValues(
        string Name,
        UnitType Type,
        int FightingFactor,
        int Points,
        string? Corps,
        string? CorpsCommander,
        string? Division,
        string? DivisionCommander,
        string? Brigade,
        string? BrigadeCommander,
        string? Notes,
        UnitStatus? Status,
        int? ImportOrder
    )
    {
        public static ImportedValues From(Row row, int order) =>
            new(
                row.Name,
                row.Type,
                row.FightingFactor,
                row.Points,
                row.Corps,
                row.CorpsCommander,
                row.Division,
                row.DivisionCommander,
                row.Brigade,
                row.BrigadeCommander,
                row.Notes,
                row.Status,
                order
            );

        public static ImportedValues From(Unit unit) =>
            new(
                unit.Name,
                unit.Type,
                unit.FightingFactor,
                unit.Points,
                unit.Corps,
                unit.CorpsCommander,
                unit.Division,
                unit.DivisionCommander,
                unit.Brigade,
                unit.BrigadeCommander,
                unit.Notes,
                unit.Status,
                unit.ImportOrder
            );

        public void ApplyTo(Unit unit)
        {
            unit.Name = Name;
            unit.Type = Type;
            unit.FightingFactor = FightingFactor;
            unit.Points = Points;
            unit.Corps = Corps;
            unit.CorpsCommander = CorpsCommander;
            unit.Division = Division;
            unit.DivisionCommander = DivisionCommander;
            unit.Brigade = Brigade;
            unit.BrigadeCommander = BrigadeCommander;
            unit.Notes = Notes;
            unit.Status = Status;
            unit.ImportOrder = ImportOrder;
        }
    }

    /// <summary>The file's units, checked as the unit form checks them; errors for the rest.</summary>
    private static List<Row> ReadRows(string csv, List<ImportRowError> errors)
    {
        var records = Csv.Parse(csv);
        if (records.Count == 0)
        {
            errors.Add(new ImportRowError(0, null, "The file is empty."));
            return [];
        }

        var columns = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        for (var i = 0; i < records[0].Count; i++)
        {
            columns.TryAdd(records[0][i].Trim(), i);
        }

        var absent = RequiredColumns.Where(c => !columns.ContainsKey(c)).ToList();
        foreach (var column in absent)
        {
            errors.Add(new ImportRowError(1, column, $"The file has no \"{column}\" column."));
        }

        if (absent.Count > 0)
        {
            return [];
        }

        var rows = new List<Row>();
        // A nation's first row, which sets its flag and holds its keys.
        var nations = new Dictionary<string, (int Row, Nation Flag)>(
            StringComparer.OrdinalIgnoreCase
        );
        var keys = new Dictionary<(string, string), int>();
        for (var r = 1; r < records.Count; r++)
        {
            var reader = new RowReader(r + 1, records[r], columns, errors);
            var row = reader.Read();
            if (row is null)
            {
                continue;
            }

            if (nations.TryGetValue(row.Nation, out var first) && first.Flag != row.Flag)
            {
                reader.Error("flag", $"Its nation's flag is {first.Flag} on row {first.Row}.");
                continue;
            }

            nations.TryAdd(row.Nation, (row.Number, row.Flag));
            var key = (row.Nation.ToUpperInvariant(), row.Key);
            if (keys.TryGetValue(key, out var earlier))
            {
                reader.Error("key", $"Row {earlier} has the same key.");
                continue;
            }

            keys.Add(key, row.Number);
            rows.Add(row);
        }

        return rows;
    }

    /// <summary>Reads one record's fields by column name, noting what's wrong with them.</summary>
    private sealed class RowReader(
        int number,
        List<string> fields,
        Dictionary<string, int> columns,
        List<ImportRowError> errors
    )
    {
        private bool _failed;

        public void Error(string column, string message)
        {
            errors.Add(new ImportRowError(number, column, message));
            _failed = true;
        }

        public Row? Read()
        {
            if (fields.TrueForAll(string.IsNullOrWhiteSpace))
            {
                return null; // A blank line, such as a spreadsheet's last.
            }

            var row = new Row(
                number,
                Text("key", UnitStats.MaxImportKeyLength, required: true) ?? "",
                Text("nation", MaxNameLength, required: true) ?? "",
                Choice("flag", Nations) ?? Nation.None,
                Text("unit", MaxNameLength, required: true) ?? "",
                Choice("type", UnitTypes, required: true) ?? default,
                Number("ff", UnitStats.MinFightingFactor, UnitStats.MaxFightingFactor),
                Number("points", UnitStats.MinPoints, UnitStats.MaxPoints),
                Text("corps", UnitStats.MaxGroupLength),
                Text("corps_commander", UnitStats.MaxGroupLength),
                Text("division", UnitStats.MaxGroupLength),
                Text("division_commander", UnitStats.MaxGroupLength),
                Text("brigade", UnitStats.MaxGroupLength),
                Text("brigade_commander", UnitStats.MaxGroupLength),
                Text("notes", UnitStats.MaxNotesLength),
                Choice("status", Statuses)
            );
            if (row.Type == UnitType.Scouts)
            {
                Error("type", LibraryEndpoints.NoScoutsMessage);
            }

            return _failed ? null : row;
        }

        /// <summary>The trimmed field; null when it's empty, or the file has no such column.</summary>
        private string? Field(string column) =>
            columns.TryGetValue(column, out var i) && i < fields.Count
                ? fields[i].Trim() is { Length: > 0 } value
                    ? value
                    : null
                : null;

        private string? Text(string column, int max, bool required = false)
        {
            var value = Field(column);
            if (value is null && required)
            {
                Error(column, "It's empty.");
            }
            else if (value?.Length > max)
            {
                Error(column, $"It's longer than {max} characters.");
            }

            return value;
        }

        private T? Choice<T>(string column, Dictionary<string, T> choices, bool required = false)
            where T : struct
        {
            var value = Field(column);
            if (value is null)
            {
                if (required)
                {
                    Error(column, "It's empty.");
                }

                return null;
            }

            if (choices.TryGetValue(value, out var choice))
            {
                return choice;
            }

            Error(column, $"\"{value}\" isn't one of {string.Join(", ", choices.Keys)}.");
            return null;
        }

        private int Number(string column, int min, int max)
        {
            var value = Field(column);
            if (
                int.TryParse(value, NumberStyles.None, CultureInfo.InvariantCulture, out var number)
                && number >= min
                && number <= max
            )
            {
                return number;
            }

            Error(column, $"It must be a whole number from {min} to {max}.");
            return 0;
        }
    }

    /// <summary>
    /// Comma-separated values as RFC 4180 has them (and spreadsheets write them): fields in double
    /// quotes may hold commas, line breaks and doubled quotes; lines end in CRLF or LF.
    /// </summary>
    private static class Csv
    {
        public static List<List<string>> Parse(string text)
        {
            var records = new List<List<string>>();
            var record = new List<string>();
            var field = new StringBuilder();
            var quoted = false;
            var i = text.Length > 0 && text[0] == '﻿' ? 1 : 0; // A byte order mark.
            for (; i < text.Length; i++)
            {
                var c = text[i];
                if (quoted)
                {
                    if (c != '"')
                    {
                        field.Append(c);
                    }
                    else if (i + 1 < text.Length && text[i + 1] == '"')
                    {
                        field.Append('"');
                        i++;
                    }
                    else
                    {
                        quoted = false;
                    }
                }
                else if (c == '"')
                {
                    quoted = true;
                }
                else if (c == ',')
                {
                    record.Add(field.ToString());
                    field.Clear();
                }
                else if (c is '\r' or '\n')
                {
                    if (c == '\r' && i + 1 < text.Length && text[i + 1] == '\n')
                    {
                        i++;
                    }

                    record.Add(field.ToString());
                    field.Clear();
                    records.Add(record);
                    record = [];
                }
                else
                {
                    field.Append(c);
                }
            }

            if (field.Length > 0 || record.Count > 0)
            {
                record.Add(field.ToString());
                records.Add(record);
            }

            return records;
        }
    }
}
