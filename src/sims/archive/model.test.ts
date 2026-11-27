import { describe, expect, it } from 'vitest'
import { type Options, buildCommand, matchesTask } from './model'

const params = { destination: 'out', file: 'level1.txt' }
const assets = { path: 'assets/', base: 'assets' }
const sprites = { path: 'assets/sprites/', base: 'sprites' }
const o = (tool: Options['tool'], action: Options['action'], compression: Options['compression'], extra: Partial<Options> = {}): Options => ({
  tool,
  action,
  compression,
  verbose: false,
  elsewhere: false,
  ...extra,
})

// Every command here was run in the guest (the assets fixture, as mira) and exited 0:
// the creating ones from a clean folder, the listing and extracting ones on
// archives made by the creating ones. unzip needs the target files absent, or it asks
// before overwriting.
describe('archive model', () => {
  it.each([
    [o('tar', 'create', 'none'), assets, 'tar -cf assets.tar assets/', '.tar'],
    [o('tar', 'create', 'gzip'), assets, 'tar -czf assets.tar.gz assets/', '.tar.gz'],
    [o('tar', 'create', 'bzip2'), assets, 'tar -cjf assets.tar.bz2 assets/', '.tar.bz2'],
    [o('tar', 'create', 'xz'), assets, 'tar -cJf assets.tar.xz assets/', '.tar.xz'],
    [o('tar', 'create', 'gzip', { verbose: true }), sprites, 'tar -cvzf sprites.tar.gz assets/sprites/', '.tar.gz'],
    [o('tar', 'list', 'gzip'), assets, 'tar -tzf assets.tar.gz', '.tar.gz'],
    [o('tar', 'list', 'none'), assets, 'tar -tf assets.tar', '.tar'],
    [o('tar', 'list', 'bzip2', { verbose: true }), sprites, 'tar -tvjf sprites.tar.bz2', '.tar.bz2'],
    [o('tar', 'extract', 'xz'), assets, 'tar -xJf assets.tar.xz', '.tar.xz'],
    [o('tar', 'extract', 'gzip', { elsewhere: true }), assets, 'tar -xzf assets.tar.gz -C out', '.tar.gz'],
    [o('zip', 'create', 'none'), assets, 'zip -r assets.zip assets/', '.zip'],
    [o('zip', 'create', 'xz'), sprites, 'zip -r sprites.zip assets/sprites/', '.zip'],
    [o('zip', 'list', 'none'), assets, 'unzip -l assets.zip', '.zip'],
    [o('zip', 'extract', 'none'), assets, 'unzip assets.zip', '.zip'],
    [o('zip', 'extract', 'none', { elsewhere: true }), assets, 'unzip assets.zip -d out', '.zip'],
    [o('single', 'create', 'gzip'), assets, 'gzip -k level1.txt', '.gz'],
    [o('single', 'create', 'bzip2'), assets, 'bzip2 -k level1.txt', '.bz2'],
    [o('single', 'create', 'xz'), assets, 'xz -k level1.txt', '.xz'],
    [o('single', 'list', 'gzip'), assets, 'gzip -l level1.txt.gz', '.gz'],
    [o('single', 'list', 'xz'), assets, 'xz -l level1.txt.xz', '.xz'],
    [o('single', 'list', 'bzip2'), assets, 'bzip2 -tv level1.txt.bz2', '.bz2'],
    [o('single', 'extract', 'gzip'), assets, 'gzip -dk level1.txt.gz', '.gz'],
    [o('single', 'extract', 'bzip2'), assets, 'bzip2 -dk level1.txt.bz2', '.bz2'],
    [o('single', 'extract', 'none'), assets, 'gzip -dk level1.txt.gz', '.gz'],
  ])('%j builds the recorded command', (opts, src, command, extension) => {
    const built = buildCommand(opts, src, params)
    expect(built.command).toBe(command)
    expect(built.extension).toBe(extension)
    expect(command.includes(built.archive) || command.endsWith(built.archive.replace(extension, ''))).toBe(true)
  })

  it('adds the compression letter to every tar action and mentions auto-detection', () => {
    expect(buildCommand(o('tar', 'extract', 'gzip'), assets, params).note).toMatch(/detects/)
    expect(buildCommand(o('tar', 'create', 'gzip'), assets, params).note).toBeUndefined()
  })

  it('explains every part of a tar command', () => {
    const built = buildCommand(o('tar', 'create', 'gzip', { verbose: true }), assets, params)
    expect(built.parts.map((p) => p.text)).toEqual(['tar', '-c', 'v', 'z', 'f', 'assets.tar.gz', 'assets/'])
  })

  it('matches tasks by tool, action and (for tar and single) compression', () => {
    expect(matchesTask(o('tar', 'create', 'gzip'), { tool: 'tar', action: 'create', compression: 'gzip' })).toBe(true)
    expect(matchesTask(o('tar', 'create', 'xz'), { tool: 'tar', action: 'create', compression: 'gzip' })).toBe(false)
    expect(matchesTask(o('tar', 'list', 'gzip'), { tool: 'tar', action: 'create', compression: 'gzip' })).toBe(false)
    expect(matchesTask(o('zip', 'create', 'xz'), { tool: 'zip', action: 'create', compression: 'none' })).toBe(true)
  })
})
