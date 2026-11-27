import { type ComponentType, type LazyExoticComponent, lazy } from 'react'
import type { z } from 'zod'

export interface SimEntry {
  /** Validates the content file's `params`. */
  params: z.ZodType
  /** The interactive part, loaded on first use. It receives the parsed params. */
  Component: LazyExoticComponent<ComponentType<{ params: never }>>
}

/** What each src/sims/<simId>/index.ts default-exports. */
export function defineSim<S extends z.ZodType>(params: S, load: () => Promise<{ default: ComponentType<{ params: z.infer<S> }> }>): SimEntry {
  return { params, Component: lazy(load) as SimEntry['Component'] }
}
