// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import Cells from '../test/cells.mdx'
import { FIXTURES } from '../content/fixtureBank'
import type { Job } from '../vm/job'
import type { RunResult } from '../vm/runner'
import { lessonComponents } from './components'

const run = vi.fn<(job: Job) => Promise<RunResult>>(async () => ({ exit: 0, output: 'README.md  levels' }))
vi.mock('../vm/emulator', () => ({ sharedRunner: async () => ({ run }) }))

const renderCells = () =>
  render(
    <MemoryRouter>
      <Cells components={lessonComponents} />
    </MemoryRouter>,
  )

describe('lesson components', () => {
  it('runs a bash fence as its user, after its fixture, and shows the output', async () => {
    renderCells()
    expect(screen.getByText('jonas@tuxpixel:~$')).toBeInTheDocument()
    await userEvent.click(screen.getAllByRole('button', { name: '▶ Run' })[0]!)
    expect(await screen.findByText('README.md levels', { normalizer: (s) => s.replace(/\s+/g, ' ') })).toBeInTheDocument()
    expect(run).toHaveBeenCalledWith({ command: 'ls assets', user: 'jonas', fixture: FIXTURES.assets })
  })

  it('runs an edited command', async () => {
    renderCells()
    await userEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0]!)
    const box = screen.getByRole('textbox', { name: 'Command' })
    await userEvent.clear(box)
    await userEvent.type(box, 'ls -l assets')
    await userEvent.click(screen.getAllByRole('button', { name: '▶ Run' })[0]!)
    expect(run).toHaveBeenLastCalledWith(expect.objectContaining({ command: 'ls -l assets' }))
  })

  it('shows static fences with a prompt but no Run button', () => {
    renderCells()
    expect(screen.getByText('systemctl status nginx')).toBeInTheDocument()
    // One cell above, plus none inside Predict until it is revealed.
    expect(screen.getAllByRole('button', { name: '▶ Run' })).toHaveLength(1)
  })

  it('asks for a guess before revealing the output', async () => {
    renderCells()
    const reveal = screen.getByRole('button', { name: 'Reveal the answer' })
    expect(reveal).toBeDisabled()
    await userEvent.type(screen.getByRole('textbox', { name: 'Your guess' }), 'one ')
    await userEvent.click(reveal)
    expect(screen.getByText('✓ Exactly right.')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: '▶ Run' })).toHaveLength(2)
  })
})
