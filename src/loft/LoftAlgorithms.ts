import * as THREE from 'three'
import { Sketch } from '../2d/Sketch'

/**
 * A loft algorithm takes an array of sketches and returns
 * an array of resampled vertex arrays, all with the same count.
 */
export type LoftAlgorithm = (sketches: Sketch[]) => THREE.Vector2[][]

const algorithms: Record<string, LoftAlgorithm> = {}

/**
 * Register a loft algorithm by name.
 */
export function registerLoftAlgorithm(name: string, fn: LoftAlgorithm): void {
  algorithms[name] = fn
}

/**
 * Get a registered algorithm by name.
 */
export function getLoftAlgorithm(name: string): LoftAlgorithm | undefined {
  return algorithms[name]
}

/**
 * List all registered algorithm names.
 */
export function getAlgorithmNames(): string[] {
  return Object.keys(algorithms)
}
