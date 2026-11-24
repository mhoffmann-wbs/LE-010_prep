// @vitest-environment jsdom
// UI tests run against the real routes, so keep them independent of content order and size.
import { render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { routes } from '../app/routes'

/** Renders the real routes at `path` and waits for the lazy page's heading. */
async function renderAt(path: string) {
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />)
  return screen.findByRole('heading', { level: 1 }, { timeout: 10_000 })
}

afterEach(() => vi.unstubAllGlobals())

describe('pages', () => {
  it('shows the exam format and the non-affiliation footer on the home page', async () => {
    expect(await renderAt('/')).toHaveTextContent('Linux Essentials (010-200)')
    expect(screen.getByText(/40 questions in 60 minutes/)).toBeInTheDocument()
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
})
