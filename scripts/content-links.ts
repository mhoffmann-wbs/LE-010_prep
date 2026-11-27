// Fetches every URL the app cites (blueprint sources and every https URL in
// content files) and reports the broken ones. Needs network; not part of npm
// test. Run: npm run content:links
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { OBJECTIVES, SOURCES, learningMaterialsLessons } from '../src/content/blueprint.ts'

const root = join(import.meta.dirname, '../src/content')
const urls = new Set<string>([
  ...Object.values(SOURCES).filter((v) => v.startsWith('https://')),
  ...OBJECTIVES.flatMap(learningMaterialsLessons),
])

// Every https URL in content files (blueprint comments, questions, lessons, simulators). Captured
// transcripts are skipped: URLs in them are what the commands printed, not sources.
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]))
for (const file of walk(root).filter((f) => /\.(json|mdx|ts)$/.test(f) && !f.endsWith('.test.ts') && !f.includes('/transcripts/')))
  for (const [url] of readFileSync(file, 'utf8').matchAll(/https:\/\/[^\s"'`<>)\]]+/g)) urls.add(url.replace(/[.,;:]$/, ''))

// Some sites serve missing pages with HTTP 200 and a not-found title.
const NOT_FOUND_TITLE = /page not found|not found|404/i

async function check(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 (link check)' } })
    if (!res.ok) return `HTTP ${res.status}`
    const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(await res.text())?.[0] ?? ''
    return NOT_FOUND_TITLE.test(title) ? `looks like a not-found page: ${title.trim()}` : null
  } catch (e) {
    return (e as Error).message
  }
}

const list = [...urls].sort()
const results = await Promise.all(list.map(async (url) => [url, await check(url)] as const))
const broken = results.filter(([, problem]) => problem)
for (const [url, problem] of broken) console.log(`✗ ${url}\n    ${problem}`)
console.log(`${list.length - broken.length} / ${list.length} links OK`)
process.exit(broken.length ? 1 : 0)
