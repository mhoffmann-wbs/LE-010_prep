// @vitest-environment jsdom
// UI tests run against the real routes and the real question bank, so keep them
// independent of item order and pool size.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { routes } from '../app/routes'
import { getProgress, resetProgress, setTrack } from '../progress/store'

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

  it('switches the whole app to exam 010-160 from the home page', async () => {
    await renderAt('/')
    await userEvent.click(screen.getByRole('radio', { name: /Linux Essentials 010-160/ }))
    expect(getProgress().track).toBe('010-160')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Linux Essentials (010-160)')
    expect(screen.getByText('Topic 2: Finding Your Way on a Linux System')).toBeInTheDocument()
  })

  it('lists the lessons by topic', async () => {
    expect(await renderAt('/learn')).toHaveTextContent('Learn')
    expect(screen.getByRole('link', { name: '012.3 Files, Directories and Paths' })).toBeInTheDocument()
  })

  it('renders a lesson with runnable cells, and opens only the blocks on the learner’s exam', async () => {
    expect(await renderAt('/learn/012.3')).toHaveTextContent('012.3 Files, Directories and Paths')
    expect(await screen.findByText('Big idea')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Run/ }).length).toBeGreaterThan(0)
    const findBlock = () => screen.getAllByText('Only on exam 010-200 (objectives v2.0)')[0]!.closest('details')!
    expect(findBlock()).toHaveAttribute('open')
    expect(screen.getByText('On exam 010-160: 2.3 Using Directories and Listing Files.')).toBeInTheDocument()
  })

  it('collapses 010-200-only lesson blocks on the 010-160 track', async () => {
    setTrack('010-160')
    expect(await renderAt('/learn/012.3')).toHaveTextContent('2.3 Using Directories and Listing Files')
    const block = (await screen.findAllByText('Only on exam 010-200 (objectives v2.0)'))[0]!.closest('details')!
    expect(block).not.toHaveAttribute('open')
    expect(screen.getByText('Only on exam 010-200')).toBeInTheDocument()
  })

  it('shows a not-found page for unknown paths', async () => {
    expect(await renderAt('/nope')).toHaveTextContent('Page not found')
  })

  it('explains how to build the Linux image when it is missing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 404 })))
    expect(await renderAt('/terminal')).toHaveTextContent('Terminal')
    expect(await screen.findByText(/isn’t built yet/)).toBeInTheDocument()
  })

  it('lists the exercises and opens one with its prompt and hints', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 404 })))
    expect(await renderAt('/exercises')).toHaveTextContent('Exercises')
    await userEvent.click(screen.getByRole('link', { name: 'Pack the assets for Ada' }))
    expect(await screen.findByRole('heading', { level: 1, name: /Pack the assets for Ada/ })).toBeInTheDocument()
    expect(await screen.findByText(/isn’t built yet/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Show hint 1/ }))
    expect(screen.getByText(/Hint 1:/)).toBeInTheDocument()
  })

  it('plays a drill round and records it', async () => {
    expect(await renderAt('/explore')).toHaveTextContent('Explore')
    await userEvent.click(screen.getByRole('link', { name: 'Drills' }))
    await screen.findByRole('heading', { level: 1, name: 'Drills' })
    await userEvent.click(screen.getAllByRole('link', { name: /^Play a round/ })[0]!)
    const choices = await screen.findByRole('group', { name: 'Choices' })
    await userEvent.click(choices.querySelector('button')!)
    expect(screen.getByRole('status')).toHaveTextContent(/Correct|It’s/)
  })

  it('lists the simulators and works the permissions calculator', async () => {
    await renderAt('/explore/sims')
    await userEvent.click(screen.getByRole('link', { name: 'Permissions calculator' }))
    await screen.findByRole('heading', { level: 1, name: 'Permissions calculator' })
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Group (g) write' }))
    expect(screen.getByText('-rw-rw-r--')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('chmod'), 'o=,u+x{Enter}')
    expect(screen.getByText('chmod 760 build.sh')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Now you try' })).toBeInTheDocument()
  })

  it('replays a captured transcript and highlights the answer in its output', async () => {
    await renderAt('/explore/sims/services')
    await userEvent.click(await screen.findByRole('button', { name: 'Show all' }))
    expect(screen.getAllByText(/nginx\.service - A high performance web server/).length).toBeGreaterThan(1)
    const question = screen.getByRole('group', { name: /What state is nginx in/ })
    await userEvent.click(question.querySelector('button')!)
    expect(screen.getAllByRole('status')[0]).toHaveTextContent(/Right|Not quite/)
    expect(document.querySelector('mark')).toHaveTextContent('Active: inactive (dead)')
  })

  it('reviews built-in flashcards and keeps their review state', async () => {
    expect(await renderAt('/explore/flashcards')).toHaveTextContent('Flashcards')
    await userEvent.click(screen.getAllByRole('link', { name: /^Review \d+/ })[0]!)
    await userEvent.click(await screen.findByRole('button', { name: 'Show answer' }))
    expect(screen.getByRole('region', { name: 'Answer' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /^Good/ }))
    expect(Object.values(getProgress().cards)).toEqual([expect.objectContaining({ box: 1, reviews: 1 })])
  })

  it('makes an own flashcard deck', async () => {
    await renderAt('/explore/flashcards')
    await userEvent.type(screen.getByLabelText('New deck name'), 'Permissions')
    await userEvent.click(screen.getByRole('button', { name: 'Create deck' }))
    await userEvent.click(screen.getByRole('link', { name: 'Permissions' }))
    await userEvent.type(await screen.findByLabelText('Front (the question)'), 'What does `chmod 600` give?')
    await userEvent.type(screen.getByLabelText('Back (the answer)'), 'rw for the owner only.')
    await userEvent.click(screen.getByRole('button', { name: 'Add card' }))
    expect(getProgress().myCards.map((c) => c.back)).toEqual(['rw for the owner only.'])
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
