import * as THREE from 'three'

// ============================================================================
// Shape Generation
// ============================================================================

/**
 * Create a regular polygon with the given number of sides.
 * @param sides Number of sides (3 = triangle, 4 = square, etc.)
 * @param size Width/height of the bounding box
 * @returns Array of vertices in CCW order, centered at origin
 */
export function createRegularPolygon(sides: number, size: number): THREE.Vector2[] {
  if (sides < 3) sides = 3
  const vertices: THREE.Vector2[] = []
  const radius = size / 2

  // Start angle: π/2 puts first vertex at top
  // Offset by π/sides for even-sided polygons to get flat bottom
  const startAngle = Math.PI / 2 + (sides % 2 === 0 ? Math.PI / sides : 0)

  for (let i = 0; i < sides; i++) {
    const angle = startAngle + (i * 2 * Math.PI) / sides
    vertices.push(new THREE.Vector2(
      radius * Math.cos(angle),
      radius * Math.sin(angle)
    ))
  }

  return vertices
}

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
 * Find the best rotation offset to align polygon B's vertices to polygon A.
 * Tries all rotations and returns the one that minimizes total distance.
 *
 * @param vertsA First polygon vertices
 * @param vertsB Second polygon vertices (must be same length as A)
 * @returns Rotation offset for B (B[i] should map to A[(i + offset) % n])
 */
export function findBestRotation(
  vertsA: THREE.Vector2[],
  vertsB: THREE.Vector2[]
): number {
  const n = vertsA.length
  if (n === 0 || n !== vertsB.length) return 0

  let bestRotation = 0
  let bestDistance = Infinity

  for (let rotation = 0; rotation < n; rotation++) {
    let totalDist = 0
    for (let i = 0; i < n; i++) {
      const bIdx = (i + rotation) % n
      totalDist += vertsA[i].distanceToSquared(vertsB[bIdx])
    }
    if (totalDist < bestDistance) {
      bestDistance = totalDist
      bestRotation = rotation
    }
  }

  return bestRotation
}

/**
 * Rotate a polygon's vertices by the given offset.
 * @returns New array with vertices rotated
 */
export function rotateVertices(
  vertices: THREE.Vector2[],
  offset: number
): THREE.Vector2[] {
  const n = vertices.length
  if (n === 0) return []
  offset = ((offset % n) + n) % n // Normalize to [0, n)
  return vertices.map((_, i) => vertices[(i + offset) % n].clone())
}

/**
 * Subdivide and align polygon B to match polygon A, minimizing total distance.
 * Tries all combinations of:
 *   - Starting rotation for subdivision (affects where interpolated verts go)
 *   - Alignment rotation after subdivision
 * Returns the B polygon subdivided and rotated for best match to A.
 *
 * @param reference The polygon to match (A)
 * @param toSubdivide The polygon to subdivide and align (B)
 * @param targetCount Target vertex count (must be >= both polygon lengths)
 */
export function subdivideAndAlign(
  reference: THREE.Vector2[],
  toSubdivide: THREE.Vector2[],
  targetCount: number
): THREE.Vector2[] {
  const n = toSubdivide.length
  if (n === 0) return []

  // If no subdivision needed, just align
  if (targetCount <= n) {
    const subdivided = subdivideToCount(toSubdivide, targetCount)
    const rotation = findBestRotation(reference, subdivided)
    return rotateVertices(subdivided, rotation)
  }

  let bestResult: THREE.Vector2[] = []
  let bestDistance = Infinity

  // Try all starting rotations for subdivision
  // This changes where interpolated vertices are placed
  for (let startRot = 0; startRot < n; startRot++) {
    // Rotate input before subdivision
    const rotatedInput = rotateVertices(toSubdivide, startRot)
    // Subdivide
    const subdivided = subdivideToCount(rotatedInput, targetCount)
    // Find best alignment rotation
    const alignRot = findBestRotation(reference, subdivided)
    const aligned = rotateVertices(subdivided, alignRot)

    // Calculate total squared distance
    let dist = 0
    for (let i = 0; i < targetCount; i++) {
      dist += reference[i].distanceToSquared(aligned[i])
    }

    if (dist < bestDistance) {
      bestDistance = dist
      bestResult = aligned
    }
  }

  return bestResult
}

/**
 * Subdivide a polygon to reach targetCount vertices by adding interpolated points.
 * PRESERVES all original vertices - only adds new ones between them.
 * New vertices are distributed proportionally to edge lengths.
 *
 * @param vertices Original vertices (will all be preserved)
 * @param targetCount Desired vertex count (must be >= vertices.length)
 * @returns New array with all originals plus interpolated vertices
 */
export function subdivideToCount(
  vertices: THREE.Vector2[],
  targetCount: number
): THREE.Vector2[] {
  const n = vertices.length
  if (n === 0) return []
  if (targetCount <= n) {
    // No subdivision needed, return clones
    return vertices.map(v => v.clone())
  }

  const toAdd = targetCount - n

  // Compute edge lengths
  const edgeLengths: number[] = []
  let totalLength = 0
  for (let i = 0; i < n; i++) {
    const len = vertices[i].distanceTo(vertices[(i + 1) % n])
    edgeLengths.push(len)
    totalLength += len
  }

  // Distribute extra vertices proportionally to edge lengths
  // Use fractional accumulation for better distribution
  const addPerEdge: number[] = new Array(n).fill(0)
  let accumulated = 0

  for (let i = 0; i < n; i++) {
    const fraction = edgeLengths[i] / totalLength
    const ideal = toAdd * fraction + accumulated
    const actual = Math.round(ideal)
    addPerEdge[i] = actual - Math.round(accumulated)
    accumulated = ideal
  }

  // Fix any rounding errors - adjust the longest edge
  const currentTotal = addPerEdge.reduce((a, b) => a + b, 0)
  if (currentTotal !== toAdd) {
    const longestEdgeIdx = edgeLengths.indexOf(Math.max(...edgeLengths))
    addPerEdge[longestEdgeIdx] += toAdd - currentTotal
  }

  // Build result: original vertex, then interpolated vertices for each edge
  const result: THREE.Vector2[] = []
  for (let i = 0; i < n; i++) {
    result.push(vertices[i].clone()) // Original vertex preserved

    const numToAdd = addPerEdge[i]
    if (numToAdd > 0) {
      const next = vertices[(i + 1) % n]
      for (let j = 1; j <= numToAdd; j++) {
        const t = j / (numToAdd + 1)
        result.push(new THREE.Vector2().lerpVectors(vertices[i], next, t))
      }
    }
  }

  return result
}

/**
 * Resample a closed polygon to have exactly targetCount vertices,
 * distributed uniformly by arc length.
 * WARNING: This does NOT preserve original vertex positions!
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
// Polygon Triangulation
// ============================================================================

/**
 * Triangulate a simple polygon using ear clipping algorithm.
 * Returns array of triangle indices (each triple is one triangle).
 * Assumes CCW winding.
 */
export function triangulatePolygon(vertices: THREE.Vector2[]): number[] {
  const n = vertices.length
  if (n < 3) return []
  if (n === 3) return [0, 1, 2]

  // Create a linked list of vertex indices
  const indices = vertices.map((_, i) => i)
  const result: number[] = []

  // Helper to check if a vertex is an "ear" (can be clipped)
  const isEar = (prev: number, curr: number, next: number): boolean => {
    const a = vertices[indices[prev]]
    const b = vertices[indices[curr]]
    const c = vertices[indices[next]]

    // Check if triangle is CCW (convex at this vertex)
    const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
    if (cross <= 0) return false

    // Check that no other vertex is inside this triangle
    for (let i = 0; i < indices.length; i++) {
      if (i === prev || i === curr || i === next) continue
      if (pointInTriangle(vertices[indices[i]], a, b, c)) return false
    }
    return true
  }

  // Ear clipping loop
  let remaining = indices.length
  let curr = 0
  let attempts = 0
  const maxAttempts = remaining * remaining // Safety limit

  while (remaining > 3 && attempts < maxAttempts) {
    const prev = (curr - 1 + remaining) % remaining
    const next = (curr + 1) % remaining

    if (isEar(prev, curr, next)) {
      // Add triangle
      result.push(indices[prev], indices[curr], indices[next])
      // Remove the ear vertex
      indices.splice(curr, 1)
      remaining--
      curr = curr % remaining
      attempts = 0 // Reset attempts after successful clip
    } else {
      curr = (curr + 1) % remaining
      attempts++
    }
  }

  // Add final triangle
  if (remaining === 3) {
    result.push(indices[0], indices[1], indices[2])
  }

  return result
}

/**
 * Check if point p is inside triangle abc.
 */
function pointInTriangle(p: THREE.Vector2, a: THREE.Vector2, b: THREE.Vector2, c: THREE.Vector2): boolean {
  const v0x = c.x - a.x, v0y = c.y - a.y
  const v1x = b.x - a.x, v1y = b.y - a.y
  const v2x = p.x - a.x, v2y = p.y - a.y

  const dot00 = v0x * v0x + v0y * v0y
  const dot01 = v0x * v1x + v0y * v1y
  const dot02 = v0x * v2x + v0y * v2y
  const dot11 = v1x * v1x + v1y * v1y
  const dot12 = v1x * v2x + v1y * v2y

  const invDenom = 1 / (dot00 * dot11 - dot01 * dot01)
  const u = (dot11 * dot02 - dot01 * dot12) * invDenom
  const v = (dot00 * dot12 - dot01 * dot02) * invDenom

  // Check if point is in triangle (excluding edges)
  return (u > 0) && (v > 0) && (u + v < 1)
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
