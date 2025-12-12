import { Sketch } from '../2d/Sketch'
import { registerLoftAlgorithm } from './LoftAlgorithms'
import { ensureWindingCCW, resampleByArcLength } from '../util/Geometry'
import * as THREE from 'three'

/**
 * Simple uniform resampling algorithm.
 * Resamples all sketches to have the same number of vertices (max of all counts),
 * with points distributed uniformly by arc length around each polygon.
 */
function uniformResampleAlgorithm(sketches: Sketch[]): THREE.Vector2[][] {
  if (sketches.length === 0) return []

  // Find max vertex count across all sketches
  const maxCount = Math.max(...sketches.map(s => s.getVertexCount()))

  // Resample all to max count with consistent CCW winding
  return sketches.map(s => {
    const verts = ensureWindingCCW(s.getVertices())
    if (verts.length === maxCount) return verts
    return resampleByArcLength(verts, maxCount)
  })
}

// Register the algorithm
registerLoftAlgorithm('uniform', uniformResampleAlgorithm)

export { uniformResampleAlgorithm }
