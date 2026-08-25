# Klimarisiko-widget — prototype

A small embeddable widget showing a municipality's climate-risk ranking from
klimamonitor.no/klimarisiko: total risk + the four categories (Fare,
Eksponering, Sårbarhet, Respons), each as a 5-segment bar gauge with a rank
out of all 357 Norwegian municipalities. Two colour themes (dark / light)
and two layouts (wide grid / narrow list) are built in.

## Files

- `widget.js` — the whole widget. Vanilla JS, no dependencies, renders into
  a Shadow DOM so it can't clash with the host site's CSS. Includes both
  real logo files as embedded images.
- `demo.html` — a mock host page (not the real partner site) with switches
  for municipality, theme, and layout, to try every combination.
- `logo-dark-text.png` / `logo-light-text.png` — your real logo files
  (kept here for reference; they're also embedded directly in `widget.js`).

## The big update this round: real ranking data, not a guess

You asked whether the exact rankings shown in the dashboard's
"kommuneanalyse" panel are available somewhere in the repository. They're
not stored as a file, but the *code that calculates them* is — the
dashboard computes rankings live in the browser, in
`github.com/tiltobias/klimarisk`. I read that code (`frontend/src/hooks/
useDataStore.ts`, `hooks/statistics.ts`, `components/details/
DetailedStats.tsx`) and ported its exact method here, replacing the
earlier "average + guess" version:

1. **Per category** (Fare, Eksponering, Sårbarhet, Respons), average that
   category's available indicator values for the municipality (unchanged
   from before).
2. **Normalise** each category's average to a 0–100 score using min–max
   scaling — but critically, the min and max are taken across **all three
   years combined** (2025, 2050, 2100), not just the year being displayed.
   This is the step the earlier version was missing, and it's what
   stretches scores out to genuinely span 0–100.
3. **Total risk** = the sum of the four category scores (Respons inverted,
   since low response capacity means high risk).
4. **Rank** = the municipality's position among all 357, compared only
   within the selected year (rank 1 = highest risk).
5. **Bar-gauge level** (1–5) = which fifth of a min–max range the score
   falls into, direction-corrected for Respons. For the four categories
   that range is always exactly 0–100 (by construction, from step 2). For
   **Total risk specifically**, the range is taken from **only the
   selected year's own values** (not pooled across all three years) — so
   the bar count reflects where a municipality sits within the spread
   actually shown for the year being displayed. This was a deliberate
   change from the dashboard's own approach (its internal colour-domain
   code pools all years together), made after checking a specific case —
   Tromsø in 2100 — against the dashboard's own displayed range and
   finding the per-year domain matched what was expected; the pooled
   version did not.

This is no longer a guess dressed up as a plausible default — it's the
same formula the dashboard itself runs (with that one intentional
deviation on the total-risk bucket domain), verified line-by-line against
the source. `widget.js`'s file header has the full detail and the exact
files it was ported from.

**One thing I still can't promise:** exact parity with the specific
"Sogndal" screenshot you shared. I tested the new formula against that
exact municipality and it's much closer than before, but still not
identical (e.g. Sårbarhet matches exactly; a couple of others are off by
one level). My best explanation is that the screenshot was rendered from
an earlier monthly data snapshot — the live dataset updates over time,
and I'm fetching today's version. I also could not find the code that
generates that specific share-graphic anywhere in the dashboard
repository, so it's possible it's produced by a separate tool your team
uses — worth asking where it comes from if pixel-perfect parity with
that exact image matters to you.

## Design — three propositions, all working

You said you have no strong opinions and asked for suggestions, so I
built the two axes as independent, combinable options rather than
picking one look:

**Theme** (`data-theme="dark"` default, or `"light"`) — dark matches your
existing "Sogndal" graphic; light is the inverted version for placement
on white-background pages, using your actual light-background logo file.

**Layout** (`data-layout="grid"` default, or `"list"`) — grid is the
5-column layout matching your reference image; list is a narrower
(220px), single-column stack with horizontal bars instead of vertical
ones, for sidebars too narrow for the 340px grid version.

Combined, that's 4 working variants today (dark grid, light grid, dark
list, light list) — try them all in `demo.html`'s dropdowns. If none of
these feel right, tell me what's off and I'll iterate — since you
mentioned having no strong opinions, I'd also suggest just picking
whichever one feels most legible at a glance and we refine from there,
rather than deliberating in the abstract.

## Logo

Both logo files you sent are now embedded directly in `widget.js` (as
base64 image data, so the widget stays a single self-contained file) and
swapped automatically based on `data-theme`. No more hand-traced
approximation.

## How it works today

1. A container element `<div data-klimarisiko-widget></div>` plus
   `<script src="widget.js"></script>` is all a page needs. Optional
   attributes: `data-theme`, `data-layout`, `data-year` (2025 default —
   see note below), `data-kommune` (bypasses URL detection).
2. Municipality detection (see "Open questions" below): a `?kommune=`
   URL parameter, name or 4-digit SSB number.
3. Fetches the same two public JSON files the real dashboard uses,
   computes scores/ranks/levels for all 357 municipalities using the
   verified formula above, and renders the card.
4. Data is fetched and computed once per page load, cached in memory, and
   reused if there's more than one widget on the page.

Note on `data-year`: the interactive dashboard's own default view is
2100 (the *last* entry in its year list) — projected, not current. This
widget defaults to 2025 (today's reference period) instead, since that
reads more naturally for a general audience landing on someone else's
municipality page. Override with `data-year="2050"` or `"2100"` if you'd
rather match the dashboard's own default or let a page choose.

## Open questions (marked "ANTAKELSE" — assumption — in widget.js)

**How the widget learns which municipality to show** is still a
placeholder (a `?kommune=` URL parameter), pending the answer from the
partner-site team (message already drafted earlier in this chat). Once
you hear back, only the `detectKommune()` function needs to change.

## How to try it yourself

From this folder:

```
python3 -m http.server 8000
```

Then open `http://localhost:8000/demo.html` and use the dropdowns to
switch municipality, theme, and layout.

## Next steps

1. Send the drafted integration question to the partner-site team, if you
   haven't already.
2. Pick a theme/layout combination (or tell me what to adjust).
3. If pixel-perfect match with your existing "Sogndal" graphic matters,
   find out where/how that graphic is generated so I can compare formulas
   directly instead of reverse-engineering from one screenshot.
4. Once 1 is resolved, this is close to embeddable as-is on the real
   partner site.
