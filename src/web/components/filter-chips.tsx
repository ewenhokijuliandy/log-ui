import { useEffect, useRef, useState } from 'react'
import type { LevelChipKey } from '../../shared/levels.ts'
import { type FilterState, filterError, MAX_PATTERN_LENGTH } from '../lib/filters.ts'
import { Icon } from './icons.tsx'

export type ChipCounts = Record<Exclude<LevelChipKey, 'all'>, number>

export function SearchField({
  filter,
  onFilter,
}: {
  filter: FilterState
  onFilter: (next: FilterState) => void
}) {
  const [query, setQuery] = useState(filter.query)
  const [regexMode, setRegexMode] = useState(filter.regexMode)

  useEffect(() => {
    setQuery(filter.query)
  }, [filter.query])

  useEffect(() => {
    setRegexMode(filter.regexMode)
  }, [filter.regexMode])

  const debounce = useRef<number | null>(null)
  useEffect(() => {
    if (query === filter.query && regexMode === filter.regexMode) return
    if (debounce.current !== null) window.clearTimeout(debounce.current)
    debounce.current = window.setTimeout(() => {
      onFilter({ ...filter, query, regexMode })
    }, 150)
    return () => {
      if (debounce.current !== null) window.clearTimeout(debounce.current)
    }
  }, [query, regexMode, filter, onFilter])

  const error = filterError(filter)

  return (
    <div className={`search${error === null ? '' : ' invalid'}`}>
      <Icon name="search" />
      <input
        data-search
        type="text"
        placeholder="Search logs"
        aria-label="Search logs"
        aria-invalid={error !== null}
        aria-describedby={error === null ? undefined : 'search-error'}
        autoComplete="off"
        spellCheck={false}
        maxLength={MAX_PATTERN_LENGTH}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Escape') return
          setQuery('')
          onFilter({ ...filter, query: '' })
        }}
      />
      <button
        className="regex"
        type="button"
        aria-label="Regular expression"
        aria-pressed={regexMode}
        title="Treat the search as a regular expression"
        onClick={() => setRegexMode(!regexMode)}
      >
        .*
      </button>
      {error === null ? null : (
        <p className="search-error" id="search-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
