import { Sketch } from '../2d/Sketch'
import { registerLoftAlgorithm } from './LoftAlgorithms'
import {
  ensureWindingCCW,
  subdivideToCount,
  subdivideAndAlign
} from '../util/Geometry'
import * as THREE from 'three'

/**
 * Uniform subdivision algorithm.
 * Subdivides all sketches to have the same number of vertices (max of all counts).
 * PRESERVES all original vertices - only adds interpolated points between them.
 * Optimizes placement of interpolated vertices to minimize twisting.
 */
function uniformResampleAlgorithm(sketches: Sketch[]): THREE.Vector2[][] {
  if (sketches.length === 0) return []

  // Normalize all to CCW winding first
  const normalized = sketches.map(s => ensureWindingCCW(s.getVertices()))

  // Find max vertex count across all sketches
  const maxCount = Math.max(...normalized.map(v => v.length))

  // First sketch: just subdivide (it's the reference)
  const result: THREE.Vector2[][] = [subdivideToCount(normalized[0], maxCount)]

  // Each subsequent sketch: subdivide and align to previous
  // This tries all subdivision placements to find optimal correspondence
  for (let i = 1; i < normalized.length; i++) {
    const prev = result[i - 1]
    const curr = normalized[i]
    result.push(subdivideAndAlign(prev, curr, maxCount))
  }

  return result
}

// Register the algorithm
registerLoftAlgorithm('uniform', uniformResampleAlgorithm)

export { uniformResampleAlgorithm }
