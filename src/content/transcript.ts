// Captured transcripts (src/content/transcripts/<id>.json): commands run on a
// real Debian 13 system (and other distributions for package tools) by
// `npm run transcripts:capture`, with exactly what they printed. The transcript
// simulators replay them; nothing in a transcript is written by hand.
import { z } from 'zod'

const nonEmpty = z.string().trim().min(1)
const KEY = /^[a-z][a-z0-9-]*$/

/** A host the transcript ran on, as the capture started it. */
const hostSchema = z.object({
  /** The name in the prompt, e.g. "build". */
  name: z.string().regex(KEY),
  /** PRETTY_NAME from /etc/os-release. */
  distro: nonEmpty,
  /** The container image, pinned by digest. */
  image: nonEmpty,
})

const commandSchema = z.object({ host: z.string().regex(KEY), user: z.string().regex(KEY), command: nonEmpty })

export const stepSchema = commandSchema.extend({
  /** Names the step for the simulators: unique within the transcript. */
  key: z.string().regex(KEY),
  /** Working directory as the prompt shows it ("~" or "~/builds"). */
  cwd: nonEmpty,
  /** Everything the terminal showed after the command line, including what the user typed at prompts; colours and carriage returns removed. */
  output: z.string(),
  exit: z.number().int(),
})

export const transcriptSchema = z
  .object({
    id: z.string().regex(KEY),
    /** What the transcript shows, for its readers. */
    description: nonEmpty,
    /** The date the capture ran. */
    captured: z.iso.date(),
    /** How the hosts ran: containers, kernel, anything that differs from a real machine. */
    environment: z.array(nonEmpty).min(1),
    hosts: z.array(hostSchema).min(1),
    /** Commands run before the steps, whose output isn't shown. */
    setup: z.array(commandSchema),
    steps: z.array(stepSchema).min(1),
  })
  .superRefine((t, ctx) => {
    const hosts = new Set(t.hosts.map((h) => h.name))
    const keys = new Set<string>()
    for (const s of [...t.setup, ...t.steps]) if (!hosts.has(s.host)) ctx.addIssue({ code: 'custom', message: `unknown host ${s.host}` })
    for (const s of t.steps) {
      if (keys.has(s.key)) ctx.addIssue({ code: 'custom', message: `duplicate step key ${s.key}` })
      keys.add(s.key)
    }
  })

export type Transcript = z.infer<typeof transcriptSchema>
export type TranscriptStep = z.infer<typeof stepSchema>
