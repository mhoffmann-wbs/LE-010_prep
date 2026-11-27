// Loads every captured transcript under src/content/transcripts/ (JSON files
// named <id>.json, written by `npm run transcripts:capture`).
import { type Transcript, transcriptSchema } from './transcript'

const files = import.meta.glob<unknown>('./transcripts/*.json', { eager: true, import: 'default' })

export const TRANSCRIPT_FILES: Record<string, unknown> = Object.fromEntries(
  Object.entries(files).map(([path, data]) => [path.replace(/^.*\/(.+)\.json$/, '$1'), data]),
)

export const TRANSCRIPTS: Transcript[] = Object.values(TRANSCRIPT_FILES).map((data) => transcriptSchema.parse(data))

export const TRANSCRIPT_BY_ID = new Map(TRANSCRIPTS.map((t) => [t.id, t]))
