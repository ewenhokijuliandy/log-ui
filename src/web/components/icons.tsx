const SPRITE_SYMBOLS: readonly string[] = [
  'mark',
  'search',
  'chevron',
  'x',
  'plus',
  'terminal',
  'download',
  'moon',
  'sun',
  'trash',
  'calendar',
  'sort',
  'globe',
  'wrap',
  'autoscroll',
  'copy',
  'isolate',
  'list',
  'panel',
  'settings',
  'help',
  'bookmark',
  'print',
  'file',
  'retry',
  'check',
  'save',
  'pencil',
]

export function Sprite() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}
      aria-hidden="true"
    >
      <symbol id="i-mark" viewBox="0 0 20 20">
        <path
          d="M5.5 3.5v13"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M10 5.5h5.5M10 10h5.5M10 14.5h3"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity=".55"
          fill="none"
        />
      </symbol>
      <symbol id="i-search" viewBox="0 0 16 16">
        <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <path
          d="m10.5 10.5 3 3"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
        />
      </symbol>
      <symbol id="i-chevron" viewBox="0 0 16 16">
        <path
          d="m5 6 3 3 3-3"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </symbol>
      <symbol id="i-x" viewBox="0 0 16 16">
        <path
          d="m4.5 4.5 7 7m0-7-7 7"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
        />
      </symbol>
      <symbol id="i-plus" viewBox="0 0 16 16">
        <path
          d="M8 3.5v9M3.5 8h9"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
        />
      </symbol>
      <symbol id="i-terminal" viewBox="0 0 16 16">
        <path
          d="m3.5 5 3 3-3 3M8.5 11h4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </symbol>
      <symbol id="i-download" viewBox="0 0 16 16">
        <path
          d="M8 3v6m0 0 2.5-2.5M8 9 5.5 6.5M3.5 11.5v1h9v-1"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </symbol>
      <symbol id="i-moon" viewBox="0 0 16 16">
        <path
          d="M12.8 9.6A5 5 0 0 1 6.4 3.2a5 5 0 1 0 6.4 6.4Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
          fill="none"
        />
      </symbol>
      <symbol id="i-sun" viewBox="0 0 16 16">
        <circle cx="8" cy="8" r="2.6" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <path
          d="M8 2.2v1.2M8 12.6v1.2M2.2 8h1.2M12.6 8h1.2M3.9 3.9l.9.9M11.2 11.2l.9.9M12.1 3.9l-.9.9M4.8 11.2l-.9.9"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
        />
      </symbol>
      <symbol id="i-trash" viewBox="0 0 16 16">
        <path
          d="M3.5 5h9M6 5V3.5h4V5M5 5l.5 8h5L11 5M7 7.5v3M9 7.5v3"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </symbol>
      <symbol id="i-calendar" viewBox="0 0 16 16">
        <rect
          x="2.5"
          y="3.5"
          width="11"
          height="10"
          rx="1.5"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
        />
        <path
          d="M2.5 6.5h11M5.5 2.5v2M10.5 2.5v2"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
        />
      </symbol>
      <symbol id="i-sort" viewBox="0 0 16 16">
        <path
          d="M4 4v8M4 12l-2-2M4 12l2-2M12 12V4M12 4l-2 2M12 4l2 2"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </symbol>
      <symbol id="i-globe" viewBox="0 0 16 16">
        <circle cx="8" cy="8" r="5.3" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <path
          d="M2.7 8h10.6M8 2.7c1.6 1.5 2.4 3.3 2.4 5.3s-.8 3.8-2.4 5.3C6.4 11.8 5.6 10 5.6 8s.8-3.8 2.4-5.3Z"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
        />
      </symbol>
      <symbol id="i-wrap" viewBox="0 0 16 16">
        <path
          d="M3 4.5h10M3 8h7a2.5 2.5 0 0 1 0 5H7M8.5 11 6.5 13l2 2M3 11.5h2"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </symbol>
      <symbol id="i-autoscroll" viewBox="0 0 16 16">
        <path
          d="M8 3v7m0 0 2.5-2.5M8 10 5.5 7.5M3.5 13h9"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </symbol>
      <symbol id="i-copy" viewBox="0 0 16 16">
        <rect
          x="5.5"
          y="5.5"
          width="7"
          height="7"
          rx="1"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
        />
        <path
          d="M10.5 5.5v-1a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h1"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
        />
      </symbol>
      <symbol id="i-isolate" viewBox="0 0 16 16">
        <circle cx="8" cy="8" r="4.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <path
          d="M8 1.5v3M8 11.5v3M1.5 8h3M11.5 8h3"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
        />
      </symbol>
      <symbol id="i-list" viewBox="0 0 16 16">
        <path
          d="M5 4.5h8M5 8h8M5 11.5h8M2.5 4.5h.01M2.5 8h.01M2.5 11.5h.01"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
        />
      </symbol>
      <symbol id="i-panel" viewBox="0 0 16 16">
        <rect
          x="2.5"
          y="3"
          width="11"
          height="10"
          rx="1.5"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
        />
        <path d="M9.5 3v10" stroke="currentColor" strokeWidth="1.5" fill="none" />
      </symbol>
      <symbol id="i-settings" viewBox="0 0 16 16">
        <circle cx="8" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <path
          d="M8 2.2v1.4M8 12.4v1.4M2.2 8h1.4M12.4 8h1.4M3.9 3.9l1 1M11.1 11.1l1 1M12.1 3.9l-1 1M4.9 11.1l-1 1"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
        />
      </symbol>
      <symbol id="i-help" viewBox="0 0 16 16">
        <circle cx="8" cy="8" r="5.3" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <path
          d="M6.4 6.1a1.7 1.7 0 1 1 2.3 1.6c-.5.2-.7.6-.7 1.1v.3M8 11.4h.01"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
        />
      </symbol>
      <symbol id="i-bookmark" viewBox="0 0 16 16">
        <path
          d="M4.5 2.8h7v10.4L8 10.6l-3.5 2.6V2.8Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
          fill="none"
        />
      </symbol>
      <symbol id="i-print" viewBox="0 0 16 16">
        <path
          d="M4.5 6V2.8h7V6M4.5 11.5h-1v-4h9v4h-1M4.5 9.5h7v3.7h-7V9.5Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
          fill="none"
        />
      </symbol>
      <symbol id="i-file" viewBox="0 0 16 16">
        <path
          d="M4.5 2.5h4.2L11.5 5v8.5h-7V2.5Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
          fill="none"
        />
        <path
          d="M8.5 2.7V5.3h2.7"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
          fill="none"
        />
      </symbol>
      <symbol id="i-retry" viewBox="0 0 16 16">
        <path
          d="M12.5 8a4.5 4.5 0 1 1-1.6-3.4M12.8 2.8v2.6h-2.6"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </symbol>
      <symbol id="i-check" viewBox="0 0 16 16">
        <path
          d="m3.5 8.5 3 3 6-7"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </symbol>
      <symbol id="i-save" viewBox="0 0 16 16">
        <path
          d="M3 3.5h8.2L13 5.3v7.2H3V3.5Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
          fill="none"
        />
        <path
          d="M5.5 3.5v3.2h5V3.5M5.5 12.5v-3.2h5v3.2"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
          fill="none"
        />
      </symbol>
      <symbol id="i-pencil" viewBox="0 0 16 16">
        <path
          d="M3 13h2.4L13 5.4 10.6 3 3 10.6V13Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
          fill="none"
        />
        <path
          d="m9.6 4 2.4 2.4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
        />
      </symbol>
    </svg>
  )
}

const VALID = SPRITE_SYMBOLS

export function Icon({ name }: { name: (typeof VALID)[number] }) {
  return (
    <svg aria-hidden="true">
      <use href={`#i-${name}`} />
    </svg>
  )
}
