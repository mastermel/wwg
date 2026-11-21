# 0036. A Player can command several armies, all of one side

- **Date:** 2026-11-21
- **Status:** Accepted, not built yet (step 71; amends the one-army rule of §5.1)

## Context

A Player commands at most one army per campaign: a unique index on `Army.CommanderId`, a 409
("Already a commander") from `Commanders.ConflictAsync`, and one `army` on each member in the
members list. The club sometimes has fewer players than armies, and the Umpire wants to give one
Player two (say, an army and its ally's corps) rather than leave one unassigned, which holds every
turn up, or play it themselves.

Most of the app already treats "the armies a member commands" as a set: the access filter checks
the one army a route names, and the visibility rule, depots, sightings, reports, hex details and
the map's `myArmies` all filter by `CommanderId == MemberId`.

## Decision

- **A Player can command any number of armies**, chosen by the Umpire as now. The model stays
  one-to-many (`Army.CommanderId`); several Players sharing one army is a different feature.
- **All of a Player's armies are on one side.** Commanding both sides would show them everything
  and let them settle the battles. Giving a Player an army of the other side, or moving one of
  their armies to the other side while they command another, is refused (409, naming the army),
  and a trigger beside the `AddCommanderRules` ones catches two requests racing.
- **What they see is the union of their armies'.** The visibility rule, depots, sightings,
  reports and revealed hexes cover every army they command, so their armies share what they know
  at once. The server can't keep one person's knowledge apart, so it doesn't try: the Umpire
  weighs this when giving a second army.
- **No couriers between their own armies.** A report to an army with the same commander as the
  sender is refused (400, as a report to the other side is), whether the commander or the Umpire
  on the army's behalf sends it; `SendReportModal` greys such an army out and says it's theirs.
  A courier already riding when its two armies come under one commander rides on and arrives as
  usual.
- **Each army keeps its own turn.** The Player gives orders and submits for each army on its own,
  and an army not yet submitted still holds the next turn up. Each keeps its own Commander in
  Chief; for a Player with two armies, decision 0032's "where the person playing it is" is
  wherever that army's C-in-C is.
- **One "turn started" email per Player**, not per army: the turn and its day once, then each of
  their armies' news under its name. The other campaign emails stay per army (an army given, an
  army's turn reviewed) or go to the Umpire as now.

## Consequences

- The unique index on `Army.CommanderId` becomes a plain one; `ConflictAsync` becomes the side
  check. Set Umpire, leaving and removal already unassign all of a member's armies.
- `CampaignMemberResponse.army` becomes `armies` (a list, by name), a contract change: the
  members list shows a badge each, and the commander picker offers every Player but those
  commanding an army of the other side (shown, greyed out, with why).
- `UpdateArmyAsync` checks the side when it changes; the scoreboard's "their side" stays one side.
- Tests that expect "Already a commander" change, and the e2e suite gives a Player two armies.
- A Player commanding several armies sees more than one commanding one; that's the Umpire's call.
