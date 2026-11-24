import { useState } from 'react'
import { formatGql, gqlLineTokens } from '../lib/graphql-format.ts'
import { useCopyFeedback } from '../lib/use-copy-feedback.ts'
import { Icon } from './icons.tsx'
import { ToolView } from './tool-view.tsx'

const SAMPLE = `query Orders($first: Int = 20) { orders(first: $first) { id total status items { sku qty } } }`

const GQL_CLASS: Record<string, string | undefined> = {
  keyword: 'gql-keyword',
  field: 'gql-field',
  variable: 'gql-variable',
  string: 'gql-string',
  number: 'gql-number',
  comment: 'gql-comment',
  punct: 'gql-punct',
}

function GqlText({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <>
      {lines.map((line, lineIndex) => {
        let offset = 0
        const tokens = gqlLineTokens(line).map((token) => {
          const key = `${String(offset)}-${token.kind}`
          offset += token.text.length
          return { key, token }
        })
        return (
          <span key={`line-${String(lineIndex)}`}>
            {tokens.map(({ key, token }) => {
              const className = GQL_CLASS[token.kind]
              if (className === undefined) return token.text
              return (
                <span key={key} className={className}>
                  {token.text}
                </span>
              )
            })}
            {lineIndex === lines.length - 1 ? null : '\n'}
          </span>
        )
      })}
    </>
  )
}

export function GraphqlView() {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [error, setError] = useState('')
  const { copied, copy } = useCopyFeedback()

  const outputLines = output === '' ? 0 : output.split('\n').length

  function runFormat(): void {
    const result = formatGql(input)
    if (!result.ok) {
      setError(result.error)
      setOutput('')
      return
    }
    setError('')
    setOutput(result.text)
  }

  function clear(): void {
    setInput('')
    setOutput('')
    setError('')
  }

  function loadSample(): void {
    setInput(SAMPLE)
    setOutput('')
    setError('')
  }

  return (
    <ToolView
      title="GraphQL"
      description="Paste a messy query or schema, then copy it back formatted. Parsed in this browser."
      flush
    >
      <div className="diff-panes diff-panes-input">
        <div className="diff-heads">
          <div className="diff-head">
            <span>GQL IN</span>
            <button
              className="diff-head-copy"
              type="button"
              aria-label="Copy the input"
              title="Copy the input"
              onClick={() => void copy(input)}
            >
              <Icon name="copy" />
            </button>
          </div>
          <div className="diff-head right-head">
            <span>GQL OUT</span>
            <button
              className="diff-head-copy"
              type="button"
              aria-label="Copy the output"
              title="Copy the output"
              disabled={output.length === 0}
              onClick={() => void copy(output)}
            >
              <Icon name="copy" />
            </button>
          </div>
        </div>
        <div className="diff-inputs">
          <label className="diff-input-card" data-side="GQL IN">
            <textarea
              className="diff-textarea"
              aria-label="GraphQL in"
              placeholder="query { user { id } }"
              spellCheck={false}
              value={input}
              onChange={(event) => setInput(event.target.value)}
            />
            {error.length === 0 ? null : (
              <p className="diff-input-error" role="alert">
                {error}
              </p>
            )}
          </label>
          <div className="diff-input-card" data-side="GQL OUT">
            <output
              className={`diff-textarea diff-output${output === '' ? ' empty' : ''}`}
              aria-label="Formatted GraphQL"
            >
              {output === '' ? 'Formatted GraphQL appears here.' : <GqlText text={output} />}
            </output>
          </div>
        </div>
      </div>

      <div className="diff-summary" role="status">
        {output === '' ? (
          <span>{error === '' ? 'Paste a query, then press Format.' : error}</span>
        ) : (
          <>
            <span className="changed">{outputLines} lines</span>
            <span className="note">Formatted in this browser</span>
          </>
        )}
        <span className="spacer" />
        <span className="note">Up to 1 MB · parsed in this browser</span>
      </div>

      <div className="diff-actions">
        <button className="btn ghost" type="button" onClick={loadSample}>
          Load sample
        </button>
        <button className="btn" type="button" onClick={clear}>
          Clear
        </button>
        <button
          className="btn"
          type="button"
          disabled={output.length === 0}
          onClick={() => void copy(output)}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
        <span className="spacer" />
        <button className="btn primary" type="button" onClick={runFormat}>
          Format
        </button>
      </div>
    </ToolView>
  )
}
