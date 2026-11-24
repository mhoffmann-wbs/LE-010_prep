import { describe, expect, it } from 'vitest'
import { FILL, FIXTURES, MULTI, OUTPUT_CHOICE, OUTPUT_TYPE, SINGLE } from '../test/fixtures'
import { itemSchema, normaliseAnswer, normaliseOutput } from './schema'

const errors = (item: unknown) => itemSchema.safeParse(item).error?.issues.map((i) => i.message) ?? []

describe('item schema', () => {
  it.each(FIXTURES.map((f) => [`${f.kind} ${f.id}`, f]))('accepts a valid %s item', (_, item) => {
    expect(errors(item)).toEqual([])
  })

  it('requires the id, areas and terms to match the objective', () => {
    expect(errors({ ...SINGLE, id: '014.3-001' })).toContain('id must start with "014.2-"')
    expect(errors({ ...SINGLE, areas: ['014.3.1'] })).toContain('014.3.1 is not in 014.2')
  })

  it('requires exactly one key in single items and `select` keys in multi items', () => {
    const twoKeys = { ...SINGLE, options: SINGLE.options.map((o) => ({ ...o, correct: true })) }
    expect(errors(twoKeys)).toContain('has 4 correct options, expected 1')
    expect(errors({ ...MULTI, select: 3, stem: MULTI.stem.replace('TWO', 'THREE') })).toContain('has 2 correct options, expected 3')
  })

  it('requires multi stems to say how many to choose', () => {
    expect(errors({ ...MULTI, stem: 'Which tools install packages?' })).toContain('stem must say "(Choose TWO.)"')
  })

  it('rejects fill answers that are the same once normalised', () => {
    expect(errors({ ...FILL, accept: ['-t', ' -t '] })).toContain('has duplicate answers')
  })

  it('ties output options to the verified output', () => {
    const wrongKey = { ...OUTPUT_CHOICE, output: 'level\nboss' }
    expect(errors(wrongKey)).toContain('the correct option must equal `output`')
    expect(errors({ ...OUTPUT_CHOICE, options: undefined })).toContain('choice mode needs four options')
    expect(errors({ ...OUTPUT_TYPE, options: OUTPUT_CHOICE.options })).toContain('type mode has no options')
    expect(errors({ ...OUTPUT_TYPE, output: '' })).toContain('type mode needs a non-empty output')
  })

  it('keeps the leading spaces of output options', () => {
    const parsed = itemSchema.parse(OUTPUT_CHOICE)
    expect(parsed.kind === 'output' && parsed.options?.map((o) => o.text)).toContain('      2 boss\n      1 level')
  })

  it('normalises typed answers and outputs', () => {
    expect(normaliseAnswer('  tar   -tf  x.tar ')).toBe('tar -tf x.tar')
    expect(normaliseAnswer('/ETC', false)).toBe('/etc')
    expect(normaliseAnswer('/ETC')).toBe('/ETC')
    expect(normaliseOutput('a  \r\nb\n\n')).toBe('a\nb')
  })
})
