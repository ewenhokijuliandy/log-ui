# Design — logdeck "Data terminal" (Phase 4 port)

The approved visual direction lives in [`design/`](./design/) (17 rendered states, `design/README.md` is the visual authority). This file is the practical bridge from those tokens to the React app for the `impeccable` audit in Phase 8.

## Tokens

`src/web/theme.css` is `design/app.css` ported verbatim and extended through Phase 8 (2,797 lines): dark `:root`, light `:root[data-theme="light"]`, the paper `.print-sheet` set, every component block, both responsive compositions and the print media block. Both theme sets are applied by attribute on `<html>`, set pre-paint by the inline script in `src/web/index.html` from `localStorage["logdeck.prefs"]`.

- Fonts: Public Sans (UI) + IBM Plex Mono (timestamps, seq, ids, counts, raw, JSON) from Google Fonts, system fallbacks as in the design.
- Scale: 11 meta · 12 small · 13 body · 15 panel · 26 title (20 on phone); `tabular-nums` on the body.
- Geometry: 180px expanded rail (50px collapsed), 48px topbar, 40px tab strip, 30px rows (40 wrap/54 mobile), 42px signal strip, 440px inspector (320px at ≤1180; column shifts at 1180/960/720).
- The 1px accent-line signature: active tab underline, level-chip underline, tool underline, rail page line, selected-row left line, thread gutter. Everything else stays ink; color lives on levels, pills, ticks and selections only.

## Component map (design surface → React)

| Design surface | Path |
| --- | --- |
| Shell / grid | `src/web/app/App.tsx` (`.shell`, `.main`), `src/web/index.html` |
| Labelled rail + mobile bottom bar | `src/web/components/shell.tsx` (`Rail`) — expanded by default with icon + text labels grouped Views/App, collapsible to the 50px icon rail and persisted in `Prefs.railExpanded`; at ≤720px CSS turns it into a five-item bottom bar (Streams, Merge, Compare, Pretty, Manual; Settings/Help/Theme hidden) |
| Topbar / connection chip / export menu / theme | `shell.tsx` (`TopBar`) + `popover.tsx` (fixed-position popover portal with outside-click + Esc) |
| Stream tabs (+ drag reorder, close, count) | `tabs.tsx` — HTML5 drag; order persisted (`logdeck.tabOrder`) |
| Toolbar (search + regex, level chips or Levels popover, range/sort/pause/presets, More) | `toolbar.tsx` + `filters.ts` |
| Signal strip (60 one-second bins, note) | `signal.tsx` + `buildSignal()` |
| Log rows grid + thread gutter + trace chips | `logs.tsx` (`LogRow` markup inside the virtualized list) — grid columns from `--cols` |
| Inspector (parsed fields, Tree/Pretty JSON, collapsible raw, copies, isolate) | `inspector.tsx` + `JsonNodes` + `PrettyJson` |
| Detail sheet at ≤960 (same inspector content in a modal) | `inspector.tsx` (`DetailSheet`) + `dialogs.tsx` (`DialogFrame`) |
| Quick start (no streams, `+` tab, help action) | `quick.tsx` + `legacy-data.ts` pipe examples |
| Sheets/dialogs (settings, help, manual, pdf preview) | `dialogs.tsx` (`DialogFrame` = native `<dialog>`, focus taken on open) |
| Compare JSON dialog (paste A/B, structural diff, copy) | `compare.tsx` + `json-diff.ts` |
| Statusbar | `shell.tsx` (`Statusbar`) |
| Print sheet | `dialogs.tsx` (`PrintSheet`) + design print CSS |

## Data decisions feeding the rows

- `message` = parser prose (JSON `msg`/`message` when present, else remainder text) — the parser decision recorded in `PROGRESS.md` Phase 1.
- `ids[]` (trace/request ids) render as up to two `trace-chip`s; the first id drives the row thread gutter while it is selected or isolated.
- Timestamps: `formatTime`, epoch ms, UTC/local flip respects the toggle; `ts: null` rows render `-`. Head ISO/epoch timestamps win; JSON `time`, `timestamp`, `ts`, `@timestamp`, `datetime`, `date`, `event_time`/`eventTime` fill in when the head has none, with numeric epochs auto-scaled across seconds/milliseconds/microseconds/nanoseconds inside the 2000–2100 window.
- JSON levels accept names or numbers: Pino/Bunyan `10/20/30/40/50/60` and syslog/RFC5424 `0–7`. Out-of-band or fractional numbers stay `unknown`; named levels win over numeric siblings.
- Level chips are multi-select: ERROR = fatal+error, DEBUG = debug+trace, WARN, INFO and UNKNOWN are separate groups. Counts are merged per chip over the full buffer from the server's `levelCounts`; UNKNOWN rows appear only when that chip is selected or no level is selected.
- Parse rules are client-side: JSON level/time/message keys, a numeric preset (Auto, Pino/Bunyan, Syslog or a custom map) and an epoch unit re-parse `record.raw` in the browser. Default rules use the server parse; the daemon is untouched.
- Inspector order is parsed fields → JSON body → raw line → trace. The JSON body offers Tree/Pretty views, wrap, expand/collapse and copy; the raw line is collapsed when a JSON body exists. The default width is 440px and the JSON panel has a 200px minimum with a flexible body.

## Motion

Ported from the design rules: 120–180ms color/background transitions, `translateY(1px)` press, 140ms `scale(0.98)` popover entry (`@starting-style`), JSON caret rotate. Nothing animates on entrance or list layout; `prefers-reduced-motion` strips all durations (CSS block kept verbatim). Phase 8 added no new motion; the audit verified the reduced-motion path and that every state change also has a text/label state.

## Deviations accepted for Phase 4

- Signal-strip note label uses the newest warn+ line's message (truncated at 46 chars) — the design's hand-written `signalNote` had no live equivalent; production parity kept simple.
- `theme.css` `!important` (`[hidden]`, reduced-motion) and the design's `role="button"` rows with `aria-selected` are kept verbatim; Biome overrides scope these two files' specific rules off (documented in `biome.json`), matching the design's own a11y notes. Phase 8 moved rows to list/listitem + `aria-current` and gave tabs the APG roving/arrow behavior, so the Phase 4 note applies only to the untouched CSS blocks.

## Phase 8 additions and accepted results

- Detail sheet at ≤960 reuses the inspector body in a `detail-sheet` dialog; the desktop-only `.inspector` hide is scoped to `.log-shell`, so the sheet stays visible.
- Toolbar compositions: one row at ≥1181px with inline level chips; 961–1180px swaps the chips for a Levels popover and shows a More popover for zone, wrap and auto-scroll; ≤960px wraps to two rows (full-width search, then chips plus tools); ≤720px keeps the chips horizontally scrollable. Tool labels collapse below 1701px and every icon keeps a `title`/`aria-label`. Range, sort, pause and presets stay visible; More carries the display toggles.
- Phone-only `.stream-tab .close` is 24px; `.regex`, `.trace-chip` and `.json-copy` meet the 24px minimum. The light `--faint` token is `#65696d` so the two 4.48:1 pairs reach AA.
- Design lint: 0 FAIL / 30 WARN (29 deliberate mono + 1 clock), the Phase 4 baseline. The new pause-badge count uses tabular UI numerals rather than monospace, keeping the mono count at 29; tab counts remain IBM Plex Mono.
- Inspect: 0 FAIL at 1440/768/390 with `--allow edge-text,tiny-text`. `tiny-text` is the accepted baseline; `edge-text` is a verified false positive (the unclipped DOM Range extends into the clipped `.msg` overflow while the visible row stops 146px from the edge). The Impeccable detector's only hit is the JSON-tree disclosure triangle (`side-tab`).

## How to check

```bash
npm run build             # dist/cli.js + dist/web
node src/cli/index.ts __daemon --port=3333   # serve dist/web + WS
# browser: http://127.0.0.1:3333
CHROME_PATH="<chrome>" node .commandcode/skills/design-taste-frontend/scripts/inspect.mjs http://127.0.0.1:3333/ --app --allow edge-text,tiny-text --out .taste-skill/inspect-phase8-final
node .commandcode/skills/design-taste-frontend/scripts/lint.mjs --app src/web
```
Phase 4 gate results: lint 0 FAIL / 30 WARN (29 mono + 1 clock padding, accepted), inspect 0 FAIL / 1 tiny-text WARN (accepted). Phase 8 results: lint 0 FAIL / 30 WARN, inspect 0 FAIL with the edge-text false positive and tiny-text baseline allowed; the 768 detail sheet, tab/row keyboard paths, popover menus and reconnect states were verified live.
