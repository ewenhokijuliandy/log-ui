import type { ConnectionPhase } from '../app/ws-client.ts'

export function ConnectionBanner({
  connection,
  simulatedLost,
  onRetry,
}: {
  connection: ConnectionPhase
  simulatedLost: boolean
  onRetry: () => void
}) {
  if (connection === 'connected' && !simulatedLost) return null
  return (
    <div className="banner" role="status">
      <span>Connection to the daemon lost. Reconnecting…</span>
      <button className="link" type="button" onClick={onRetry}>
        Retry now
      </button>
    </div>
  )
}
