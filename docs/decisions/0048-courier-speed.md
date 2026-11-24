# 0048. Couriers ride faster than light cavalry, at a speed the Umpire sets

- **Date:** 2026-11-23
- **Status:** Accepted (amends 0020's courier speed)

## Context

A courier rides as light cavalry by the campaign's movement table (§L, decision 0020). In play,
reports between allies take too long to be useful: a lone rider changing horses should outpace a
regiment. Groups may judge this differently, so it shouldn't be fixed.

## Decision

- **A campaign has a courier speed** (`Campaign.CourierSpeed`), a multiple of light cavalry's,
  0.25–5. Every step of a courier's ride costs its light-cavalry cost divided by the speed, so a
  turn's ride reaches that many times as far, by the same cheapest way over terrain and roads.
- **1.5 by default**, for new campaigns and those already under way; 1 is the rules' courier, and
  the Umpire can choose it.
- **A change reaches couriers already on their way.** Nothing about a ride is stored but where the
  courier is, so from the next turn that closes each rides at the new speed, and the Umpire's
  Couriers list shows the turns left at it at once. A courier already due next turn (sent within
  two turns' ride) still arrives then, even if the speed drops.
- The setting is `GET / PUT /api/campaigns/{id}/courier-settings` (every member reads it, the
  Umpire changes it), and the **Couriers** section of the campaign's edit page.

## Consequences

- Within two turns' ride, which decides whether a report arrives as the next turn starts, is
  measured at the courier speed: a faster courier is "close by" further away.
- The Umpire's reports (decision 0035) have no courier and are unaffected.
