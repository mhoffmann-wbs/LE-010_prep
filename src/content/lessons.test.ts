// Lesson content tests: structure, coverage of the objective's knowledge areas
// and terms, predict-the-output checks, and links. What each snippet prints is
// checked against the guest in verify.test.ts.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { EXAM_IDS, OBJECTIVE_BY_ID, inExam } from './blueprint'
import { LESSONS, REQUIRED_SECTIONS } from './lessons'
import { extractSnippets, fences, parseMeta } from './snippets'

// Read the raw MDX from disk: the MDX plugin would compile a `?raw` import.
const dir = join(import.meta.dirname, 'lessons')
const SOURCES = Object.fromEntries(
  readdirSync(dir)
    .filter((f) => f.endsWith('.mdx'))
    .map((f) => [f.replace(/\.mdx$/, ''), readFileSync(join(dir, f), 'utf8')]),
)

/** In-app pages a lesson may link to, besides other lessons. */
const PAGES = ['/practice', '/questions', '/mock', '/terminal', '/progress', '/learn']

it('every objective has a lesson', () => {
  expect([...OBJECTIVE_BY_ID.keys()].filter((id) => !LESSONS.has(id))).toEqual([])
})

describe.each(Object.entries(SOURCES))('lesson %s', (fileId, source) => {
  const lesson = LESSONS.get(fileId)
  const objective = OBJECTIVE_BY_ID.get(fileId)

  it('is named after its objective and covers every knowledge area and term', () => {
    expect(lesson, `${fileId}.mdx must export meta with objectiveId '${fileId}'`).toBeDefined()
    expect(objective, `no objective ${fileId}`).toBeDefined()
    expect([...lesson!.meta.areasCovered].sort()).toEqual(objective!.areas.map((a) => a.id).sort())
    expect([...lesson!.meta.termsCovered].sort()).toEqual(objective!.terms.map((t) => t.id).sort())
  })

  it('marks what only one exam asks with <ExamOnly>', () => {
    const marked = [...source.matchAll(/<ExamOnly exam="([^"]*)">/g)].map((m) => m[1]!)
    expect(marked.filter((e) => !(EXAM_IDS as readonly string[]).includes(e)), 'unknown exam ids').toEqual([])
    // Every exam with lines of its own (areas or terms the other exam doesn't list) needs at least one block.
    const lines = [...objective!.areas, ...objective!.terms]
    const needed = EXAM_IDS.filter((e) => lines.some((l) => inExam(l, e) && l.exams))
    expect(needed.filter((e) => !marked.includes(e)), 'add an <ExamOnly exam="…"> block for these').toEqual([])
  })

  it('has the required sections in order', () => {
    const positions = REQUIRED_SECTIONS.map((heading) => source.indexOf(`\n${heading}\n`))
    expect(
      REQUIRED_SECTIONS.filter((_, i) => positions[i]! < 0),
      'missing sections',
    ).toEqual([])
    expect([...positions].sort((x, y) => x - y), 'sections out of order').toEqual(positions)
  })

  it('has 2–3 predict-the-output checks, each a runnable command with its output', () => {
    const start = source.indexOf('\n## Predict the output\n')
    const section = source.slice(start, source.indexOf('\n## ', start + 1))
    const blocks = section.split('<Predict>').slice(1)
    expect(blocks.length).toBeGreaterThanOrEqual(2)
    expect(blocks.length).toBeLessThanOrEqual(3)
    for (const block of blocks) {
      const snippet = extractSnippets(block.split('</Predict>')[0]!)[0]
      expect(snippet?.output, 'each Predict needs a runnable ```bash fence and an ```output fence').toBeDefined()
    }
  })

  it('states output only for commands the guest runs', () => {
    // Output of tools the guest can't run (systemctl, ssh, ip …) comes from
    // captured transcripts, never from a lesson's hand-written fence.
    const all = fences(source)
    const orphans = all.flatMap((f, i) => {
      const prev = all[i - 1]
      const ok = f.lang !== 'output' || (prev?.lang === 'bash' && !parseMeta(prev.meta).static)
      return ok ? [] : [`line ${f.start + 1}`]
    })
    expect(orphans, 'an ```output fence must follow a runnable ```bash fence').toEqual([])
  })

  it('links only to pages and lessons that exist', () => {
    const links = [...source.matchAll(/\]\((\/[^)\s]*)\)/g)].map((m) => m[1]!)
    const broken = links.filter((link) => {
      const path = link.split(/[?#]/)[0]!
      const lessonId = /^\/learn\/(.+)$/.exec(path)?.[1]
      return lessonId ? !OBJECTIVE_BY_ID.has(lessonId) : !PAGES.includes(path)
    })
    expect(broken).toEqual([])
  })
})
