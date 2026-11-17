import { type Dispatch, type SetStateAction, useEffect, useState } from 'react'
import type { ParseRules } from '../../shared/parse-rules.ts'
import { loadParseRules, PARSE_RULES_KEY } from './parse-rules.ts'
import { applyTheme, loadPrefs, type Prefs, resolveTheme, savePrefs } from './prefs.ts'
import { useUi } from './ui.ts'

export type PrefsEffectsOptions = {
  setRules: Dispatch<SetStateAction<ParseRules>>
}

export type PrefsEffects = {
  prefs: Prefs
  setPrefs: Dispatch<SetStateAction<Prefs>>
}

export function usePrefsEffects({ setRules }: PrefsEffectsOptions): PrefsEffects {
  const [prefs, setPrefs] = useState<Prefs>(() => loadPrefs())
  const setResolvedTheme = useUi((state) => state.setTheme)

  useEffect(() => {
    applyTheme(prefs.theme)
    setResolvedTheme(resolveTheme(prefs.theme))
    savePrefs(prefs)
  }, [prefs, setResolvedTheme])

  useEffect(() => {
    if (prefs.theme !== 'system') return
    const media = window.matchMedia('(prefers-color-scheme: light)')
    const onChange = () => {
      applyTheme('system')
      setResolvedTheme(resolveTheme('system'))
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [prefs.theme, setResolvedTheme])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== PARSE_RULES_KEY) return
      setRules(loadParseRules())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [setRules])

  return { prefs, setPrefs }
}
