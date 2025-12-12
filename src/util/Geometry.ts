import * as THREE from 'three'

// ============================================================================
// Polygon Utilities for Lofting
// ============================================================================

/**
 * Calculate signed area of a polygon using the shoelace formula.
 * Positive = counter-clockwise, Negative = clockwise
 */
export function signedArea(vertices: THREE.Vector2[]): number {
  let area = 0
  const n = vertices.length
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    area += vertices[i].x * vertices[j].y
    area -= vertices[j].x * vertices[i].y
  }
  return area / 2
}

/**
 * Ensure vertices are in counter-clockwise order.
 * Returns new array (reversed if needed), does not mutate input.
 */
export function ensureWindingCCW(vertices: THREE.Vector2[]): THREE.Vector2[] {
  if (signedArea(vertices) < 0) {
    return [...vertices].reverse().map(v => v.clone())
  }
  return vertices.map(v => v.clone())
}

/**
 * Compute total arc length of a polygon.
 * @param closed If true, includes edge from last to first vertex
 */
export function computeArcLength(vertices: THREE.Vector2[], closed: boolean = true): number {
  let length = 0
  const n = vertices.length
  const limit = closed ? n : n - 1
  for (let i = 0; i < limit; i++) {
    const j = (i + 1) % n
    length += vertices[i].distanceTo(vertices[j])
  }
  return length
}

/**
 * Resample a closed polygon to have exactly targetCount vertices,
 * distributed uniformly by arc length.
 */
export function resampleByArcLength(
  vertices: THREE.Vector2[],
  targetCount: number
): THREE.Vector2[] {
  if (targetCount <= 0) return []
  if (vertices.length === 0) return []
  if (targetCount === 1) return [vertices[0].clone()]

  const totalLength = computeArcLength(vertices, true)
  if (totalLength === 0) {
    // Degenerate polygon - all points at same location
    return Array(targetCount).fill(null).map(() => vertices[0].clone())
  }

  const segmentLength = totalLength / targetCount
  const result: THREE.Vector2[] = []
  const n = vertices.length

  // Helper to get edge length
  const edgeLength = (idx: number): number => {
    return vertices[idx].distanceTo(vertices[(idx + 1) % n])
  }

  let accumulated = 0
  let currentIndex = 0

  for (let i = 0; i < targetCount; i++) {
    const targetDistance = i * segmentLength

    // Walk along polygon until we reach targetDistance
    while (accumulated + edgeLength(currentIndex) < targetDistance) {
      accumulated += edgeLength(currentIndex)
      currentIndex = (currentIndex + 1) % n
    }

    // Interpolate position on current edge
    const remaining = targetDistance - accumulated
    const edge = edgeLength(currentIndex)
    const t = edge > 0 ? remaining / edge : 0

    const start = vertices[currentIndex]
    const end = vertices[(currentIndex + 1) % n]
    result.push(new THREE.Vector2().lerpVectors(start, end, t))
  }

  return result
}

/**
 * Find the nearest vertex in a polygon to a given point.
 */
export function findNearestVertex(
  point: THREE.Vector2,
  vertices: THREE.Vector2[]
): { index: number; distance: number } {
  let minDist = Infinity
  let minIndex = 0
  for (let i = 0; i < vertices.length; i++) {
    const d = point.distanceTo(vertices[i])
    if (d < minDist) {
      minDist = d
      minIndex = i
    }
  }
  return { index: minIndex, distance: minDist }
}

/**
 * Get a point at a given distance along an open polyline.
 */
export function pointAtDistance(polyline: THREE.Vector2[], distance: number): THREE.Vector2 {
  if (polyline.length === 0) return new THREE.Vector2()
  if (polyline.length === 1) return polyline[0].clone()

  let accumulated = 0
  for (let i = 0; i < polyline.length - 1; i++) {
    const edgeLen = polyline[i].distanceTo(polyline[i + 1])
    if (accumulated + edgeLen >= distance) {
      const t = edgeLen > 0 ? (distance - accumulated) / edgeLen : 0
      return new THREE.Vector2().lerpVectors(polyline[i], polyline[i + 1], t)
    }
    accumulated += edgeLen
  }
  return polyline[polyline.length - 1].clone()
}

// ============================================================================
// Segment Intersection Utilities
// ============================================================================

/**
 * Returns orientation of triplet (p, q, r):
 * 0 = collinear, 1 = clockwise, 2 = counter-clockwise
 */
function orientation(p: THREE.Vector2, q: THREE.Vector2, r: THREE.Vector2): number {
  const val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y)
  if (Math.abs(val) < 1e-10) return 0
  return val > 0 ? 1 : 2
}

/**
 * Check if point q lies on segment pr (when collinear)
 */
function onSegment(p: THREE.Vector2, q: THREE.Vector2, r: THREE.Vector2): boolean {
  return q.x <= Math.max(p.x, r.x) && q.x >= Math.min(p.x, r.x) &&
         q.y <= Math.max(p.y, r.y) && q.y >= Math.min(p.y, r.y)
}

/**
 * Check if two line segments (p1,q1) and (p2,q2) intersect.
 * Uses the orientation (CCW) method.
 */
export function segmentsIntersect(
  p1: THREE.Vector2, q1: THREE.Vector2,
  p2: THREE.Vector2, q2: THREE.Vector2
): boolean {
  const o1 = orientation(p1, q1, p2)
  const o2 = orientation(p1, q1, q2)
  const o3 = orientation(p2, q2, p1)
  const o4 = orientation(p2, q2, q1)

  if (o1 !== o2 && o3 !== o4) return true
  if (o1 === 0 && onSegment(p1, p2, q1)) return true
  if (o2 === 0 && onSegment(p1, q2, q1)) return true
  if (o3 === 0 && onSegment(p2, p1, q2)) return true
  if (o4 === 0 && onSegment(p2, q1, q2)) return true
  return false
}

/**
 * Check if moving vertex at dragIndex to newPosition would cause self-intersection.
 * Tests the two edges connected to the dragged vertex against all non-adjacent edges.
 */
export function wouldCauseSelfIntersection(
  vertices: THREE.Vector2[],
  dragIndex: number,
  newPosition: THREE.Vector2
): boolean {
  const n = vertices.length
  if (n < 4) return false  // Triangle can't self-intersect by moving a vertex

  const prev = (dragIndex - 1 + n) % n
  const next = (dragIndex + 1) % n

  // The two new edges formed by moving the vertex:
  // newEdge1: prev -> newPosition
  // newEdge2: newPosition -> next
  const newEdge1Start = vertices[prev]
  const newEdge1End = newPosition
  const newEdge2Start = newPosition
  const newEdge2End = vertices[next]

  // Check against all edges in the polygon
  for (let j = 0; j < n; j++) {
    const jNext = (j + 1) % n

    // Skip the two edges that are being replaced (they no longer exist)
    // Edge prev->dragIndex and edge dragIndex->next are replaced by the new edges
    if (j === prev && jNext === dragIndex) continue  // skip old edge prev->dragIndex
    if (j === dragIndex && jNext === next) continue  // skip old edge dragIndex->next

    const edgeStart = vertices[j]
    const edgeEnd = vertices[jNext]

    // For newEdge1 (prev -> newPosition): skip edges that share endpoint 'prev'
    // Those are: edge (prev-1)->prev and edge prev->dragIndex (already skipped above)
    const prevPrev = (prev - 1 + n) % n
    const sharesPrevWithEdge1 = (j === prevPrev && jNext === prev)

    // For newEdge2 (newPosition -> next): skip edges that share endpoint 'next'
    // Those are: edge dragIndex->next (already skipped) and edge next->(next+1)
    const nextNext = (next + 1) % n
    const sharesNextWithEdge2 = (j === next && jNext === nextNext)

    // Check newEdge1 against this edge (unless they share endpoint prev)
    if (!sharesPrevWithEdge1) {
      if (segmentsIntersect(newEdge1Start, newEdge1End, edgeStart, edgeEnd)) return true
    }

    // Check newEdge2 against this edge (unless they share endpoint next)
    if (!sharesNextWithEdge2) {
      if (segmentsIntersect(newEdge2Start, newEdge2End, edgeStart, edgeEnd)) return true
    }
  }
  return false
}
