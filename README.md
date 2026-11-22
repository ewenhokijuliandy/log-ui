# logdeck

Pipe terminal output into a rich, interactive local log viewer.

`logdeck` reads stdin, streams it to a local daemon, and renders the result in a browser workspace with tabs, search, level filters, a JSON inspector, trace isolation, manual parsing, and TXT/PDF export. Everything stays on `127.0.0.1`; there is no cloud service and no log persistence.

## Install

```bash
npm install --global logdeck
```

The CLI binary is `logdeck`. Requires Node.js 22.12 or newer.

## Quick start

```bash
tail -f app.log | logdeck
docker logs -f api | logdeck --name=api
npm run start | logdeck --name=web
```

The first pipe starts the daemon, opens the browser, and creates a tab. Additional pipes add tabs to the same daemon.

Running `logdeck` with no piped input starts the daemon, prints the URL and stop hint (in a terminal), and opens the Quick Start guide instead.

## CLI

```text
logdeck [options]
logdeck stop [--port <number>]

--port <number>        local server port (default: 3333)
--name <name>          tab name for the piped stream
--no-open              do not open the browser
--idle-timeout <min>   idle shutdown in minutes; 0 disables (default: 5)
--buffer-cap <number>  initial buffer limit (1,000–50,000; settable later in Settings)
--quiet                suppress CLI status messages
-V, --version          print the version
-h, --help             print usage
```

Stop the daemon with:

```bash
logdeck stop
logdeck stop --port 3333
```

Status lines go to **stderr** and are shown only when stderr is a terminal: the startup banner, the stream-end summary and the `logdeck stop` confirmation. `--quiet` suppresses them. stdout is never used for status, so `cmd | logdeck | tee out.log` stays clean.

On a TTY the stream banner is four lines (three below 62 columns; ASCII `|`/`-` fallbacks when Unicode is unavailable):

```text
▌ logdeck  api
  streaming   http://127.0.0.1:3333
  daemon      already running on port 3333
  stop        Ctrl+C this stream  ·  logdeck stop all
```

The end summary is unchanged:

```text
logdeck: "api" ended — 1,234 lines sent in 18.4s
```

Closing a tab removes its retained buffer and ends that stream. If a pipe is still writing, the CLI exits with code 0 and the upstream command sees a closed pipe (SIGPIPE on Unix).

The daemon exits after the idle timeout when there are no active streams and no connected browser. `--idle-timeout=0` keeps it running. `--buffer-cap` seeds the persisted buffer limit when it starts or updates the running daemon; Settings remains the live control.

## Viewer

- **Tabs** - one per stream; drag to reorder, double-click or press F2 to rename, close with the tab button. The magnifier (or `Cmd/Ctrl+K`) finds a tab by name when many are open, and the `⋯` menu closes every tab at once after a confirmation.
- **Search** - plain text or regular expressions (`.*`), with an inline invalid-pattern message.
- **Filters** - interactive severity bar (Error / Warn / Info / Debug / Unknown) sized by the full-buffer mix; click a segment to solo it, Shift-click to add, click it again or press Esc for All levels. Relative or custom time ranges, saved presets, and oldest-first sorting by default.
- **Parsing** - ANSI-stripped lines; ISO or epoch head timestamps plus JSON `time`/`timestamp`/`ts` fields with second-to-nanosecond detection; named or numeric levels (Pino/Bunyan, syslog); JSON bodies and trace/request IDs.
- **Parse rules** - Settings → Parsing rules: JSON level/time/message keys, numeric presets (Auto, Pino/Bunyan, Syslog, Custom map), epoch units, and a live test line. Rules apply in this browser and re-parse the retained buffer.
- **Inspect** - click a row (or press Enter) for parsed fields, a Pretty (default) or Tree JSON body with wrap, expand/collapse and copy, and a collapsible raw line. Trace IDs isolate a request across the buffer.
- **Compare** - Compare JSON opens as a full workspace view, not a dialog. Paste two JSON documents and read a side-by-side line diff with line numbers in both gutters and a centre gutter marking added (`→`), removed (`←`) and changed (`↔`) lines. Added, removed and changed rows are tinted, and every row also carries its sign so the diff reads without colour. Key order is ignored; the diff is copyable. **Pretty** formats both sides in place.
- **Pretty** - Pretty JSON also opens as a full workspace view. Paste messy JSON, choose Pretty (2- or 4-space indent) or Minify, optionally sort keys, format it locally (1 MB limit), and copy the result.
- **Merge** - Merge log sits directly below Streams. Pick two to eight existing streams and read them on one timeline; each row names the stream it came from in a **stream** column between time and level. Search matches the stream name too, and the level bar, wrap, pause, inspector and export all work on the merged set. One merged view at a time; change the selection to see another.
- **Pause** - freeze the visible rows while ingestion and counts continue; resume to reveal the buffered lines.
- **Manual mode** - paste text or drop a `.txt`/`.log` file (up to 25 MB) for a client-only tab.
- **Export** - filtered TXT download or a print-styled PDF through the browser's print dialog.
- **Settings** - theme, timestamp zone, auto-scroll, word wrap, the buffer limit (1,000–50,000 lines; applies live and persists), and the running daemon's version, pid and uptime.
- **Themes** - dark, light, or system.

- **Help** - pipe examples, a level-filter tutorial, the keyboard shortcuts, the CLI flags and the daemon's version and uptime.

Keyboard: `/` search, `Cmd/Ctrl+K` find a tab, `Enter` inspect, `j`/`k` move rows, `Esc` close a sheet or return to the logs, `t` theme, `?` shortcuts.

## Behavior and limits

- Each stream retains the newest 10,000 lines by default; the limit is configurable from 1,000 to 50,000 in Settings, applies live, and persists. Older lines are counted as dropped.
- Streams are in-memory only. Restarting the daemon clears them; create new pipes to continue.
- The daemon binds to `127.0.0.1`, checks same-origin/Host on mutating routes, and requires a per-stream token for ingestion.
- Browser auto-open happens only when no viewer is already connected.
- Windows is best-effort: the daemon works, but the Unix signal and SIGPIPE paths are skipped.

## Development

```bash
npm install
npm run build
npm test
npm run typecheck
npm run lint
npm run e2e
```

`npm run e2e` builds the app, starts a test daemon on port 4173, and runs the Playwright suite. Use `LOGDECK_E2E_PORT` to move it.

The approved visual direction and tokens live in `design/`; `DESIGN.md` documents the port. The daemon, CLI, shared parser, and web app are all in `src/`.
