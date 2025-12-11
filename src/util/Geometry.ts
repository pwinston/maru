import * as THREE from 'three'

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
