import * as THREE from 'three'
import { Sketch } from '../2d/Sketch'
import { registerLoftAlgorithm } from './LoftAlgorithms'
import {
  ensureWindingCCW,
  findNearestVertex,
  subdivideToCount,
  subdivideAndAlign,
  computeArcLength,
  pointAtDistance
} from '../util/Geometry'
import { LOFT } from '../constants'

interface Anchor {
  indexA: number
  indexB: number
}

/**
 * Find mutual nearest neighbor anchors between two vertex arrays.
 * An anchor is a pair of vertices where each is the other's nearest neighbor
 * and the distance is below the epsilon threshold.
 */
function findAnchors(
  vertsA: THREE.Vector2[],
  vertsB: THREE.Vector2[],
  epsilon: number
): Anchor[] {
  const candidates: Anchor[] = []

  for (let i = 0; i < vertsA.length; i++) {
    const nearestInB = findNearestVertex(vertsA[i], vertsB)
    if (nearestInB.distance > epsilon) continue

    // Check if it's mutual (B's nearest to that point is also A[i])
    const nearestInA = findNearestVertex(vertsB[nearestInB.index], vertsA)
    if (nearestInA.index === i && nearestInA.distance <= epsilon) {
      candidates.push({ indexA: i, indexB: nearestInB.index })
    }
  }

  // Filter to maintain monotonic ordering (no crossing)
  // Sort by indexA first
  candidates.sort((a, b) => a.indexA - b.indexA)

  // Keep only anchors where indexB is also increasing (modulo wrap handling)
  const filtered: Anchor[] = []
  for (const anchor of candidates) {
    if (filtered.length === 0) {
      filtered.push(anchor)
    } else {
      // Check if this anchor maintains monotonic B ordering
      const lastB = filtered[filtered.length - 1].indexB
      // Simple approach: only keep if indexB > lastB
      // This doesn't handle wrap-around perfectly but works for most cases
      if (anchor.indexB > lastB) {
        filtered.push(anchor)
      }
    }
  }

  return filtered
}

/**
 * Count vertices in a chunk from start to end (exclusive of end).
 */
function chunkVertexCount(total: number, start: number, end: number): number {
  if (end > start) return end - start
  if (end === start) return total // Full loop
  return total - start + end
}

/**
 * Resample a chunk (open polyline from start to end) to have targetCount points.
 * The first point will be at the start, distributed by arc length.
 */
function resampleChunk(
  vertices: THREE.Vector2[],
  startIndex: number,
  endIndex: number,
  targetCount: number
): THREE.Vector2[] {
  if (targetCount <= 0) return []

  // Extract the chunk as an open polyline (including end point for interpolation)
  const chunk: THREE.Vector2[] = []
  const n = vertices.length
  let i = startIndex
  while (i !== endIndex) {
    chunk.push(vertices[i])
    i = (i + 1) % n
  }
  chunk.push(vertices[endIndex]) // Include end for interpolation

  if (chunk.length <= 1) {
    return [vertices[startIndex].clone()]
  }

  // Compute arc length of this chunk (open polyline)
  const totalLength = computeArcLength(chunk, false)
  if (totalLength === 0) {
    return Array(targetCount).fill(null).map(() => vertices[startIndex].clone())
  }

  const result: THREE.Vector2[] = []
  for (let t = 0; t < targetCount; t++) {
    // Distribute points from 0 to just before the end
    // (end point will be the start of the next chunk)
    const targetDist = (t / targetCount) * totalLength
    result.push(pointAtDistance(chunk, targetDist))
  }

  return result
}

/**
 * Resample both polygons using anchor correspondences.
 * Returns [resampledA, resampledB] with equal vertex counts.
 */
function resampleWithAnchors(
  vertsA: THREE.Vector2[],
  vertsB: THREE.Vector2[],
  anchors: Anchor[]
): [THREE.Vector2[], THREE.Vector2[]] {
  if (anchors.length === 0) {
    // Fallback: uniform subdivision with optimized alignment
    const targetCount = Math.max(vertsA.length, vertsB.length)
    const subdividedA = subdivideToCount(vertsA, targetCount)
    const alignedB = subdivideAndAlign(subdividedA, vertsB, targetCount)
    return [subdividedA, alignedB]
  }

  const resultA: THREE.Vector2[] = []
  const resultB: THREE.Vector2[] = []

  // Process each chunk between consecutive anchors
  for (let i = 0; i < anchors.length; i++) {
    const nextIdx = (i + 1) % anchors.length
    const startA = anchors[i].indexA
    const endA = anchors[nextIdx].indexA
    const startB = anchors[i].indexB
    const endB = anchors[nextIdx].indexB

    // Count vertices in each chunk
    const countA = chunkVertexCount(vertsA.length, startA, endA)
    const countB = chunkVertexCount(vertsB.length, startB, endB)
    const targetCount = Math.max(countA, countB)

    // Resample both chunks to target count
    const chunkA = resampleChunk(vertsA, startA, endA, targetCount)
    const chunkB = resampleChunk(vertsB, startB, endB, targetCount)

    resultA.push(...chunkA)
    resultB.push(...chunkB)
  }

  return [resultA, resultB]
}

/**
 * Anchor-based resampling algorithm.
 *
 * For each pair of adjacent sketches:
 * 1. Normalize winding direction to CCW
 * 2. Find anchor correspondences (mutual nearest neighbors within epsilon)
 * 3. Resample chunks between anchors to have matching vertex counts
 * 4. Fall back to uniform resampling if no anchors found
 */
function anchorResampleAlgorithm(sketches: Sketch[]): THREE.Vector2[][] {
  if (sketches.length === 0) return []
  if (sketches.length === 1) {
    return [ensureWindingCCW(sketches[0].getVertices())]
  }

  // Step 0: Normalize all sketches to CCW winding
  const normalized = sketches.map(s => ensureWindingCCW(s.getVertices()))

  // Process pairs of adjacent sketches
  // Start with first sketch, process each subsequent pair
  let result: THREE.Vector2[][] = [normalized[0]]

  for (let i = 1; i < normalized.length; i++) {
    const vertsA = result[i - 1] // Previous (already processed)
    const vertsB = normalized[i]

    // Step 1: Find anchors
    const epsilon = LOFT.ANCHOR_EPSILON ?? 0.5
    const anchors = findAnchors(vertsA, vertsB, epsilon)

    // Step 2 & 3: Resample using anchors (or fallback to uniform)
    const [resampledA, resampledB] = resampleWithAnchors(vertsA, vertsB, anchors)

    // Update previous result if it was resampled
    result[i - 1] = resampledA
    result.push(resampledB)
  }

  // Verify all have the same count (they should after pairwise processing,
  // but if there are >2 sketches we may need another pass)
  const counts = result.map(r => r.length)
  const allSame = counts.every(c => c === counts[0])

  if (!allSame) {
    // Final subdivision pass to ensure all match (preserves originals)
    const maxCount = Math.max(...counts)
    // First one: just subdivide
    const first = result[0].length === maxCount ? result[0] : subdivideToCount(result[0], maxCount)
    const aligned: THREE.Vector2[][] = [first]
    // Rest: subdivide and align to previous
    for (let i = 1; i < result.length; i++) {
      aligned.push(subdivideAndAlign(aligned[i - 1], result[i], maxCount))
    }
    result = aligned
  }

  return result
}

// Register the algorithm
registerLoftAlgorithm('anchor-resample', anchorResampleAlgorithm)

export { anchorResampleAlgorithm }
