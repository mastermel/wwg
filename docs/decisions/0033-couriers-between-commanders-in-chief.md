# 0033. Couriers ride between Commanders in Chief, and the Umpire cancels them with a note

- **Date:** 2026-11-20
- **Status:** Accepted (amends 0020; settles 0032's "where couriers ride from")

## Context

Decision 0020 sent a report's courier from the sender's unit nearest the recipient to the
recipient's unit nearest the courier. Decision 0032 marked each army's Commander in Chief (C-in-C):
where the person playing it is on the map. A report is between players, so it should travel
between them. The Umpire also needs to see every courier, the ones finished too, and to record why
one was stopped.

## Decision

- **From C-in-C to C-in-C.** A courier sets out from the sender's C-in-C and rides towards the
  recipient's C-in-C where each closing turn leaves it, re-aimed every turn (a new C-in-C chosen
  mid-ride is ridden to from then). It arrives as before: next to it (or in its hex), or as the
  next turn starts if within two turns' ride, now measured C-in-C to C-in-C.
- **Both armies need a C-in-C to send.** Without one either side, sending is refused (409); the
  app greys out an ally with none, and says why.
- **A courier with no one to ride to waits.** If the recipient's C-in-C is removed or changed to
  another type mid-ride, or no way reaches it, the courier stays where it is; the Umpire sees why
  (`Waiting`: `NoCommanderInChief` or `NoWay`). Nothing cancels it by itself.
- **The Umpire sees every courier**, on the map (their map only, a courier marker) and in the
  Couriers panel: who sent it and to whom (army and C-in-C), the turn sent, where it is, the turns
  still to ride, whether it's among the enemy, what it carries, and why it waits. The panel keeps
  the history too: couriers arrived (on which turn) and cancelled (on which turn, and why).
- **Cancelling takes a note** (required, up to 500 characters): the Umpire's record of why
  (captured, lost, killed). Only the Umpire and Admins see it; the sender still isn't told what
  became of their courier, nor the recipient that one was sent.
- Couriers already on their way follow the new rule from the next turn closed.

## Consequences

- `IntelReport` gains `StoppedTurn`, `StoppedNote` and `StoppedById`; `POST /api/reports/{id}/stop`
  takes `{ note }`.
- `GET /api/campaigns/{id}/couriers` lists every courier, newest first, with its status.
- Choosing a C-in-C becomes something every army needs before its commander can send reports.
- Couriers usually ride further than before (a C-in-C is often behind the front), so fewer
  arrive next turn.
- Players never see couriers, as before.
