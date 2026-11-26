// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { CARDS } from '../content/flashcards'
import { addCards, createDeck, getProgress, resetProgress, setTrack } from '../progress/store'
import { itemInExam } from '../content/blueprint'
import { allDecks, builtInDecks, cardsFor } from './decks'
import { INTERVAL_DAYS, buildQueue, countCards, intervalLabel, rate } from './schedule'
import { deckFileName, exportDecks, importDeckFile, parseDeckFile } from './share'

const DAY = 86_400_000
const noon = new Date(2026, 10, 20, 12).getTime()
const midnight = new Date(2026, 10, 20).getTime()

beforeEach(() => {
  localStorage.clear()
  resetProgress()
})

describe('schedule', () => {
  it('moves cards up one box for Good, two for Easy, back to 0 for Again', () => {
    const first = rate(undefined, 'good', noon)
    expect(first).toEqual({ box: 1, due: midnight + DAY, reviews: 1, lapses: 0, lastAt: noon })
    const easy = rate(first, 'easy', noon)
    expect(easy).toMatchObject({ box: 3, due: midnight + INTERVAL_DAYS[3] * DAY, reviews: 2 })
    expect(rate(easy, 'again', noon)).toMatchObject({ box: 0, due: noon, lapses: 1 })
    expect(rate(first, 'again', noon).lapses, 'not yet learned, so not a lapse').toBe(0)
    let top = first
    for (let i = 0; i < 6; i++) top = rate(top, 'easy', noon)
    expect(top.box).toBe(5)
  })

  it('labels when a card comes back', () => {
    expect(intervalLabel(undefined, 'again')).toBe('now')
    expect(intervalLabel(undefined, 'good')).toBe('1 day')
    expect(intervalLabel(undefined, 'easy')).toBe('3 days')
  })

  it('queues due cards (most overdue first), then a limited number of new ones', () => {
    const stats = {
      a: { box: 1, due: noon - 2 * DAY, reviews: 1, lapses: 0, lastAt: 0 },
      b: { box: 1, due: noon + DAY, reviews: 1, lapses: 0, lastAt: 0 },
      c: { box: 2, due: noon - 5 * DAY, reviews: 2, lapses: 0, lastAt: 0 },
    }
    const ids = ['a', 'b', 'c', 'n1', 'n2', 'n3']
    expect(buildQueue(ids, stats, noon, { newLimit: 2 })).toEqual(['c', 'a', 'n1', 'n2'])
    expect(buildQueue(ids, stats, noon, { everything: true })).toEqual(ids)
    expect(countCards(ids, { ...stats, c: { ...stats.c, box: 3 } }, noon)).toEqual({ total: 6, fresh: 3, due: 2, learned: 1 })
  })
})

describe('decks', () => {
  it('has a built-in deck per topic, with the cards of the learner’s exam', () => {
    expect(builtInDecks('010-200').map((d) => d.id)).toEqual(['t011', 't012', 't013', 't014', 't015'])
    for (const exam of ['010-200', '010-160'] as const) {
      const ids = builtInDecks(exam).flatMap((d) => d.cards.map((c) => c.id))
      expect(ids).toEqual(CARDS.filter((c) => itemInExam(c, exam)).map((c) => c.id))
    }
  })

  it('selects cards by deck, by objective, or all', () => {
    const deck = createDeck('Mine')
    addCards([{ deckId: deck, front: 'Q', back: 'A' }])
    setTrack('010-200')
    const progress = getProgress()
    expect(cardsFor({ deck }, progress).map((c) => c.front)).toEqual(['Q'])
    expect(cardsFor({ objective: '013.1' }, progress).map((c) => c.id)).toEqual(CARDS.filter((c) => c.id.startsWith('013.1-')).map((c) => c.id))
    expect(cardsFor({}, progress)).toHaveLength(allDecks(progress).reduce((n, d) => n + d.cards.length, 0))
    expect(cardsFor({ deck: 'nope' }, progress)).toEqual([])
  })
})

describe('sharing', () => {
  const fileWith = (decks: unknown) => JSON.stringify({ app: 'le-010-prep', kind: 'flashcards', format: 1, decks })

  it('exports a deck and imports it back, merging by name and skipping cards it already has', () => {
    const deck = createDeck('Commands', 1)
    addCards([
      { deckId: deck, front: 'What does `pwd` print?', back: 'The current working directory.' },
      { deckId: deck, front: 'Which file lists the users?', back: '`/etc/passwd`.' },
    ])
    const file = exportDecks(getProgress().decks, getProgress().myCards, new Date(0))
    expect(JSON.parse(file).decks[0].cards[0]).toEqual({ front: 'What does `pwd` print?', back: 'The current working directory.' })

    expect(importDeckFile(file)).toEqual({ added: 0, skipped: 2, newDecks: [] })
    resetProgress()
    expect(importDeckFile(file)).toEqual({ added: 2, skipped: 0, newDecks: ['Commands'] })
    expect(getProgress().myCards.map((c) => c.back)).toEqual(['The current working directory.', '`/etc/passwd`.'])
    expect(getProgress().cards, 'review state is not shared').toEqual({})
  })

  it('skips duplicates inside one file', () => {
    const card = { front: 'Q', back: 'A' }
    expect(importDeckFile(fileWith([{ name: 'Twice', cards: [card, card] }]))).toEqual({ added: 1, skipped: 1, newDecks: ['Twice'] })
  })

  it('rejects files that are not deck files, without adding anything', () => {
    expect(() => parseDeckFile('nope')).toThrow("isn't valid JSON")
    expect(() => parseDeckFile('{"app":"le-010-prep","kind":"progress"}')).toThrow("isn't an LE-010 Prep flashcard file")
    expect(() => parseDeckFile(JSON.stringify({ app: 'le-010-prep', kind: 'flashcards', format: 2, decks: [] }))).toThrow('newer version')
    expect(() => importDeckFile(fileWith([{ name: 'Bad', cards: [{ front: ' ', back: 'A' }] }]))).toThrow('damaged')
    expect(() => importDeckFile(fileWith([{ name: 'Long', cards: [{ front: 'x'.repeat(1001), back: 'A' }] }]))).toThrow('too long')
    expect(getProgress().decks).toEqual([])
  })

  it('names download files after the deck', () => {
    expect(deckFileName('Commands & Traps!')).toBe('le-010-flashcards-commands-traps.json')
    expect(deckFileName('***')).toBe('le-010-flashcards-deck.json')
  })
})
