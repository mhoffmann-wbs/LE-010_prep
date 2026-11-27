// Captured transcripts parse, and the transcript simulators only point at what
// was captured: every scene's steps exist, and every answer's evidence appears
// verbatim in the output of the step it names, which the scene replays.
import { describe, expect, it } from 'vitest'
import { SIM_REGISTRY } from '../sims/registry'
import { paramsSchema as replayParams } from '../sims/transcript/model'
import { transcriptSchema } from './transcript'
import { SIMS } from './sims'
import { TRANSCRIPT_BY_ID, TRANSCRIPT_FILES } from './transcripts'

const REPLAY_SIMS = SIMS.filter((s) => SIM_REGISTRY.get(s.id)?.params === replayParams)

describe('transcripts', () => {
  it.each(Object.entries(TRANSCRIPT_FILES))('%s.json parses and is named after its id', (fileId, data) => {
    const parsed = transcriptSchema.safeParse(data)
    expect(parsed.success, parsed.error?.message).toBe(true)
    expect(parsed.data?.id).toBe(fileId)
  })

  it('has a simulator for every transcript', () => {
    const used = new Set(REPLAY_SIMS.map((s) => replayParams.parse(s.params).transcript))
    expect([...TRANSCRIPT_BY_ID.keys()].filter((id) => !used.has(id))).toEqual([])
  })

  it.each(REPLAY_SIMS.map((s) => [s.id, s] as const))('%s replays captured steps and answers from their output', (_, sim) => {
    const params = replayParams.parse(sim.params)
    const transcript = TRANSCRIPT_BY_ID.get(params.transcript)
    expect(transcript, `no transcript ${params.transcript}`).toBeDefined()
    const output = new Map(transcript!.steps.map((s) => [s.key, s.output]))
    const problems = params.scenes.flatMap((scene) => [
      ...scene.steps.filter((k) => !output.has(k)).map((k) => `${scene.title}: no step ${k}`),
      ...Object.keys(scene.notes ?? {}).filter((k) => !scene.steps.includes(k)).map((k) => `${scene.title}: note for a step it doesn't replay: ${k}`),
      ...scene.questions.flatMap((q) => {
        if (!scene.steps.includes(q.evidence.step)) return [`${scene.title}: evidence from a step it doesn't replay: ${q.evidence.step}`]
        return output.get(q.evidence.step)?.includes(q.evidence.text) ? [] : [`${scene.title}: “${q.evidence.text}” isn't in ${q.evidence.step}`]
      }),
    ])
    expect(problems).toEqual([])
  })
})
