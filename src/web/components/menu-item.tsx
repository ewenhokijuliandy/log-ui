export function MenuItem({
  checked,
  label,
  note,
  onPress,
}: {
  checked?: boolean
  label: string
  note?: string
  onPress: () => void
}) {
  const selected = checked ?? false
  const role: 'menuitem' | 'menuitemradio' = checked === undefined ? 'menuitem' : 'menuitemradio'
  return (
    <button
      className="menu-item"
      type="button"
      role={role}
      aria-checked={checked === undefined ? undefined : selected}
      onClick={onPress}
    >
      <span className="grow">{label}</span>
      {note === undefined ? null : <span className="note">{note}</span>}
    </button>
  )
}
