import {
  defaultParseRules,
  normalizeParseRules,
  type ParseRules,
} from '../../shared/parse-rules.ts'
import { bestEffort } from '../lib/best-effort.ts'

export const PARSE_RULES_KEY = 'logdeck.parseRules'

export function loadParseRules(): ParseRules {
  try {
    const raw = window.localStorage.getItem(PARSE_RULES_KEY)
    if (raw === null) return defaultParseRules()
    return normalizeParseRules(JSON.parse(raw))
  } catch {
    return defaultParseRules()
  }
}

export function saveParseRules(rules: ParseRules): void {
  bestEffort(() => {
    window.localStorage.setItem(PARSE_RULES_KEY, JSON.stringify(normalizeParseRules(rules)))
  })
}
