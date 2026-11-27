// Filesystem map: the Filesystem Hierarchy Standard directories a Linux
// Essentials candidate must know, what lives in each, where it is stored (disk,
// kernel-generated or memory), and a "where would you look?" quiz. The listings
// in the content file were run in the guest (see model.test.ts).
import { z } from 'zod'

const nonEmpty = z.string().trim().min(1)
const dirPath = z.string().regex(/^\/[a-z0-9/._-]*$/)

export const STORAGE = ['disk', 'pseudo', 'ram', 'varies'] as const
export type Storage = (typeof STORAGE)[number]

const example = z.object({
  /** Typed after mira's prompt in the guest. */
  command: nonEmpty,
  /** Exactly what it printed, without the final newline. */
  output: z.string().min(1),
})

const entry = z.object({
  path: dirPath,
  /** One short phrase: what the directory is for. */
  role: nonEmpty,
  /** What lives there, in a sentence or two. */
  contents: nonEmpty,
  /** Where the data is stored. */
  storage: z.enum(STORAGE),
  /** Explains the storage, or a caution about it. */
  storageNote: nonEmpty,
  /** TuxPixel context: what Mira, Jonas or Ada would use it for. */
  atTuxPixel: nonEmpty,
  /** Listings run in the guest. */
  examples: z.array(example).min(1).max(2),
  /** If the path is a symbolic link on the guest, where it points. */
  linkTo: dirPath.optional(),
  /** The exam point in one sentence. */
  examTip: nonEmpty,
})

export const paramsSchema = z.object({
  /** Parents before children, "/" first. */
  directories: z.array(entry).min(12),
  /** "Where would you look?" questions: the answer and the options are paths from `directories`. */
  quiz: z
    .array(
      z.object({
        text: nonEmpty,
        options: z.array(dirPath).min(3).max(5),
        answer: dirPath,
        why: nonEmpty,
      }),
    )
    .min(6),
})

export type FilesystemParams = z.infer<typeof paramsSchema>
export type Directory = z.infer<typeof entry>

export const STORAGE_LABEL: Record<Storage, string> = {
  disk: 'On disk',
  pseudo: 'Pseudo filesystem (made by the kernel, not stored on disk)',
  ram: 'In memory (tmpfs), gone at reboot',
  varies: 'Depends on the distribution',
}

/** Short badge text for the tree. */
export const STORAGE_BADGE: Record<Storage, string> = { disk: 'disk', pseudo: 'pseudo', ram: 'RAM', varies: 'varies' }

export const parentOf = (path: string) => (path === '/' ? undefined : path.slice(0, path.lastIndexOf('/')) || '/')
export const depthOf = (path: string) => (path === '/' ? 0 : path.split('/').length - 1)

/** The entries in tree order with their depth. Symbolic-link children are not hidden. */
export function flatten(params: FilesystemParams): { dir: Directory; depth: number }[] {
  return params.directories.map((dir) => ({ dir, depth: depthOf(dir.path) }))
}

export const childrenOf = (params: FilesystemParams, path: string) => params.directories.filter((d) => parentOf(d.path) === path)

/** Checks a quiz answer: right when the chosen path is the answer. */
export const isRight = (question: FilesystemParams['quiz'][number], choice: string) => choice === question.answer
