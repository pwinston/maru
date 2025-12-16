/**
 * FrozenSegment.ts
 *
 * Data structures for "frozen" (locked) segments.
 * When a segment is locked, we capture a snapshot of its topology
 * so that vertex connectivity stays fixed even as sketch positions change.
 * 
 * One application of this is to twist a sketch without the loft rebuilding
 * out from under you.
 */

import * as THREE from 'three'
import type { LoftFace } from './LoftAlgorithm'

/**
 * Describes where a face vertex came from.
 *
 * - 'sketch': Directly from a sketch vertex (can be updated when sketch changes)
 * - 'interpolated': On an edge between two sketch vertices (recomputed from edge + t)
 */
export type VertexSource =
  | { type: 'sketch'; loop: 'bottom' | 'top'; index: number }
  | { type: 'interpolated'; loop: 'bottom' | 'top'; edgeStart: number; edgeEnd: number; t: number }

/**
 * A frozen face has vertices with their sources tracked.
 */
export interface FrozenFace {
  vertices: THREE.Vector3[]
  sources: VertexSource[]
}

/**
 * A frozen segment captures the topology of a locked segment.
 * The faces array mirrors LoftSegment.faces but with source tracking.
 */
export interface FrozenSegment {
  faces: FrozenFace[]
}

/**
 * Serializable version of VertexSource for storage.
 */
export interface VertexSourceData {
  type: 'sketch' | 'interpolated'
  loop: 'bottom' | 'top'
  // For 'sketch' type
  index?: number
  // For 'interpolated' type
  edgeStart?: number
  edgeEnd?: number
  t?: number
}

/**
 * Serializable version of FrozenFace for storage.
 */
export interface FrozenFaceData {
  /** Vertices as [x, y, z] tuples */
  vertices: [number, number, number][]
  sources: VertexSourceData[]
}

/**
 * Serializable version of FrozenSegment for storage.
 */
export interface FrozenSegmentData {
  faces: FrozenFaceData[]
}

/**
 * Convert a FrozenSegment to serializable data.
 */
export function serializeFrozenSegment(segment: FrozenSegment): FrozenSegmentData {
  return {
    faces: segment.faces.map(face => ({
      vertices: face.vertices.map(v => [v.x, v.y, v.z] as [number, number, number]),
      sources: face.sources.map(serializeVertexSource)
    }))
  }
}

/**
 * Convert serialized data back to a FrozenSegment.
 */
export function deserializeFrozenSegment(data: FrozenSegmentData): FrozenSegment {
  return {
    faces: data.faces.map(faceData => ({
      vertices: faceData.vertices.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
      sources: faceData.sources.map(deserializeVertexSource)
    }))
  }
}

function serializeVertexSource(source: VertexSource): VertexSourceData {
  if (source.type === 'sketch') {
    return { type: 'sketch', loop: source.loop, index: source.index }
  } else {
    return {
      type: 'interpolated',
      loop: source.loop,
      edgeStart: source.edgeStart,
      edgeEnd: source.edgeEnd,
      t: source.t
    }
  }
}

function deserializeVertexSource(data: VertexSourceData): VertexSource {
  if (data.type === 'sketch') {
    return { type: 'sketch', loop: data.loop, index: data.index! }
  } else {
    return {
      type: 'interpolated',
      loop: data.loop,
      edgeStart: data.edgeStart!,
      edgeEnd: data.edgeEnd!,
      t: data.t!
    }
  }
}

/**
 * Convert frozen faces to regular LoftFaces (for rendering).
 * Strips out the source tracking.
 */
export function frozenFacesToLoftFaces(frozen: FrozenFace[]): LoftFace[] {
  return frozen.map(face => ({
    vertices: face.vertices.map(v => v.clone())
  }))
}

// ============================================================================
// Source Computation (Phase 2)
// ============================================================================

const POSITION_TOLERANCE = 0.0001
const HEIGHT_TOLERANCE = 0.0001

/**
 * Create a FrozenSegment by analyzing the current faces and computing
 * where each vertex came from. This is the "snapshot" operation when locking.
 *
 * @param faces - The current loft faces (from perimeter walk algorithm)
 * @param bottomVerts - 2D vertices of the bottom sketch
 * @param bottomHeight - Z height of the bottom sketch
 * @param topVerts - 2D vertices of the top sketch
 * @param topHeight - Z height of the top sketch
 */
export function createFrozenSegment(
  faces: LoftFace[],
  bottomVerts: THREE.Vector2[],
  bottomHeight: number,
  topVerts: THREE.Vector2[],
  topHeight: number
): FrozenSegment {
  return {
    faces: faces.map(face => freezeFace(face, bottomVerts, bottomHeight, topVerts, topHeight))
  }
}

/**
 * Freeze a single face by computing vertex sources.
 */
function freezeFace(
  face: LoftFace,
  bottomVerts: THREE.Vector2[],
  bottomHeight: number,
  topVerts: THREE.Vector2[],
  topHeight: number
): FrozenFace {
  return {
    vertices: face.vertices.map(v => v.clone()),
    sources: face.vertices.map(v =>
      computeVertexSource(v, bottomVerts, bottomHeight, topVerts, topHeight)
    )
  }
}

/**
 * Determine where a single vertex came from.
 */
function computeVertexSource(
  vertex: THREE.Vector3,
  bottomVerts: THREE.Vector2[],
  bottomHeight: number,
  topVerts: THREE.Vector2[],
  topHeight: number
): VertexSource {
  // Determine which loop this vertex belongs to (by height)
  const isBottom = Math.abs(vertex.z - bottomHeight) < HEIGHT_TOLERANCE
  const isTop = Math.abs(vertex.z - topHeight) < HEIGHT_TOLERANCE

  if (!isBottom && !isTop) {
    // This shouldn't happen - loft vertices are always at one of the two heights
    // But handle gracefully: treat as bottom, interpolated at position 0
    console.warn('Vertex at unexpected height:', vertex.z, 'expected', bottomHeight, 'or', topHeight)
    return { type: 'interpolated', loop: 'bottom', edgeStart: 0, edgeEnd: 1, t: 0 }
  }

  const loop: 'bottom' | 'top' = isBottom ? 'bottom' : 'top'
  const sketchVerts = isBottom ? bottomVerts : topVerts
  const vertex2D = new THREE.Vector2(vertex.x, vertex.y)

  // Try to find an exact match with a sketch vertex
  const exactMatch = findExactSketchVertex(vertex2D, sketchVerts)
  if (exactMatch !== -1) {
    return { type: 'sketch', loop, index: exactMatch }
  }

  // Not an exact match - must be interpolated on an edge
  const edgeInfo = findEdgePosition(vertex2D, sketchVerts)
  return {
    type: 'interpolated',
    loop,
    edgeStart: edgeInfo.edgeStart,
    edgeEnd: edgeInfo.edgeEnd,
    t: edgeInfo.t
  }
}

/**
 * Find exact match with a sketch vertex.
 * Returns the index, or -1 if no match within tolerance.
 */
function findExactSketchVertex(point: THREE.Vector2, sketchVerts: THREE.Vector2[]): number {
  for (let i = 0; i < sketchVerts.length; i++) {
    if (point.distanceTo(sketchVerts[i]) < POSITION_TOLERANCE) {
      return i
    }
  }
  return -1
}

/**
 * Find which edge the point lies on and how far along it is.
 * Returns the edge endpoints and interpolation factor t.
 */
function findEdgePosition(
  point: THREE.Vector2,
  sketchVerts: THREE.Vector2[]
): { edgeStart: number; edgeEnd: number; t: number } {
  let bestEdge = { edgeStart: 0, edgeEnd: 1, t: 0 }
  let bestDistance = Infinity

  for (let i = 0; i < sketchVerts.length; i++) {
    const j = (i + 1) % sketchVerts.length
    const p0 = sketchVerts[i]
    const p1 = sketchVerts[j]

    // Project point onto the edge
    const edge = new THREE.Vector2().subVectors(p1, p0)
    const edgeLengthSq = edge.lengthSq()
    if (edgeLengthSq < POSITION_TOLERANCE * POSITION_TOLERANCE) {
      continue // Degenerate edge
    }

    const toPoint = new THREE.Vector2().subVectors(point, p0)
    let t = edge.dot(toPoint) / edgeLengthSq

    // Clamp t to [0, 1] to stay on the edge
    t = Math.max(0, Math.min(1, t))

    // Find the closest point on the edge
    const closest = new THREE.Vector2().copy(p0).addScaledVector(edge, t)
    const distance = point.distanceTo(closest)

    if (distance < bestDistance) {
      bestDistance = distance
      bestEdge = { edgeStart: i, edgeEnd: j, t }
    }
  }

  return bestEdge
}

// ============================================================================
// Position Update (Phase 3)
// ============================================================================

/**
 * Update vertex positions in a frozen segment to match current sketch positions.
 * Topology stays fixed, but positions move to follow the sketches.
 *
 * @param frozen - The frozen segment to update (modified in place)
 * @param bottomVerts - Current 2D vertices of the bottom sketch
 * @param bottomHeight - Z height of the bottom sketch
 * @param topVerts - Current 2D vertices of the top sketch
 * @param topHeight - Z height of the top sketch
 */
export function updateFrozenPositions(
  frozen: FrozenSegment,
  bottomVerts: THREE.Vector2[],
  bottomHeight: number,
  topVerts: THREE.Vector2[],
  topHeight: number
): void {
  for (const face of frozen.faces) {
    for (let i = 0; i < face.vertices.length; i++) {
      const source = face.sources[i]
      const vertex = face.vertices[i]

      const verts = source.loop === 'bottom' ? bottomVerts : topVerts
      const height = source.loop === 'bottom' ? bottomHeight : topHeight

      if (source.type === 'sketch') {
        // Direct sketch vertex - update from current sketch position
        const sketchVert = verts[source.index]
        if (sketchVert) {
          vertex.set(sketchVert.x, sketchVert.y, height)
        }
      } else {
        // Interpolated vertex - recompute position on edge
        const p0 = verts[source.edgeStart]
        const p1 = verts[source.edgeEnd]
        if (p0 && p1) {
          const x = p0.x + source.t * (p1.x - p0.x)
          const y = p0.y + source.t * (p1.y - p0.y)
          vertex.set(x, y, height)
        }
      }
    }
  }
}
