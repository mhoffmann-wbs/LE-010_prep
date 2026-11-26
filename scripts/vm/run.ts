// Runs one command in the guest (v86 in Node) the way a lesson cell does and
// prints what it printed and its exit status: for trying things out while
// writing content. Only content:verify's records count as proof.
//
//   npm run vm:run -- 'ls -l assets'
//   npm run vm:run -- --fixture assets --user jonas 'ls ~mira'
import { parseArgs } from 'node:util'
import { USERS, type User } from '../../src/vm/job.ts'
import { loadFixtures } from '../content-load.ts'
import { guestBuilt, restoreGuest } from './guest.ts'

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { fixture: { type: 'string' }, user: { type: 'string' } },
})
const command = positionals.join(' ')
if (!command) {
  console.error("Usage: npm run vm:run -- [--fixture name] [--user jonas] 'command'")
  process.exit(2)
}
if (!guestBuilt()) {
  console.error('No guest in public/vm/. Run npm run vm:build, then npm run vm:state.')
  process.exit(1)
}
if (values.user && !(USERS as readonly string[]).includes(values.user)) {
  console.error(`Unknown user "${values.user}" (${USERS.join(', ')})`)
  process.exit(2)
}
const fixtures = loadFixtures()
if (values.fixture && !fixtures[values.fixture]) {
  console.error(`Unknown fixture "${values.fixture}" (${Object.keys(fixtures).join(', ')})`)
  process.exit(2)
}

const { emulator, runner } = await restoreGuest()
const result = await runner.run({ command, user: values.user as User | undefined, fixture: values.fixture ? fixtures[values.fixture] : undefined })
console.log(result.output)
console.log(`--- exit ${result.exit}`)
emulator.destroy()
process.exit(0)
