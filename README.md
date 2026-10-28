# logdeck

Pipe terminal output into a rich, interactive local log viewer.

`logdeck` reads stdin, streams it to a local daemon, and renders the result in a browser workspace with tabs, search, level filters, a JSON inspector, trace isolation, manual parsing, and TXT/PDF export. Everything stays on `127.0.0.1`; there is no cloud service and no log persistence.

## Install

```bash
npm install --global logdeck
```

The CLI command is `logdeck` (also available as `logdeck`). Requires Node.js 22.12 or newer.

## Quick start

```bash
tail -f app.log | logdeck
docker logs -f api | logdeck --name=api
npm run start | logdeck --name=web
```

The first pipe starts the daemon, opens the browser, and creates a tab. Additional pipes add tabs to the same daemon.

Running `logdeck` with no piped input starts the daemon and opens the Quick Start guide instead.

## CLI

```text
logdeck [options]
logdeck stop [--port <number>]

--port <number>        local server port (default: 3333)
--name <name>          tab name for the piped stream
--no-open              do not open the browser
--idle-timeout <min>   idle shutdown in minutes; 0 disables (default: 5)
-V, --version          print the version
-h, --help             print usage
```

Stop the daemon with:

```bash
logdeck stop
logdeck stop --port 3333
```

Closing a tab removes its retained buffer and ends that stream. If a pipe is still writing, the CLI exits with code 0 and the upstream command sees a closed pipe (SIGPIPE on Unix).

The daemon exits after the idle timeout when there are no active streams and no connected browser. `--idle-timeout=0` keeps it running.

## Viewer

- **Tabs** - one per stream; drag to reorder, double-click or press F2 to rename, close with the tab button.
- **Search** - plain text or regular expressions (`.*`), with an inline invalid-pattern message.
- **Filters** - level chips with full-buffer counts, relative or custom time ranges, and saved presets.
- **Inspect** - click a row (or press Enter) for the raw line, parsed fields, and an expandable JSON tree. Trace IDs isolate a request across the buffer.
- **Pause** - freeze the visible rows while ingestion and counts continue; resume to reveal the buffered lines.
- **Manual mode** - paste text or drop a `.txt`/`.log` file (up to 25 MB) for a client-only tab.
- **Export** - filtered TXT download or a print-styled PDF through the browser's print dialog.
- **Themes** - dark, light, or system.

Keyboard: `/` search, `Enter` inspect, `j`/`k` move rows, `Esc` close, `t` theme, `?` shortcuts.

## Behavior and limits

- Each stream retains the newest 10,000 lines in memory; older lines are counted as dropped.
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
