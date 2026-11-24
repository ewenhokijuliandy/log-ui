import { describe, expect, test } from 'vitest'
import { formatGql, gqlLineTokens } from './graphql-format.ts'

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
