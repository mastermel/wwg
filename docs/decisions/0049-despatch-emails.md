# 0049. Every email is a despatch

- **Date:** 2026-11-23
- **Status:** Accepted

## Context

The emails were bare HTML: a greeting, paragraphs, lists and a plain link, with no sign of
where they came from. A turn-started email with sightings, attrition and allies' reports read as
a wall of bullet points. Three designs were mocked up (a navy masthead, a letterhead, a
despatch), and the despatch was chosen.

## Decision

- **One layout for every email** (`EmailBuilder`, `Infrastructure/Email`): a white page with a
  navy top rule, the app's icon in a circle, a sender line ("Wasatch Wargamers · The Hundred
  Days"), a serif title and an italic subtitle (a turn's date and time of day) over a double rule.
  Then the body, a button, and a footer.
- **The body is built from a few blocks:** a greeting, paragraphs, a heading, a *letter* (someone's
  words quoted under a label: the Umpire's notes), and a *ledger* (labelled rows: enemy sightings,
  supply, attrition, boats, allies' reports, notes on units, orders the Umpire set). Each block
  writes the HTML and the plain text together, so the two can't drift apart.
- **Georgia** for the despatch's voice, system sans for labels and the button: every mail client
  has both, so there are no web fonts to load.
- **The icon is attached inline** (a 104px PNG, embedded in the API, `cid:`): mail clients don't
  show SVG, and an inline image shows without the reader allowing remote images.
- **Campaign emails say why they were sent** ("You get this email when a new turn starts") and
  link to the account page, where each kind can be turned off (decision 0023). The account's own
  emails say they're about the account, with no link: they can't be turned off.
- The first paragraph is the **preheader**, the preview the inbox shows after the subject.
- Tables and inline styles only, `color-scheme: light`: that's what Gmail, Outlook and Apple
  Mail all render.

## Consequences

- A new email is a few builder calls; nobody writes email HTML by hand.
- The plain-text bodies changed a little: ledger entries are "- " lines under their label, quotes
  are "> " lines, and a footer follows "--". "Their note:" became the letter "The Umpire's note".
- A line break in a note now shows in the HTML: the encoder had been escaping it before it could
  be replaced with `<br>`.
