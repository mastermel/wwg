# 0051. Everyone sees which armies haven't submitted the turn

- **Date:** 2026-11-24
- **Status:** Accepted

## Context

The Turn panel told players how far the turn had got ("4 of 6 armies have submitted"), but not
which armies: DESIGN.md said "no names". Players waiting on a turn wanted to know who they were
waiting for, and the count already says that some are late; which armies a campaign has, and
their flags and colours, is no secret.

## Decision

- **The turn list gives every member the armies still to submit** (`pending`: those whose turn
  is a Draft, by name), as ids. Each army's own status and times stay the Umpire's and its
  commander's.
- **The Turn panel shows them as army badges** (flag, colour, name), under the count, which now
  has its own line beneath the turn's day and time of day.

## Consequences

- A player can tell who is holding the turn up, and say so.
- Whether an army has submitted is public; what it ordered, and when it submitted, are not.
