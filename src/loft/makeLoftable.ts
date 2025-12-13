import * as THREE from 'three'
import { SketchPlane } from '../3d/SketchPlane'
import { getLoftAlgorithm } from './LoftAlgorithms'
import { LOFT } from '../constants'

// Import algorithms to register them
import './AnchorResampleAlgorithm'
import './UniformResampleAlgorithm'

/**
 * Create loftable vertices from sketch planes.
 * All returned vertex arrays will have the same count.
 *
 * @param planes The sketch planes to make loftable
 * @param algorithmName Optional algorithm name (defaults to LOFT.DEFAULT_ALGORITHM)
 * @returns Array of vertex arrays, one per plane, all with same count
 */
export function makeLoftable(
  planes: SketchPlane[],
  algorithmName?: string
): THREE.Vector2[][] {
  if (planes.length === 0) return []

  const name = algorithmName ?? LOFT.DEFAULT_ALGORITHM ?? 'uniform'
  const algorithm = getLoftAlgorithm(name)

  if (!algorithm) {
    throw new Error(`Unknown loft algorithm: ${name}`)
  }

  return algorithm(planes.map(p => p.getSketch()))
}
