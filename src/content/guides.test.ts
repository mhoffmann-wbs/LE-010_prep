// Guide content tests: each guide is registered under its file name, and its
// in-app links point at real routes.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { OBJECTIVE_BY_ID, TOPIC_BY_ID } from './blueprint'
import { GUIDES, GUIDE_ORDER } from './guides'

// Read the raw MDX from disk: the MDX plugin would compile a `?raw` import.
const dir = join(import.meta.dirname, 'guides')
const SOURCES = Object.fromEntries(
  readdirSync(dir)
    .filter((f) => f.endsWith('.mdx'))
    .map((f) => [f.replace(/\.mdx$/, ''), readFileSync(join(dir, f), 'utf8')]),
)

const PAGES = ['/', '/learn', '/practice', '/questions', '/mock', '/terminal', '/exercises', '/explore', '/progress']

it('lists every guide, and only those', () => {
  expect([...GUIDE_ORDER].sort()).toEqual(Object.keys(SOURCES).sort())
})

describe.each(Object.entries(SOURCES))('guide %s', (slug, source) => {
  it('exports meta with its file name as slug', () => {
    expect(GUIDES.get(slug)?.meta.slug).toBe(slug)
  })

  it('links only to pages, lessons and guides that exist', () => {
    const links = [...source.matchAll(/\]\((\/[^)\s]*)\)/g)].map((m) => m[1]!.replace(/\?.*$/, ''))
    const lessons = [
      ...links.filter((l) => l.startsWith('/learn/')).map((l) => l.slice('/learn/'.length)),
      ...[...source.matchAll(/<LessonLink id="([^"]+)"/g)].map((m) => m[1]!),
    ]
    const guides = links.filter((l) => l.startsWith('/guides/')).map((l) => l.slice('/guides/'.length))
    const others = links.filter((l) => !l.startsWith('/learn/') && !l.startsWith('/guides/'))
    expect(lessons.filter((id) => !OBJECTIVE_BY_ID.has(id))).toEqual([])
    expect(guides.filter((g) => !GUIDES.has(g))).toEqual([])
    expect(others.filter((p) => !PAGES.includes(p))).toEqual([])
  })

  it('heads only real topics', () => {
    const topics = [...source.matchAll(/<TopicHeading topic="([^"]+)"/g)].map((m) => m[1]!)
    expect(topics.filter((t) => !TOPIC_BY_ID.has(t))).toEqual([])
  })
})

it('gives the cheat sheet a part per topic and links every lesson', () => {
  const source = SOURCES['cheat-sheet']!
  expect([...source.matchAll(/<TopicHeading topic="([^"]+)"/g)].map((m) => m[1])).toEqual([...TOPIC_BY_ID.keys()])
  const linked = new Set([...source.matchAll(/<LessonLink id="([^"]+)"/g)].map((m) => m[1]))
  expect([...OBJECTIVE_BY_ID.keys()].filter((id) => !linked.has(id))).toEqual([])
})
