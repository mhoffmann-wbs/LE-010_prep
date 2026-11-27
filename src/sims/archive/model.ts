// Archive chooser: builds the `tar`, `zip` or single-file compressor command for
// an action, a compression and a few options, with its conventional file
// extension and what each part does. Every command it can produce was run in
// the guest (see model.test.ts).
import { z } from 'zod'

const nonEmpty = z.string().trim().min(1)

export const TOOLS = ['tar', 'zip', 'single'] as const
export type Tool = (typeof TOOLS)[number]
export const ACTIONS = ['create', 'list', 'extract'] as const
export type Action = (typeof ACTIONS)[number]
export const COMPRESSIONS = ['none', 'gzip', 'bzip2', 'xz'] as const
export type Compression = (typeof COMPRESSIONS)[number]

const source = z.object({
  id: nonEmpty,
  label: nonEmpty,
  /** What the command packs, e.g. "assets/". */
  path: nonEmpty,
  /** Archive name without extension, e.g. "assets". */
  base: nonEmpty,
})

export const paramsSchema = z.object({
  sources: z.array(source).min(2),
  /** The directory the extract commands unpack into when the learner asks for another one. */
  destination: nonEmpty,
  /** The file the single-file compressors work on. */
  file: nonEmpty,
  /** Tasks: pick the command the text asks for. */
  tasks: z
    .array(
      z.object({
        text: nonEmpty,
        source: nonEmpty,
        tool: z.enum(TOOLS),
        action: z.enum(ACTIONS),
        compression: z.enum(COMPRESSIONS),
        why: nonEmpty,
      }),
    )
    .min(4),
})

export type ArchiveParams = z.infer<typeof paramsSchema>

export interface Options {
  tool: Tool
  action: Action
  compression: Compression
  verbose: boolean
  /** Extract somewhere other than the current directory. */
  elsewhere: boolean
}

export interface Built {
  command: string
  /** The archive or compressed file the command makes or reads. */
  archive: string
  /** The conventional extension, with its dot(s). */
  extension: string
  /** One line per part of the command, in the order it is typed. */
  parts: { text: string; meaning: string }[]
  note?: string
}

const TAR_EXT: Record<Compression, string> = { none: '.tar', gzip: '.tar.gz', bzip2: '.tar.bz2', xz: '.tar.xz' }
const SINGLE_EXT: Record<Exclude<Compression, 'none'>, string> = { gzip: '.gz', bzip2: '.bz2', xz: '.xz' }
const TAR_LETTER: Record<Compression, string> = { none: '', gzip: 'z', bzip2: 'j', xz: 'J' }
const PROGRAM: Record<Exclude<Compression, 'none'>, string> = { gzip: 'gzip', bzip2: 'bzip2', xz: 'xz' }
export const COMPRESSION_LABEL: Record<Compression, string> = { none: 'None', gzip: 'gzip', bzip2: 'bzip2', xz: 'xz' }

export function buildCommand(o: Options, src: { path: string; base: string }, params: Pick<ArchiveParams, 'destination' | 'file'>): Built {
  if (o.tool === 'tar') return buildTar(o, src, params.destination)
  if (o.tool === 'zip') return buildZip(o, src, params.destination)
  return buildSingle(o, params.file)
}

function buildTar(o: Options, src: { path: string; base: string }, destination: string): Built {
  const extension = TAR_EXT[o.compression]
  const archive = src.base + extension
  const letter = TAR_LETTER[o.compression]
  const mode = { create: 'c', list: 't', extract: 'x' }[o.action]
  const flags = `-${mode}${o.verbose ? 'v' : ''}${letter}f`
  const parts: Built['parts'] = [
    { text: 'tar', meaning: 'the archiver. It bundles files; compression is a separate, optional step.' },
    {
      text: `-${mode}`,
      meaning: { create: 'create a new archive.', list: 'list what is inside, without unpacking.', extract: 'extract the files from the archive.' }[o.action],
    },
  ]
  if (o.verbose) parts.push({ text: 'v', meaning: 'verbose: print each file name as tar handles it.' })
  if (letter) {
    const meaning = `${COMPRESSION_LABEL[o.compression]}: ${o.action === 'create' ? 'compress' : 'decompress'} the archive through ${PROGRAM[o.compression as 'gzip']}.`
    parts.push({ text: letter, meaning })
  }
  parts.push({ text: 'f', meaning: 'the next word is the archive file. Keep f last in the flag group, so the file name follows it.' })
  parts.push({ text: archive, meaning: o.action === 'create' ? 'the archive to write.' : 'the archive to read.' })
  let command = `tar ${flags} ${archive}`
  if (o.action === 'create') {
    command += ` ${src.path}`
    parts.push({ text: src.path, meaning: 'what goes in. A directory is added with everything below it.' })
  } else if (o.action === 'extract' && o.elsewhere) {
    command += ` -C ${destination}`
    parts.push({ text: `-C ${destination}`, meaning: 'change into that directory first, so the files are unpacked there. It must already exist.' })
  }
  const note =
    o.action === 'create'
      ? undefined
      : letter
        ? 'GNU tar also detects the compression by itself when it reads, so the compression letter is optional for -t and -x. The exam still expects it.'
        : 'GNU tar detects the compression of a .tar.gz, .tar.bz2 or .tar.xz by itself when it reads. Giving the wrong letter fails ("not in gzip format").'
  return { command, archive, extension, parts, note }
}

function buildZip(o: Options, src: { path: string; base: string }, destination: string): Built {
  const archive = `${src.base}.zip`
  if (o.action === 'create') {
    const flags = o.verbose ? '-rv' : '-r'
    return {
      command: `zip ${flags} ${archive} ${src.path}`,
      archive,
      extension: '.zip',
      parts: [
        { text: 'zip', meaning: 'the ZIP archiver. It compresses each file as it adds it, so there is no separate compression step.' },
        { text: '-r', meaning: 'recurse into directories. Without it, zip stores only the empty directory entry.' },
        ...(o.verbose ? [{ text: 'v', meaning: 'verbose: print more detail.' }] : []),
        { text: archive, meaning: 'the archive to write. Unlike tar, the archive comes first.' },
        { text: src.path, meaning: 'what goes in.' },
      ],
      note: 'The compression choice has no effect: ZIP always compresses (deflate) file by file, and Windows and macOS open .zip files without extra tools.',
    }
  }
  if (o.action === 'list') {
    return {
      command: `unzip -l ${archive}`,
      archive,
      extension: '.zip',
      parts: [
        { text: 'unzip', meaning: 'the ZIP extractor. Creating and unpacking are two programs.' },
        { text: '-l', meaning: 'list the contents without extracting.' },
        { text: archive, meaning: 'the archive to read.' },
      ],
    }
  }
  const dest = o.elsewhere ? ` -d ${destination}` : ''
  return {
    command: `unzip ${archive}${dest}`,
    archive,
    extension: '.zip',
    parts: [
      { text: 'unzip', meaning: 'the ZIP extractor. With no option, it extracts into the current directory.' },
      { text: archive, meaning: 'the archive to read.' },
      ...(o.elsewhere ? [{ text: `-d ${destination}`, meaning: 'extract into this directory (unzip creates it if needed).' }] : []),
    ],
  }
}

function buildSingle(o: Options, file: string): Built {
  const c: Exclude<Compression, 'none'> = o.compression === 'none' ? 'gzip' : o.compression
  const program = PROGRAM[c]
  const extension = SINGLE_EXT[c]
  const compressed = file + extension
  if (o.action === 'create') {
    return {
      command: `${program} -k ${file}`,
      archive: compressed,
      extension,
      parts: [
        { text: program, meaning: 'compresses one file. It cannot bundle several files; that is what tar is for.' },
        { text: '-k', meaning: 'keep the original. Without it, the original is deleted and only the compressed file remains.' },
        { text: file, meaning: 'the file to compress.' },
      ],
      note: `Result: ${compressed} next to ${file}.`,
    }
  }
  if (o.action === 'list') {
    if (c === 'bzip2') {
      return {
        command: `bzip2 -tv ${compressed}`,
        archive: compressed,
        extension,
        parts: [
          { text: 'bzip2', meaning: 'the bzip2 program.' },
          { text: '-t', meaning: 'test the compressed file for errors.' },
          { text: 'v', meaning: 'verbose: print "ok" for a good file.' },
          { text: compressed, meaning: 'the file to test.' },
        ],
        note: 'bzip2 has no listing option, so this tests the file instead. gzip and xz both have -l.',
      }
    }
    return {
      command: `${program} -l ${compressed}`,
      archive: compressed,
      extension,
      parts: [
        { text: program, meaning: `the ${program} program.` },
        { text: '-l', meaning: 'list the compressed and uncompressed size.' },
        { text: compressed, meaning: 'the compressed file.' },
      ],
    }
  }
  return {
    command: `${program} -dk ${compressed}`,
    archive: compressed,
    extension,
    parts: [
      { text: program, meaning: `the ${program} program.` },
      { text: '-d', meaning: 'decompress. (gunzip, bunzip2 and unxz do the same without -d.)' },
      { text: '-k', meaning: 'keep the compressed file.' },
      { text: compressed, meaning: 'the file to decompress.' },
    ],
  }
}

/** Whether the options match what a task asks for. */
export function matchesTask(o: Options, task: Pick<ArchiveParams['tasks'][number], 'tool' | 'action' | 'compression'>): boolean {
  if (o.tool !== task.tool || o.action !== task.action) return false
  return o.tool === 'zip' || o.compression === task.compression
}
