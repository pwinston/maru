/**
 * PerimeterWalkAlgorithm.ts
 *
 * Connects two 2D loops by "walking" both perimeters simultaneously.
 *
 * CONCEPT:
 * --------
 * Think of both outlines as parameterized by normalized perimeter distance [0, 1].
 * We walk both loops together, advancing whichever loop has the next vertex
 * (by perimeter parameter). This creates quads when both advance together,
 * or subdivided quads when one advances ahead of the other.
 *
 * ALGORITHM:
 * ----------
 * 1. Compute cumulative perimeter distance for each vertex (normalized 0..1)
 * 2. Start at vertex 0 on both loops
 * 3. At each step, look at the parameter of the next vertex on each loop
 * 4. Advance whichever is smaller (or both if equal), creating a quad
 * 5. When one advances alone, we interpolate a point on the other loop's edge
 */

import * as THREE from 'three'
import type { LoftFace, LoftResult } from './LoftAlgorithm'
import { ensureWindingCCW } from '../util/Geometry'

// ============================================================================
// HELPER: ParameterizedLoop
// ============================================================================

/**
 * A closed loop of 2D vertices with precomputed perimeter parameters.
 *
 * Each vertex has a "parameter" t in [0, 1] representing how far around
 * the perimeter it is (by arc length).
 */
class ParameterizedLoop {
  /** Original vertices (CCW winding) */
  readonly vertices: THREE.Vector2[]

  /** Cumulative perimeter parameter for each vertex, normalized to [0, 1] */
  readonly params: number[]

  /** Total perimeter length */
  readonly totalLength: number

  constructor(vertices: THREE.Vector2[]) {
    // Ensure consistent CCW winding
    this.vertices = ensureWindingCCW(vertices)

    // Compute cumulative distances
    const n = this.vertices.length
    const distances: number[] = [0]
    let total = 0

    for (let i = 0; i < n; i++) {
      const next = (i + 1) % n
      const edgeLength = this.vertices[i].distanceTo(this.vertices[next])
      total += edgeLength
      if (i < n - 1) {
        distances.push(total)
      }
    }

    this.totalLength = total

    // Normalize to [0, 1]
    this.params = distances.map(d => (total > 0 ? d / total : 0))
  }

  /** Number of vertices in the loop */
  get count(): number {
    return this.vertices.length
  }

  /**
   * Get the parameter for vertex at index i.
   * Handles wrap-around: param(n) = 1.0
   */
  param(i: number): number {
    const n = this.count
    if (i >= n) return 1.0
    return this.params[i]
  }

  /**
   * Get vertex at index (with wrap-around).
   */
  vertex(i: number): THREE.Vector2 {
    return this.vertices[i % this.count]
  }

  /**
   * Interpolate a point on edge (i → i+1) at parameter t.
   * t should be in [param(i), param(i+1)]
   */
  interpolate(i: number, t: number): THREE.Vector2 {
    const v0 = this.vertex(i)
    const v1 = this.vertex(i + 1)

    const t0 = this.param(i)
    const t1 = this.param(i + 1)

    // Handle wrap-around edge
    const span = t1 > t0 ? t1 - t0 : (1 - t0) + t1

    if (span === 0) return v0.clone()

    // u is [0,1] within this edge
    const u = (t - t0) / span

    return new THREE.Vector2(
      v0.x + u * (v1.x - v0.x),
      v0.y + u * (v1.y - v0.y)
    )
  }
}

// ============================================================================
// HELPER: FaceBuilder
// ============================================================================

/**
 * Builds 3D faces from 2D points at different heights.
 */
class FaceBuilder {
  private faces: LoftFace[] = []
  private heightA: number
  private heightB: number

  constructor(heightA: number, heightB: number) {
    this.heightA = heightA
    this.heightB = heightB
  }

  /**
   * Convert a 2D point on loop A to 3D (at heightA).
   */
  private toPoint3D_A(p: THREE.Vector2): THREE.Vector3 {
    return new THREE.Vector3(p.x, p.y, this.heightA)
  }

  /**
   * Convert a 2D point on loop B to 3D (at heightB).
   */
  private toPoint3D_B(p: THREE.Vector2): THREE.Vector3 {
    return new THREE.Vector3(p.x, p.y, this.heightB)
  }

  /**
   * Add a quad face connecting two edges.
   *
   * Vertices should be in order: a0, a1 (from loop A), b1, b0 (from loop B)
   * This creates proper winding for outward-facing normals.
   *
   *    a0 -------- a1
   *    |          |
   *    |   QUAD   |
   *    |          |
   *    b0 -------- b1
   */
  addQuad(
    a0: THREE.Vector2,
    a1: THREE.Vector2,
    b0: THREE.Vector2,
    b1: THREE.Vector2
  ): void {
    this.faces.push({
      vertices: [
        this.toPoint3D_A(a0),
        this.toPoint3D_A(a1),
        this.toPoint3D_B(b1),
        this.toPoint3D_B(b0)
      ]
    })
  }

  /**
   * Add a triangle where A advances but B stays at the same vertex.
   * This is the "collapse" case - two A vertices connect to one B vertex.
   *
   *    a0 -------- a1
   *     \        /
   *      \  TRI /
   *       \    /
   *        \  /
   *         b0
   */
  addTriangleCollapseB(
    a0: THREE.Vector2,
    a1: THREE.Vector2,
    b0: THREE.Vector2
  ): void {
    this.faces.push({
      vertices: [
        this.toPoint3D_A(a0),
        this.toPoint3D_A(a1),
        this.toPoint3D_B(b0)
      ]
    })
  }

  /**
   * Add a triangle where B advances but A stays at the same vertex.
   * This is the "collapse" case - two B vertices connect to one A vertex.
   *
   *         a0
   *        /  \
   *       /    \
   *      /  TRI \
   *     /        \
   *    b0 -------- b1
   */
  addTriangleCollapseA(
    a0: THREE.Vector2,
    b0: THREE.Vector2,
    b1: THREE.Vector2
  ): void {
    this.faces.push({
      vertices: [
        this.toPoint3D_A(a0),
        this.toPoint3D_B(b1),
        this.toPoint3D_B(b0)
      ]
    })
  }

  /**
   * Get all built faces.
   */
  getFaces(): LoftFace[] {
    return this.faces
  }
}

// ============================================================================
// HELPER: Look-ahead Merge Detection
// ============================================================================

/**
 * Check if we can merge an A-advance step with a following B-advance step into a quad.
 *
 * Scenario without merging:
 * - Step N: A advances, B stays → creates triangle (a0, a1, b0)
 * - Step N+1: B advances, A stays → creates triangle (a1, b0, b1)
 *
 * These two triangles share edge (a1, b0) and together form quad (a0, a1, b1, b0).
 * By detecting this pattern ahead of time, we can emit one quad instead of two triangles.
 *
 * We can merge if, after advancing A, the NEXT vertex on A comes AFTER
 * the next vertex on B (by parameter), meaning the following step would be B advancing.
 */
function canMergeIntoQuadWhenAAdvances(
  loopA: ParameterizedLoop,
  loopB: ParameterizedLoop,
  iA: number,
  iB: number,
  tNextB: number,
  EPS: number
): boolean {
  // After advancing A to iA+1, we need another A vertex to compare (at iA+2)
  // and B must not be exhausted
  if (iA + 1 >= loopA.count || iB >= loopB.count) return false

  // After A advances, tNextA becomes param(iA+2) while tNextB stays the same
  const tNextNextA = loopA.param(iA + 2)

  // If A's next-next comes after B's next, the following step will be B advancing
  return tNextNextA > tNextB + EPS
}

/**
 * Check if we can merge a B-advance step with a following A-advance step into a quad.
 * (Mirror of canMergeIntoQuadWhenAAdvances)
 */
function canMergeIntoQuadWhenBAdvances(
  loopA: ParameterizedLoop,
  loopB: ParameterizedLoop,
  iA: number,
  iB: number,
  tNextA: number,
  EPS: number
): boolean {
  if (iA >= loopA.count || iB + 1 >= loopB.count) return false

  const tNextNextB = loopB.param(iB + 2)
  return tNextNextB > tNextA + EPS
}

// ============================================================================
// MAIN ALGORITHM: Perimeter Walk
// ============================================================================

/**
 * Walk two loops simultaneously, creating faces as we go.
 *
 * At each step we compare the parameter of the next vertex on each loop
 * and advance the one that comes first (or both if equal).
 *
 * Uses look-ahead merging to combine adjacent triangles into quads when possible.
 */
function walkPerimeters(
  loopA: ParameterizedLoop,
  loopB: ParameterizedLoop,
  builder: FaceBuilder
): void {
  let iA = 0 // Current vertex index on loop A
  let iB = 0 // Current vertex index on loop B

  const nA = loopA.count
  const nB = loopB.count

  // We're done when we've visited all vertices on both loops
  while (iA < nA || iB < nB) {
    // Parameter of the NEXT vertex on each loop
    const tNextA = loopA.param(iA + 1)
    const tNextB = loopB.param(iB + 1)

    // Current vertices
    const a0 = loopA.vertex(iA)
    const b0 = loopB.vertex(iB)

    // Small epsilon for floating point comparison
    const EPS = 1e-9

    if (iA >= nA) {
      // Loop A is done, only advance B
      // Create triangle collapsing to A's last vertex (a0)
      const b1 = loopB.vertex(iB + 1)
      builder.addTriangleCollapseA(a0, b0, b1)
      iB++
    } else if (iB >= nB) {
      // Loop B is done, only advance A
      // Create triangle collapsing to B's last vertex (b0)
      const a1 = loopA.vertex(iA + 1)
      builder.addTriangleCollapseB(a0, a1, b0)
      iA++
    } else if (Math.abs(tNextA - tNextB) < EPS) {
      // CASE 1: Both reach their next vertex at the same parameter
      // Create a clean quad, advance both
      const a1 = loopA.vertex(iA + 1)
      const b1 = loopB.vertex(iB + 1)
      builder.addQuad(a0, a1, b0, b1)
      iA++
      iB++
    } else if (tNextA < tNextB) {
      // CASE 2: A's next vertex comes before B's
      const a1 = loopA.vertex(iA + 1)

      // Look ahead: can we merge with a following B-advance into a quad?
      if (canMergeIntoQuadWhenAAdvances(loopA, loopB, iA, iB, tNextB, EPS)) {
        // Merge two triangles into one quad
        const b1 = loopB.vertex(iB + 1)
        builder.addQuad(a0, a1, b0, b1)
        iA++
        iB++
      } else {
        // Just create triangle collapsing to b0
        builder.addTriangleCollapseB(a0, a1, b0)
        iA++
      }
    } else {
      // CASE 3: B's next vertex comes before A's
      const b1 = loopB.vertex(iB + 1)

      // Look ahead: can we merge with a following A-advance into a quad?
      if (canMergeIntoQuadWhenBAdvances(loopA, loopB, iA, iB, tNextA, EPS)) {
        // Merge two triangles into one quad
        const a1 = loopA.vertex(iA + 1)
        builder.addQuad(a0, a1, b0, b1)
        iA++
        iB++
      } else {
        // Just create triangle collapsing to a0
        builder.addTriangleCollapseA(a0, b0, b1)
        iB++
      }
    }
  }
}

// ============================================================================
// HELPER: Align Starting Points
// ============================================================================

/**
 * Find the vertex in loopB that is closest to vertex 0 of loopA.
 * Returns the index in loopB.
 */
function findClosestVertexIndex(
  loopA: THREE.Vector2[],
  loopB: THREE.Vector2[]
): number {
  const target = loopA[0]
  let bestIndex = 0
  let bestDist = Infinity

  for (let i = 0; i < loopB.length; i++) {
    const dist = target.distanceTo(loopB[i])
    if (dist < bestDist) {
      bestDist = dist
      bestIndex = i
    }
  }

  return bestIndex
}

/**
 * Rotate an array so that the element at startIndex becomes index 0.
 */
function rotateArray<T>(arr: T[], startIndex: number): T[] {
  if (startIndex === 0 || arr.length === 0) return arr
  return [...arr.slice(startIndex), ...arr.slice(0, startIndex)]
}

/**
 * Align loopB's starting vertex to be closest to loopA's starting vertex.
 * This prevents twisting when the loops have different vertex positions.
 */
function alignLoopStarts(
  loopA: THREE.Vector2[],
  loopB: THREE.Vector2[]
): THREE.Vector2[] {
  const closestIndex = findClosestVertexIndex(loopA, loopB)
  return rotateArray(loopB, closestIndex)
}

// ============================================================================
// HELPER: Per-Edge Adaptive Subdivision
// ============================================================================

/**
 * Options for adaptive subdivision behavior.
 * These could be exposed per-segment in the future.
 */
export interface AdaptiveSubdivisionOptions {
  /** Minimum vertices an edge must span to trigger subdivision (default: 2) */
  threshold: number
  /** Maximum intermediate points to insert per edge (default: unlimited) */
  maxPerEdge: number
  /** Enable/disable subdivision entirely (default: true) */
  enabled: boolean
}

const DEFAULT_SUBDIVISION_OPTIONS: AdaptiveSubdivisionOptions = {
  threshold: 3,  // Only subdivide edges spanning 3+ vertices; small mismatches handled naturally
  maxPerEdge: Infinity,
  enabled: true,
}

/**
 * Count how many vertices from otherLoop have parameters within the given range.
 * Handles wrap-around at t=1.0.
 */
function countVerticesInParamRange(
  otherLoop: ParameterizedLoop,
  t0: number,
  t1: number
): number {
  let count = 0
  const isWrapAround = t1 < t0 // Edge crosses the t=1.0 boundary

  for (let i = 0; i < otherLoop.count; i++) {
    const t = otherLoop.param(i)
    if (isWrapAround) {
      // Range wraps: [t0, 1.0) or [0, t1)
      if (t >= t0 || t < t1) count++
    } else {
      // Normal range: [t0, t1)
      if (t >= t0 && t < t1) count++
    }
  }

  return count
}

/**
 * Adaptively subdivide a loop based on how many vertices from the other loop
 * fall within each edge's parameter range.
 *
 * For each edge that spans N vertices from the other loop (where N > threshold),
 * insert N-1 intermediate points to ensure we get quads instead of triangle fans.
 */
function subdivideLoopAdaptively(
  loop: ParameterizedLoop,
  otherLoop: ParameterizedLoop,
  options: AdaptiveSubdivisionOptions = DEFAULT_SUBDIVISION_OPTIONS
): THREE.Vector2[] {
  if (!options.enabled) {
    return [...loop.vertices]
  }

  const result: THREE.Vector2[] = []

  for (let i = 0; i < loop.count; i++) {
    // Add original vertex
    result.push(loop.vertex(i))

    // Edge from i to i+1
    const t0 = loop.param(i)
    const t1 = loop.param(i + 1)

    // Count other loop vertices in this edge's parameter range
    const vertsInRange = countVerticesInParamRange(otherLoop, t0, t1)

    // If edge spans more vertices than threshold, insert intermediate points
    if (vertsInRange >= options.threshold) {
      const numToInsert = Math.min(vertsInRange - 1, options.maxPerEdge)

      for (let j = 1; j <= numToInsert; j++) {
        // Interpolate evenly along the edge
        const fraction = j / (numToInsert + 1)
        const t = t0 + (t1 - t0) * fraction
        result.push(loop.interpolate(i, t))
      }
    }
  }

  return result
}

/**
 * Balance two loops by adaptively subdividing edges that span multiple
 * vertices from the other loop.
 *
 * Unlike global subdivision (which doubles all vertices), this only adds
 * vertices where needed - on edges that would otherwise create triangle fans.
 */
function adaptivelyBalanceLoops(
  loopA: THREE.Vector2[],
  loopB: THREE.Vector2[],
  options: AdaptiveSubdivisionOptions = DEFAULT_SUBDIVISION_OPTIONS
): { loopA: THREE.Vector2[]; loopB: THREE.Vector2[] } {
  // First pass: parameterize both loops
  const paramA = new ParameterizedLoop(loopA)
  const paramB = new ParameterizedLoop(loopB)

  // Second pass: subdivide each loop based on the other
  const newLoopA = subdivideLoopAdaptively(paramA, paramB, options)
  const newLoopB = subdivideLoopAdaptively(paramB, paramA, options)

  return { loopA: newLoopA, loopB: newLoopB }
}

// ============================================================================
// ALGORITHM ENTRY POINT
// ============================================================================

/**
 * Perimeter Walk Loft Algorithm
 *
 * Creates a mesh connecting two 2D loops by walking their perimeters
 * in sync, parameterized by arc length.
 *
 * Key properties:
 * - Produces mostly quads (good for rendering)
 * - Handles loops with different vertex counts
 * - Preserves the shape of both loops (no resampling/distortion)
 * - Vertices are connected based on their relative position along the perimeter
 * - Per-edge adaptive subdivision: edges spanning multiple other-loop vertices
 *   get intermediate points to avoid triangle fans
 */
function perimeterWalkAlgorithm(
  loopA: THREE.Vector2[],
  heightA: number,
  loopB: THREE.Vector2[],
  heightB: number
): LoftResult {
  // Handle edge cases
  if (loopA.length < 3 || loopB.length < 3) {
    return { faces: [] }
  }

  // Normalize winding to CCW
  let normalizedA = ensureWindingCCW(loopA)
  let normalizedB = ensureWindingCCW(loopB)

  // Adaptively subdivide edges that span multiple vertices from the other loop
  const balanced = adaptivelyBalanceLoops(normalizedA, normalizedB)
  normalizedA = balanced.loopA
  normalizedB = balanced.loopB

  // Align loopB's start to be closest to loopA's start
  const alignedB = alignLoopStarts(normalizedA, normalizedB)

  // Create parameterized loops (note: ParameterizedLoop also calls ensureWindingCCW,
  // but since we already did it, it's a no-op)
  const paramA = new ParameterizedLoop(normalizedA)
  const paramB = new ParameterizedLoop(alignedB)

  // Build faces
  const builder = new FaceBuilder(heightA, heightB)
  walkPerimeters(paramA, paramB, builder)

  return { faces: builder.getFaces() }
}

export { perimeterWalkAlgorithm, ParameterizedLoop, FaceBuilder }
