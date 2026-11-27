import { describe, expect, it } from 'vitest'
import content from '../../content/sims/distros.json'
import { familyTree, lineage, paramsSchema } from './model'

const p = paramsSchema.parse(content.params)

describe('distribution tree', () => {
  it('chains Fedora, CentOS Stream and RHEL, with AlmaLinux and Rocky below RHEL', () => {
    expect(lineage(p.distros, 'almalinux')).toEqual(['almalinux', 'rhel', 'centos-stream', 'fedora'])
    expect(lineage(p.distros, 'rocky')).toEqual(['rocky', 'rhel', 'centos-stream', 'fedora'])
  })
  it('puts Ubuntu and Raspberry Pi OS under Debian, Leap under SLE and the stable Alpine branch under edge', () => {
    expect(lineage(p.distros, 'linux-mint')).toEqual(['linux-mint', 'ubuntu', 'debian'])
    expect(lineage(p.distros, 'raspberry-pi-os')).toEqual(['raspberry-pi-os', 'debian'])
    expect(lineage(p.distros, 'leap')).toEqual(['leap', 'sle'])
    expect(lineage(p.distros, 'alpine')).toEqual(['alpine', 'alpine-edge'])
  })
  it('lays every distribution into exactly one family tree', () => {
    const seen = p.families.flatMap((f) => {
      const walk = (n: ReturnType<typeof familyTree>[number]): string[] => [n.distro.id, ...n.children.flatMap(walk)]
      return familyTree(p.distros, f.id).flatMap(walk)
    })
    expect(seen.sort()).toEqual(p.distros.map((d) => d.id).sort())
  })
  it('names the package tools of the four exam families', () => {
    const tools = Object.fromEntries(p.families.map((f) => [f.id, f.tools]))
    expect(tools.debian).toMatch(/apt/)
    expect(tools.enterprise).toMatch(/dnf/)
    expect(tools.suse).toMatch(/zypper/)
    expect(tools.alpine).toMatch(/apk/)
  })
  it('marks the rolling releases of the objectives as rolling', () => {
    const rolling = p.distros.filter((d) => d.model === 'rolling').map((d) => d.id)
    expect(rolling).toEqual(expect.arrayContaining(['tumbleweed', 'alpine-edge']))
  })
})
