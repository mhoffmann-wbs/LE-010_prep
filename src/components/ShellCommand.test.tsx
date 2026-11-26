// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ShellCommand } from './ShellCommand'

const prompts = (command: string) => [...render(<ShellCommand command={command} />).container.querySelectorAll('pre > span > span')].map((s) => s.textContent)

describe('ShellCommand', () => {
  it('prompts with "> " inside loops and here documents', () => {
    const p = prompts("for f in *.png; do\n  echo $f\ndone\ncat > a.sh <<'EOF'\n#!/bin/bash\necho hi\nEOF\nchmod +x a.sh")
    expect(p.map((s) => (s === '> ' ? '>' : '$'))).toEqual(['$', '>', '>', '$', '>', '>', '>', '$'])
  })
})
