# logdeck v1.3 — Enhancement Plan

**Status:** planning · no production code
**Baseline:** `logdeck@1.2.0` (tagged `v1.2.0` on `c5bc532`; npm publish pending 2FA)
**Target:** `logdeck@1.3.0`
**Source:** user request, 2026-11-21 (seven items)
**Design source:** `/Users/ewenhokijuliandy/Documents/logdeck — current design.figcraft`
**Related:** [`PRD.md`](./PRD.md), [`PRODUCT.md`](./PRODUCT.md), [`PLAN.md`](./PLAN.md), [`TODO.md`](./TODO.md) (round 2), [`PROGRESS.md`](./PROGRESS.md), [`RELEASE.md`](./RELEASE.md)

> This plan covers the seven v1.3 enhancements only. `TODO.md` remains the
> record of the completed round-2 work (`FB-19`–`FB-26`); nothing here reopens
> it. No code is written until the design wave is approved and the user starts
> an item.

---

## 1. Scope at a glance

| ID | User item | Type | Priority | Design gate | Depends on | Status |
| --- | --- | --- | --- | --- | --- | --- |
| V13-01 | Compare JSON and Pretty JSON become full-workspace views, not modals | Architecture + UI | P0 | D-08 | — | Planned |
| V13-02 | Compare JSON revamp: side-by-side line diff with line numbers, gutter arrows and tints | Feature + design | P0 | D-08 | V13-01 | Planned |
| V13-03 | Find a stream tab by name (the 32-tab problem) | Feature + design | P1 | D-09 | — | Planned |
| V13-04 | Close all tabs from the tab-strip menu | Feature + design | P1 | D-10 | — | Planned |
| V13-05 | Merge log view below Streams, with a source-stream column | Feature + design + architecture | P0 | D-11 | V13-01 | Planned |
| V13-06 | logdeck version info on the Settings page | Feature | P1 | D-12 | — | Planned |
| V13-07 | More relevant Help: version/daemon info, CLI flags, level-filter tutorial | Content + design | P1 | D-13 | V13-03, V13-06 | Planned |

**Recommended order:** design wave → V13-01 → V13-02 → V13-03 → V13-04 → V13-05 → V13-06 → V13-07 → docs/release.

**Why this order.** V13-01 introduces the workspace-view shell that V13-02 and
V13-05 reuse. V13-03 and V13-04 both touch the tab strip and are cheap to land
together. V13-05 is the largest item and depends on the view shell plus a
`LogList` variant. V13-06 and V13-07 share the app-info fetch, so they land
last. V13-07 also documents the `Cmd/Ctrl+K` shortcut V13-03 adds.

---

## 2. Working agreement

Carried forward from [`TODO.md`](./TODO.md) §1 and [`AGENTS.md`](./AGENTS.md):

1. **Design gate.** Every browser-visible change is designed in the FigCraft
   document first, exported/screenshot for review, and approved by the user
   before code. Terminal-only copy is reviewed as plain text.
2. **No design drift.** New colors, spacing, icons, or components are added to
   the Foundations page and [`DESIGN.md`](./DESIGN.md) before use. The
   "Data terminal" rules stay authoritative: 50 px rail, 48 px top bar, 40 px
   tabs, 30 px rows, 42 px signal strip, 440/320 px inspector, accent as a 1 px
   line, flat surfaces, pale status pills.
3. **One item at a time.** Code, tests, and `PROGRESS.md` are updated together
   for the item being worked on. No batching unrelated changes.
4. **No commits** until explicitly asked. Markdown files other than
   `README.md` are not committed. `/design` and `/mockups` are never committed.
5. **Code rules.** No `else`/`else if`; no inline or block comments; JSDoc only
   when writing JavaScript. Prefer guard clauses, early returns, and lookup
   tables.
6. **Ask when unsure.** Ambiguities stop the item until the user answers.
7. **Definition of done.** Design approved (where applicable), code
   implemented, unit/integration tests added or updated, Playwright flow
   covered where user-visible, typecheck/lint/build green, docs updated
   (`README`, `PRD`, `PRODUCT`, `PROGRESS`), and the item checked off here.

---

## 3. Current state audit

| Area | Today | v1.3 change |
| --- | --- | --- |
| Compare / Pretty | Native `<dialog>` modals (`compare.tsx`, `prettify.tsx`) opened through `sheet` state in `workspace-state.ts`; `sheets-model.ts` maps `'compare'`/`'prettify'`; `workspace-sheets.tsx` mounts them | Full-workspace views selected from the rail; no backdrop, no focus trap; tab strip stays |
| Compare diff | Path-based walk in `json-diff.ts`; rows show `path`, red before, green after; 5,000 paths, depth 100 | Side-by-side line diff with line numbers, gutter arrows, tints; line-based limits |
| Tabs | `tabs.tsx`: drag reorder, inline rename, per-tab close, `+`; horizontally scrollable | Add a tab finder and a tab-strip menu with "Close all tabs" |
| Rail | `shell.tsx`: Streams, Detail, Compare, Pretty, Manual, divider, Settings, bottom Help/Theme; mobile bar 7 items at 50 px min | Add Merge directly below Streams; mobile bar gains a More overflow for the 8th item at 11 px labels |
| Merge | Does not exist; store and derivations are per stream | New merged model, selector, source column, merged toolbar/list/inspector/export |
| Settings | `settings-sheet.tsx`: theme, zone, autoscroll, wrap, parsing rules, buffer limit, daemon port | Add a Version row with daemon pid/uptime |
| Help | `help-sheet.tsx`: pipe examples + six shortcuts | Sections for pipes, level-filter tutorial, shortcuts, CLI flags, about |
| App info | `/api/health` returns `{ok, pid, version, startedAt, port}`; the web app never fetches it | Fetch on boot/reconnect; add `node`; share between Settings and Help |
| Tests | 267/274 unit+integration (7 environment-blocked), 26/26 Playwright | New unit suites for line diff, merge, tab filter, uptime, close-all copy; new E2E flows |

Relevant files:

- Shell and views: [`src/web/app/App.tsx`](./src/web/app/App.tsx),
  [`src/web/app/ui.ts`](./src/web/app/ui.ts),
  [`src/web/components/workspace-state.ts`](./src/web/components/workspace-state.ts),
  [`src/web/components/stream-view.tsx`](./src/web/components/stream-view.tsx),
  [`src/web/components/shell.tsx`](./src/web/components/shell.tsx)
- Tabs: [`src/web/components/tabs.tsx`](./src/web/components/tabs.tsx)
- Compare / Pretty: [`src/web/components/compare.tsx`](./src/web/components/compare.tsx),
  [`src/web/components/prettify.tsx`](./src/web/components/prettify.tsx),
  [`src/web/lib/json-diff.ts`](./src/web/lib/json-diff.ts),
  [`src/web/lib/json-pretty.ts`](./src/web/lib/json-pretty.ts),
  [`src/web/lib/json-format.ts`](./src/web/lib/json-format.ts)
- Logs and filters: [`src/web/components/logs.tsx`](./src/web/components/logs.tsx),
  [`src/web/lib/filters.ts`](./src/web/lib/filters.ts),
  [`src/web/components/toolbar.tsx`](./src/web/components/toolbar.tsx),
  [`src/web/components/level-bar.tsx`](./src/web/components/level-bar.tsx)
- Store: [`src/web/app/store.ts`](./src/web/app/store.ts),
  [`src/web/app/stream-entry.ts`](./src/web/app/stream-entry.ts),
  [`src/web/app/stream-reducers.ts`](./src/web/app/stream-reducers.ts),
  [`src/web/components/workspace-derivations.ts`](./src/web/components/workspace-derivations.ts)
- Settings / Help: [`src/web/components/settings-sheet.tsx`](./src/web/components/settings-sheet.tsx),
  [`src/web/components/help-sheet.tsx`](./src/web/components/help-sheet.tsx),
  [`src/web/app/legacy-data.ts`](./src/web/app/legacy-data.ts)
- Server: [`src/server/routes/health.ts`](./src/server/routes/health.ts),
  [`src/server/version.ts`](./src/server/version.ts)
- Styles: [`src/web/theme.css`](./src/web/theme.css)
- Tests: [`tests/e2e/flows.spec.ts`](./tests/e2e/flows.spec.ts),
  [`tests/e2e/critique.spec.ts`](./tests/e2e/critique.spec.ts),
  [`tests/server.integration.test.ts`](./tests/server.integration.test.ts)

---

## 4. Architecture decisions

### 4.1 Workspace views (V13-01, V13-02, V13-05)

Today `useUi` has `screen: 'stream' | 'quick'`, where `'quick'` really means
"the Quick Start modal is open". Tool views need a different axis.

**Decision.** Add `workspaceView: 'stream' | 'compare' | 'prettify' | 'merge'`
to `useUi` with `setWorkspaceView`. Keep `screen` for Quick Start only.

- `App.tsx` renders the active workspace view inside `.workspace`. The tab
  strip, top bar, rail, and status bar stay mounted.
- **Render precedence.** `workspaceView` wins over `zeroStreams`. Today
  `App.tsx:31-35` renders `EmptyState` *instead of* `StreamView` when
  `zeroStreams` is true, and `StreamView` returns `null` when `active === null`
  (`stream-view.tsx:69`). New rule: `zeroStreams` only replaces the `'stream'`
  view. With zero streams and `workspaceView !== 'stream'`, the tool view
  renders and shows its own empty state. Rail tool items stay enabled. Closing
  the last stream sets `workspaceView` to `'stream'`.
- **Rail order** becomes: Streams, **Merge**, Detail, Compare, Pretty, Manual,
  divider, Settings, then the bottom group Help and Theme. Merge sits directly
  below Streams, as requested. The desktop rail fits nine 34 px buttons plus
  the mark and divider in 900 px (≈497 px used), so no overflow work is needed.
- The rail sets the view: Streams → `'stream'`, Merge → `'merge'`, Compare →
  `'compare'`, Pretty → `'prettify'`. Activating a stream tab always returns to
  `'stream'`.
- **Detail** toggles the inspector, which exists only in `'stream'` and
  `'merge'`. In Compare/Pretty it switches to `'stream'` first, then toggles.
  It is never a dead control.
- **No back button.** A tool view is left by clicking the Streams rail item, an
  active stream tab, or pressing `Esc` (precedence in the Keyboard bullet
  below). The header carries only the title, description and the view's own
  actions.
- **Active state.** The rail item for the active view gets `aria-current="page"`.
  While a tool view is active, the stream tabs render `aria-selected="false"`
  and drop the `.selected` styling: the tab strip stays visible for switching
  streams, but no tab claims to control the visible region. Two simultaneous
  "current" indicators would be a state lie and an a11y bug.
- **State preservation.** Keep the Compare, Pretty, and Merge views mounted
  with the `hidden` attribute (`.view[hidden] { display: none }` already
  exists) so pasted JSON, the diff, and the merge selection survive switching
  to logs and back. The stream view stays mounted too. Verify the log
  virtualizer re-measures when it becomes visible again; if it does not, call
  `virtualizer.measure()` on visibility.
- **Focus.** On opening a tool view, focus its heading (`tabIndex={-1}`). On
  closing, return focus to the rail trigger that opened it.
- **Keyboard.** `useKeyboardShortcuts` receives `workspaceView`:
  `j`/`k`/`Enter` apply in `'stream'` **and** `'merge'` (operating on that
  view's visible list); `/` applies only in `'stream'` because the search field
  is stream-only; `t` and `?` stay global.
  **`Esc` precedence:** open dialog → tab finder → tool view → search clear.
  The finder's handler calls `stopPropagation()`. In Compare's Input mode the
  first `Esc` blurs the focused textarea and the second returns to logs, so the
  escape hatch is never inert behind a text field.
- **Top bar.** `TopBar` gains `exportDisabled` and `exportTitle` props. The
  Export menu is disabled in Compare/Pretty with the title "Export applies to
  log views"; in Merge it exports the merged view. Manual mode and the
  connection chip stay available.
- **Status bar.** Add a view-aware summary: stream counts in `'stream'`,
  `Compare JSON · N changed lines` in `'compare'`, `Pretty JSON · N lines` in
  `'prettify'`, `Merged · N streams · M lines` in `'merge'`. The compare and
  pretty stats live in `useUi` (`compareStats`, `prettyStats`) written by those
  views, because `workspace-state.ts` cannot reach component-local state.
- **Sheets.** `SheetName` is defined **twice**: `sheets-model.ts:7` (the real
  definition, including `'rules' | 'compare' | 'prettify'`) and a narrower
  duplicate at `shell.tsx:8` used by `RailProps.openSheet` and
  `TopBarProps.openSheet`. Delete the `compare`/`prettify` members from
  `sheets-model.ts:7`, delete the duplicate in `shell.tsx:8`, and import the
  single type from `sheets-model.ts`. Remove the two dialogs from
  `workspace-sheets.tsx`. Settings, Help, Manual, Parsing rules, confirms,
  Quick Start, and the print sheet remain dialogs.
- **`setScreen` call sites.** `setScreen('stream')` is called from six places:
  `tabs.tsx:61` (`activate`), `workspace-state.ts:342` (`onQuickManual`),
  `:346` (`onQuickHelp`), `:349` (`onQuickClose`), `:376` (`onParseManual`),
  and `:400` (`onStreams`). Each becomes `setWorkspaceView('stream')`, plus
  `setScreen('stream')` only where Quick Start must also close
  (`onQuickManual`, `onQuickHelp`, `onQuickClose`). Without this, parsing a
  manual file while in Compare leaves the user staring at Compare.
- **Deep links.** Not in v1.3. A hash route (`#compare`) can be added later
  without changing the view model.

**Alternatives considered.**

| Decision | Rejected option | Why rejected |
| --- | --- | --- |
| Rail-driven `workspaceView` | Tool tabs in the tab strip | The user chose "full-workspace view, no tab"; tool tabs would also fight the 32-tab problem V13-03 solves |
| Tool views stay mounted with `hidden` | Unmount on switch | Unmounting discards pasted JSON and the computed diff, which is a worse regression than the memory cost |
| `workspaceView` as a second axis | Reuse `screen` for both | `screen` already means "Quick Start is open"; overloading it makes the zero-stream and tool-view states unrepresentable |

### 4.2 Compare line diff (V13-02)

**Decision.** Replace the path list with a line diff computed from the
pretty-printed JSON.

- New `src/web/lib/json-line-diff.ts`:
  - `prettyLines(value): string[]` — **reuses `prettyJson` from
    `src/web/lib/json-pretty.ts:11-18`** and splits on `\n`. Do not write a
    third stringify path; `json-format.ts:26` already has one.
  - `diffLines(before: string[], after: string[]): DiffRow[]` — Myers diff with
    a bounded edit distance.
  - `pairChanged(rows: DiffRow[]): DiffRow[]` — pair adjacent removed/added
    blocks line by line into `changed` rows, matching the reference's `↔` rows.
  - `diffRowsToText(rows: readonly DiffRow[]): string` — copyable text diff.
  - `diffStats(rows: readonly DiffRow[]): { added: number; removed: number; changed: number }`.
- Row model (proposed contract):

  ```ts
  type DiffRowKind = 'same' | 'added' | 'removed' | 'changed'

  type DiffRow = {
    kind: DiffRowKind
    leftNo: number | null
    rightNo: number | null
    leftText: string | null
    rightText: string | null
  }
  ```

- **Limits.** 1 MB per side (existing), 20,000 lines per side, 2,000 rendered
  rows, Myers edit distance capped at 2,000. Beyond a limit, show a truncation
  note and the first N rows. Never freeze the tab.
- **Rendering.** One vertical scroll container; each row is a three-column grid
  (left code, 28 px gutter, right code). Line numbers are 40 px, right-aligned,
  mono, faint. The gutter shows `→` for added, `←` for removed, `↔` for
  changed.
- **Row height and wrapping.** Rows are 22 px at 12 px mono / 1.5 line-height
  when not wrapped. **Wrap is the default**, matching the shipped
  `.compare-line { overflow-wrap: anywhere }`; a long JSON value must not be
  clipped, because clipping defeats the comparison. The Wrap toggle switches to
  `white-space: pre` with a per-pane horizontal scroll, and the gutter stays
  fixed. A wrapped row grows to fit its tallest side; both cells share the row
  height.
- **Tints.** The shipped pill tints are too faint at 22 px row scale. Measured
  against the row background (`--surface`): `--pill-pos-bg` 1.23:1 dark /
  1.23:1 light, `--pill-warn-bg` 1.21:1 / 1.26:1, `--accent-soft` 1.19:1 /
  1.11:1. Add three Foundations tokens, each verified at **1.40–1.50:1** — a
  readable row tint that stays quiet:

  | Token | Dark | Light | Dark ratio | Light ratio |
  | --- | --- | --- | --- | --- |
  | `--diff-add-bg` | `#1a3a2c` | `#c9e0d1` | 1.50:1 | 1.39:1 |
  | `--diff-remove-bg` | `#452733` | `#f4cccc` | 1.41:1 | 1.46:1 |
  | `--diff-change-bg` | `#1e3350` | `#c6d8ec` | 1.46:1 | 1.45:1 |

  Each row keeps its 2 px left edge in `--positive` / `--negative` / `--accent`.
  **Changed pairs use `--diff-change-bg`, not `--pill-warn-bg`** — amber means
  "warning" everywhere else in this product and must not be overloaded to mean
  "changed". The tint is never the only cue: every row also carries a gutter
  arrow (`→` / `←` / `↔`) and a sign, so the diff reads without colour.
  Re-verify all six values in the browser at row scale before locking; the
  FigCraft frames use these exact hexes.
- **Modes.** A segmented `Input | Diff` control in the view header. Input mode
  shows the two editable panes; `Compare` validates, computes, and switches to
  Diff. `Edit` returns to Input with the text intact. `Pretty`, `Swap`,
  `Clear`, `Load sample`, and `Copy diff` keep their current behavior.
- **Mobile.** At ≤720 px, Diff mode becomes a unified single-column diff
  (line number, sign, code) with an `A | B` toggle for Input mode. Side-by-side
  is not usable at 390 px.
- **Retirement.** `json-diff.ts` is imported only by `compare.tsx` and its
  test. Remove both once the line diff lands; do not leave dead code. Also
  retire `theme.css:2525-2746` — both `dialog.*` blocks **and** the
  `.compare-*` / `.prettify-*` rules — keeping only the `.prettify-*` rules the
  new `PrettyView` reuses (`.prettify-grid`, `.prettify-out`, `.prettify-note`,
  `.prettify-footer`, `.prettify-tools`, `.prettify-indent`).
- **Copy diff format.** Exact, not deferred:

  ```text
  ~ <leftNo> <leftText> -> <rightText>
  - <leftNo> <leftText>
  + <rightNo> <rightText>
    <leftNo> <leftText>
  ```

  Rows joined with `\n`, no trailing newline; a `null` text renders as an empty
  string. Example:

  ```text
  ~ 3 "version": "2.0" -> "2.1"
  - 7 "ads": false
  + 8 "premium": true
  ```

**Alternatives considered.**

| Decision | Rejected option | Why rejected |
| --- | --- | --- |
| Line diff on pretty-printed JSON | Keep the path list, add highlighting | The user asked for the reference's side-by-side visual; a path list cannot show line numbers or alignment |
| Line diff | Word-level inline diff | Much higher complexity for marginal gain on JSON, where line granularity already maps to one key |
| Wrap by default | `pre` + ellipsis | Clipping long values defeats comparison and regresses the shipped wrapping behavior |
| Neutral tint for changed | Amber (`--pill-warn-bg`) | Amber already means warning in this product; reusing it would make a benign value change look like a problem |

### 4.3 Merged log model (V13-05)

**Decision.** Merge is a client-side view over existing streams. No new server
route, no new persistence.

- **Selection of streams.** 2–8 streams, chosen from existing tabs. One merged
  view at a time; changing the selection replaces it. The selection is
  session-only (not `localStorage`); a reload resets it. Stale IDs are pruned on
  boot/reconnect. The 8-stream cap is a measured budget, not a product limit:
  the row cap already bounds output, so the cap exists only to keep the merge
  sort inside the frame budget. D-11 must design the disabled 9th-stream state
  with the reason shown ("8 streams is the merge limit").
- **Row model.**

  ```ts
  type MergedRow = {
    key: string        // `${streamId}:${seq}`
    streamId: string
    streamName: string
    record: LogRecord
  }
  ```

- **Library contract.** New `src/web/lib/merged-timeline.ts` — **not**
  `merge.ts`, which would sit confusingly beside the existing append-merge
  `src/web/lib/stream-merge.ts:11` (`mergeRecords(existing, incoming, cap)`).
  `stream-merge.ts` stays untouched; the two do different jobs.

  ```ts
  mergeStreamRecords(
    entries: readonly StreamEntry[],
    rules: ParseRules,
    cap: number,
  ): { rows: MergedRow[]; truncated: boolean }

  visibleMergedRows(
    rows: readonly MergedRow[],
    filter: FilterState,
    isolateTrace: string | null,
    sort: SortKey,
  ): MergedRow[]

  orderMergedRows(rows: readonly MergedRow[], sort: SortKey): MergedRow[]

  mergedPauseKeys(rows: readonly MergedRow[]): Set<string>

  mergedExportText(rows: readonly MergedRow[]): string
  ```

  `mergeStreamRecords` applies `reparseRecords` per entry (the stream view does
  the same at `workspace-derivations.ts:14-17`). Level counts are
  `countLevels(rows.map((row) => row.record))` — no separate export.
- **Ordering.** Timestamp ascending; rows without a timestamp go last;
  tie-break by the selected stream order (tab order), then `seq`. Newest-first
  reverses the final list. This is deterministic and matches "one timeline".
- **Cap.** Keep the newest `bufferCap` rows after ordering (default 10,000,
  max 50,000) and show a truncation note when the merged set is larger. This
  bounds memory and DOM work.
- **Search.** The haystack is the source stream name plus the existing
  `searchTextOf(record)` (message, level, ids, JSON). Searching `ms-user`
  therefore finds every line from that stream.
- **Filter, sort, and pause ownership.** Merge owns an **independent**
  `FilterState`, `SortKey`, and pause boundary in `useWorkspace`
  (`mergeFilter`, `mergeSort`, `mergePausedAt`). The stream view's
  `filter`/`sort` are untouched, so filtering the merge never silently filters
  the stream view. `Toolbar`, `LevelBar`, `SignalStrip`, and `LogList`
  (`variant="merged"`) receive them as props. **Presets are not offered in merge in v1.3.**
- **Range.** Measured against the newest timestamp in the merged set
  (`bufferNow`), consistent with the stream view.
- **Pause.** Per merged view, not per stream. On pause, snapshot
  `mergedPauseKeys(rows)`; new rows buffer; the pending count is the number of
  current rows whose key is not in the snapshot; resume reveals them. The
  snapshot is session-only and is pruned on reconnect alongside the selection.
- **Selection state.** `useUi` gains `selectedMergedKey: string | null` and
  `selectMerged(key: string | null)`. `MergedRow.key` is the sole selection
  identity. Selecting a merged row **does not** write `selectedSeq`.
  `useSelectionSync` is gated on `workspaceView === 'stream'` so it cannot
  overwrite a merged selection on the next append. `useWorkspace` derives
  `mergedSelectedRecord` from the merged row list, not from `derivedRecords`.
  `LogList` in merged mode takes `selectedKey` and `onSelect(key)` props and
  does not read `useUi` directly.
- **Inspector.** Selecting a merged row opens the existing inspector with an
  optional `source` label (the stream name) in the parsed fields. The ≤960 px
  detail sheet gets the same label, which means threading `source` through
  `detail-sheet.tsx` and `SheetsModel.detail`.
- **Trace isolation.** Shared with the stream view (`useUi.isolateTrace`); the
  banner shows the ID and the merged count.
- **Export.** TXT lines are prefixed with `[source] `; the PDF print sheet
  includes the source (prefix or a column). The export menu count reflects the
  merged view. Clear buffer stays a per-stream action in the stream view; the
  merge view does not offer a destructive clear in v1.3.
- **Performance.** Memoize the merge on the selected entries' `records` and
  `rules`. Gate: `src/web/lib/merged-timeline.bench.test.ts` builds 8 × 10,000
  synthetic `LogRecord`s with interleaved timestamps, runs `mergeStreamRecords`
  20 times, and asserts the median under 50 ms via `performance.now()`. If the
  median exceeds 50 ms, **cap the selection at 4 streams and re-measure**; do
  not add a k-way merge in v1.3.
- **Row rendering.** `logs.tsx` exports `LogList` with a
  `variant: 'stream' | 'merged'` prop rather than a second component.
  `getItemKey` becomes a required `getKey: (row) => string` prop, because the
  current hardcoded `visible[index]?.seq` (`logs.tsx:37`) is wrong for merged
  rows where `seq` is per-stream. The header renders a source span when
  `variant === 'merged'`. The isolate/pause banners and the empty state are
  parameterized, not duplicated.
- **Column grid.** `--cols` is a single global token on `:root`
  (`theme.css:49`) with one override at `@media (max-width: 1180px)`
  (`theme.css:3110`), consumed by both `.log-head` and `.log-row`, which each
  render exactly six children. Do **not** change `--cols`; add a separate
  `--cols-merged` token on `:root` and in the same media query, consumed by
  `.merge-view .log-head` / `.merge-view .log-row`. The stream view is
  untouched.

  | Viewport | Inspector | Panel | Grid | Message |
  | --- | --- | --- | --- | --- |
  | 1440 | 440 | 950 | `14px 42px 92px 140px 72px minmax(0,1fr) 116px` | 382 px |
  | 1366 | 440 | 876 | `14px 40px 88px 88px 72px minmax(0,1fr)` | 490 px |
  | 1280 | 440 | 790 | `14px 40px 88px 88px 72px minmax(0,1fr)` | 404 px |
  | 1181 | 440 | 691 | `14px 40px 88px 88px 72px minmax(0,1fr)` | 305 px |
  | 1024 | 320 | 654 | `14px 40px 88px 88px 72px minmax(0,1fr)` | 268 px |
  | 961 | 320 | 591 | `14px 40px 88px 88px 72px minmax(0,1fr)` | 205 px |

  Message = panel − fixed tracks − 6×8 gaps − 52 px row padding
  (`--pad` 24 + 4 left, 24 right). **The ids column is dropped at ≤1366 px**,
  not ≤1180: at 1181 px the seven-track grid leaves only 123 px for the
  message, which is unusable. Trace chips remain in the inspector. The 140 px
  source track fits a 14-character name like `ms-user-1ahdss` at 11 px mono
  (≈92 px) plus the 6 px dot and gaps.
- **Mobile.** At ≤720 px the merged row uses the existing four-track grid
  (`10px 88px 72px minmax(0,1fr)`, `theme.css:3355`) with the source as a chip
  after the level on the first row, not between time and level. This is a
  stated deviation from the desktop column order, forced by the 390 px width.
- **Source cell.** A 6 px status dot plus the stream name, mono 11 px,
  truncated with a `title`. No new colors; the dot uses the existing
  `--positive`/`--faint` status colors.
- **Lifecycle.** A removed stream drops out of the selection; if fewer than two
  remain, show the "select at least two" empty state with a notice. A rename
  updates the source cell. A clear removes its rows. A reconnect prunes IDs
  that no longer exist and prunes the pause snapshot.

**Alternatives considered.**

| Decision | Rejected option | Why rejected |
| --- | --- | --- |
| Client-side merge | Server `GET /api/merged?ids=` | Adds a route, a cache, and a second source of truth for ordering; the client already holds every record |
| Independent merge filter/sort | Share the stream view's `filter`/`sort` | Filtering the merge would silently filter the stream view, and the two views have different search haystacks |
| `--cols-merged` token | Change `--cols` | `--cols` is consumed by six-child rows; a seven-track value breaks the stream view |
| `LogList` variant prop | Separate merged-list component | Duplicates the virtualizer, banners, header, and empty state; the variant keeps one code path |
| 8-stream cap | No cap | Unbounded sort cost; the cap is measured, and the limit state is designed |

### 4.4 App info (V13-06, V13-07)

- Add `node: process.version` to the response object in `health.ts:12-18` and
  to the `HealthInfo` dep constructed at `src/server/index.ts:61-66`.
  `HealthInfo` is the dependency type (it carries `portProvider: () => number`),
  not the response shape.
- New `src/web/app/app-info.ts`: a small zustand store
  `{version, pid, startedAt, port, node, loaded}` with `loadAppInfo()`, called
  on boot and on every reconnect. `loadAppInfo()` is
  `fetchJson<HealthResponse>('/api/health')` — reuse the existing helper at
  `api.ts:11-19`, which already swallows errors and returns `null`, giving the
  "Unavailable" behavior for free. Do not hand-roll a fetch that can throw.
- New `src/web/lib/format-uptime.ts`. Exact contract:

  ```ts
  formatUptime(startedAt: number, now: number): string
  ```

  `elapsed = max(0, now - startedAt)`; non-finite or negative input →
  `just now`.
  - `< 60_000` → `just now`
  - `< 3_600_000` → `${floor(elapsed / 60_000)}m`
  - `< 86_400_000` → `${h}h ${m}m`, omitting ` 0m` when `m === 0`
  - otherwise → `${d}d ${h}h`, omitting ` 0h` when `h === 0`

  This is a browser-side variant of the CLI's `formatDuration`
  (`src/cli/pipe.ts:59-67`, which emits `14m 3s`); note the different output
  contract rather than sharing code.
- Settings shows a Version row: `logdeck 1.3.0` with the subtext
  `Daemon pid 1234 · up 2h 14m`. **Three states:** `Checking…` while
  `loaded === false` (never flash a false "Unavailable" on boot), the version
  once loaded, and `Unavailable` when the fetch returned `null`.
- Help shows the full About block: version, daemon port, pid, uptime, Node
  version, with the same three states.

### 4.5 Tab finder and close all (V13-03, V13-04)

- New `src/web/lib/tab-filter.ts`:
  `filterTabs(streams: readonly StreamEntry[], query: string): StreamEntry[]` —
  case-insensitive substring on the stream name, preserving tab order.
  Unit-tested.
- New `src/web/components/tab-finder.tsx`: a **single-select listbox** combobox
  on desktop and a dialog on mobile. Search input, listbox of matching tabs
  (status dot, name, line count, a check on the *current* tab), `N of M` count,
  no-matches state. Arrow keys move the active option, `Enter` activates, `Esc`
  closes and returns focus to the trigger. A checkbox would imply multi-select;
  checkboxes belong to the merge selector, not here.
- `Cmd/Ctrl+K` opens the finder from any view. It calls `preventDefault()`; the
  browser's own search shortcut is not otherwise used by this app.
- Tab strip gains two controls before `+`: a finder button (magnifier, with the
  tab count) and a `⋯` menu with "Close all tabs".
- New store action `closeAllStreams()`. **`deleteStream` must change first:**
  today it is `await fetch(...)` with no `response.ok` check (`api.ts:50-52`),
  so a 404/500 resolves as fulfilled and `Promise.allSettled` would report
  every delete as a success. Change it to
  `deleteStream(id): Promise<{ ok: true } | { ok: false; error: string }>`,
  returning `ok: false` on `!response.ok` or a throw. `closeAllStreams()`
  partitions on that result: manual tabs are removed locally, pipe tabs are
  deleted through the API, successful tabs disappear (the server broadcast is
  idempotent), and failed tabs stay with `lastError` set.
- **`lastError` is currently never rendered.** It is written at `store.ts:253`
  and `:270` but no component reads it. `tabs.tsx` must render
  `useStreams((s) => s.lastError)` in the existing `.tab-error` slot
  (`theme.css:653`), alongside the local rename error.
- After closing all, `activeId` is null, `workspaceView` is `'stream'`, and the
  zero-stream empty state shows.
- Confirmation copy is built by a pure helper `closeAllBody(streams)` so it can
  be unit-tested. Exact strings:
  - pipe-only: `This closes N streams and ends their pipes. Buffers are freed. This cannot be undone.`
  - manual-only: `This removes N parsed tabs from this browser. This cannot be undone.`
  - mixed: `This closes N streams: P pipes end and M parsed tabs are removed. This cannot be undone.`

  D-10 may revise the wording; the unit test asserts the approved strings.

---

## 5. Design workstream (FigCraft first)

Document: `/Users/ewenhokijuliandy/Documents/logdeck — current design.figcraft`
(one file; do not create a second design file).

### 5.1 New page

Create **`05 · Proposals · v1.3`** so page 04 stays the round-2 record.

| Frame | Size | States |
| --- | --- | --- |
| Proposal · Compare JSON · input | 1440×900 | Dark, empty, sample loaded |
| Proposal · Compare JSON · diff | 1440×900 | Dark, reference-like sample, changed/added/removed rows |
| Proposal · Compare JSON · diff · light | 1440×900 | Light |
| Proposal · Compare JSON · states | 1440×900 | Invalid side, identical JSON, truncated, copied |
| Proposal · Compare JSON · mobile | 390×844 | Unified diff, input toggle |
| Proposal · Compare JSON · 768 | 768×800 | Diff at the sheet breakpoint |
| Proposal · Pretty JSON | 1440×900 | Dark, formatted output, all controls |
| Proposal · Pretty JSON · light | 1440×900 | Light |
| Proposal · Pretty JSON · states | 1440×900 | Invalid input, minified, sorted keys, copied |
| Proposal · Pretty JSON · mobile | 390×844 | Stacked |
| Proposal · Tab finder | 1440×900 | 32 tabs, query `ms-user`, results |
| Proposal · Tab finder · no matches | 1440×900 | Empty result with a reset action |
| Proposal · Tab finder · mobile | 390×844 | Full-width dialog |
| Proposal · Close all tabs · menu | 1440×900 | Tab-strip menu open, disabled with zero tabs |
| Proposal · Close all tabs · confirm | 440×180 | Mixed pipe + manual copy |
| Proposal · Close all tabs · states | 1440×900 | In-flight, partial failure, post-close empty state |
| Proposal · Merge log · empty | 1440×900 | No streams; fewer than two selected |
| Proposal · Merge log · selector | 1440×900 | Popover with search + checklist; 9th-stream limit |
| Proposal · Merge log · merged | 1440×900 | Dark, two streams, source column |
| Proposal · Merge log · merged · light | 1440×900 | Light |
| Proposal · Merge log · states | 1440×900 | No lines, no matches, truncated at cap, paused |
| Proposal · Merge log · 768 | 768×800 | Merged rows at the sheet breakpoint |
| Proposal · Merge log · mobile | 390×844 | Source chip, stacked rows |
| Proposal · Settings · version row | 640×~560 | Checking…, loaded, Unavailable |
| Proposal · Help · expanded | 640×~700 | Dark, all sections, scrolled with sticky footer |
| Proposal · Help · expanded · light | 640×~700 | Light |
| Proposal · Help · mobile | 390×844 | Full-screen sheet |
| Proposal · Rail · 9 items | 240×900 | Merge below Streams |
| Proposal · Mobile bar · 8 items | 390×56 | 11 px labels, More overflow for the 8th |
| Proposal · Tool view shell | 1440×900 | Title, description, actions slot |
| Proposal · Zero streams + tool view | 1440×900 | Compare reachable with no streams |

### 5.2 Foundations additions

- Merge icon (16×16, 1.5 px stroke, same family as the existing sprite).
- Source column specimen: dot + name at 140/88 px, truncation.
- Diff row anatomy: line numbers, gutter arrows, tints, changed pair, wrapped
  and unwrapped rows.
- **Diff tint tokens:** `--diff-add-bg`, `--diff-remove-bg`, `--diff-change-bg`
  in both themes, verified at 22 px row scale.
- Tab finder row: status dot, name, count, current-tab check (single-select).
- Merge selector row: checkbox, status dot, name, count, disabled 9th state.
- **Tool view shell:** title, description, actions slot.
- **Sticky Help footer** and the checkbox anatomy.
- Help section headers, mini severity bar, CLI flags table, version readout.
- Rail specimen with 9 items; mobile bar specimen with 8 items at 11 px labels
  and a More overflow.

### 5.3 Canonical updates after approval

- `01 · Workspace` frames 3509 (dark), 3839 (light), 4169 (inspector), 4661
  (mobile): add the Merge rail item (nine rail items), the tab finder and `⋯`
  controls, and the 8-item mobile bar.
- `03 · Key states`: Compare 5543 and Prettify 11530 become full-workspace
  views. Add the new canonical frames and mark the old modal frames as
  superseded (rename with a `superseded` prefix or hide them) so the document
  does not show two truths. Settings 5213/6566 gets the Version row; Help
  6203/12001 gets the expanded content.
- `02 · Foundations`: add the specimens above.
- [`DESIGN.md`](./DESIGN.md): update the component map and the rail/mobile
  geometry.

### 5.4 Review checklist (apply to every D task)

- [ ] Same tokens; no invented colors, radii, type sizes, or spacing.
- [ ] Dark and light both shown where the surface exists in both.
- [ ] Desktop 1440 and mobile 390 variants (or a stated reason why not).
- [ ] Default, hover/focus/active, empty, error, and long-content states.
- [ ] Text contrast ≥4.5:1; focus visible; phone targets ≥24 px (44 px for the
      bottom bar).
- [ ] Copy is specific and honest.
- [ ] No new pattern that is not added to Foundations.
- [ ] Exported PNG/screenshots + a short spec note (anatomy, copy, states,
      behavior, a11y) attached for review.
- [ ] User approval recorded in §9 before code.

---

## 6. Item specifications

### V13-01 — Compare and Pretty as full-workspace views

**Feedback.** "Compare JSON and Pretty JSON will be full screen like log stream
tab not modal anymore."

**Current behavior.** Both are native `<dialog>` modals opened from the rail
through `sheet` state. They trap focus, dim the app, and close on backdrop or
`Esc`.

**Desired behavior.**

- The rail opens Compare or Pretty in the workspace area, with the rail, top
  bar, tab strip, and status bar still visible.
- No backdrop, no focus trap, no modal; the view is a page.
- `Esc`, the Streams rail item, or an active stream tab return to the stream
  view. There is no back button in the header.
- Content survives switching to logs and back.
- The rail item is marked `aria-current="page"` while active; stream tabs render
  `aria-selected="false"` while a tool view is shown.
- The tab strip keeps only stream tabs; no tool tabs.
- The Export menu is disabled in Compare/Pretty; the status bar shows a
  view-appropriate summary.
- **Pretty keeps its full control set:** Format (Pretty/Minify), Indent (2/4
  spaces), Sort keys, Load sample, Clear, Copy, and the 1 MB note. This is a
  relocation, not a feature reduction.
- Mobile: the view fills the workspace above the bottom bar; the action bar is
  sticky.

**Design gate.** D-08.

**Implementation.**

- `useUi`: add `workspaceView`, `setWorkspaceView`, `compareStats`,
  `prettyStats`.
- `App.tsx`: render the active view; keep the tool views mounted with `hidden`;
  `workspaceView` wins over `zeroStreams` (see §4.1).
- New `src/web/components/tool-view.tsx`:
  `ToolView({ title, description, onBack, actions, children })`, rendering
  `<section className="tool-view" role="region" aria-label={title} tabIndex={-1}>`.
  `CompareView` passes `title="Compare JSON"`, `PrettyView` passes
  `title="Pretty JSON"`, `MergeView` passes `title="Merge log"`.
- Rewrite `compare.tsx` and `prettify.tsx` as `CompareView` and `PrettyView`.
- `sheets-model.ts:7`: delete the `compare`/`prettify` members from
  `SheetName`. `shell.tsx:8`: delete the duplicate `SheetName` and import the
  one from `sheets-model.ts`.
- `workspace-state.ts`: wire the rail to `setWorkspaceView`; add
  `onBackToLogs`; convert the six `setScreen('stream')` call sites listed in
  §4.1.
- `tabs.tsx`: `activate` sets `setWorkspaceView('stream')`; tabs render
  `aria-selected={false}` when a tool view is active.
- `workspace-sheets.tsx`: remove the two dialogs.
- `shell.tsx`: `aria-current` for the active rail item; `TopBar` gains
  `exportDisabled` and `exportTitle`.
- `theme.css`: `.tool-view`, `.tool-view-head`, `.tool-view-body`,
  `.tool-view-actions`; retire `theme.css:2525-2746` (both `dialog.*` blocks and
  the `.compare-*`/`.prettify-*` rules), keeping only the `.prettify-*` rules
  `PrettyView` reuses.
- `use-keyboard-shortcuts.ts`: view-aware guards, `Esc` precedence, and the
  two-stage `Esc` in Compare's Input mode.

**Acceptance criteria.**

- [ ] Rail Compare/Pretty open a full-workspace view; no dialog role, no
      backdrop, no focus trap.
- [ ] The tab strip, top bar, rail, and status bar remain visible and usable.
- [ ] `Esc`, the Streams rail item and an active stream tab return to the
      stream view; focus returns to the rail trigger.
- [ ] Pasted JSON and the diff survive a round trip to logs and back.
- [ ] The rail item shows the active state; no stream tab shows selected while a
      tool view is displayed.
- [ ] The status bar reflects the view.
- [ ] Pretty keeps Format, Indent, Sort keys, Load sample, Clear, and Copy.
- [ ] With zero streams, Compare and Pretty are reachable and render their own
      empty states.
- [ ] Mobile layout works at 390 px with the bottom bar.
- [ ] Existing Compare/Pretty E2E tests are rewritten for the view.

**Tests.** E2E: open from rail, assert no `dialog`, type/paste, switch to logs
and back, assert content preserved, `Esc` returns, focus restored, zero-stream
reachability. Critique: the dialog focus test no longer covers Compare/Pretty.

**Risks.** Focus management without a dialog; hidden-view virtualizer
re-measure; keyboard shortcuts leaking into tool views.

**Open detail.** The reference shows a LEFT/RIGHT header with copy and upload
icons per side. Proposed: keep the per-side copy action, drop the upload icon
(there is no file-upload path in Compare today; adding one is out of scope
unless the user asks). Confirm at design review.

---

### V13-02 — Compare JSON side-by-side line diff

**Feedback.** "Compare JSON revamp UI, shows the differences with more visual.
Reference UI attached." The reference shows LEFT/RIGHT panes with line numbers,
a center gutter with arrows, and tinted changed/added/removed rows.

**Current behavior.** A path list: each row shows a JSON path, a red before
line, and a green after line. Added/removed rows are tinted. There are no line
numbers and no side-by-side alignment.

**Desired behavior.**

- Side-by-side line diff with independent line numbers, a center gutter, and
  tinted rows.
- Input mode and diff mode in the same full-workspace view.
- Summary counts for added/removed/changed lines; identical and truncated
  states.
- Mobile unified diff.
- Keep Load sample, Pretty, Swap, Clear, Compare, and Copy diff.

**Design gate.** D-08.

**Implementation.**

- New `src/web/lib/json-line-diff.ts` (Myers, pairing, stats, text output).
- Rewrite `compare.tsx` as the view with Input/Diff modes.
- New sprite glyphs for the gutter arrows (or mono text arrows; design
  decides).
- CSS for the diff grid, line numbers, gutter, tints, wrap toggle, mobile
  unified layout.
- Remove `json-diff.ts` and its test after migration.
- Unit tests for the diff engine; E2E for the flow.

**Acceptance criteria.**

- [ ] Both sides render with line numbers; added, removed, and changed rows are
      visually distinct and aligned.
- [ ] Changed pairs show a `↔` gutter row with the before and after values.
- [ ] Compare validates both sides; invalid JSON keeps the inline error and
      does not switch to Diff.
- [ ] Identical JSON shows an "Identical JSON" state with no tints.
- [ ] Large inputs truncate with a visible note; the tab never freezes.
- [ ] Copy diff copies a readable text diff.
- [ ] Mobile uses a unified diff at 390 px.
- [ ] The old path list and `json-diff.ts` are gone.

**Tests.** Unit: identical, added, removed, changed, nested objects, arrays,
line numbers, pairing, truncation, text output, 1 MB guard. E2E: sample →
Compare → diff rows and line numbers → Edit → Swap → Pretty → Copy → Back;
invalid side; identical; mobile.

**Risks.** Myers correctness and performance; pairing heuristics; long lines;
mobile readability.

---

### V13-03 — Find a stream tab by name

**Feedback.** "Search Tab on log stream menu features." Clarified: "A features
for user to find tab by the name. Now, users says it's difficult to find one
service log called ms-user for example when 32 tab opened. So the user want
search stream tab by name feature."

**Current behavior.** The tab strip scrolls horizontally; there is no search.
With 32 tabs, finding `ms-user-1ahdss` means scrolling and reading.

**Desired behavior.**

- A finder in the tab strip that filters tabs by name.
- Trigger: a magnifier button before `+`, showing the tab count.
- Popover on desktop, dialog on mobile.
- Search input + list of matches (status dot, name, line count, active check).
- Arrow keys move, `Enter` activates, `Esc` closes; `Cmd/Ctrl+K` opens it.
- No-matches state with a clear action.
- The finder does not reorder tabs or change the active tab until activated.

**Design gate.** D-09.

**Implementation.**

- `src/web/lib/tab-filter.ts` + unit tests.
- `src/web/components/tab-finder.tsx` (combobox pattern).
- `tabs.tsx`: trigger, state, keyboard wiring.
- `use-keyboard-shortcuts.ts`: `Cmd/Ctrl+K`.
- Mobile dialog variant.
- CSS for the popover/dialog, rows, active option, count.

**Acceptance criteria.**

- [ ] Typing filters tabs by name, case-insensitively, in tab order.
- [ ] `Enter` or a click activates the highlighted tab and closes the finder.
- [ ] `Esc` closes and returns focus to the trigger.
- [ ] `Cmd/Ctrl+K` opens the finder from any view.
- [ ] No matches shows a clear message and a way to reset the query.
- [ ] Works with 32 tabs without layout overflow; mobile uses a dialog.
- [ ] Screen readers get the combobox/listbox relationship.

**Tests.** Unit: filter behavior. E2E: three pipes, open, filter, Enter, no
matches, `Esc`, shortcut, mobile.

**Risks.** Combobox focus/keyboard details; popover positioning near the strip
edge.

---

### V13-04 — Close all tabs

**Feedback.** "Close all tab on log stream menu button."

**Current behavior.** Each tab has a close button with a confirmation. There is
no bulk action.

**Desired behavior.**

- A `⋯` menu in the tab strip with "Close all tabs" (danger).
- Confirmation with the tab count and the consequences for pipe and manual
  tabs.
- Closing all frees buffers, ends live streams, removes manual tabs, clears the
  active tab, and shows the zero-stream empty state.
- Partial failures keep the failed tab and show an error.
- The item is disabled when there are no tabs.

**Design gate.** D-10.

**Implementation.**

- `store.ts`: `closeAllStreams()` with `Promise.allSettled`; manual tabs
  removed locally; pipe tabs deleted through the API; `lastError` on failure.
- `tabs.tsx`: `⋯` menu with `MenuItem`/`PopoverPanel`; `onCloseAll` prop.
- `sheets-model.ts`: `closeAll` confirm model + `closeAllBody(streams)` helper.
- `workspace-state.ts`: `closeAllOpen` state and handlers.
- `workspace-sheets.tsx`: render the confirm.
- CSS for the menu trigger and the tab-strip error.

**Acceptance criteria.**

- [ ] The `⋯` menu offers "Close all tabs" and is disabled with zero tabs.
- [ ] The confirm names the count and explains pipe vs. manual consequences.
- [ ] Confirming closes every tab, deletes every pipe stream, and shows the
      empty state.
- [ ] Cancelling keeps every tab.
- [ ] A failed delete keeps that tab and shows an error.
- [ ] Focus returns to the tab strip after the confirm closes.

**Tests.** Unit: `closeAllBody` for pipe-only, manual-only, mixed. E2E: two
pipes + manual → close all → empty state and server streams gone; cancel keeps
tabs; disabled state.

**Risks.** Destructive action; partial failures; daemon unreachable.

---

### V13-05 — Merge log view

**Feedback.** "Merge log view menu blow log stream menu. User have to select
current existing log stream tab. example: ms-user-1ahdss, and ms-user-1kjwnd.
It will combine the log and the feature on merge log same as current log
stream. But the table on left side of log level should add new column name
(ms-user-1ahdss, and ms-user-1kjwnd). User only can view 1 merged log at one
time, so if the user want to see other merge log it have to change the selected
stream name."

**Current behavior.** No merge. The store, derivations, toolbar, list, and
inspector are all per active stream.

**Desired behavior.**

- Rail item **Merge** directly below **Streams**.
- Full-workspace view (no tab), like Compare/Pretty.
- Select 2–8 existing streams; one merged view at a time; changing the
  selection replaces it.
- Merged table adds a **source** column between time and level.
- Same features as the stream view: search, level bar, range, sort, pause,
  wrap, autoscroll, signal strip, inspector, trace isolation, export.
- Empty states for no streams, fewer than two selected, no lines, and no
  matches.
- Stream lifecycle handling (removed, renamed, cleared, reconnect).

**Design gate.** D-11.

**Implementation.**

- `src/web/lib/merged-timeline.ts` (not `merge.ts`): the five functions in
  §4.3. `stream-merge.ts` stays untouched.
- `src/web/components/merge-view.tsx`: header, selector trigger, chips,
  toolbar, signal strip, merged list, inspector.
- `src/web/components/merge-selector.tsx`: popover/dialog with search and
  checklist, including the disabled 9th-stream state.
- `src/web/components/logs.tsx`: `LogList` gains `variant` and a required
  `getKey` prop; the header renders a source span for `'merged'`.
- `src/web/components/inspector.tsx`: optional `source` label.
- `src/web/components/detail-sheet.tsx`: thread `source` through.
- `src/web/components/sheets-model.ts`: `SheetsModel.detail` gains `source`.
- `src/web/components/export.tsx` / `src/web/lib/print-sheet.ts`: source
  prefix/column.
- `src/web/components/shell.tsx`: Merge rail item + icon.
- `src/web/components/icons.tsx`: merge glyph.
- `src/web/theme.css`: `--cols-merged` on `:root` and in the 1180 media query;
  `.merge-view` source column, selector, mobile.
- `src/web/components/workspace-state.ts`: `mergeFilter`, `mergeSort`,
  `mergePausedAt`, merge export, status bar.
- `src/web/components/workspace-derivations.ts`: merge derivations; gate
  `useSelectionSync` on `workspaceView === 'stream'`.
- `src/web/app/ui.ts`: `workspaceView: 'merge'`, `selectedMergedKey`,
  `selectMerged`.
- `src/web/app/App.tsx`: render precedence for `workspaceView` vs
  `zeroStreams`.

**Acceptance criteria.**

- [ ] Merge sits directly below Streams in the rail and is active while the
      view is open.
- [ ] The selector lists existing streams with search, status, and line count;
      selecting 2–8 updates the merged view; the 9th is disabled with a reason.
- [ ] The merged table shows the source column between time and level; names
      truncate with a title.
- [ ] Rows are ordered by timestamp (nulls last), tie-broken by stream order
      then seq; newest-first reverses.
- [ ] Search matches the source name; level counts, range, sort, pause, wrap,
      autoscroll, signal strip, inspector, trace isolation, and export work.
- [ ] The merge filter/sort/pause are independent of the stream view's.
- [ ] Selecting a merged row opens the inspector with the source label and does
      not disturb the stream view's selection.
- [ ] `j`/`k`/`Enter` navigate and inspect merged rows.
- [ ] Removing a selected stream drops its rows; fewer than two shows the
      empty state; renames update the source cell.
- [ ] The merged set is capped at the buffer limit with a truncation note.
- [ ] The merge sort median stays under 50 ms for 8 × 10k rows.
- [ ] Mobile shows the source as a chip and keeps the row readable at 390 px.
- [ ] Only one merged view exists at a time; changing the selection replaces
      it.

**Tests.** Unit: ordering, nulls, tie-break, cap, newest-first, counts, search
by source, pause keys, selection pruning, export text. Bench:
`merged-timeline.bench.test.ts` (8 × 10k, median < 50 ms). E2E: two pipes with
interleaved timestamps → Merge → select both → source column and order →
level filter → search by source → inspect → pause/resume → change selection →
close a stream → empty state; mobile.

**Risks.** Performance with many streams; ordering semantics; pause; export
format; mobile column; selection lifecycle; design drift on the source column.

**Open detail.** The merged view needs a selection entry point. Proposed: a
`Select streams` button in the view header that opens a popover with a search
field and a checkbox list (status dot, name, line count), plus removable chips
for the current selection. The rail item opens the view; it does not open a
picker first. Confirm in D-11.

---

### V13-06 — Version info in Settings

**Feedback.** "Add logdeck version info on settings page."

**Current behavior.** Settings has theme, zone, autoscroll, wrap, parsing
rules, buffer limit, and daemon port. There is no version.

**Desired behavior.**

- A Version row in Settings showing `logdeck 1.3.0` and the daemon subtext
  (`pid`, uptime).
- The value comes from `/api/health`, not a hardcoded string.
- If the daemon is unreachable, show `Unavailable`.
- Help shows the same information in its About section (V13-07).

**Design gate.** D-12.

**Implementation.**

- `src/server/routes/health.ts`: add `node: process.version` to the response
  object at lines 12-18.
- `src/server/index.ts`: pass `node: process.version` in the `health` object at
  lines 61-66 (required by the `HealthInfo` type change).
- `src/web/app/api.ts`: `fetchHealth()` as
  `fetchJson<HealthResponse>('/api/health')`.
- `src/web/app/app-info.ts`: `useAppInfo` store + `loadAppInfo()`.
- `src/web/lib/format-uptime.ts` + unit tests (boundaries per §4.4).
- `settings-sheet.tsx`: Version row with the three states.
- `sheets-model.ts`: pass app info.
- `workspace-state.ts` / `useBootEffect`: load app info on boot and reconnect.
- `tests/server.integration.test.ts`: assert `info.node` matches
  `process.version`; update the version assertion to `1.3.0` in phase 6.

**Acceptance criteria.**

- [ ] Settings shows the running daemon's version, matching `/api/health`.
- [ ] The row shows pid and uptime; it updates after a reconnect.
- [ ] The row shows `Checking…` before the first fetch resolves, never a false
      `Unavailable`.
- [ ] An unreachable daemon shows `Unavailable` without breaking Settings.
- [ ] The version is not duplicated as a hardcoded literal in the UI.
- [ ] The health response includes the Node version.

**Tests.** Unit: `formatUptime` boundaries (59 999, 60 000, 3 599 999,
3 600 000, 86 399 999, 86 400 000, negative, non-finite). Server: health
includes `node`; version assertion updated to `1.3.0` at release. E2E: Settings
version equals the health endpoint's version.

**Risks.** Health fetch failure; stale web bundle; API addition.

---

### V13-07 — Expanded Help

**Feedback.** "Add more relevant info on help menu." Selected: CLI flags
reference, version and daemon info, and a level-filter tutorial ("click to
select 1, command + click multi select, etc").

**Current behavior.** Help shows pipe examples with copy buttons and six
shortcuts.

**Desired behavior.**

- Sections: Get started (pipes), Find what matters (level-filter tutorial),
  Keyboard shortcuts, CLI flags, About (version/daemon info).
- A mini severity bar illustration with annotations.
- A compact CLI flags table.
- The About block uses the live app info.
- The sheet scrolls; the footer actions stay visible; mobile is a full-screen
  sheet.

**Design gate.** D-13.

**Implementation.**

- `legacy-data.ts`: `CLI_FLAGS`, expanded `SHORTCUTS`, `LEVEL_FILTER_TIPS`.
- `help-sheet.tsx`: sections, mini bar, table, About.
- `theme.css`: `.help-dialog` (width `min(640px, calc(100vw - 32px))`, matching
  the shipped `dialog.wide` at `theme.css:2404-2406`), `.help-body`,
  `.help-section`, `.help-table`, `.mini-level-bar`, sticky footer, mobile.
- `sheets-model.ts`: pass app info.
- Optional: a "Focus the level bar" button that closes Help and focuses the
  first segment. Mark as a nice-to-have, not required.

**Acceptance criteria.**

- [ ] Help has the five sections and is scrollable at 640 px and 390 px.
- [ ] The level-filter tutorial explains solo, click-again/Esc, Cmd/Ctrl-click
      and Shift-click, the full-buffer sizing, the merged Error/Debug groups,
      and keyboard navigation.
- [ ] The CLI flags table matches the shipped flags and defaults.
- [ ] About shows version, daemon port, pid, uptime, and Node version, with the
      `Checking…` state.
- [ ] Existing pipe examples and shortcuts remain; new shortcuts are listed.
- [ ] The footer actions stay reachable while the body scrolls.

**Tests.** E2E: open Help, assert sections, flags, tutorial, About; mobile;
keyboard focus order.

**Risks.** Content length; modal scroll; copy drifting from the CLI.

**Open detail.** The level-filter tutorial can be static text with a small
illustration, or interactive (a live mini bar the user can click). Proposed:
static illustration plus a "Try it on the logs" button that closes Help and
focuses the first level segment. Confirm in D-13.

---

## 7. Execution order

| Phase | Work | Gate |
| --- | --- | --- |
| 0 | Design wave: page 05 frames, Foundations specimens, screenshots + spec note | User approval recorded in §9 |
| 1 | View architecture + app info: `workspaceView`, `ToolView`, `useAppInfo`, health `node`, `formatUptime` | Typecheck, unit tests |
| 2 | V13-01 + V13-02: full-workspace Compare/Pretty + line diff | E2E Compare/Pretty, design check |
| 3 | V13-03 + V13-04: tab finder + close all | E2E tabs, unit tests |
| 4 | V13-05: merge | E2E merge, performance check |
| 5 | V13-06 + V13-07: version + Help | E2E Settings/Help |
| 6 | Docs + release: README, PRD, PRODUCT, RELEASE, PROGRESS; bump `1.3.0`; gates; tag | Full gate, `npm pack`, FigCraft sync |

No phase starts before the previous phase's gates pass. No commit until the
user asks.

### 7.1 Test migration

Existing tests that assume modals must change in the same item, not later:

| Test | Today | After |
| --- | --- | --- |
| `flows.spec.ts` › compare JSON reports differences and validates both sides | `getByRole('dialog', { name: 'Compare JSON' })`, `.compare-row`, `.compare-before`/`.compare-after`, `Close` | Region `Compare JSON`, `.diff-row`, `.diff-cell.left`/`.right`, the Streams rail item; new assertions for line numbers, gutter arrows, and the Input/Diff switch |
| `flows.spec.ts` › prettify JSON formats from the rail menu | Dialog role, `Close` | Region `Pretty JSON`, the Streams rail item; assert Format/Indent/Sort keys still work |
| `critique.spec.ts` › dialogs expose accessible names and restore focus | Covers Settings/Manual/Help only | Unchanged; add a separate view-focus test for Compare/Pretty |
| `critique.spec.ts` › global shortcuts are inert while a dialog is open | Settings dialog | Unchanged; add a tool-view variant (`j`/`k` inert in Compare, `t`/`?` still work) |
| `critique.spec.ts` › log rows expose list semantics and one roving tab stop | Exactly one `.log-row[aria-current="true"]` with `tabindex="0"` | At risk from the `LogRow`/`LogList` variant change; assert the roving tab stop survives in both variants |
| `critique.spec.ts` › phone targets meet the 24px minimum | Measures `.stream-tab .close` at 390 px | At risk from the two new tab-strip controls; assert the close target stays ≥24 px |
| `flows.spec.ts` › toolbar stays on one row or a compact two-row layout without overflow | Stream toolbar | Add the merged toolbar at 1440/1181/1024/768/390 |
| `critique.spec.ts` › tabs use arrow keys and the add button stays visible at 390 | `+` button | Add the finder and `⋯` controls; assert no overflow with 8 rail items |

New suites:

- `src/web/lib/json-line-diff.test.ts`
- `src/web/lib/merged-timeline.test.ts`
- `src/web/lib/merged-timeline.bench.test.ts`
- `src/web/lib/tab-filter.test.ts`
- `src/web/lib/format-uptime.test.ts`
- `src/web/components/close-all-copy.test.ts` (or fold into `sheets-model` tests)
- `tests/e2e/merge.spec.ts`
- `tests/e2e/tabs.spec.ts` (finder + close all)
- `tests/e2e/tool-views.spec.ts` (Compare/Pretty full-workspace behavior)

---

## 8. Verification gates

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm test` — unit + integration; expect roughly 300+ tests.
- `npm run e2e` — Playwright; expect roughly 35+ tests.
- Design lint: `node .commandcode/skills/design-taste-frontend/scripts/lint.mjs --app src/web`
- Inspect: `CHROME_PATH="<chrome>" node .commandcode/skills/design-taste-frontend/scripts/inspect.mjs http://127.0.0.1:3333/ --app --allow edge-text,tiny-text`
- FigCraft screenshots at 1440×900 dark/light, 768×800, and 390×844; compare
  against the app.
- Manual checks: 32 tabs, merge two streams, compare a large JSON, mobile
  8-item bar, Settings version, Help sections.
- Zero console errors while the daemon is up.

### 8.1 ui-ux-pro-max compliance

Audited against the 10 priority categories in
`.dsh/skills/ui-ux-pro-max/references/quick-reference.md`. Verdict: **compliant
with two accepted deviations and three additions now folded into the plan.**

| # | Category | Rule | Status |
| --- | --- | --- | --- |
| 1 | Accessibility | Contrast 4.5:1; visible focus; keyboard nav | **Pass.** Focus rings, `aria-current`, `role="region"`, roving tab stops, and the `Esc` precedence chain are specified. Diff tints are decorative and always paired with a gutter arrow and a sign, so color is never the only cue (`color-only` rule). |
| 2 | Touch & interaction | 44×44 targets; 8 px spacing; press feedback | **Pass with deviation.** The mobile bar keeps 11 px labels and uses a More overflow rather than shrinking to 44 px, because "Settings" at 11 px needs ~41 px of a 36 px content box. All other phone targets stay ≥24 px (WCAG 2.2 AA) and the existing 24 px close-button test is retained. |
| 3 | Performance | Virtualize; reserve space; no layout thrash | **Pass.** `LogList` stays virtualized in both variants; `getKey` replaces the hardcoded `seq`; the merge sort has a measured 50 ms gate; the diff caps at 2,000 rendered rows. |
| 4 | Style selection | Match product type; SVG icons, no emoji | **Pass.** The merge glyph joins the existing 1.5 px sprite; no emoji anywhere. |
| 5 | Layout & responsive | Mobile-first; no horizontal scroll; no fixed px containers | **Pass.** The corrected column table covers 1440/1366/1280/1181/1024/961/390; the merged grid drops ids at ≤1366 instead of squeezing the message to 123 px. |
| 6 | Typography & color | Base 16 px; semantic tokens; no raw hex | **Pass with deviation.** The plan adds three semantic tokens (`--diff-add-bg`, `--diff-remove-bg`, `--diff-change-bg`) rather than raw hex, and rejects the invented 10 px label. The 11 px mono in rows is the shipped design language, not body text. |
| 7 | Animation | Context-aware timing; reduced motion | **Pass.** No new motion is introduced; the existing `prefers-reduced-motion` block covers the new views. |
| 8 | Forms & feedback | Visible labels; error near field; loading states | **Pass after fix.** The app-info row gained `Checking…`; Compare keeps per-side inline errors; close-all gained in-flight and partial-failure states. |
| 9 | Navigation | Predictable back; bottom nav ≤5; deep linking | **Accepted deviation.** `bottom-nav-limit` says max 5 items; this app has 7 today and 8 with Merge. The rule targets consumer mobile apps with a primary tab bar; logdeck's bar is a tool switcher on a desktop-first product. The plan mitigates by keeping labels, adding a More overflow, and marking the active item. **Deep linking is explicitly out of scope for v1.3** (`deep-linking` rule) and recorded as a follow-up. |
| 10 | Charts & data | Legends; accessible colors | **N/A.** No charts in v1.3. |

**Three additions folded in from the audit:**

1. **`focus-on-route-change`** — the plan already focuses the tool-view heading
   on open; this is now an explicit acceptance criterion rather than an
   implementation note.
2. **`empty-nav-state`** — the merge selector's disabled 9th stream and the
   zero-stream tool views now explain why instead of silently hiding.
3. **`color-only`** — every diff row carries a gutter arrow (`→`/`←`/`↔`) and a
   sign in addition to its tint, so the diff is readable without color.

**Two rules deliberately not followed, with reasons:**

- `bottom-nav-limit` (max 5) — see row 9. Reducing to 5 would remove Manual,
  Settings, or Help from the phone bar, which is a worse regression than the
  extra items.
- `deep-linking` — adding hash routes would change the view model and the
  session-only merge selection contract. Recorded as a v1.4 candidate.

---

## 9. Design approval record

Page `05 · Proposals · v1.3` is built in
`/Users/ewenhokijuliandy/Documents/logdeck — current design.figcraft`
(12 frames). Awaiting review.

| Task | Design status | Approved by | Date | Notes |
| --- | --- | --- | --- | --- |
| D-08 Compare/Pretty full workspace + line diff | **Drafted · awaiting review** | — | — | Compare diff dark 12079, light 12853; Pretty 13052 |
| D-09 Tab finder | **Drafted · awaiting review** | — | — | 12476 (32 tabs, query `ms-user`, 4 of 32) |
| D-10 Close all tabs | **Drafted · awaiting review** | — | — | Menu 13013, confirm 13005 |
| D-11 Merge log | **Drafted · awaiting review** | — | — | Merged dark 12243, light 13236, mobile 12707, selector 13020 |
| D-12 Settings version | **Drafted · awaiting review** | — | — | 12776 (Version row with pid + uptime) |
| D-13 Expanded Help | **Drafted · awaiting review** | — | — | 12806 (5 sections, mini bar, CLI flags, About) |

### 9.1 What the frames show

**Compare JSON (12079, 12853).** Full-workspace view: rail, top bar, tab strip
and status bar stay. `Compare JSON` title + one-line
description. `Input | Diff` switch top-right with Diff active and the accent
underline. Two panes with `LEFT · BEFORE` / `RIGHT · AFTER` headers and per-side
copy. Line numbers in both gutters, a centre gutter with `↔` for changed and `→`
for added. Changed rows tinted accent-soft with a 2 px accent left edge; the
added row tinted positive with a green right edge. Summary bar reads
`2 added · 0 removed · 3 changed · 5 of 11 lines differ` with Wrap and Copy diff
on the right. Action bar: Load sample, Pretty, Swap, Clear, Edit, and Compare
primary. Export is visibly disabled in the top bar.

**Pretty JSON (13052).** Same shell. `Pretty | Minify` switch, two panes
`JSON in` / `JSON out`, and a footer that keeps **every** shipped control:
Format (Pretty/Minify), Indent (2/4 spaces), Sort keys, the 1 MB note, Load
sample, Clear, Copy, Prettify.

**Tab finder (12476).** Popover anchored under the tab strip's magnifier.
Search field with `ms-user` typed and a caret, `4 of 32` count, four result rows
(status dot, mono name, line count), the current tab checked, footer hint
`↑↓ move · Enter open · Esc close` and `⌘K`. The tab strip shows the new
magnifier and `⋯` controls before `+`.

**Close all (13013, 13005).** `⋯` menu with `Find a tab… ⌘K` and a red
`Close all tabs` with its count and `Asks before closing`. Confirm dialog:
`Close all 4 tabs?` with the mixed-set copy from §4.5 and a red primary.

**Merge log (12243, 13236, 12707, 13020).** Rail gains **Merge** directly below
Streams (nine items). Header: `Merge log`, one-line
description, `2 streams | Change` switch. `Merging` chips row with removable
`ms-user-1ahdss` / `ms-user-1kjwnd`, `+ Add stream`, `2 of 8` on the right.
Toolbar: search, level bar, range, sort, wrap, pause. Column header
`seq · time · stream · level · message` — **the source column sits between time
and level**, exactly as requested. Rows interleave both streams by timestamp;
the selected row carries the accent left edge. Mobile (390) puts the source in a
chip after the level on the first row and the message on the second, with a
`More` overflow in the bottom bar instead of an 8th item. Selector popover:
search, checkbox rows, the 9th stream disabled, `8 streams is the merge limit`,
`Merge 2` primary.

**Settings (12776).** Version row: `logdeck 1.3.0` with `pid 4821 · up 2h 14m`
beneath, above the existing Daemon port row.

**Help (12806).** Five sections: Get started (pipes with copy), Find what
matters (mini severity bar + the four interaction rules + the merged-group
note), CLI flags (five flags with defaults), About (version, daemon, pid,
uptime, Node, privacy line). Sticky footer with Open quick start and Close.

### 9.2 Review notes

- The Compare diff uses **wrap by default**; the Wrap toggle switches to
  `pre` + per-pane scroll. Long values are never clipped.
- Changed rows use a **neutral accent-soft tint**, not amber. Amber stays the
  warning colour.
- The mobile bar keeps **11 px labels** and adds a `More` overflow rather than
  shrinking to 44 px, because "Settings" at 11 px needs ~41 px of a 36 px box.
- Merge drops the **ids** column at ≤1366 px; trace chips remain in the
  inspector. The desktop frames show the 1440 case with ids present.
- The 8-stream cap is shown as a designed limit state, not a silent failure.

---

## 10. Open questions / proposed defaults

These are the remaining design details. Each has a recommended default; the
user can confirm or override at design review.

| # | Question | Proposed default | Why |
| --- | --- | --- | --- |
| 1 | Compare input vs. diff layout | `Input \| Diff` segmented control; Compare switches to Diff; Edit returns | Keeps the reference's full-width panes without cramming textareas above the diff |
| 2 | Mobile diff | Unified single-column at ≤720 px | Side-by-side is unreadable at 390 px |
| 3 | Merge stream limit | 2–8 streams; merged rows capped at the buffer limit | Bounds sort time; the user's example is two. The 9th-stream state is designed, not silent |
| 4 | Merge ordering | Timestamp ascending, nulls last, tie-break stream order then seq | Deterministic "one timeline"; newest-first reverses |
| 5 | Merge export | TXT `[source] raw`; PDF source prefix; no clear-buffer in merge | Keeps the source visible; destructive clear stays per stream |
| 6 | Tab finder entry | Magnifier in the tab strip + `Cmd/Ctrl+K`; popover desktop, dialog mobile | Fast, discoverable, and does not reorder tabs |
| 7 | Close all scope | Includes manual tabs; confirm; failed deletes keep the tab | Matches "close all"; avoids silent data loss |
| 8 | Mobile bottom bar | **More overflow for the 8th item; 11 px labels** | Today's 7 items use `min-width: 50px` (378 px). Eight at 44 px is 382 px only if every label fits a 36 px content box, and "Settings" at 11 px is ~41 px, so the bar overflows. A More menu keeps 11 px labels and the shipped token scale |
| 9 | Health API | Add `node` to `/api/health` | Help needs the Node version; one fetch feeds Settings and Help |
| 10 | Help layout | Scrollable sections in a 640 px modal (the shipped `dialog.wide`); no inner tabs | Simpler and more scannable than nested tabs; matches the existing width |
| 11 | Merge selection persistence | Session-only | Stream IDs change across daemon restarts; avoids stale selections |
| 12 | Compare/Pretty state preservation | Keep the views mounted with `hidden` | Pasted JSON and the diff survive a trip to logs |
| 13 | Merged row at ≤1366 px | Drop the ids column, source 88 px | At 1181 px the seven-track grid leaves 123 px for the message; dropping ids restores 305 px |
| 14 | Merge selection entry | `Select streams` button in the view header with a searchable checklist | The rail opens the view; picking is a deliberate second step |
| 15 | Level-filter tutorial | Static illustration + "Try it on the logs" | Teaches without a second interactive surface to maintain |
| 16 | Compare per-side upload icon | Not in v1.3; keep copy only | No file-upload path exists in Compare today |
| 17 | Diff row wrapping | Wrap by default; `pre` + per-pane scroll as the toggle | Clipping long values defeats comparison and regresses shipped behavior |
| 18 | Diff "changed" tint | Neutral accent-soft, not amber | Amber already means warning in this product |
| 19 | `Cmd/Ctrl+K` | Keep, with `preventDefault()` | The user asked for a finder; the shortcut is a small addition, and the app uses no other browser shortcut |

---

## 11. Revision history

| Revision | Date | Change |
| --- | --- | --- |
| 1 | 2026-11-21 | Initial v1.3 plan for the seven user items; design gates D-08–D-13; workspace-view, line-diff, merge, app-info, tab-finder, and close-all decisions; open questions |
| 2 | 2026-11-22 | Goldfish review round 1 (3 reviewers, 51 findings, 9 blockers) applied. Fixed: merged-row selection contract (`selectedMergedKey`, `useSelectionSync` gating); `deleteStream` HTTP-failure contract and the never-rendered `lastError`; independent merge filter/sort/pause ownership; full `merged-timeline.ts` signatures; the corrected column table (the 1181 row was wrong by 259 px, and the ids-drop threshold moved from 1180 to 1366); `--cols-merged` instead of mutating `--cols`; the duplicate `SheetName` in `shell.tsx`; the six `setScreen` call sites; `workspaceView` vs `zeroStreams` precedence; `j`/`k`/`Enter` in merge; `src/server/index.ts` and `detail-sheet.tsx` added to file lists; `formatUptime` boundaries; `closeAllBody` strings; `diffRowsToText` format; `ToolView` path and `role="region"`; the mobile bar switched to a More overflow at 11 px; diff wrap-by-default and a neutral changed tint; the missing error/loading/limit states in the design workstream; 768×800 frames; the tab finder as a single-select listbox; the app-info `Checking…` state; two-stage `Esc` in Compare Input mode; `prettyLines` reusing `json-pretty.ts`; the `.compare-*`/`.prettify-*` CSS retirement range; two missing test-migration rows; "Alternatives considered" for §4.1–§4.3 |
| 3 | 2026-11-22 | ui-ux-pro-max audit added as §8.1: all 10 priority categories checked, 3 additions folded in (`focus-on-route-change`, `empty-nav-state`, `color-only`), 2 deviations recorded with reasons (`bottom-nav-limit` max 5, `deep-linking` deferred to v1.4) |
| 4 | 2026-11-22 | Design wave drafted in FigCraft page `05 · Proposals · v1.3` (12 frames): Compare diff dark/light, Pretty, tab finder, close-all menu + confirm, Merge dark/light/mobile + selector, Settings version row, Help expanded. §9 now records each frame id and what it shows, plus review notes. Awaiting user review before implementation |
| 5 | 2026-11-22 | Diff tint corrected after review question. The frames had used the shipped `--accent-soft` (1.19:1 dark / 1.11:1 light), which is weaker than the amber the plan rejected and far below the stated target. Measured all shipped pill tints, found the 1.6:1 target too aggressive for a row tint, and settled on three new tokens at 1.40–1.50:1 with exact hexes in §4.2: `--diff-add-bg` `#1a3a2c`/`#c9e0d1`, `--diff-remove-bg` `#452733`/`#f4cccc`, `--diff-change-bg` `#1e3350`/`#c6d8ec`. Frames 12079/12853 updated; a tint comparison strip (13377) added to page 05 showing amber vs accent-soft vs the proposed token at 22 px row scale |
