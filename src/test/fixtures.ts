// One valid item per kind (output in both modes), for schema, quality and engine tests.
import type { Item } from '../content/schema'

const opt = (text: string, correct = false) => ({ text, correct, rationale: `Why "${text}" ${correct ? 'fits' : 'misses'}.` })

export const SINGLE: Extract<Item, { kind: 'single' }> = {
  id: '014.2-001',
  objectiveId: '014.2',
  kind: 'single',
  areas: ['014.2.2'],
  terms: ['014.2.t7'],
  stem: 'Which device discards everything written to it?',
  options: [opt('`/dev/null`', true), opt('`/dev/zero`'), opt('`/dev/urandom`'), opt('`/dev/sda`')],
  explanation: 'Writes to /dev/null succeed and the data is thrown away.',
}

export const MULTI: Extract<Item, { kind: 'multi' }> = {
  id: '011.2-001',
  objectiveId: '011.2',
  kind: 'multi',
  areas: ['011.2.6'],
  stem: 'Which tools install packages on Enterprise Linux-based distributions? (Choose TWO.)',
  select: 2,
  options: [opt('`dnf`', true), opt('`rpm`', true), opt('`apt`'), opt('`zypper`'), opt('`apk`')],
  explanation: 'dnf resolves dependencies from repositories; rpm installs single package files.',
}

export const FILL: Extract<Item, { kind: 'fill' }> = {
  id: '013.1-001',
  objectiveId: '013.1',
  kind: 'fill',
  areas: ['013.1.2'],
  stem: 'Which `tar` option lists the contents of an archive without extracting it? Type the short option.',
  accept: ['-t', 't'],
  caseSensitive: true,
  explanation: '-t (or --list) lists the members of an archive.',
}

export const OUTPUT_CHOICE: Extract<Item, { kind: 'output' }> = {
  id: '013.2-001',
  objectiveId: '013.2',
  kind: 'output',
  areas: ['013.2.1'],
  stem: 'What does this command print?',
  command: "printf 'boss\\nlevel\\nboss\\n' | sort | uniq",
  output: 'boss\nlevel',
  mode: 'choice',
  options: [opt('boss\nlevel', true), opt('boss\nlevel\nboss'), opt('level\nboss'), opt('      2 boss\n      1 level')],
  explanation: 'sort puts the two boss lines next to each other, so uniq drops the repeat.',
}

export const OUTPUT_TYPE: Extract<Item, { kind: 'output' }> = {
  id: '012.1-001',
  objectiveId: '012.1',
  kind: 'output',
  areas: ['012.1.4'],
  stem: 'Type what this command prints.',
  command: `x=Pixel; echo "$x and '$x'"`,
  output: "Pixel and 'Pixel'",
  mode: 'type',
  explanation: 'Inside double quotes, single quotes are ordinary characters, so both $x expand.',
}

export const FIXTURES: Item[] = [SINGLE, MULTI, FILL, OUTPUT_CHOICE, OUTPUT_TYPE]
