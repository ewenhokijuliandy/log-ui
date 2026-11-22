# PRODUCT — `logdeck` 1.3.0

`logdeck` turns any piped command into a live, structured log workspace on
`127.0.0.1`. One npm package, three roles:

| Role | Process | Responsibility |
| --- | --- | --- |
| CLI | per-pipeline foreground | read stdin, batch, register a stream, stream over WS, open the browser once, exit 0 on EOF/Ctrl-C/closed pipe |
| Daemon | one detached process per port | parse, ring-buffer 10k/stream by default (1k–50k configurable), WS fanout, serve the built UI, idle-exit |
| Web UI | browser | tabs, filters, inspector, Compare JSON, parse rules, manual mode, export, settings |

## Shipped surfaces (1.1.1)

**CLI and daemon**
- `<command> | logdeck [--name=x] [--port=p] [--no-open] [--quiet] [--idle-timeout=min] [--buffer-cap=n]`; a TTY with no pipe opens Quick Start.
- Status on stderr only when stderr is a TTY: a four-line branded stream banner (daemon started/already running, URL, stop hints; three-line narrow and ASCII fallbacks) plus the end summary and stop confirmation. `--quiet` silences it; stdout stays clean.
- Daemon per port, reused by later pipes; pidfile in `~/.logdeck`; version-mismatch warning; stale-file cleanup; `logdeck stop` polls and removes state.
- Idle exit when zero active streams and zero browsers (default 5 min, `0` disables). A new pipe auto-opens a browser only when no viewer is connected and none connected in the last 30 s.
- Loopback bind; Host/Origin guard on every `/api`, `/ws`, and `/ingest` request; per-stream ingest token.

**Workspace**
- One tab per stream: drag reorder (persisted), double-click/F2 rename with inline validation, confirmation before close (buffer freed, ingest closed), arrow/Home/End navigation, live line count.
- Virtualized rows: seq, time (UTC/local), colored level, message with JSON marker, trace chips. Autoscroll, wrap, per-stream pause with pending count, 60 s signal strip, ACTIVE/STOPPED/MANUAL pill, stopped and connection banners.
- Clear-buffer confirmation with retained/dropped counts in the title and status bar (the tab count shows retained).
- Quick Start modal plus a zero-stream empty state (pipe examples, copy buttons, Retry when the daemon is unreachable, Manual mode).
- Desktop rail and mobile bottom bar: Streams, Detail, Compare, Manual, Settings, Help; Theme sits in the rail and top bar on desktop and is hidden in the phone bar.

**Filtering and analysis**
- Plain or regex search (150 ms debounce, 1,000-char cap, inline invalid-pattern message) over message, level, IDs, and JSON.
- Interactive severity bar (Error, Warn, Info, Debug, Unknown) sized by the full-buffer mix; click to solo, Shift-click to add, click again/Esc for All; selected segments outlined, others dimmed; keyboard and 44 px mobile targets.
- Relative ranges (5/15 min, 1 h, All) measured against the newest buffered line, plus validated custom `From`/`To`.
- Oldest-first default sort (newest-first available), saved presets with save/rename/delete in `localStorage` (no seeded entries), trace isolation with a count banner.

**Inspection and diff**
- Inspector with parsed fields, **Pretty** JSON by default (Tree to its right, wrap, expand/collapse, per-node and whole-body copy), collapsible raw line with 100 KB truncation note, trace chips; resizable 280–720 px (default 440/320), persisted; detail sheet at ≤960 px.
- Compare JSON from the rail/bottom bar: paste A/B, sample, **Pretty** (formats both sides in place), swap, clear, added/removed/changed paths with red before and green after lines, copyable diff; 1 MB per side, 5,000 paths, depth 100.
- Pretty JSON from the rail/bottom bar: paste messy JSON, choose Pretty (2/4-space) or Minify, optionally sort keys, copy the result; 1 MB cap, invalid input reports inline.

**Manual and export**
- Manual mode: paste, drag-drop, or choose `.txt`/`.log`, 25 MB guard, sample, ephemeral `manual-N` tab capped at the configured buffer limit with dropped count, browser-only clear/close.
- Export: filtered TXT download, or a print-styled PDF (40 rows/page, page numbers, range/cap header) through the browser's print dialog.

**Preferences and resilience**
- Settings: theme (system/dark/light, pre-paint), zone, autoscroll, wrap; **Buffer limit** dropdown (1k–50k, presets + custom, live and persisted); port readout; Parsing rules (JSON keys, numeric presets, epoch unit, live preview, reset).
- Parse rules are browser-side, persisted, and immediately re-parse the retained buffer; the daemon keeps its defaults.
- WS reconnect with exponential backoff (0.5 s → 15 s + jitter), `since=<seq>` resync, gap rebuild, Manual tabs and pause boundaries preserved; "Simulate connection loss" for review.
- Keyboard: `/`, `j`/`k`, `Enter`, `Esc`, `t`, `?`, `F2`, tab arrows.

## Release delta

| Version | What changed |
| --- | --- |
| 1.3.0 | Compare JSON and Pretty JSON became full-workspace views (no modal); Compare rebuilt as a side-by-side line diff with line numbers, gutter arrows and tinted rows; a tab finder (`Cmd/Ctrl+K`) for many open tabs; "Close all tabs" in a tab-strip menu; a Merge log view below Streams with a source-stream column; the daemon version, pid and uptime in Settings; and an expanded Help with a level-filter tutorial, CLI flags and an About block |
| 1.1.1 | Route/ingest hardening (403 on forged Host/Origin, replaced ingest sockets, pre-clear flush), module splits, 251 tests; published 2026-11-17 |
| 1.1.0 | Numeric Pino/Bunyan + syslog levels, JSON timestamps, client parse rules, multi-select levels with Unknown, stderr status + `--quiet`, 440 px inspector with Tree/Pretty JSON, responsive toolbar with Levels/More, Compare JSON |
| 1.0.1 | First npm release of `logdeck` after the rename and staged review |
| 1.0.0 | Rename from `log-ui`; tab lifecycle, filters, inspector, manual mode, export |

## Documented PRD deviations (also in PRD §9)

1. A new pipe auto-opens a browser only when no viewer is connected (and none in the last 30 s); the no-pipe TTY path opens it directly.
2. Idle exit when zero active streams and zero browser clients.
3. PDF export is the design-approved print sheet (browser Save-as-PDF), not jsPDF.
4. Relative time ranges are measured against the newest buffered line.
5. Parse rules are client-side only; Compare JSON is paste-only.
6. `Unknown` is its own level chip, hidden unless selected.
7. CLI status is stderr-only and TTY-gated.

## Non-goals (1.1.1)

- No persistent storage: buffers are the product; restart ⇒ new pipes.
- No multi-line stack-trace grouping (one record per line).
- No remote access, auth, TLS, cloud, alerting, or log shipping.
- No editing/annotating log lines and no server-side saved views.

## Verification baseline

- 251 unit/integration tests across 29 files; 24 Playwright E2E tests.
- Build, typecheck, and source lint green; `npm pack` = 8 files; tarball
  `logdeck --version` → `1.1.1`.
- Published as npm `latest` on 2026-11-17; see [`RELEASE.md`](./RELEASE.md).
