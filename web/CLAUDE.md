# web/

The Wasatch Wargamers app (`wwg-campaigner` in code): React + TypeScript SPA built with Vite. Full design: DESIGN.md §3.12.

## Commands (from web/)

```sh
npm ci                  # install (Node version in .nvmrc)
npm run dev             # Vite dev server on http://localhost:5173
npm run lint            # ESLint (type-aware); npm run lint:fix to auto-fix
npm run format          # Prettier; npm run format:check is what CI runs
npm run typecheck       # tsc -b
npm test                # Vitest, once; npm run test:watch while working
npm run build           # typecheck + production build into dist/
```

Before committing a `web/` change: `npm run lint`, `npm run typecheck` and `npm test` must pass.
The pre-commit hook runs `eslint --fix` and Prettier on staged files.

## Conventions

- TypeScript `strict`. No `any`; lint errors are fixed, not disabled. A rare `eslint-disable`
  comment needs a reason on the same line.
- Import from `src/` with the `@/` alias (`import { App } from "@/App"`), not long relative paths.
- Named exports, not default exports (except where a tool requires one, e.g. config files).
- Components are function components in `PascalCase.tsx` files; one exported component per file.
- Tests sit next to the code as `*.test.ts(x)`, using Testing Library queries by role/label (how a
  user finds things), not CSS selectors or test IDs.
- Prettier owns formatting (line width 100). Don't hand-format.
- Session: `useSession()` for the state (status, user), `useSessionStore()` for `signIn` /
  `signOut`, and `switchUser` for a masquerade (decision 0012; `useMasqueradeSession`). Pages inside the app frame live under `routes/_app/` (guarded); sign-in and register
  under `routes/_public/`. Never store tokens yourself: the access token is in memory in
  `lib/access-token`, the refresh token is an HttpOnly cookie.
- Forms: React Hook Form + `zodResolver` with the generated schema (`@/api/generated/zod/...`);
  trim name/email inputs with `setValueAs`; put API errors on fields with `applyServerErrors`.
- Tests: `renderApp(path, { session })` renders the real app with a mocked session
  ("signed-in" by default, "signed-out" or "offline").
  `test/server.ts` answers requests many pages make (the campaign list, a campaign's armies,
  members and join code) with empty defaults; a test's own `server.use(...)` wins.
- Page data goes through `QueryState` (loading / error / "not available offline", and saved data
  wins over a failed refetch). Wrap each page in `Page`, which sets the title and focus.
- Admin screens live under `routes/_app/admin/` (the layout gives non-admins the not-found page).
  Lists keep their search and page in the URL (`validateSearch`), so they can be shared.
- Page layout: `Page` takes `back` (a `BackLink`), `summary`, `actions` and `wide` (the
  screen's whole width, for the map pages; others keep a readable width); its content is
  `Section`s (a titled panel; `flush` for a table, `tone="danger"` for deleting and leaving,
  which go last). Empty lists use `EmptyState`. Don't hand-roll headings and panels.
- Colours come from the theme's variables (`--app-canvas`, `--app-header`, Mantine's); a new
  colour pair gets its contrast checked and noted in `theme.ts`. Component styles that need more
  than props go in a `*.module.css` next to the component.
- Anything that deletes, removes or can't be undone asks first with `ConfirmModal`.
- A button that goes to another page is a `LinkButton` (`renderLink`), not a `Button` with
  `renderRoot`: disabled, it becomes a real disabled button (a link could still be followed).
- Every successful change confirms itself with a green notification ("Saved …", "Deleted …").
- Tests render Mantine with `env="test"` (`AppProviders`' `env`; `renderApp` passes it, and so
  must a test rendering `AppProviders` itself): no transitions, and no `hideDetached`, which in
  jsdom hides popovers, menus and dropdowns at a moment that depends on the machine's speed
  (passing locally, failing in CI). So a popover's contents need no `hidden: true`, and a popover
  that a click outside closes is gone at once. Mantine's `Select` is a `combobox` to Testing
  Library. An `Accordion` panel still animates, and stays `display: none` in jsdom once opened:
  query inside it with `hidden: true`.
- Show dates with `formatDate` / `formatDateTime` (`lib/format`): the API sends UTC.
- Don't set a `gcTime` above 2^31 - 1 ms (about 24.8 days): timers overflow and fire at once,
  dropping the data before it can be saved or restored.
- After a change inside a campaign, refetch it with `refreshCampaign(queryClient, id)`
  (`features/campaigns/campaign-cache`), not query by query: changes spread (removing a Player
  unassigns their army). After deleting or leaving one, `forgetCampaign` (once navigated away).
- Failed calls: `errorMessage(error, "What didn't happen. Try again.")` (`lib/errors`) for the
  message; forms use `applyServerErrors`, which does the same for non-field errors.
- A Mantine `Alert` that informs rather than warns of an error gets `role="status"`.
- Name an army with `ArmyBadge` (`features/armies/identity`): its flag, framed in its colour,
  beside the name. Army colours are the theme's `--army-*` variables (`armyColorVar`), checked
  in `army-colors.ts`; flags come from `NationFlag`, names from `nationLabel`.
- The campaign map (`features/maps`): `CampaignMap` draws our style (`map-style.ts`, colours
  contrast-checked there) with MapLibre. jsdom has no WebGL, so tests `vi.mock` `CampaignMap`
  with a stand-in (`useImperativeHandle` for its `mapRef`, a button calling `onMapClick`); the
  stand-in can't draw its children (markers need a real map), so marker behaviour is e2e's.
  Stacking (`stacks.ts`) is a pure function, tested alone.
  Import it only through `CampaignMap`, which sets MapLibre's worker URL (`maplibre-worker.ts`).
  How far the view may go, and the playable area's outline, are `playable-area.ts`
  (`viewLimits`, `playableOutline`), drawn by `PlayableAreaLayer`. The Map page's full screen (a
  computer's) is `useFullScreen`: a fixed layer under drawers and dialogs, and the whole page's
  browser full screen, never the map's (which would hide them).
  `geo.ts` holds `Point` and the haversine distance (`distanceMetres`, which measures the view
  for the game map's zoom rule); orders in words from `orders.ts`. Ghost moves and the reach
  (the hexes the unit can reach, shaded as hex polygons) are `OrderOverlay`, inside the map:
  sight only, as the turn panel lists the same orders, but for a ghost's button, which chooses
  the hex its units left (step 75b, `ghostChoice`). Every turn, past or open, is shown as it
  was played (step 59, decision 0029): the units from the positions after the turn before
  (`shownTurn - 1`), and the turn's orders (`shownOrders`, from `useOpenTurns`' turns) as ghosts.
  A commander's turn changes go through `useOrders` (`use-orders.ts`), which also refetches the
  army's turns: they're keyed by the army, so `refreshCampaign` doesn't reach them.
  Moving a hex's units together (step 66, decision 0031) is `stack-moves.ts` (who can:
  `stackGroups`; whose orders can be taken back together: `orderedGroups`; each unit's budget:
  `stackMovers`) and `movement.ts`' `stackReach`; `MapPage`'s
  `together` holds the units, `moving` the first of them. Ghost moves along one path share a
  line (`ghost-lines.ts`) and stack as units do (`useStacks`, which both markers use). A hex
  with both units and ghosts coming in draws them side by side (decision 0039): `sideBySide`
  (`hex-halves.ts`, by `HexGrid.half`) moves where they're drawn, never their hex.
  The chosen hex's moves stand out (decision 0041): `move-focus.ts` (which moves, their
  destinations, their lines and arrowheads), drawn by `OrderOverlay` and `SelectedHexLayer`;
  a mouse over a marker or ghost previews them (`previewed` in `MapPage`, step 75c), and the
  layers' `otherMoves` group hides the rest instead of fading them (step 75d); their `trails`
  group off draws each moving unit where it's going instead (step 75e: `atDestinations`,
  `arrivalChoice`), but for those whose moves stand out.
  The hex grid (decision 0014) is `hex-grid.ts`: its arithmetic matches the API's `HexGrid.cs`,
  and both are tested against `testdata/hex-grid.json` (from an independent Python reference;
  the Dockerfile copies it into the web build). `HexGridLayer` draws it, and nothing past
  `maxDrawnHexes`. Movement is `movement.ts` (classes, the rule book's table, `stepCost` from the terrain and
  the campaign's table, `reach` and `pathTo`), mirroring the API's `Movement.cs`; both are
  tested against `testdata/movement.json`. Terrain (decisions 0014, 0016) is `terrain.ts` (labels,
  and where each of a hex's six sides is stored: `storedEdge`, `flowFor`), drawn by
  `TerrainLayer` and edited on `TerrainPage`. Inference (`inference/`) reads the map's tiles in
  the browser: `tiles.ts` fetches and decodes them (browser only), `sources.ts` and `infer.ts`
  are plain arithmetic, tested with made-up data. A hex's actual terrain (the rules' p. 57
  roll) is `hex-detail.ts` in words, `HexDetailSection` for the Umpire and `HexDetailsList` on
  the Map page. The Umpire's turn actions
  (approve, send back, reopen, the next turn) go through `useReview` (`use-review.ts`).
- The library (decision 0015) is `features/library`: every signed-in user views it; edits are
  shown only to `canEditLibrary(user)` (Managers and Admins). `UnitFormModal` (`features/units`)
  is shared by library units and the army's copies of them. An army takes units only from its
  factions (the army form's **Factions**), through `AddUnitsModal`; both fetch the library afresh
  each time they open (`refetchOnMount: "always"`), as a Manager may have changed it. A faction's
  units, and an army's, show as their order of battle (step 54): `order-of-battle.ts`
  (`features/units`) groups them (a pure function; corps, division, brigade, in the imported
  file's order where units have one, step 55), `OrderOfBattleTable` draws them for both. Beside the map (step 62),
  `FormationList` (`features/maps`) lists an army's units the same way, as nested lists named
  for each group, with what the panel counts in each heading ("3 of 5 placed"); each heading
  folds its group (step 63), and a `complete` group starts folded. Its `actions` sit beside
  each heading: `FormationMenu`, through `formationActions` (`pick-out.tsx`), picks a formation out on
  the map (step 64); what stands out there is `standsOut`, a test of each unit. An army's
  units with their orders (undo, Hold the rest) are `ArmyOrdersList`, in the commander's turn
  panel and folded under each army in the Umpire's (step 64d). The review dialog's unit notes are a `FormationList` too (step 65); a few units named apart (a history's
  notes) are sorted with `inOrderOfBattle` instead.
  Managers and Admins import the club's CSV from the library page (`ImportLibraryModal`,
  decision 0025): the file's text is previewed, then imported. Its file field is a native
  `<input type="file">` in an `Input.Wrapper`, so tests upload to it by its label.
- A campaign's calendar (step 45) is `features/campaigns/calendar.ts`: `turnWhen(turn)` labels a
  turn ("17 June 1815, Afternoon"); the rule book's marching nations mirror the API's
  `TurnParts`. The march itself is `movement.ts`'s `ratesFor` (each rate a hex faster or slower, `faster`), as
  the API's `Movement.TableFor`.
- Contact and concentration (step 46, decision 0017) is `features/maps/contact.ts`: `hexWarnings`
  per hex and side, by the campaign's concentration settings (`features/campaigns/concentration.ts`
  has the usual ones); `afterOrders` for the turn shown. `HexWarningsList` in the turn panels,
  `HexWarningsLayer` on the map: the Umpire's of every side, a commander's of their own units'
  hexes (decision 0040). A hex's drawer totals its points (`hexConcentration`,
  `ConcentrationSummary`). Name a hex with `hexName` (`hex-grid.ts`); beside the map, with
  `HexLink`, which opens and centres it (the Map page's `ShowHexContext`; decision 0040).
  `TownSearch` (decision 0046) finds a town the same way: the grid's named settlements, then the
  API's `SearchTowns`, each leading to its hex.
- The Map page's layers (`map-layers.ts`, `MapLayersControl`): each viewer hides what the
  campaign's map settings show, layer by layer or a whole map by its own switch (`groups`, which
  leaves its layers' switches as they were; on the Map page, `"pieces"` hides everything drawn
  over the maps, `showsPieces`; `useHiddenLayers`, in `localStorage`; the terrain
  editor has its own, `useHiddenLayers(id, "terrain")`, and no zoom rule); the game map shows once the
  view spans `gameMaxHexesAcross` hexes or fewer (`CampaignMap`'s `onViewChange`). Game layers stay
  mounted and are hidden with `visibility`: WebKit can miss layers first added just after the map
  loads, so `zoomedIn` starts from the area's own size.
- Forced marches (step 47, decision 0018) are `features/maps/marches.ts` (the force march's extra
  reach, when it's allowed, the count and costs in words; the count itself is the API's
  `ListMarches`); the Umpire confirms attrition in `StartTurnModal`; a unit's points history is
  `UnitPointsHistory`. `useReview` refreshes every army's marches and every unit's history after a
  change, `useOrders` the army's marches. Attrition in words is `attrition.ts` (the scale, a rough
  loss, `whyItOwes`, `attritionWarning`); commanders and the Umpire are warned (decision 0050)
  from the API's `ListAttritionDue` (their own armies'): `UnitMarkers`' `underAttrition` mark,
  the drawer's `AttritionWarning`, and the move prompt's cost.
- Supply (step 48, decision 0019): depots are `DepotsPanel`, `DepotMarkers` and `use-depots.ts`;
  each unit's supply is the API's (`useGetSupply`), worded by `supply.ts` (`describeSupply`) and
  warned of by `SupplyWarnings`; living off the land is the drawer's switch, kept on every new
  order (`livingOffTheLand` in `MapPage`). The settings are `SupplySection` on the edit page.
- What's in a hex (step 57, decision 0027): a click or tap on a hex or a unit's marker opens
  `HexDrawer` (its units, one in full with its orders, then its sightings, then its terrain from
  `hex-info.ts`'s `describeHex`, a pure function), its units by id from the positions. It isn't modal
  (decision 0038: no overlay, from the left on a computer); a unit chosen from a list goes through
  `MapPage`'s `chooseUnit`, which centres its hex (`centreOn`, by `mapRef`) and moves focus into
  the drawer (`focusRequest`). Hover is
  `CampaignMap`'s `onHover` (mouse only), shown by `HexInfoPopup` (a MapLibre popup in the app's
  colours): the hex's units, else its sightings, else its ground (`hoverLines`). The
  legend is `MapLegend`. The theme choice is `ThemeMenuItems` (Mantine keeps it in localStorage;
  `public/color-scheme.js` reads it before the first paint): a Menu item stays a `menuitem`, so
  the chosen one is marked with `aria-current`.
- Sightings and intelligence (step 49, decision 0020): the Umpire shapes sightings in
  `StartTurnModal` (`SightingsFields`, `sighting-entries.ts`); commanders see them in
  `SightingsPanel` and on the map (`SightingMarkers`, the turn shown and 3 before, faded:
  `sightingsFor`), and the turn list marks their turns. Reports are `IntelligencePanel` and
  `SendReportModal`, a received one's units `SnapshotMarkers`; the Umpire's couriers are
  `CouriersPanel` (on their way, and the history), worded by `couriers.ts`, cancelled with a note
  in `CancelCourierModal` (step 68, decision 0033), and drawn on the Umpire's map of the open
  turn by `CourierMarkers` (a popover with the details and Cancel). The Umpire's own reports
  (step 70, decision 0035) are `SendIntelligenceModal` (its units by army, `umpire-intel.ts`;
  sightings shaped in `SightingsFields`), opened by `SendIntelligenceButton`. How fast couriers
  ride (decision 0048) is `CourierSection` on the edit page.
- Towns and victory points (step 50, decision 0021): a settlement's value is `victory.ts`
  (`settlementValue`, by the campaign's mode, mirroring the API's `HexSettlement.ValueIn`; the
  mode is `VictorySection` on the edit page); the scoreboard is the API's,
  shown by `ScoreboardPanel` (map and campaign pages) and `HoldingFlags`; the Umpire sets the
  value and holder in the terrain editor (`HolderField`).
- Boats (step 51, decision 0022) are `features/maps/boats.ts` (who's on boats, free boats in a
  hex, where a unit can land, where boats are built), mirroring the API's rules. A placed unit
  carries the boats it's on (`PlacedUnit.boats`, from its position); boats tied to a unit aren't
  drawn or listed (`tiedBoats`), and a unit on them moves as a "Boat". The drawer's Embark, Land
  and Build a boat are `OrderActions`' `boats` (`boatOptions` in `MapPage`); the capacity is
  `BoatSection` on the edit page.
- Screening (step 56, decision 0026): the unit drawer's switch and the turns it screened are
  `UnitScreening` (worded by `screening.ts`), for the unit's commander and the Umpire only
  (`screeningOf` in `MapPage`); the Umpire sees what screens hide in `SightingsFields`.
- Scouts (step 58, decision 0028): the Umpire adds them from the army's Units (`AddScoutModal`);
  `fights(type)` (`unit-types.ts`) is false for them, and they have no FF or points (`UnitStat`
  shows "–"). `unitTypeOptions` leaves them out, so no form or setting offers the type. The map's
  rules skip them: `canForceMarch`, `buildsBoats`, `hexWarnings`.
- Commanders (decision 0034) have no FF or points either, but otherwise fight: `hasStats(type)`
  (`unit-types.ts`) is false for them and scouts, so `UnitStat` shows "–" and `UnitFormModal`
  hides the fields while the type is Commander, sending 0. At 0 points a Commander or scout keeps
  its boats.
- The Commander in Chief (step 67, decision 0032): `isCommanderInChief` on a unit; pass it to
  `UnitSymbol`'s `commanderInChief` (the star in a ring) wherever a unit's symbol is drawn, and put
  `CommanderInChiefBadge` beside its name in lists. It leads its marker's stack (`stackUnits`).
  The Umpire chooses it by the star in the army page's units (`UnitsSection`).
- Markers (step 80, decision 0054): each viewer's own, seen by no one else. `use-markers.ts`
  changes them; `MarkerFormModal` edits one, `MarkerList` lists them (in the hex drawer's
  `HexMarkers` and the `MarkersPanel`), `MarkerPins` draws them (the layers' `markers` group,
  `showsMarkers`). A new one's title is `markerTitleFor` (`markers.ts`): the hex's settlement name,
  else `realPlaceIn` the map's loaded tiles (`placesOnTheMap`), else empty.
- Queries that must not be saved for offline use (live status, admin data such as the user list)
  pass `meta: { persist: false }`.
- Accessibility (WCAG 2.1 AA) is enforced in part by `jsx-a11y`; also give every page a title and
  a single `h1`.
