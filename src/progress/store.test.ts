// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { masteryOf } from './readiness'
import {
  exportProgress,
  getProgress,
  importProgress,
  recordAnswer,
  recordMockResult,
  reloadProgress,
  resetProgress,
  setLessonRead,
  setTrack,
  setToggle,
} from './store'

beforeEach(() => {
  localStorage.clear()
  resetProgress()
})

describe('progress store', () => {
  it('records attempts with a streak that a wrong answer resets', () => {
    recordAnswer('013.2-001', true, 1)
    recordAnswer('013.2-001', true, 2)
    expect(getProgress().items['013.2-001']).toMatchObject({ attempts: 2, correct: 2, streak: 2 })
    recordAnswer('013.2-001', false, 3)
    expect(getProgress().items['013.2-001']).toMatchObject({ attempts: 3, correct: 2, streak: 0, lastCorrect: false })
  })

  it('persists to localStorage and survives a reload', () => {
    recordAnswer('011.1-001', true)
    setToggle('outputInMock', true)
    reloadProgress()
    expect(getProgress().items['011.1-001']?.attempts).toBe(1)
    expect(getProgress().outputInMock).toBe(true)
  })

  it('starts with output items in practice and out of the mock', () => {
    expect(getProgress()).toMatchObject({ outputInPractice: true, outputInMock: false })
  })

  it('discards unreadable or other-version data', () => {
    localStorage.setItem('le010:progress', '{not json')
    reloadProgress()
    expect(getProgress().items).toEqual({})
    localStorage.setItem('le010:progress', JSON.stringify({ version: 99, items: { a: 1 } }))
    reloadProgress()
    expect(getProgress().items).toEqual({})
  })

  it('migrates version 1 (no exam track) to 010-200, keeping answers and mock results', () => {
    const v1 = { version: 1, outputInPractice: false, outputInMock: false, items: { '012.1-001': { attempts: 2, correct: 1, lastCorrect: true, lastAt: 5, streak: 1 } }, mockResults: [{ at: 1, output: false, correct: 30, total: 40, percent: 75, scaled: 578, passed: true, topics: [] }], lessonsRead: ['012.3'] }
    localStorage.setItem('le010:progress', JSON.stringify(v1))
    reloadProgress()
    expect(getProgress().track).toBe('010-200')
    expect(getProgress().items['012.1-001']?.attempts).toBe(2)
    expect(getProgress().mockResults[0]?.exam).toBe('010-200')
    expect(getProgress().outputInPractice).toBe(false)
    importProgress(JSON.stringify({ app: 'le-010-prep', progress: v1 }))
    expect(getProgress().mockResults[0]?.exam).toBe('010-200')
  })

  it('switches the exam track and keeps it', () => {
    expect(getProgress().track).toBe('010-200')
    setTrack('010-160')
    reloadProgress()
    expect(getProgress().track).toBe('010-160')
  })

  it('marks lessons read and unread', () => {
    setLessonRead('012.1', true)
    setLessonRead('013.3', true)
    setLessonRead('012.1', false)
    expect(getProgress().lessonsRead).toEqual(['013.3'])
  })

  it('round-trips an export and rejects files that are not exports', () => {
    recordAnswer('015.3-001', true)
    recordMockResult({ at: 1, exam: '010-200', output: false, correct: 30, total: 40, percent: 75, scaled: 578, passed: true, topics: [{ id: '011', correct: 5, total: 7 }] })
    const file = exportProgress()
    resetProgress()
    importProgress(file)
    expect(getProgress().items['015.3-001']?.attempts).toBe(1)
    expect(getProgress().mockResults).toHaveLength(1)
    expect(() => importProgress('nope')).toThrow(/valid JSON/)
    expect(() => importProgress('{"app":"other","progress":{}}')).toThrow(/LE-010 Prep/)
    expect(() => importProgress('{"app":"le-010-prep","progress":{"version":3}}')).toThrow(/newer version/)
    expect(() => importProgress('{"app":"le-010-prep","progress":{"version":1,"items":{"x":{"attempts":-1}}}}')).toThrow(/damaged/)
  })

  it('derives mastery from the latest answer and past misses', () => {
    expect(masteryOf(undefined)).toBe('untested')
    recordAnswer('a', false)
    expect(masteryOf(getProgress().items.a)).toBe('recentError')
    recordAnswer('a', true)
    expect(masteryOf(getProgress().items.a)).toBe('reviewed')
    recordAnswer('b', true)
    expect(masteryOf(getProgress().items.b)).toBe('alwaysCorrect')
  })
})
