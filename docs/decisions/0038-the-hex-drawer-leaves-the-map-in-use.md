# 0038. The hex drawer leaves the map in use, and a unit chosen from a list is centred

- **Date:** 2026-11-21
- **Status:** Accepted (amends 0027)

## Context

The hex's drawer (decision 0027) was a modal drawer: an overlay covered the rest of the page,
so the map couldn't be moved or another hex chosen without closing it first. It opened from the
right on a computer, over the turn panel, so a unit couldn't be chosen from the list beside the
map while it was open either. A unit chosen from the turn panel opened its drawer, but the map
stayed where it was, so the unit could be off screen.

## Decision

- **The drawer doesn't hold the page:** no overlay, no focus trap, no scroll lock, and a click
  outside doesn't close it. The map pans and zooms beneath it; choosing another hex (or marker)
  changes what it shows. Esc and its close button close it.
- **It opens from the left on a computer** (from the bottom on a phone, at most half the screen),
  leaving the turn panel on the right in reach.
- **A unit chosen from a list (the turn panel, the Umpire's review panel) is centred:** the map
  scrolls into view and eases to its hex, in the middle of the part the drawer leaves, zoomed in
  to the game map if the view is wider; the hex is outlined, as for any chosen hex. Focus moves
  into the drawer, and back to the list once it closes. A click on the map leaves focus there.

## Consequences

- The drawer is still a `dialog` to tests and assistive technology (Mantine marks it modal; the
  rest of the page stays reachable).
- MapLibre skips the easing for those who prefer reduced motion.
