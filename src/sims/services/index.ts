// A transcript simulator: the shared replay over a captured transcript.
import { defineSim } from '../define'
import { paramsSchema } from '../transcript/model'

export default defineSim(paramsSchema, () => import('../transcript/Replay'))
