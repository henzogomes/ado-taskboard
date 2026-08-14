import { createContext, useContext } from 'react'
import type { StateCategory } from '../api/types'
import { colorForState } from '../domain/stateColors'
import type { StateColor } from '../domain/stateColors'

export const StateCategoryContext = createContext<Record<string, StateCategory>>({})

export function useStateColor(state: string): StateColor {
  return colorForState(state, useContext(StateCategoryContext))
}
