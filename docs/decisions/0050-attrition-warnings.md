# 0050. Commanders see the attrition their orders cost

- **Date:** 2026-11-23
- **Status:** Accepted (refines 0018 and 0019)

## Context

Attrition (decisions 0018, 0019) is worked out by the API and confirmed by the Umpire when the
next turn starts. A commander saw only a line in the move prompt ("Moving costs normal
attrition"), which said nothing of supply, nor how many points; and nothing on the map or in the
unit's drawer once the order was given. Players found out what an order cost when the turn
started.

## Decision

- **The attrition list is every member's**, filtered as supply is: the Umpire and Admins see
  every army's units, a commander their own armies', anyone else none. It's the same figure the
  Umpire confirms (forced march, doubled out of supply; supply's own from the 7th turn out), with
  the carried fraction counted in, by the orders as given.
- **The app warns where the commander looks:** a mark on the unit's marker, a warning in its
  drawer (where it stands, what its order costs and what follows), and the move prompt's cost
  shown as a warning with roughly how many points.

## Consequences

- Commanders learn the points a unit is due to lose before the Umpire confirms them; the Umpire
  may still change the loss when starting the turn.
- The warning is by the orders as given: a move's cost while choosing its hex can't know whether
  the hex is out of supply, so the prompt says what the forced march costs, and the drawer the
  full figure once the order is given.
