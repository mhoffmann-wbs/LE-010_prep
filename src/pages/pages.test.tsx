// @vitest-environment jsdom
// UI tests run against the real routes and the real question bank, so keep them
// independent of item order and pool size.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { routes } from '../app/routes'
import { getProgress, resetProgress } from '../progress/store'

/** Renders the real routes at `path` and waits for the lazy page's heading. */
async function renderAt(path: string) {
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />)
  return screen.findByRole('heading', { level: 1 }, { timeout: 10_000 })
}

beforeEach(() => {
  localStorage.clear()
  resetProgress()
})

afterEach(() => vi.unstubAllGlobals())

describe('pages', () => {
  it('shows the exam format, all five topics and the footer on the home page', async () => {
    expect(await renderAt('/')).toHaveTextContent('Linux Essentials (010-200)')
    expect(screen.getByText(/40 questions in 60 minutes/)).toBeInTheDocument()
    expect(screen.getAllByText(/^Topic 01\d:/)).toHaveLength(5)
    expect(screen.getByText(/Not affiliated with or endorsed by the Linux Professional Institute/)).toBeInTheDocument()
  })

  it('shows a not-found page for unknown paths', async () => {
    expect(await renderAt('/nope')).toHaveTextContent('Page not found')
  })

  it('explains how to build the Linux image when it is missing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 404 })))
    expect(await renderAt('/terminal')).toHaveTextContent('Terminal')
    expect(await screen.findByText(/isn’t built yet/)).toBeInTheDocument()
  })

  it('lists every topic on the practice picker', async () => {
    expect(await renderAt('/practice')).toHaveTextContent('Practice')
    expect(screen.getAllByText(/^Topic 01\d:/)).toHaveLength(5)
  })

  it('checks a typed answer with Enter, reveals the key and records the attempt', async () => {
    const user = userEvent.setup()
    await renderAt('/questions/013.1-001')
    await user.type(screen.getByRole('textbox', { name: /your answer/i }), '--list{Enter}')
    expect(screen.getByRole('status')).toHaveTextContent('Correct')
    expect(screen.getByText(/Accepted answers:/)).toBeInTheDocument()
    expect(getProgress().items['013.1-001']).toMatchObject({ attempts: 1, correct: 1 })
  })

  it('shows the command of an output item and grades the picked output', async () => {
    const user = userEvent.setup()
    await renderAt('/questions/013.2-001')
    expect(screen.getByText(/sort \| uniq$/)).toBeInTheDocument()
    await user.click(screen.getAllByRole('radio')[0]!)
    await user.click(screen.getByRole('button', { name: 'Check answer' }))
    expect(screen.getByRole('status')).toHaveTextContent('Not quite')
    expect(getProgress().items['013.2-001']).toMatchObject({ attempts: 1, correct: 0 })
  })

  it('runs a mock exam and shows an estimated scaled score', async () => {
    const user = userEvent.setup()
    expect(await renderAt('/mock')).toHaveTextContent('Mock exam')
    await user.click(screen.getByRole('button', { name: 'Start the mock exam' }))
    while (!screen.queryByRole('button', { name: 'Submit exam' })) await user.click(screen.getByRole('button', { name: /^(Next|Review)$/ }))
    await user.click(screen.getByRole('button', { name: 'Submit exam' }))
    expect(await screen.findByText(/Estimated scaled score/)).toBeInTheDocument()
    expect(getProgress().mockResults).toHaveLength(1)
  })

  it('shows readiness by topic on the progress page', async () => {
    expect(await renderAt('/progress')).toHaveTextContent('Progress')
    expect(screen.getByText('Weakest objectives')).toBeInTheDocument()
    expect(screen.getAllByRole('checkbox')).toHaveLength(2)
  })
})
