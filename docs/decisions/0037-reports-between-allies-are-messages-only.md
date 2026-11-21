# 0037. Reports between allies are hand-written messages only

- **Date:** 2026-11-21
- **Status:** Accepted (step 72; amends 0020)

## Context

Decision 0020 let a commander's report to an ally carry a snapshot of their army's units (exact
hexes and points) and every sighting they'd received, beside a note. In play that hands over
perfect, machine-made intelligence by courier, which takes the friction out of communication the
rules mean to have. The app already hid the two choices; the API still offered them.

## Decision

- **A report between allies is a hand-written message**, nothing else: `SendReportRequest` is
  `{ toArmyId, note }`, the note required (≤ 1,000 characters). The commander writes what they
  want their ally to know.
- **What's already recorded stays.** `IntelReport.Snapshot` and `SightingIds` remain: reports sent
  before carry them, and a courier already on its way still delivers its sightings on arrival.
  The Umpire's reports (decision 0035) keep their positions and sightings.

## Consequences

- `SendReportModal` is the recipient and a message; Send needs a message.
- The responses (`ReportResponse.snapshot`, `sightingCount`; `CourierResponse.includesSnapshot`,
  `sightingCount`) stay, for older reports and the Umpire's.
