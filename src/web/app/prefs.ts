export type ThemeChoice = 'system' | 'dark' | 'light'
export type Zone = 'utc' | 'local'

export type Prefs = {
  theme: ThemeChoice
  zone: Zone
  autoscroll: boolean
  wrap: boolean
}

const PREFS_KEY = 'log-ui.prefs'
const TAB_ORDER_KEY = 'log-ui.tabOrder'
const INSPECTOR_WIDTH_KEY = 'log-ui.inspectorWidth'

export const INSPECTOR_MIN_WIDTH = 280
export const INSPECTOR_MAX_WIDTH = 720

export const DEFAULT_PREFS: Prefs = {
  theme: 'dark',
  zone: 'utc',
  autoscroll: true,
  wrap: false,
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    if (raw === null) return fallback
    const parsed = JSON.parse(raw)
    if (parsed === null || typeof parsed !== 'object') return fallback
    return parsed as T
  } catch {
    return fallback
  }
}

export function loadPrefs(): Prefs {
  const stored = readJson<Partial<Prefs>>(PREFS_KEY, {})
  return {
    theme: isTheme(stored.theme) ? stored.theme : DEFAULT_PREFS.theme,
    zone: stored.zone === 'local' ? 'local' : 'utc',
    autoscroll: stored.autoscroll !== false,
    wrap: stored.wrap === true,
  }
}

function isTheme(value: unknown): value is ThemeChoice {
  return value === 'system' || value === 'dark' || value === 'light'
}

export function savePrefs(prefs: Prefs): void {
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
  } catch {}
}

export function resolveTheme(choice: ThemeChoice): 'dark' | 'light' {
  if (choice !== 'system') return choice
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

export function applyTheme(choice: ThemeChoice): void {
  document.documentElement.setAttribute('data-theme', resolveTheme(choice))
}

export function loadTabOrder(): string[] | null {
  try {
    const raw = window.localStorage.getItem(TAB_ORDER_KEY)
    if (raw === null) return null
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return null
    return parsed.filter((entry) => typeof entry === 'string')
  } catch {
    return null
  }
}

export function saveTabOrder(ids: readonly string[]): void {
  try {
    window.localStorage.setItem(TAB_ORDER_KEY, JSON.stringify(ids))
  } catch {}
}

export function defaultInspectorWidth(viewport = window.innerWidth): number {
  return viewport <= 1180 ? 320 : 356
}

export function clampInspectorWidth(width: number, viewport = window.innerWidth): number {
  if (!Number.isFinite(width)) return defaultInspectorWidth(viewport)
  const ceiling = Math.min(INSPECTOR_MAX_WIDTH, Math.max(INSPECTOR_MIN_WIDTH, viewport - 480))
  return Math.round(Math.min(ceiling, Math.max(INSPECTOR_MIN_WIDTH, width)))
}

export function loadInspectorWidth(): number | null {
  try {
    const raw = window.localStorage.getItem(INSPECTOR_WIDTH_KEY)
    if (raw === null) return null
    const value = Number(raw)
    if (!Number.isFinite(value)) return null
    return clampInspectorWidth(value)
  } catch {
    return null
  }
}

export function saveInspectorWidth(width: number): void {
  try {
    window.localStorage.setItem(INSPECTOR_WIDTH_KEY, String(width))
  } catch {}
}
