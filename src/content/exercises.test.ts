// Integrity of the terminal exercises. Whether each check passes once solved and
// fails before is proved by content:verify (verify.test.ts checks its records).
import { describe, expect, it } from 'vitest'
import { AREA_BY_ID, EXAM_IDS, OBJECTIVE_BY_ID, itemInExam } from './blueprint'
import { exerciseFileSchema, parseCheck } from './exercise'
import { EXERCISES, EXERCISE_FILES } from './exercises'
import { FIXTURES } from './fixtureBank'

describe('exercises', () => {
  it.each(Object.keys(EXERCISE_FILES))('%s.json is valid and holds only its own objective', (objectiveId) => {
    expect(OBJECTIVE_BY_ID.has(objectiveId)).toBe(true)
    for (const ex of exerciseFileSchema.parse(EXERCISE_FILES[objectiveId])) expect(ex.objectiveId).toBe(objectiveId)
  })

  it('has unique ids', () => {
    expect(new Set(EXERCISES.map((e) => e.id)).size).toBe(EXERCISES.length)
  })

  it('tags areas of its own objective, on at least one exam', () => {
    for (const ex of EXERCISES) {
      for (const a of ex.areas) expect(AREA_BY_ID.has(a) && a.startsWith(`${ex.objectiveId}.`), `${ex.id}: ${a}`).toBe(true)
      expect(EXAM_IDS.some((e) => itemInExam(ex, e)), ex.id).toBe(true)
    }
  })

  it('starts from fixtures that exist', () => {
    expect(EXERCISES.filter((ex) => ex.fixture && !FIXTURES[ex.fixture]).map((ex) => ex.id)).toEqual([])
  })

  it('uses only the markup Inline renders (code, no bold or italics)', () => {
    for (const ex of EXERCISES) for (const text of [ex.prompt, ...ex.hints]) expect(/\*\*|__/.test(text), ex.id).toBe(false)
  })

  it('keeps backticks out of checks, where bash would run them', () => {
    for (const ex of EXERCISES) expect(ex.check.includes('`'), ex.id).toBe(false)
  })
})

describe('parseCheck', () => {
  it('splits met and unmet requirements from anything else', () => {
    expect(parseCheck(1, '✓ a.txt exists.\n✗ It is empty.\nbash: line 3: oops\n')).toEqual({
      passed: false,
      rows: [
        { passed: true, text: 'a.txt exists.' },
        { passed: false, text: 'It is empty.' },
      ],
      other: 'bash: line 3: oops',
    })
    expect(parseCheck(0, '✓ Done.').passed).toBe(true)
  })
})
