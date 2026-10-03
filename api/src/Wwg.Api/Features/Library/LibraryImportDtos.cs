using System.ComponentModel.DataAnnotations;
using Wwg.Api.Data.Entities;

namespace Wwg.Api.Features.Library;

/// <summary>The club's unit library as CSV, to preview or import (decision 0025).</summary>
/// <param name="Csv">
/// The file's text: a header row naming the columns (`docs/library-import.md`), then a unit per
/// row.
/// </param>
public sealed record ImportLibraryRequest(
    [property: Required, StringLength(LibraryImport.MaxCsvLength)] string Csv
);

/// <summary>What importing a file does, or would do (decision 0025).</summary>
/// <param name="UnitCount">How many units the file has.</param>
/// <param name="Factions">Its factions, in the file's order, with what happens to their units.</param>
/// <param name="Missing">
/// Imported units of those factions that the file no longer has: the import keeps them.
/// </param>
/// <param name="Errors">
/// Rows the import can't take, the first 50; while there are any, nothing is imported.
/// </param>
/// <param name="ErrorCount">How many errors there are in all.</param>
public sealed record LibraryImportResponse(
    int UnitCount,
    IReadOnlyList<ImportFactionSummary> Factions,
    IReadOnlyList<ImportMissingUnit> Missing,
    IReadOnlyList<ImportRowError> Errors,
    int ErrorCount
);

/// <summary>A faction in the file, and what happens to its units.</summary>
/// <param name="Id">The library faction its units go to; null for one the import creates.</param>
/// <param name="Name">Its name: the library faction's, or the file's for a new one.</param>
/// <param name="Nation">Its flag: the library faction's, or the file's for a new one.</param>
/// <param name="Created">Units the import adds.</param>
/// <param name="Updated">Units it changes.</param>
/// <param name="Unchanged">Units already as the file has them.</param>
public sealed record ImportFactionSummary(
    Guid? Id,
    string Name,
    Nation Nation,
    int Created,
    int Updated,
    int Unchanged
);

/// <summary>An imported unit the file no longer has.</summary>
/// <param name="Id">The library unit's ID.</param>
/// <param name="FactionId">Its faction.</param>
/// <param name="Name">Its name.</param>
/// <param name="Key">The import key it was last imported by.</param>
public sealed record ImportMissingUnit(Guid Id, Guid FactionId, string Name, string Key);

/// <summary>Why a row (or the file) can't be imported.</summary>
/// <param name="Row">The row, counting the header as row 1; 0 for the file as a whole.</param>
/// <param name="Column">The column at fault; null for the whole row or file.</param>
/// <param name="Message">What's wrong, in words.</param>
public sealed record ImportRowError(int Row, string? Column, string Message);
