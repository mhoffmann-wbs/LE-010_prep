import { describe, expect, it } from 'vitest'
import { extractSnippets, parseMeta } from './snippets'

const fence = (lang: string, body: string) => `\`\`\`${lang}\n${body}\n\`\`\``

describe('lesson snippets', () => {
  it('pairs a bash fence with the output fence right after it', () => {
    const source = ['# Title', '', fence('bash', 'echo hi'), '', fence('output', 'hi'), '', fence('bash', 'ls'), 'text', fence('output', 'not paired')].join('\n')
    expect(extractSnippets(source)).toEqual([
      { line: 3, code: 'echo hi', output: 'hi' },
      { line: 11, code: 'ls' },
    ])
  })

  it('reads the fixture and user, and skips static fences', () => {
    const source = [fence('bash fixture=assets user=jonas', 'ls'), fence('bash static', 'systemctl status nginx'), fence('text', 'not shell')].join('\n')
    expect(extractSnippets(source)).toEqual([{ line: 1, code: 'ls', fixture: 'assets', user: 'jonas' }])
  })

  it('rejects unknown fence options', () => {
    expect(() => parseMeta('fixtures=assets')).toThrow('unknown fence option "fixtures=assets"')
    expect(() => extractSnippets(fence('bash statc', 'ls'))).toThrow('line 1: unknown fence option "statc"')
  })
})
