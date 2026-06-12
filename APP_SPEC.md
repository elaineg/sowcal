# SowCal — succession-planting calendar feed

Purpose: Lets a market gardener turn frost dates + crop choices into a subscribable ICS
feed and printable week-by-week task list with every sow, transplant, and expected-harvest
date for the season — no account, all parameters in the URL.

Problem: A market gardener or serious kitchen gardener plans 10–40 crop successions each
season and works from the plan weekly from late winter through fall; dates all derive from
frost dates plus per-crop offsets, recomputed by hand or spreadsheet every year.

Beats alternative: Johnny's Selected Seeds free Excel calculators (trusted data, no
calendar integration), WhenToPlant (verified: free zip-code month-by-month printable, no
ICS and no succession intervals), or Seedtime (purpose-built succession planning, $99+/yr
for full use, account required). No free tool found that emits a subscribable calendar.
Re-validated 2026-06-12: Seedtime's free tier (signup required) does cover the succession
math, so the load-bearing differentiator is the no-signup, parameters-in-URL **subscribable
ICS feed** that calendar apps poll, plus the shareable-link plan — verified unserved.

## Parameter model (shared by all three flows — this is the contract)

- `lf` = last spring frost date, `ff` = first fall frost date, both `YYYY-MM-DD`.
- `crops` = comma-separated crop specs:
  `id:intervalDays:count[:sowOffset:transplantAfter:daysToHarvest]`
  - `intervalDays` = days between successive sowings; `count` = number of successions.
  - `sowOffset` = days from last frost to the FIRST sowing (negative = before frost).
  - `transplantAfter` = days from sowing to transplant; the literal `-` means direct-sow
    (no transplant events).
  - `daysToHarvest` = days from sowing to expected first harvest.
  - When the optional trio is omitted, defaults come from the built-in crop table; when
    present, the override wins (this is the P0 per-crop offset override).
- Date math, succession n (1-based): sow_n = lf + sowOffset + (n−1)·intervalDays;
  transplant_n = sow_n + transplantAfter (transplanted crops only);
  harvest_n = sow_n + daysToHarvest. If harvest_n is after `ff`, the harvest event's
  SUMMARY gets the suffix ` (frost risk)` — events are kept, not dropped.
- Built-in crop table (static TS module, Johnny's/extension-style offsets, ~18 crops):
  lettuce, arugula, spinach, radish, salad turnip, carrot, beet, cilantro, dill, basil,
  bush bean, pea, sweet corn, cucumber, zucchini, kale, broccoli, scallion. Each entry:
  display name, default sowOffset, transplantAfter (or direct-sow), daysToHarvest,
  suggested intervalDays.
- Event SUMMARY format (exact, so checks can assert on it): `Sow Lettuce #1`,
  `Transplant Lettuce #1`, `Harvest Lettuce #1`, `Harvest Lettuce #2 (frost risk)`.
- The same crop id may appear more than once in `crops` (e.g. a spring run and a fall
  run with different offsets). The k-th occurrence (k ≥ 2) is labeled `Lettuce (k)` in
  SUMMARYs and the builder (`Sow Lettuce (2) #1`); the first occurrence is unchanged.

## Core flows

1. **Plan builder (`/`)**: user enters last/first frost dates in two plain date fields
   (typed directly — no zip-code or location lookup), picks crops from the built-in table,
   and per crop sets re-sow interval, succession count, and (optionally, behind an
   "adjust" toggle) overrides for sow offset / transplant-after / days-to-harvest. The
   page live-renders three copyable outputs that encode the whole plan in their query
   strings: the printable plan link (`/plan?...`), the subscribable feed URL
   (`https://.../api/feed.ics?...`), and its `webcal://` variant — with one-line
   instructions for Google Calendar "From URL" and Apple Calendar subscribe. Opening `/`
   with those same query params prefills the form, so editing a shared plan = open link,
   change form, copy new link. Nothing is stored server-side or client-side.
2. **Stateless subscribable ICS feed (`GET /api/feed.ics`)** — the differentiator: all
   parameters in the query string, no DB, no signup. Emits a valid VCALENDAR of all-day
   events (`DTSTART;VALUE=DATE`) for every sow, transplant (transplanted crops only), and
   expected-harvest date of every succession per the date math above. UIDs are
   deterministic functions of (crop id, occurrence index in the crops list, succession
   number, event type) and are unique within the VCALENDAR even when the same crop id
   appears multiple times: the first occurrence is `sow-lettuce-1@sowcal`, the k-th
   (k ≥ 2) is `sow-lettuce.2-1@sowcal` (crop ids cannot contain `.`, so no collisions).
   The body contains no timestamps derived from "now" — the
   same URL returns a byte-identical body every time, so calendar re-syncs update rather
   than duplicate. Response headers set explicitly: `Content-Type: text/calendar;
   charset=utf-8`, `Cache-Control: public, max-age=3600`, and
   `Vercel-CDN-Cache-Control: public, s-maxage=3600` (CDN strips s-maxage from the
   client-visible header — see memory/friction). Bad input (malformed date, unknown crop
   id without a full override trio, malformed crop spec) returns 400 with a plain-text
   reason, never 500.
3. **Printable week-by-week task list (`GET /plan`)** with the same query parameters:
   every sow/transplant/harvest task grouped under Monday-start "Week of <date>" headings
   in season order, using the same SUMMARY strings as the feed; a print stylesheet makes
   it a clean one-to-few-page handout (no nav/buttons when printed); an "Edit this plan"
   link goes back to `/` with the same params prefilled.

## Success checks

All checks use explicit override trios so they are independent of the built-in table's
default values, and are verifiable in seconds with curl or a browser.

1. `GET /api/feed.ics?lf=2026-05-15&ff=2026-10-05&crops=lettuce:14:2:-28:14:55` returns
   HTTP 200 with `Content-Type: text/calendar`, a body wrapped in
   `BEGIN:VCALENDAR`/`END:VCALENDAR`, and exactly 6 `BEGIN:VEVENT` blocks with all-day
   dates: sows on `DTSTART;VALUE=DATE:20260417` and `20260501`, transplants on `20260501`
   and `20260515`, harvests on `20260611` and `20260625`, with SUMMARYs
   `Sow Lettuce #1` … `Harvest Lettuce #2`.
2. Direct-sow: `...&crops=carrot:21:3:0:-:70` yields exactly 6 VEVENTs (3 sows + 3
   harvests, no `Transplant` SUMMARY anywhere), first sow `20260515`, last sow `20260626`.
3. Determinism / re-sync safety: two consecutive curls of the URL in check 1 return
   byte-identical bodies, and every VEVENT's UID matches the pattern
   `<type>-<crop>-<n>@sowcal` (so a stranger can diff the two responses and see zero
   changes).
4. Cache headers: `curl -sI` of the URL in check 1 shows `Cache-Control: public,
   max-age=3600` and `Vercel-CDN-Cache-Control: public, s-maxage=3600` set by the route.
5. Frost-risk marker: with `ff=2026-06-20` and the crops param from check 1, the second
   harvest event's SUMMARY is exactly `Harvest Lettuce #2 (frost risk)` and the first
   harvest's SUMMARY has no suffix.
6. `GET /plan?lf=2026-05-15&ff=2026-10-05&crops=lettuce:14:2:-28:14:55` renders HTML
   containing the heading `Week of` for the week containing 2026-04-17 (Monday
   2026-04-13) with the task `Sow Lettuce #1` under it, and a link to `/` carrying the
   same query string; the page has a `@media print` stylesheet that hides the nav/edit
   controls.
7. Opening `/` with the query string from check 6 prefills the frost-date fields with
   2026-05-15 / 2026-10-05 and shows lettuce configured with interval 14 and 2
   successions; the displayed feed URL contains `crops=lettuce:14:2:-28:14:55`.
8. `GET /api/feed.ics?lf=notadate&crops=lettuce:14:2` and
   `GET /api/feed.ics?lf=2026-05-15&ff=2026-10-05&crops=quinoa:14:2` both return HTTP 400
   with a human-readable reason naming the bad field, not a 500.

## Out of scope

- Zip-code / location-based frost-date lookup (frost dates are typed directly — P0).
- Accounts, login, or any persistence (no DB, no localStorage; the URL is the save file).
- External APIs of any kind.
- Bed/space planning, crew assignments, harvest-quantity targets (Seedtime's paid turf).
- Custom user-defined crops beyond overriding the three offsets of a built-in crop.
- Crop-table editing UI; PDF generation (print CSS only); email or push reminders.
- Timed (non-all-day) events and timezone handling; fall-frost-only/overwinter crop
  edge polish.

Production URL: TBD
