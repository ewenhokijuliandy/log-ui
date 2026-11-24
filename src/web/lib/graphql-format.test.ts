import { describe, expect, test } from 'vitest'
import { formatGql, gqlLineTokens, prepareGqlText } from './graphql-format.ts'

const format = (source: string): string => {
  const result = formatGql(source)
  if (!result.ok) throw new Error(result.error)
  return result.text
}

describe('graphql format', () => {
  test('puts one selection per line and indents by depth', () => {
    expect(format('query { user { id name email } }')).toBe(
      ['query {', '  user {', '    id', '    name', '    email', '  }', '}'].join('\n'),
    )
  })

  test('keeps arguments, directives and variables inline', () => {
    expect(format('query Q($id: ID!) { user(id: $id) @include(if: $x) { id } }')).toBe(
      ['query Q($id: ID!) {', '  user(id: $id) @include(if: $x) {', '    id', '  }', '}'].join(
        '\n',
      ),
    )
  })

  test('formats operation headers and fragments inline', () => {
    expect(format('fragment F on User { id }')).toBe(
      ['fragment F on User {', '  id', '}'].join('\n'),
    )
    expect(format('query { ... on User { id } }')).toBe(
      ['query {', '  ... on User {', '    id', '  }', '}'].join('\n'),
    )
    expect(format('query { ...Fields }')).toBe(['query {', '  ...Fields', '}'].join('\n'))
  })

  test('keeps input objects and list values readable', () => {
    expect(format('mutation { create(input: {name: "x"}) { id } }')).toBe(
      ['mutation {', '  create(input: { name: "x" }) {', '    id', '  }', '}'].join('\n'),
    )
    expect(format('query { a(ids: [1, 2, 3]) }')).toBe(
      ['query {', '  a(ids: [1, 2, 3])', '}'].join('\n'),
    )
  })

  test('does not treat braces or hashes inside strings as structure', () => {
    expect(format('query { s(q: "a{b}#c") { id } }')).toBe(
      ['query {', '  s(q: "a{b}#c") {', '    id', '  }', '}'].join('\n'),
    )
    expect(format('query { s(q: """x{y}""") }')).toBe(
      ['query {', '  s(q: """x{y}""")', '}'].join('\n'),
    )
  })

  test('preserves comments on their own line', () => {
    expect(format('# note\nquery { a }')).toBe(['# note', 'query {', '  a', '}'].join('\n'))
  })

  test('is idempotent across a fixture corpus', () => {
    const corpus = [
      'query { user { id name email } }',
      '{ a b }',
      'query Foo($id: ID!) { user(id: $id) { id posts(first: 10) { title } } }',
      'mutation { create(input: {name: "x"}) { id } }',
      'query { search(q: "a{b}c#d") { id } }',
      'fragment F on User { id ...G }',
      'query { a @include(if: $x) b }',
      'query { ... on A { x } ... on B { y } }',
      'query Q($x: Int = 5, $y: String = "z") { a }',
    ]
    for (const source of corpus) {
      const once = format(source)
      expect(format(once), source).toBe(once)
    }
  })

  test('rejects unbalanced input without emitting text', () => {
    expect(formatGql('query { a').ok).toBe(false)
    expect(formatGql('query Q( { a }').ok).toBe(false)
    expect(formatGql('query { a } }').ok).toBe(false)
    expect(formatGql('   ').ok).toBe(false)
  })
})

describe('gql line tokens', () => {
  test('classifies keywords, fields, variables, strings and numbers', () => {
    const kinds = gqlLineTokens('  user(id: $id, first: 10, name: "x") @dir').map(
      (token) => token.kind,
    )
    expect(kinds).toContain('field')
    expect(kinds).toContain('variable')
    expect(kinds).toContain('number')
    expect(kinds).toContain('string')
    expect(kinds).toContain('punct')
    expect(gqlLineTokens('query {').some((token) => token.kind === 'keyword')).toBe(true)
  })

  test('round-trips the source text', () => {
    for (const line of ['query Q($x: Int = 5) {', '  user(id: $id)', '}']) {
      expect(
        gqlLineTokens(line)
          .map((token) => token.text)
          .join(''),
      ).toBe(line)
    }
  })
})

describe('escaped and wrapped GraphQL', () => {
  const expected = 'query {\n  user(name: "x") {\n    id\n  }\n}'

  test('keeps quotes when the query arrives backslash-escaped', () => {
    const result = formatGql('query { user(name: \\"x\\") { id } }')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.decoded).toBe(true)
    expect(result.text).toBe(expected)
  })

  test('unwraps a JSON envelope holding the query', () => {
    const result = formatGql(JSON.stringify({ query: 'query { user(name: "x") { id } }' }))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.decoded).toBe(true)
    expect(result.text).toBe(expected)
  })

  test('unwraps an escaped JSON envelope', () => {
    const envelope = JSON.stringify({ query: 'query { user { id } }' }).replaceAll('"', '\\"')
    const result = formatGql(envelope)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.decoded).toBe(true)
    expect(result.text).toBe('query {\n  user {\n    id\n  }\n}')
  })

  test('unwraps a JSON string holding the query', () => {
    const result = formatGql(JSON.stringify('query { user(name: "x") { id } }'))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.decoded).toBe(true)
    expect(result.text).toBe(expected)
  })

  test('leaves ordinary queries alone', () => {
    const result = formatGql('query { user(name: "x") { id } }')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.decoded).toBe(false)
    expect(result.text).toBe(expected)
  })

  test('does not mangle an escaped quote inside a real string literal', () => {
    const source = 'query { a(s: "he said \\"hi\\"") }'
    expect(prepareGqlText(source).decoded).toBe(false)
    const result = formatGql(source)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.text).toContain('"he said \\"hi\\""')
  })
})

describe('literal backslash escapes', () => {
  test('turns literal backslash-n into real line breaks', () => {
    const result = formatGql('query pfmSetting {\\npfmSetting {\\n__typename\\n}\\n}')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.decoded).toBe(true)
    expect(result.text).toBe('query pfmSetting {\n  pfmSetting {\n    __typename\n  }\n}')
  })

  test('turns literal backslash-t into indentation', () => {
    const result = formatGql('query {\\n\\tpfmSetting {\\n\\t\\tid\\n\\t}\\n}')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.decoded).toBe(true)
    expect(result.text).toBe('query {\n  pfmSetting {\n    id\n  }\n}')
  })

  test('never rewrites an escape inside a string literal', () => {
    const source = 'query { a(s: "line1\\nline2") }'
    expect(prepareGqlText(source).decoded).toBe(false)
    const result = formatGql(source)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.text).toContain('"line1\\nline2"')
  })

  test('leaves a real newline inside a block string untouched', () => {
    const source = 'query { a(s: """line1\nline2""") }'
    expect(prepareGqlText(source).decoded).toBe(false)
    const result = formatGql(source)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.text).toContain('line1\nline2')
  })
})

describe('top level definition layout', () => {
  test('separates a fragment from the operation with a blank line', () => {
    const result = formatGql('query { a }\nfragment F on T { b }')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.text).toBe('query {\n  a\n}\n\nfragment F on T {\n  b\n}')
  })

  test('separates consecutive fragments', () => {
    const result = formatGql('fragment A on T { a }\nfragment B on T { b }')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.text).toBe('fragment A on T {\n  a\n}\n\nfragment B on T {\n  b\n}')
  })

  test('does not add a trailing or leading blank line', () => {
    const result = formatGql('query { a }')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.text).toBe('query {\n  a\n}')
  })
})
