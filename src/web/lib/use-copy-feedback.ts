import { useCallback, useEffect, useRef, useState } from 'react'
import { copyText } from './clipboard.ts'

export const COPIED_MS = 1_200

export type CopyState = {
  key: string | null
  scope: unknown
}

export const IDLE_COPY: CopyState = { key: null, scope: undefined }

export function beginCopy(key: string, scope: unknown): CopyState {
  return { key, scope }
}

export function clearCopy(state: CopyState): CopyState {
  return { key: null, scope: state.scope }
}

export function copiedKeyFor(state: CopyState, scope: unknown): string | null {
  if (state.scope !== scope) return null
  return state.key
}

export type CopyFeedback = {
  copied: boolean
  copiedKey: string | null
  copy: (text: string, key?: string) => Promise<void>
}

export function useCopyFeedback(resetKey?: unknown): CopyFeedback {
  const [state, setState] = useState<CopyState>(IDLE_COPY)
  const currentScope = useRef(resetKey)
  currentScope.current = resetKey
  const timer = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    }
  }, [])

  const copy = useCallback(async (text: string, key = 'text'): Promise<void> => {
    const copySucceeded = await copyText(text)
    if (!copySucceeded) return
    setState(beginCopy(key, currentScope.current))
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      setState((previous) => clearCopy(previous))
    }, COPIED_MS)
  }, [])

  const copiedKey = copiedKeyFor(state, resetKey)
  return { copied: copiedKey !== null, copiedKey, copy }
}
