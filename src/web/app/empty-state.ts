export type EmptyStateInput = {
  cleared: boolean
  activeKind: 'pipe' | 'manual' | null
  filterProblem: string | null
  filtersActive: boolean
  bootError: string | null
}

export function emptyStateText({
  cleared,
  activeKind,
  filterProblem,
  filtersActive,
  bootError,
}: EmptyStateInput): string {
  if (cleared) {
    return activeKind === 'manual'
      ? 'Parsed lines cleared.'
      : 'Buffer cleared. New lines will appear here.'
  }
  if (filterProblem !== null) return 'This pattern is not a valid regular expression.'
  if (filtersActive) return 'No lines match this view.'
  return bootError ?? 'No lines in this buffer yet.'
}
