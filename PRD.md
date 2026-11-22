# Product Requirements Document (PRD): `logdeck`

**Revision:** 4 · **Updated:** 2026-11-22 · **Release audited:** `logdeck@1.3.0`

`logdeck` intercepts terminal output and streams it into an interactive browser
workspace. One npm package plays three roles: a per-pipeline CLI, a local
daemon, and a web viewer. Everything stays on the loopback interface; there is
no cloud service, account, or persistent log storage.

> Revision 1 described the 1.0 MVP. This revision reflects what ships in
> `1.1.1`: the `1.1.0` feedback enhancements (numeric levels, JSON timestamps,
> client-side parse rules, stderr status output, responsive toolbar,
> Tree/Pretty JSON, Compare JSON) and the `1.1.1` hardening are now
> requirements, not proposals. §9 lists deliberate deviations and §8 the
> non-goals.

## 1. Product overview

| Field | Value |
| --- | --- |
| Package | `logdeck` (unscoped, MIT) |
| CLI binary | `logdeck` |
| Distribution | `npm install --global logdeck` |
| Runtime | Node.js `>=22.12.0` |
| Bind address | `127.0.0.1` only |
| Retention | In memory, newest 10,000 lines per stream by default (1,000–50,000 configurable) |

**Problem.** Terminal log viewing (`tail -f`, `kubectl logs -f`, `docker logs
-f`, `npm run start`) is plain text: no filtering, no structure, no way to
isolate one request, and no readable JSON. Copying output into an external tool
loses the live tail.

**Solution.** A pipe is the only setup. `logdeck` captures stdin, parses each
line once, and fans it out over WebSocket to a local viewer with tabs, search,
level filters, a JSON inspector, trace isolation, a JSON diff, manual file
parsing, and TXT/PDF export.

## 2. Audience and jobs

- **Software engineer** debugging a local service: `npm run dev | logdeck`, then
  filter to ERROR/WARN and inspect the JSON body of a failed request.
- **DevOps / SRE** watching cluster logs: `kubectl logs -f pod | logdeck
  --name=api`, then isolate a trace ID across the buffer.
- **Support / QA** reading a customer's pasted log file in Manual mode without
  installing a log platform.
- **API developer** comparing a before/after JSON payload when a response shape
  changes.

## 3. System model

| Role | Lifetime | Responsibility |
| --- | --- | --- |
| CLI | Foreground process per pipeline | Read stdin, batch lines, register a stream, stream over WebSocket, open the browser once, exit 0 cleanly |
| Daemon | One detached process per port | Parse, ring-buffer 10,000 lines per stream by default (configurable 1,000–50,000), broadcast over WebSocket, serve the built viewer, shut down when idle |
| Web UI | Browser tab | Tabs, filters, inspector, diff, manual mode, export, settings; keeps its own display preferences and parse rules |

The daemon is shared: every new pipe on the same port adds a stream/tab to the
existing daemon instead of starting another server. State is per daemon
process; a restart drops buffers by design.

## 4. CLI requirements

### 4.1 Invocations

```bash
tail -f app.log | logdeck
docker logs -f api | logdeck --name=api
kubectl logs -f pod | logdeck --port=4000 --name=api
logdeck                      # no pipe: daemon + Quick Start
logdeck stop [--port 3333]
```

### 4.2 Flags

| Flag | Default | Behavior |
| --- | --- | --- |
| `--port <number>` | `3333` | Port for the daemon and viewer; reuse when healthy, start when absent |
| `--name <name>` | `log-viewer-N` | Tab name; duplicates get ` (2)`, ` (3)`; trimmed and capped at 64 characters |
| `--no-open` | off | Do not open a browser |
| `--idle-timeout <minutes>` | `5` | Graceful exit after N idle minutes; `0` disables |
| `--buffer-cap <number>` | persisted value (`10,000`) | Sets the persisted buffer limit at daemon start, or updates a running daemon; 1,000–50,000 |
| `--quiet` | off | Suppress CLI status messages |
| `-V, --version` | — | Print the package version |
| `-h, --help` | — | Print usage |

`logdeck stop` asks the daemon to shut down, polls until the port is free, and
removes the state file. When no daemon answers but a stale pidfile exists, the
command removes the file and reports it.

### 4.3 Status output

- Status goes to **stderr**, only when stderr is a TTY; `--quiet` suppresses it.
  stdout is never used for status, so `cmd | logdeck | tee out.log` stays clean.
- A piped stream prints its banner when the ingest socket opens and a summary
  on EOF/SIGINT. On a TTY the banner is four lines (three below 62 columns; ASCII
  `|`/`-` fallbacks when Unicode is unavailable; the accent bar may be colored
  when `NO_COLOR` is unset):

  ```text
  ▌ logdeck  api
    streaming   http://127.0.0.1:3333
    daemon      already running on port 3333
    stop        Ctrl+C this stream  ·  logdeck stop all
  ```

  The end summary remains:
  `logdeck: "api" ended — 1,234 lines sent in 18.4s`.

- A no-pipe TTY run prints the URL, the pipe hint, and `stop: logdeck stop`,
  then opens the Quick Start guide.
- `logdeck stop` confirms on stderr.

### 4.4 Pipe lifecycle and exit codes

- Lines are batched (50 ms / 500 lines) and flushed; backpressure pauses the
  reader above 4 MB of buffered WebSocket data.
- EOF, Ctrl-C, and a daemon-closed socket all exit **0**, quietly when the
  daemon closed first.
- Closing a tab ends the stream and frees its buffer. A pipe still writing sees
  a closed socket and exits; upstream commands observe SIGPIPE on Unix.
- For a new piped stream, the browser opens only when no viewer is connected
  **and** none connected in the last 30 seconds, preventing a new tab for every
  pipeline. The no-pipe TTY path opens the viewer directly (unless `--no-open`).

### 4.5 Daemon lifecycle

- The daemon starts detached, writes `~/.logdeck/daemon-<port>.json`, and
  handles SIGINT/SIGTERM with a graceful broadcast and exit 0.
- A version mismatch on a reused daemon warns and suggests `logdeck stop`.
- Idle exit fires after the timeout only when there are zero active streams and
  zero browser clients.
- On Windows the daemon works; Unix-signal and SIGPIPE paths are skipped.

## 5. Web UI requirements

All rows, counts, filters, and exports operate on lines retained in this daemon
unless stated otherwise. Display preferences and parse rules are stored in the
browser.

### 5.1 Shell and navigation

- Desktop rail: Streams, Detail, Compare, Manual, Settings, Help, Theme. Detail
  toggles the inspector for the selected row.
- Top bar: wordmark, host, connection chip, Manual mode, Export menu, theme.
- Mobile (≤720 px): six-item bottom bar (Streams, Detail, Compare, Manual,
  Settings, Help) and the Export button in the top bar.
- Status bar: `ws://<host>/ws`, "N of M in view", retained/dropped totals, and
  the active time zone.
- Quick Start is a first-class modal reachable from the `+` tab, the zero-stream
  empty state, and Help. With zero streams, the empty state shows the pipe
  examples, Retry (when the daemon is unreachable), Open quick start, and
  Manual mode.

### 5.2 Ingestion and memory

- Each stream retains the newest **10,000** lines by default; older lines are
  purged and counted as `dropped`. Settings → Buffer limit changes the cap from
  **1,000 to 50,000**, applies live to every stream and viewer, and persists
  under `~/.logdeck`.
- Retained and dropped counts appear in the title row and the status bar; the
  tab count shows retained lines.
- Streams are memory-only. A daemon restart clears them; new pipes recreate
  them. No logs are written to disk.
- Ingest is language-agnostic: ANSI/OSC/BEL escapes are stripped; Java,
  Node.js, Python, Go, and plain text all parse through the same pipeline.
- A single line is capped at 100 KB; longer lines are stored truncated with a
  note in the inspector.

### 5.3 Tabs

- One tab per stream, created in stream order and user-reorderable by drag
  (persisted in `localStorage`).
- Double-click or `F2` renames inline. `Enter` commits; `Escape`/blur cancels.
  Empty, duplicate, or >64-character names are rejected inline.
- `Left`/`Right`/`Home`/`End` move between tabs with roving focus.
- Close asks for confirmation, frees the buffer, ends the ingest socket, and
  removes the tab. Manual tabs close locally without a daemon call.
- The `+` tab opens Quick Start.

### 5.4 Live viewing

- Virtualized rows (30 px; 46 px when wrapping) with seq, time, level, message,
  and ID columns; wrapping rows measure their real height.
- Seven parsed levels (`fatal`, `error`, `warn`, `info`, `debug`, `trace`,
  `unknown`) render with level colors. The filter's Error segment includes
  fatal + error, its Debug segment includes debug + trace, and Unknown is
  separate.
- Timestamps show in UTC or Local, switchable from the toolbar and Settings;
  the choice also drives the inspector and exports.
- `Auto-scroll` pins the newest row; `Wrap` toggles long-line wrapping. Both
  are toolbar controls and Settings segments.
- **Pause** freezes the visible rows while ingestion, counts, and the buffer
  continue. A paused banner shows the pending line count, and Resume reveals
  the buffered lines. Pause is per stream, survives tab switches and reconnects,
  and works in Manual tabs.
- A 60-second signal strip shows one bin per second, tinted for warn/error/
  fatal/trace bins, with the latest warn-or-worse timestamp.
- The title pill reads `ACTIVE`, `STOPPED`, or `MANUAL`. A stopped pipe shows a
  banner explaining that the source ended.
- **Clear buffer** asks for confirmation, then removes retained lines and
  resets counts (`logs:cleared`). A live stream keeps receiving new lines.
- Row selection is keyboard-accessible; clicking a row or pressing `Enter`/`Space`
  opens the inspector.

### 5.5 Search, filters, sort, and presets

- Search is plain text or regular expression (`.*` toggle), case-insensitive,
  debounced 150 ms, capped at 1,000 characters, with an inline
  `Invalid regular expression` message.
- Search covers message text, level, IDs, and the serialized JSON body.
- Level filtering is an **interactive severity bar** with five segments
  (Error, Warn, Info, Debug, Unknown), each sized by its share of the full
  buffer. Counts are computed over the full buffer, not the filtered view.
  Default is **All levels**. Click a segment to solo it; click it again to
  return to All; Shift/Cmd-click adds or removes a level; Esc resets. Selected
  segments are outlined, the rest dimmed, and the bar shows `selected of total`.
  A zero-count level stays as a 2 px targetable sliver; an empty buffer shows an
  empty track with `Levels · All` and `0 lines`. Keyboard focus, arrow
  navigation, Enter/Space toggling and per-segment tooltips are supported. At
  ≤720 px the bar becomes a full-width row with 44 px minimum targets.
- Time range: Last 5 minutes, Last 15 minutes, Last 1 hour, All, or a custom
  `From`/`To` range (`datetime-local`, validated; the start must not follow the
  end).
  Relative ranges are measured against the **newest buffered line**, not the
  wall clock. Lines without a timestamp are hidden while any range is active.
- Sort: oldest first (default) or newest first, applied to the list and to both exports.
- Filter presets store query, regex mode, level selection, range, sort, and trace
  isolation. Users can apply, save, rename, and delete them. **No presets are
  seeded**; the menu starts empty. Presets persist in `localStorage`, and the
  retired seed IDs are purged from existing storage.
- Trace chips isolate one request transaction across the buffer. The isolation
  banner shows the ID and line count, with Clear isolation; isolation composes
  with search, levels, and range. The empty state offers Clear filters when a
  filter hides every row.

### 5.6 Inspection

- Click a row (or press `Enter`) to open the inspector; close it with the X or
  by selecting another row.
- Parsed fields: seq, time, level, a raw preview, and each detected ID.
- JSON body defaults to the **Pretty** tokenized view (left side of the switch);
  **Tree** sits to its right with expand/collapse. Both support Wrap and copy. Per-node copy buttons copy the raw value or
  pretty JSON, and the footer offers Copy raw and Copy JSON, each with a
  transient `Copied` state.
- The raw line is collapsible and collapsed when a JSON body exists; a 100 KB
  truncation note appears when applicable.
- Trace chips in the inspector re-isolate the transaction.
- The desktop inspector resizes from 280 to 720 px (default 440 px; 320 px at
  ≤1180 px) by dragging or with `Left`/`Right`; double-click resets it; the
  width persists per browser. At ≤960 px it becomes a 92svh detail sheet with
  the same content.

### 5.7 Compare and Prettify JSON

- Entry points: Compare in the desktop rail and the mobile bottom bar. It opens
  as a **full workspace view** (rail, top bar, tab strip and status bar stay
  visible), not a modal; `Back to logs` and `Esc` return to the stream view.
- Paste two documents into A (before) and B (after); Load sample, Pretty, Swap,
  Clear, Edit, Compare, and Copy diff are available.
- The diff is **side-by-side by line**: line numbers in both gutters, a centre
  gutter marking added (`→`), removed (`←`) and changed (`↔`) lines, and tinted
  rows. Every row also carries its sign, so colour is never the only cue.
  Wrap is on by default; the toggle switches to `pre` with per-pane scroll.
- Pretty formats both sides in place with 2-space indentation before comparing.
  If either side is empty or invalid, both inputs are left untouched and the
  side's inline error is shown.
- Added, removed and changed lines are tinted with dedicated tokens
  (`--diff-add-bg`, `--diff-remove-bg`, `--diff-change-bg`) verified at
  1.40–1.50:1 against the row background in both themes. Key order is ignored.
- Each side is limited to 1 MB; the diff stops at 5,000 paths and depth 100 and
  reports truncation. Identical input reports `Identical JSON`. Invalid JSON is
  reported per side.
- **Pretty** is a separate rail tool below Compare and also opens as a full
  workspace view. Paste messy JSON, choose
  **Pretty** (2-space default or 4-space indent) or **Minify**, optionally
  **Sort keys** (recursive, arrays preserved), press Prettify, then copy the
  formatted result. Input is capped at 1 MB; invalid JSON reports an inline
  error and leaves the input intact. Load sample and Clear are available; the
  dialog runs entirely in the browser.

### 5.7a Tabs: finder and close all

- The tab strip carries a magnifier button (with the tab count) and a `⋯` menu
  before `+`. `Cmd/Ctrl+K` opens the finder from any view.
- The finder is a single-select listbox: a search field, matching tabs with
  status dot, name and line count, the current tab checked, and an `N of M`
  count. Arrow keys move, `Enter` activates, `Esc` closes and returns focus.
  A no-match state offers Clear.
- `⋯` → **Close all tabs** asks for confirmation naming the count and the
  pipe/manual split, then closes every tab, frees buffers, ends live streams
  and shows the zero-stream empty state. A failed delete keeps that tab and
  shows an error in the tab strip. The item is disabled with zero tabs.

### 5.7b Merge log

- **Merge** sits directly below **Streams** in the rail and opens as a full
  workspace view.
- Select 2–8 existing streams from a searchable checklist; one merged view at
  a time, and changing the selection replaces it. The selection is
  session-only. The 9th stream is disabled with the reason shown.
- Rows are ordered by timestamp ascending, rows without a timestamp last,
  tie-broken by selection order then `seq`. Newest-first reverses.
- The merged table adds a **stream** column between time and level. At
  ≤1366 px the ids column is dropped to protect the message column; trace
  chips remain in the inspector.
- Search matches the source stream name as well as the record text. The level
  bar, range, sort, wrap, pause, inspector, trace isolation and export all
  operate on the merged set, with filter/sort/pause state independent of the
  stream view.
- The merged set is capped at the buffer limit with a truncation note.
- At ≤720 px the source becomes a chip after the level on the first row.

### 5.8 Parsing rules

- Settings → Parsing rules edits JSON level keys, time keys, and message keys
  (up to 12 comma-separated keys each, 40 characters per key).
- Numeric level preset: Auto (Pino/Bunyan + syslog bands), Pino / Bunyan,
  Syslog, or Custom (numeric `key=level` map, up to 32 entries).
- Epoch unit: Auto-detect, Seconds, Milliseconds, Microseconds, or Nanoseconds.
- A live test line previews the parse result, including resolved level and
  time. Reset restores defaults.
- Rules apply in this browser only, persist in `localStorage`, and re-parse the
  retained buffer immediately; the daemon keeps its built-in parse.
- Invalid custom-map entries block Save with an inline message.

### 5.9 Manual mode

- Paste raw text, drop a file, or choose a `.txt`/`.log`/`text/plain` file.
- Files over 25 MB are refused before reading, with the real size in the
  message. Wrong extensions and read failures are reported inline.
- "Try a sample" loads a multi-format sample.
- Parsing runs client-side through the shared parser and opens an ephemeral
  `manual-N` tab with the configured buffer cap and a dropped count. Manual tabs
  are browser-only: clear and close never call the daemon, and they survive a
  daemon restart/reconnect.

### 5.10 Export

- TXT: downloads the current filtered, isolated, and sorted view as `<name>.txt`.
- PDF: renders a print-styled sheet with the stream name, line count, time
  range, the active buffer cap, monospace rows, and `Page N of M` (40 rows per page, A4),
  then opens the browser print dialog; the user saves as PDF.
- The export menu names the active line count and notes that exports stop at the
  active buffer cap.

### 5.11 Settings, Help, and Quick Start

- Settings edits Theme (System/Dark/Light), Timestamp zone (UTC/Local),
  Auto-scroll (On/Off), Word wrap (On/Off), and the **Buffer limit**
  (1,000–50,000, presets plus Custom…) as one saved draft, and links to Parsing
  rules. The buffer limit applies live and persists; the daemon port is a
  read-only fact.
- Settings also shows a **Version** row: `logdeck <version>` with the daemon
  pid and uptime beneath, read from `/api/health`. It shows `Checking…` before
  the first fetch resolves and `Unavailable` when the daemon is unreachable.
- Help has five sections: Get started (pipe examples with copy buttons), Find
  what matters (a mini severity bar and the level-filter interaction rules),
  Keyboard shortcuts, CLI flags (with defaults), and About (version, daemon
  port, pid, uptime, Node version, and the loopback/no-telemetry note). The
  body scrolls with a sticky footer.
- Quick Start shows connection status, the four pipe examples with copy
  buttons, Manual mode, and Shortcuts.

### 5.12 Connection handling

- The viewer maintains a WebSocket to the daemon and reconnects with
  exponential backoff (0.5 s → 15 s) plus jitter.
- The connection chip reads `connected`, `connecting`, or `reconnecting`; a lost
  connection shows a banner with Retry now. The chip menu exposes "Simulate
  connection loss" to review this state.
- On reconnect the client re-fetches each stream from its last `seq`
  (`since=<seq>`), deduplicates, and performs a full rebuild when the server
  reports a gap.
- Reconnect preserves Manual tabs and each stream's pause boundary.

### 5.13 Theme, layout, and accessibility

- Theme: System, Dark, or Light, persisted and applied before first paint (no
  flash). System follows the OS preference.
- Responsive breakpoints: ≥1181 px one toolbar row; 961–1180 px Levels and More
  popovers; ≤960 px two-row toolbar and inspector-as-sheet; ≤720 px mobile
  bottom bar and horizontally scrollable chips. Toolbar labels collapse below
  1701 px, and every control keeps a title/`aria-label`.
- Dialogs capture and restore focus, close on `Escape` and backdrop, and trap
  global shortcuts while open.
- Tabs follow the tab APG pattern (roving tabindex, arrow/Home/End, add button
  outside the scroll region). Log rows are a list with
  `aria-current`/`posinset`; connection and pause banners plus the connection
  chip use live regions, and filter errors are tied to the search field with
  `aria-invalid`/`aria-describedby`.
- Phone touch targets are at least 24 px.

### 5.14 Keyboard shortcuts

| Key | Action |
| --- | --- |
| `/` | Focus search |
| `j` / `k` | Next / previous visible row |
| `Enter` / `Space` | Open the inspector for the selection |
| `Esc` | Clear the focused search, or close the open sheet/dialog |
| `t` | Toggle theme |
| `?` | Open Help |
| `Cmd/Ctrl+K` | Find a stream tab by name |
| `F2` | Rename the active tab |
| Tab `Left`/`Right`/`Home`/`End` | Move between tabs |
| `Left` / `Right` (inspector) | Resize the inspector |

## 6. Parsing and data requirements

- **Pipeline:** cap line → strip ANSI → head timestamp → level → optional JSON
  → IDs → message.
- **Levels:** named aliases (FATAL/CRITICAL→fatal, ERROR/ERR→error,
  WARN/WARNING→warn, INFO/NOTICE→info, DEBUG→debug, TRACE/VERBOSE→trace) and
  numeric bands (Pino/Bunyan 10–60, syslog 0–7, numeric strings accepted).
  Out-of-band or fractional numeric values stay `unknown`.
- **Timestamps:** ISO/space-separated head timestamps with optional `Z`/offset,
  and 10–13-digit epoch heads with optional fractions. Without a head
  timestamp, JSON `time`/`timestamp`/`ts`/`@timestamp`/`datetime`/`date`/
  `event_time`/`eventTime` is used. Epoch values auto-scale from
  seconds to nanoseconds and must land in 2000–2100. Head timestamps win.
- **IDs:** JSON keys (trace/span/request/correlation/conversation/x-request),
  keyed `trace_id=`-style text, dashed UUIDs, and 32-hex runs; deduplicated and
  capped at 8 per line.
- **Message:** prefers the configured JSON message key (`msg`/`message` by
  default); falls back to the remaining text.
- **Bounds:** 100 KB line cap, JSON scan skipped beyond 256 KB and bounded to
  2 MB, JSON body extracted by balanced scan.
- **Ring buffer:** configured 1,000–50,000 lines (default 10,000), monotonic
  `seq` per stream (clear does not reset seq), cumulative `dropped`, `since`
  snapshots with a `gap` flag.
- **Wire:** `stream:created/updated/removed`, coalesced `logs:appended` (50 ms),
  and `logs:cleared`; `stream:updated` carries name, status, line count,
  dropped, and level counts. The browser snapshot is
  `{records, dropped, firstSeq, lastSeq, gap, status}`.
- **HTTP API:** `GET /api/health` (pid, version, startedAt, port),
  `GET/PATCH /api/settings` (buffer limit), `GET/POST /api/streams`,
  `GET /api/streams/:id/logs?since=`, `PATCH /api/streams/:id` (rename),
  `POST /api/streams/:id/clear`, `DELETE /api/streams/:id`, and
  `POST /api/shutdown`.

## 7. Non-functional requirements

- **Performance:** virtualized DOM, default 10,000-line retention (configurable
  1,000–50,000), 50 ms server-side coalescing, and a parser floor of ≥20k lines/s
  on the fixture set. A 100k-line ingest retains 10k and keeps the DOM bounded. Filtering 10k
  lines stays under a frame budget; re-parsing 10k lines after a rule change
  stays under 50 ms.
- **Security and privacy:** bind `127.0.0.1`; every `/api/*`, `/ws`, and
  `/ingest` request is checked against the expected Host/Origin and rejected
  with 403 otherwise; ingestion requires the per-stream token. No telemetry,
  accounts, cloud sync, or disk persistence.
- **Reliability:** graceful shutdown, idle exit, stale-pidfile cleanup, socket
  replacement closes the old ingest socket, and reconnect/resync restores the
  view without losing Manual work.
- **Accessibility:** keyboard paths for every action, visible focus, labelled
  controls, live regions for async state, and dialog focus management.
- **Compatibility:** Node.js `>=22.12.0` (validated on Node 24), macOS and Linux
  primary, Windows best-effort, current Chromium/Firefox/Safari.
- **Packaging:** the published tarball contains only `bin`, `dist`,
  `README.md`, and `package.json` (8 files); the CLI entry is
  `bin/logdeck.mjs`.

## 8. Out of scope

- Persistent log storage, search history on the server, or replay after a
  daemon restart.
- Remote/multi-user access, authentication, TLS, or team sharing.
- Multi-line stack-trace grouping (each line is one record; continuation rows
  render as plain rows).
- Alerting, metrics backends, log shipping, or query languages (Lucene/SQL).
- A programmatic PDF library (the browser print sheet is the PDF path).
- Editing or annotating log lines.
- Non-loopback binding or a hosted service.

## 9. Documented deviations and decisions

1. **Browser auto-open for a new pipe is conditional** — only when no viewer is
   connected and none connected in the last 30 seconds.
2. **Idle shutdown** — zero active streams and zero browser clients for
   `--idle-timeout` (default 5 min) exits the daemon; `0` keeps it running.
3. **PDF is the design-approved print sheet** (browser Save-as-PDF), not jsPDF.
4. **The package is publish-shaped and published** — `files` is
   `bin`/`dist`/`README.md`; releases go to npm (`1.1.1` is `latest`).
5. **Relative ranges are measured against the newest buffered line**, matching
   the design's sample semantics rather than wall-clock time.
6. **Parse rules are client-side only** — they never mutate server state; the
   daemon always uses the built-in defaults.
7. **Compare JSON is paste-only** — no line picking and no new dependency.
8. **Unknown is its own level chip** — hidden unless selected (or All).
9. **CLI status is stderr-only, TTY-gated** — stdout stays pipeline-clean.

## 10. Release and verification baseline

| Gate | `1.1.1` |
| --- | --- |
| Published | npm `latest`, 2026-11-17 |
| Unit/integration | 251 tests across 29 files |
| Playwright E2E | 24 tests |
| Build / typecheck / lint | Green on source (local tool configs excluded) |
| `npm pack` | 8 files, only the `logdeck` bin |
| Tarball smoke | `logdeck --version` → `1.1.1` |

Release mechanics and the per-version history live in
[`RELEASE.md`](./RELEASE.md).

## 11. Document revision history

| Revision | Date | Change |
| --- | --- | --- |
| 1 | 2026-10-27 | 1.0 MVP requirements (CLI, daemon, viewer) |
| 2 | 2026-11-02 | 1.1.0 feedback scope recorded in `PLAN.md` §9 |
| 4 | 2026-11-22 | Audited against `1.3.0`: Compare/Pretty as full-workspace views, side-by-side line diff with tint tokens, tab finder and close-all, Merge log with the source column, Settings version row, expanded Help |
| 3 | 2026-11-18 | Audited against `1.1.1`: pause, Compare JSON, parse rules, Pretty JSON, numeric levels/JSON timestamps, responsive toolbar, reconnect details, security and limits, release baseline; stale 1.0 statements corrected |
