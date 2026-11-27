// What a terminal finally shows for a stream of output: carriage returns,
// backspaces, cursor moves and line erases are applied, so progress bars that
// redraw themselves leave only their last frame. Colours and other attributes
// are dropped. Text that a program draws between save-cursor and restore-cursor
// (ESC 7 … ESC 8), such as apt's and apk's status line at the bottom of the
// screen, is left out, since it disappears when the program ends. Lines don't
// wrap: the screen is as wide as its longest line.

const ESC = '\x1b'

export function renderScreen(text: string): string {
  const lines: string[][] = [[]]
  let row = 0
  let col = 0
  const line = () => (lines[row] ??= [])
  const moveTo = (r: number) => {
    row = Math.max(0, r)
    while (lines.length <= row) lines.push([])
  }

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!
    if (ch === ESC) {
      const next = text[i + 1]
      if (next === '7') {
        // Skip to the matching restore: whatever is drawn in between is a status line.
        const end = text.indexOf(`${ESC}8`, i + 2)
        i = end < 0 ? text.length : end + 1
        continue
      }
      if (next === '[') {
        const m = /^\[([0-?]*)[ -/]*([@-~])/.exec(text.slice(i + 1))
        if (!m) continue
        i += m[0].length
        const n = Number.parseInt(m[1]!.replace(/^\?/, ''), 10)
        const count = Number.isNaN(n) || n === 0 ? 1 : n
        switch (m[2]) {
          case 'A':
            moveTo(row - count)
            break
          case 'B':
            moveTo(row + count)
            break
          case 'C':
            col += count
            break
          case 'D':
            col = Math.max(0, col - count)
            break
          case 'G':
            col = count - 1
            break
          case 'K':
            if (m[1] === '2') lines[row] = []
            else if (m[1] === '1') lines[row] = line().map((c, k) => (k <= col ? ' ' : c))
            else line().length = Math.min(line().length, col)
            break
        }
        continue
      }
      if (next === ']') {
        // A title (OSC), ended by BEL or ESC \.
        // eslint-disable-next-line no-control-regex
        const m = /^\][^\x07\x1b]*(\x07|\x1b\\)?/.exec(text.slice(i + 1))
        i += m ? m[0].length : 1
        continue
      }
      if (next === '(' || next === ')') i += 2
      else i += 1
      continue
    }
    if (ch === '\r') col = 0
    else if (ch === '\n') {
      moveTo(row + 1)
      col = 0
    } else if (ch === '\b') col = Math.max(0, col - 1)
    else if (ch === '\x07' || ch < ' ') continue
    else {
      const l = line()
      while (l.length < col) l.push(' ')
      l[col++] = ch
    }
  }
  return lines
    .map((l) => l.join('').replace(/\s+$/, ''))
    .join('\n')
    .replace(/\n+$/, '')
}
