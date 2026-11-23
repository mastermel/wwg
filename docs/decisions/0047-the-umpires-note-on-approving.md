# 0047. The Umpire can leave a note when approving a turn

- **Date:** 2026-11-23
- **Status:** Accepted

## Context

A commander can send a note with their turn, and the Umpire can leave notes when sending a turn
back or reopening it. Approving had no note, so a word for the commander ("Approved, but the ford
will be contested") had to go some other way. An approved turn is also short-lived on the
commander's panel: once every army is approved, the Umpire starts the next turn, sometimes
minutes later, and the panel moves on to the new Draft.

## Decision

- Approve takes an optional note for the turn (≤2000), kept on the Approved history event, as
  Submit keeps the commander's. No notes on units: send back or reopen is the way to change
  orders, and approving stays light.
- **Approve** stays a single click; **Approve with a note** beside it opens a dialog. It's offered
  for every army, commanderless ones too, where the note is the Umpire's own record.
- The commander reads it in four places: the approval email; the turn panel while the turn is
  approved; the next turn's panel, through its whole time open ("The Umpire on turn N: …"); and
  the turn-started email's news for the army. The history lists it, as it does every note.
- Notes stay append-only, like the others. Reopening and approving again adds a new event, and
  the latest approval's note is the one shown.
- Who sees it follows the visibility rule (0010): the army's commander, the Umpire and Admins,
  not allies.

## Consequences

- No migration: `ArmyTurnEvent.Note` already holds it.
- A note can't be corrected once sent without reopening and approving again, which emails the
  commander twice.
- A commander who has turned off turn emails still sees the note on the next turn's panel.
