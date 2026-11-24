import { type JsonToken, type JsonTokenKind, jsonLineTokens } from '../lib/json-pretty.ts'
import { jsonEntries, jsonLeafText } from '../lib/json-value.ts'
import { Icon } from './icons.tsx'

const TOKEN_CLASS: Record<JsonTokenKind, string | undefined> = {
  key: 'json-key',
  string: 'val-string',
  number: 'val-number',
  bool: 'val-bool',
  null: 'val-null',
  plain: undefined,
}

export function JsonLine({ text }: { text: string }) {
  const tokens = jsonLineTokens(text)
  if (tokens.length === 0) return null
  return (
    <>
      {tokens.map((token, index) => {
        const className = TOKEN_CLASS[token.kind]
        if (className === undefined) return token.text
        return (
          <span key={`${String(index)}-${token.kind}`} className={className}>
            {token.text}
          </span>
        )
      })}
    </>
  )
}

export function JsonText({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <>
      {lines.map((line, index) => {
        const offset = lines.slice(0, index).join('\n').length
        return (
          <span key={`line-${String(offset)}`}>
            <JsonLine text={line} />
            {index === lines.length - 1 ? null : '\n'}
          </span>
        )
      })}
    </>
  )
}

export function PrettyJson({ tokens, wrap }: { tokens: JsonToken[]; wrap: boolean }) {
  let offset = 0
  return (
    <pre className={`json-pretty${wrap ? ' wrap' : ''}`}>
      {tokens.map((token) => {
        const key = `${String(offset)}-${token.kind}`
        offset += token.text.length
        return (
          <span key={key} className={TOKEN_CLASS[token.kind]}>
            {token.text}
          </span>
        )
      })}
    </pre>
  )
}

export type JsonNodeProps = {
  name: string
  value: unknown
  depth: number
  path: string
  copied: string | null
  onCopy: (path: string, value: unknown) => Promise<void>
}

export function JsonNodes({ name, value, depth, path, copied, onCopy }: JsonNodeProps) {
  if (value === null || typeof value !== 'object') {
    return (
      <JsonLeaf
        name={name}
        value={value}
        depth={depth}
        path={path}
        copied={copied}
        onCopy={onCopy}
      />
    )
  }
  const entries = jsonEntries(value)
  const shape = Array.isArray(value) ? `[${entries.length}]` : `{${entries.length}}`
  return (
    <details open={depth === 0}>
      <summary style={{ paddingLeft: `${String(depth * 12)}px` }}>
        <span className="json-key">{name}:</span>
        <span className="json-punct"> {shape}</span>
        <button
          className={`json-copy${copied === path ? ' is-copied' : ''}`}
          type="button"
          title={copied === path ? 'Copied' : `Copy ${path}`}
          aria-label={`Copy ${path}`}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            void onCopy(path, value)
          }}
        >
          <Icon name={copied === path ? 'check' : 'copy'} />
        </button>
      </summary>
      <div>
        {entries.map(([key, child]) => (
          <JsonNodes
            key={key}
            name={key}
            value={child}
            depth={depth + 1}
            path={`${path}.${key}`}
            copied={copied}
            onCopy={onCopy}
          />
        ))}
      </div>
    </details>
  )
}

function JsonLeaf({ name, value, depth, path, copied, onCopy }: JsonNodeProps) {
  const kind =
    value === null
      ? 'null'
      : typeof value === 'boolean'
        ? 'bool'
        : typeof value === 'number'
          ? 'number'
          : 'string'
  return (
    <button
      className="json-leaf"
      type="button"
      style={{ paddingLeft: `${String(depth * 12)}px` }}
      title={copied === path ? 'Copied' : 'Copy value'}
      aria-label={`Copy ${path}`}
      onClick={() => void onCopy(path, value)}
    >
      <span className="json-key">{name}:</span>
      <span className="json-punct"> </span>
      <span className={`val-${kind}`}>{jsonLeafText(value)}</span>
      {copied === path ? (
        <span className="json-copied" role="status">
          Copied
        </span>
      ) : null}
    </button>
  )
}
