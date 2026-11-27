import { describe, expect, it } from 'vitest'
import regexJson from '../../content/sims/regex.json'
import { MAX_PATTERN, check, grepCommand, paramsSchema, run } from './model'

// The log the cases below ran against, as the guest's build.log.
const LOG = [
  '09:00:01 INFO  build started for pixel-raiders 1.4.2',
  '09:00:03 INFO  compiling sprites: 128 files',
  '09:00:09 WARN  goblin.png is 3 pixels too wide',
  '09:00:12 INFO  compiling levels: 7 files',
  '09:00:15 ERROR level7.map: missing tile slime',
  '09:00:16 ERROR level9.map: missing tile slyme',
  '09:00:20 WARN  boss-theme.ogg is 2.1 MB, limit is 2 MB',
  '09:00:24 INFO  packing assets into pixel-raiders-1.4.2.tar.gz',
  '09:00:31 ERROR disk almost full on /dev/sda1',
  '09:00:35 INFO  tested bat, ghost and ghosts: all spawn',
  '09:00:40 INFO  build finished in 39 s with 3 errors',
]

// Each row was run in the guest with `grep -nE -e PATTERN build.log` (the line numbers
// grep prints) and `grep -noE -e PATTERN build.log` (the matches it highlights).
// Format: [pattern, line numbers, [line number, matched text][]].
const GUEST: [string, number[], [number, string][]][] = [
  ["ERROR", [5,6,9], [[5,"ERROR"],[6,"ERROR"],[9,"ERROR"]]],
  ["ERROR|WARN", [3,5,6,7,9], [[3,"WARN"],[5,"ERROR"],[6,"ERROR"],[7,"WARN"],[9,"ERROR"]]],
  ["sl.me", [5,6], [[5,"slime"],[6,"slyme"]]],
  ["sl[iy]me", [5,6], [[5,"slime"],[6,"slyme"]]],
  ["ghosts?", [10], [[10,"ghost"],[10,"ghosts"]]],
  ["[0-9]+ files", [2,4], [[2,"128 files"],[4,"7 files"]]],
  ["files$", [2,4], [[2,"files"],[4,"files"]]],
  ["^09:00:[0-2][0-9] ERROR", [5,6], [[5,"09:00:15 ERROR"],[6,"09:00:16 ERROR"]]],
  ["1\\.4\\.2", [1,8], [[1,"1.4.2"],[8,"1.4.2"]]],
  ["1.4.2", [1,8], [[1,"1.4.2"],[8,"1.4.2"]]],
  ["sl[^i]me", [6], [[6,"slyme"]]],
  ["^[IW]", [], []],
  ["b[a-z]+t", [10], [[10,"bat"]]],
  ["(ERROR|WARN) .*e", [3,5,6,7,9], [[3,"WARN  goblin.png is 3 pixels too wide"],[5,"ERROR level7.map: missing tile slime"],[6,"ERROR level9.map: missing tile slyme"],[7,"WARN  boss-theme"],[9,"ERROR disk almost full on /de"]]],
  ["o*", [1,2,3,4,5,6,7,8,9,10,11], [[1,"o"],[2,"o"],[3,"o"],[3,"oo"],[4,"o"],[7,"o"],[7,"o"],[8,"o"],[9,"o"],[9,"o"],[10,"o"],[10,"o"],[11,"o"]]],
  ["ERR.*R", [5,6,9], [[5,"ERROR"],[6,"ERROR"],[9,"ERROR"]]],
  [".", [1,2,3,4,5,6,7,8,9,10,11], [[1,"0"],[1,"9"],[1,":"],[1,"0"],[1,"0"],[1,":"],[1,"0"],[1,"1"],[1," "],[1,"I"],[1,"N"],[1,"F"],[1,"O"],[1," "],[1," "],[1,"b"],[1,"u"],[1,"i"],[1,"l"],[1,"d"],[1," "],[1,"s"],[1,"t"],[1,"a"],[1,"r"],[1,"t"],[1,"e"],[1,"d"],[1," "],[1,"f"],[1,"o"],[1,"r"],[1," "],[1,"p"],[1,"i"],[1,"x"],[1,"e"],[1,"l"],[1,"-"],[1,"r"],[1,"a"],[1,"i"],[1,"d"],[1,"e"],[1,"r"],[1,"s"],[1," "],[1,"1"],[1,"."],[1,"4"],[1,"."],[1,"2"],[2,"0"],[2,"9"],[2,":"],[2,"0"],[2,"0"],[2,":"],[2,"0"],[2,"3"],[2," "],[2,"I"],[2,"N"],[2,"F"],[2,"O"],[2," "],[2," "],[2,"c"],[2,"o"],[2,"m"],[2,"p"],[2,"i"],[2,"l"],[2,"i"],[2,"n"],[2,"g"],[2," "],[2,"s"],[2,"p"],[2,"r"],[2,"i"],[2,"t"],[2,"e"],[2,"s"],[2,":"],[2," "],[2,"1"],[2,"2"],[2,"8"],[2," "],[2,"f"],[2,"i"],[2,"l"],[2,"e"],[2,"s"],[3,"0"],[3,"9"],[3,":"],[3,"0"],[3,"0"],[3,":"],[3,"0"],[3,"9"],[3," "],[3,"W"],[3,"A"],[3,"R"],[3,"N"],[3," "],[3," "],[3,"g"],[3,"o"],[3,"b"],[3,"l"],[3,"i"],[3,"n"],[3,"."],[3,"p"],[3,"n"],[3,"g"],[3," "],[3,"i"],[3,"s"],[3," "],[3,"3"],[3," "],[3,"p"],[3,"i"],[3,"x"],[3,"e"],[3,"l"],[3,"s"],[3," "],[3,"t"],[3,"o"],[3,"o"],[3," "],[3,"w"],[3,"i"],[3,"d"],[3,"e"],[4,"0"],[4,"9"],[4,":"],[4,"0"],[4,"0"],[4,":"],[4,"1"],[4,"2"],[4," "],[4,"I"],[4,"N"],[4,"F"],[4,"O"],[4," "],[4," "],[4,"c"],[4,"o"],[4,"m"],[4,"p"],[4,"i"],[4,"l"],[4,"i"],[4,"n"],[4,"g"],[4," "],[4,"l"],[4,"e"],[4,"v"],[4,"e"],[4,"l"],[4,"s"],[4,":"],[4," "],[4,"7"],[4," "],[4,"f"],[4,"i"],[4,"l"],[4,"e"],[4,"s"],[5,"0"],[5,"9"],[5,":"],[5,"0"],[5,"0"],[5,":"],[5,"1"],[5,"5"],[5," "],[5,"E"],[5,"R"],[5,"R"],[5,"O"],[5,"R"],[5," "],[5,"l"],[5,"e"],[5,"v"],[5,"e"],[5,"l"],[5,"7"],[5,"."],[5,"m"],[5,"a"],[5,"p"],[5,":"],[5," "],[5,"m"],[5,"i"],[5,"s"],[5,"s"],[5,"i"],[5,"n"],[5,"g"],[5," "],[5,"t"],[5,"i"],[5,"l"],[5,"e"],[5," "],[5,"s"],[5,"l"],[5,"i"],[5,"m"],[5,"e"],[6,"0"],[6,"9"],[6,":"],[6,"0"],[6,"0"],[6,":"],[6,"1"],[6,"6"],[6," "],[6,"E"],[6,"R"],[6,"R"],[6,"O"],[6,"R"],[6," "],[6,"l"],[6,"e"],[6,"v"],[6,"e"],[6,"l"],[6,"9"],[6,"."],[6,"m"],[6,"a"],[6,"p"],[6,":"],[6," "],[6,"m"],[6,"i"],[6,"s"],[6,"s"],[6,"i"],[6,"n"],[6,"g"],[6," "],[6,"t"],[6,"i"],[6,"l"],[6,"e"],[6," "],[6,"s"],[6,"l"],[6,"y"],[6,"m"],[6,"e"],[7,"0"],[7,"9"],[7,":"],[7,"0"],[7,"0"],[7,":"],[7,"2"],[7,"0"],[7," "],[7,"W"],[7,"A"],[7,"R"],[7,"N"],[7," "],[7," "],[7,"b"],[7,"o"],[7,"s"],[7,"s"],[7,"-"],[7,"t"],[7,"h"],[7,"e"],[7,"m"],[7,"e"],[7,"."],[7,"o"],[7,"g"],[7,"g"],[7," "],[7,"i"],[7,"s"],[7," "],[7,"2"],[7,"."],[7,"1"],[7," "],[7,"M"],[7,"B"],[7,","],[7," "],[7,"l"],[7,"i"],[7,"m"],[7,"i"],[7,"t"],[7," "],[7,"i"],[7,"s"],[7," "],[7,"2"],[7," "],[7,"M"],[7,"B"],[8,"0"],[8,"9"],[8,":"],[8,"0"],[8,"0"],[8,":"],[8,"2"],[8,"4"],[8," "],[8,"I"],[8,"N"],[8,"F"],[8,"O"],[8," "],[8," "],[8,"p"],[8,"a"],[8,"c"],[8,"k"],[8,"i"],[8,"n"],[8,"g"],[8," "],[8,"a"],[8,"s"],[8,"s"],[8,"e"],[8,"t"],[8,"s"],[8," "],[8,"i"],[8,"n"],[8,"t"],[8,"o"],[8," "],[8,"p"],[8,"i"],[8,"x"],[8,"e"],[8,"l"],[8,"-"],[8,"r"],[8,"a"],[8,"i"],[8,"d"],[8,"e"],[8,"r"],[8,"s"],[8,"-"],[8,"1"],[8,"."],[8,"4"],[8,"."],[8,"2"],[8,"."],[8,"t"],[8,"a"],[8,"r"],[8,"."],[8,"g"],[8,"z"],[9,"0"],[9,"9"],[9,":"],[9,"0"],[9,"0"],[9,":"],[9,"3"],[9,"1"],[9," "],[9,"E"],[9,"R"],[9,"R"],[9,"O"],[9,"R"],[9," "],[9,"d"],[9,"i"],[9,"s"],[9,"k"],[9," "],[9,"a"],[9,"l"],[9,"m"],[9,"o"],[9,"s"],[9,"t"],[9," "],[9,"f"],[9,"u"],[9,"l"],[9,"l"],[9," "],[9,"o"],[9,"n"],[9," "],[9,"/"],[9,"d"],[9,"e"],[9,"v"],[9,"/"],[9,"s"],[9,"d"],[9,"a"],[9,"1"],[10,"0"],[10,"9"],[10,":"],[10,"0"],[10,"0"],[10,":"],[10,"3"],[10,"5"],[10," "],[10,"I"],[10,"N"],[10,"F"],[10,"O"],[10," "],[10," "],[10,"t"],[10,"e"],[10,"s"],[10,"t"],[10,"e"],[10,"d"],[10," "],[10,"b"],[10,"a"],[10,"t"],[10,","],[10," "],[10,"g"],[10,"h"],[10,"o"],[10,"s"],[10,"t"],[10," "],[10,"a"],[10,"n"],[10,"d"],[10," "],[10,"g"],[10,"h"],[10,"o"],[10,"s"],[10,"t"],[10,"s"],[10,":"],[10," "],[10,"a"],[10,"l"],[10,"l"],[10," "],[10,"s"],[10,"p"],[10,"a"],[10,"w"],[10,"n"],[11,"0"],[11,"9"],[11,":"],[11,"0"],[11,"0"],[11,":"],[11,"4"],[11,"0"],[11," "],[11,"I"],[11,"N"],[11,"F"],[11,"O"],[11," "],[11," "],[11,"b"],[11,"u"],[11,"i"],[11,"l"],[11,"d"],[11," "],[11,"f"],[11,"i"],[11,"n"],[11,"i"],[11,"s"],[11,"h"],[11,"e"],[11,"d"],[11," "],[11,"i"],[11,"n"],[11," "],[11,"3"],[11,"9"],[11," "],[11,"s"],[11," "],[11,"w"],[11,"i"],[11,"t"],[11,"h"],[11," "],[11,"3"],[11," "],[11,"e"],[11,"r"],[11,"r"],[11,"o"],[11,"r"],[11,"s"]]],
  ["x*y", [6], [[6,"y"]]],
  ["ERROR$|^09", [1,2,3,4,5,6,7,8,9,10,11], [[1,"09"],[2,"09"],[3,"09"],[4,"09"],[5,"09"],[6,"09"],[7,"09"],[8,"09"],[9,"09"],[10,"09"],[11,"09"]]],
  ["slim?e", [5], [[5,"slime"]]],
  ["e.*e", [1,2,3,4,5,6,7,8,10,11], [[1,"ed for pixel-raide"],[2,"es: 128 file"],[3,"els too wide"],[4,"evels: 7 file"],[5,"evel7.map: missing tile slime"],[6,"evel9.map: missing tile slyme"],[7,"eme"],[8,"ets into pixel-raide"],[10,"este"],[11,"ed in 39 s with 3 e"]]],
  ["[a-c][0-9]", [9], [[9,"a1"]]],
  ["\\[", [], []],
  ["a|b", [1,3,5,6,7,8,9,10,11], [[1,"b"],[1,"a"],[1,"a"],[3,"b"],[5,"a"],[6,"a"],[7,"b"],[8,"a"],[8,"a"],[8,"a"],[8,"a"],[9,"a"],[9,"a"],[10,"b"],[10,"a"],[10,"a"],[10,"a"],[10,"a"],[11,"b"]]],
  ["^$", [], []],
]

const params = paramsSchema.parse(regexJson.params)

function outcome(pattern: string) {
  const r = run(pattern, LOG)
  if ('error' in r) throw new Error(r.error)
  return {
    lines: r.lines.filter((l) => l.matched).map((l) => l.n),
    hits: r.lines.flatMap((l) => l.segments.filter((s) => s.hit).map((s): [number, string] => [l.n, s.text])),
  }
}

describe('regex model against grep -E in the guest', () => {
  it('uses the log the cases were recorded with', () => {
    expect(params.log).toEqual(LOG)
  })

  it.each(GUEST)('%s selects the lines and highlights the matches grep does', (pattern, lines, hits) => {
    expect(outcome(pattern)).toEqual({ lines, hits })
  })

  it('has a guest recording for every preset', () => {
    const recorded = new Set(GUEST.map((g) => g[0]))
    expect(params.presets.filter((p) => !recorded.has(p.pattern)).map((p) => p.pattern)).toEqual([])
  })

  it('accepts every preset', () => {
    expect(params.presets.filter((p) => !check(p.pattern).ok).map((p) => p.pattern)).toEqual([])
  })

  it('shows the grep command', () => {
    expect(grepCommand('ERROR|WARN', 'build.log')).toBe("grep -E 'ERROR|WARN' build.log")
  })
})

describe('regex syntax checks', () => {
  it.each(['ERROR', 'a*', 'a+b?', '^x$', '(ab)?c', '(a|b)c', '[^a-c]x', '[a-]', '[-a]', 'a\\.b', 'a\\\\b', '\\(', ''])('accepts %s', (p) => {
    expect(check(p)).toEqual({ ok: true })
  })

  it.each([
    ['*a', /cannot come first/],
    ['+', /cannot come first/],
    ['a**', /Two repeat/],
    ['a+?', /Two repeat/],
    ['^*', /anchor/],
    ['(ab)*', /whole group/],
    ['\\d', /different things/],
    ['\\w+', /different things/],
    ['a\\', /backslash/],
    ['[abc', /no closing/],
    ['[]', /empty set|no closing/],
    ['[z-a]', /backwards/],
    ['[[:alpha:]]', /class/],
    ['[\\d]', /backslash/],
    ['a{2}', /Interval/],
    ['(a', /no closing/],
    ['a)', /no matching/],
    ['()', /empty group/],
    ['a|', /both sides/],
    ['|a', /both sides/],
    ['(a|)', /empty/],
    ["it's", /quote/],
    ['é', /ASCII/],
    ['a'.repeat(MAX_PATTERN + 1), /under/],
  ])('rejects %s with a helpful message', (p, message) => {
    const r = check(p)
    expect(r.ok).toBe(false)
    expect(r.ok ? '' : r.error).toMatch(message)
  })

  it('reports an error instead of lines for a rejected pattern', () => {
    expect(run('*a', LOG)).toHaveProperty('error')
  })
})

describe('leftmost-longest highlighting', () => {
  // The first alternative that matches wins in JavaScript; POSIX takes the longest.
  // Recorded in the guest: `echo abcd | grep -oE 'ab|abcd'` prints abcd.
  it('prefers the longest alternative, as grep does', () => {
    const r = run('ab|abcd', ['abcd'])
    expect('lines' in r && r.lines[0]!.segments).toEqual([{ text: 'abcd', hit: true }])
  })

  it('skips empty matches and never highlights an empty pattern', () => {
    const r = run('', ['abc'])
    expect('lines' in r && r.lines[0]).toMatchObject({ matched: true, segments: [{ text: 'abc', hit: false }] })
  })
})
