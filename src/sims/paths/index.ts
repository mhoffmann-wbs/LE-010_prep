import { defineSim } from '../define'
import { paramsSchema } from './model'

export default defineSim(paramsSchema, () => import('./Sim'))
