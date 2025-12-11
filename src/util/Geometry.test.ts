import * as THREE from 'three'
import { segmentsIntersect, wouldCauseSelfIntersection } from './Geometry'

let passed = 0
let failed = 0

function test(name: string, actual: boolean, expected: boolean) {
  if (actual === expected) {
    console.log(`✓ ${name}`)
    passed++
  } else {
    console.log(`✗ ${name}: got ${actual}, expected ${expected}`)
    failed++
  }
}

console.log('=== Testing segmentsIntersect ===\n')

// Two crossing segments (X shape)
test('X shape crossing',
  segmentsIntersect(
    new THREE.Vector2(0, 0), new THREE.Vector2(2, 2),
    new THREE.Vector2(0, 2), new THREE.Vector2(2, 0)
  ), true)

// Parallel segments
test('Parallel segments',
  segmentsIntersect(
    new THREE.Vector2(0, 0), new THREE.Vector2(2, 0),
    new THREE.Vector2(0, 1), new THREE.Vector2(2, 1)
  ), false)

// T intersection
test('T intersection',
  segmentsIntersect(
    new THREE.Vector2(0, 0), new THREE.Vector2(2, 0),
    new THREE.Vector2(1, 0), new THREE.Vector2(1, 1)
  ), true)

// Collinear non-overlapping
test('Collinear non-overlapping',
  segmentsIntersect(
    new THREE.Vector2(0, 0), new THREE.Vector2(1, 0),
    new THREE.Vector2(2, 0), new THREE.Vector2(3, 0)
  ), false)

console.log('\n=== Testing wouldCauseSelfIntersection ===\n')

// Square: 0=BL, 1=BR, 2=TR, 3=TL
const square = [
  new THREE.Vector2(-2, -2),  // 0: bottom-left
  new THREE.Vector2(2, -2),   // 1: bottom-right
  new THREE.Vector2(2, 2),    // 2: top-right
  new THREE.Vector2(-2, 2),   // 3: top-left
]

test('Square, drag v0 to center (no intersection)',
  wouldCauseSelfIntersection(square, 0, new THREE.Vector2(0, 0)), false)

// Drag v0 (bottom-left) across to (1,1) - new edges would be:
// v3->newPos: (-2,2)->(1,1)
// newPos->v1: (1,1)->(2,-2)
// Edge v1->v2 is (2,-2)->(2,2) (right edge)
// newEdge1 (-2,2)->(1,1) should cross edge v1->v2 (2,-2)->(2,2)? No, doesn't reach x=2
// Actually drag to (3,0) to cross the right edge
// v3->newPos: (-2,2)->(3,0)
// newPos->v1: (3,0)->(2,-2)
// Edge v1->v2 is (2,-2)->(2,2) - newEdge1 crosses this!
test('Square, drag v0 to (3,0) should cross right edge',
  wouldCauseSelfIntersection(square, 0, new THREE.Vector2(3, 0)), true)

// Let's verify manually that (-2,2)->(3,0) crosses (2,-2)->(2,2)
console.log('  Manual check: (-2,2)->(3,0) vs (2,-2)->(2,2):',
  segmentsIntersect(
    new THREE.Vector2(-2, 2), new THREE.Vector2(3, 0),
    new THREE.Vector2(2, -2), new THREE.Vector2(2, 2)
  ))

// Pentagon: added vertex at bottom-middle
const pentagon = [
  new THREE.Vector2(-2, -2),  // 0
  new THREE.Vector2(0, -2),   // 1: bottom-middle
  new THREE.Vector2(2, -2),   // 2
  new THREE.Vector2(2, 2),    // 3
  new THREE.Vector2(-2, 2),   // 4
]

// Drag v1 up and right past the right edge
test('Pentagon, drag v1 to (3,1) should cross right edge',
  wouldCauseSelfIntersection(pentagon, 1, new THREE.Vector2(3, 1)), true)

test('Pentagon, drag v1 to (0,0) (no intersection)',
  wouldCauseSelfIntersection(pentagon, 1, new THREE.Vector2(0, 0)), false)

// 5-gon with vertex on right edge
const rightMidPoly = [
  new THREE.Vector2(-2, -2),  // 0: bottom-left
  new THREE.Vector2(2, -2),   // 1: bottom-right
  new THREE.Vector2(2, 0),    // 2: right-middle
  new THREE.Vector2(2, 2),    // 3: top-right
  new THREE.Vector2(-2, 2),   // 4: top-left
]

// Drag v2 far left and up - should cross the left edge (4->0)
// newEdge1: v1(2,-2) -> newPos(-3, 1)
// newEdge2: newPos(-3,1) -> v3(2,2)
// Edge 4->0 is (-2,2)->(-2,-2) (left edge)
test('5-gon, drag v2 to (-3,1) should cross left edge',
  wouldCauseSelfIntersection(rightMidPoly, 2, new THREE.Vector2(-3, 1)), true)

// Manual verification
console.log('  Manual: newEdge1 (2,-2)->(-3,1) vs left edge (-2,2)->(-2,-2):',
  segmentsIntersect(
    new THREE.Vector2(2, -2), new THREE.Vector2(-3, 1),
    new THREE.Vector2(-2, 2), new THREE.Vector2(-2, -2)
  ))

// Another scenario: drag v2 across the top-left to bottom-right diagonal
// Let's drag it to position that crosses edge 3->4 (top edge)
// newEdge2 is newPos -> v3(2,2)
// For this to cross edge 3->4, it can't since they share v3!
// But newEdge1 (v1 -> newPos) could cross edge 3->4
// v1 = (2,-2), if newPos = (-1, 3), then newEdge1 is (2,-2)->(-1,3)
// Edge 3->4 is (2,2)->(-2,2)
test('5-gon, drag v2 to (-1,3) should cross top edge',
  wouldCauseSelfIntersection(rightMidPoly, 2, new THREE.Vector2(-1, 3)), true)

console.log('  Manual: newEdge1 (2,-2)->(-1,3) vs top edge (2,2)->(-2,2):',
  segmentsIntersect(
    new THREE.Vector2(2, -2), new THREE.Vector2(-1, 3),
    new THREE.Vector2(2, 2), new THREE.Vector2(-2, 2)
  ))

// Test case matching the screenshot:
// Start with square, add vertex on right edge, drag it to create X crossing
// The crossing in screenshot shows the new edges crossing the diagonal from top-left to bottom-right
console.log('\n=== Screenshot scenario ===')

// Looking at the screenshot more carefully:
// - There's a vertex on the right side that's been dragged left
// - The edges from that vertex cross another edge creating an X
// Let's model this exactly

// If we have vertices going: bottom-left -> bottom-right -> right-mid -> top-right -> top-left
// And drag right-mid to far left, the new edges are:
// bottom-right -> newPos (crossing occurs here)
// newPos -> top-right

// The crossing appears to be with the top-left -> bottom-left edge (left edge)
// OR with a diagonal. Looking at the image, it seems like:
// - One edge goes from top-left area down to bottom-right
// - Another edge goes from bottom-left area up to top-right

// This looks like vertex was dragged from right side to create edges that cross
// The X pattern suggests the new edge from bottom-right to newPos crosses
// the edge from top-right to top-left

const screenshotPoly = [
  new THREE.Vector2(-2, -2),  // 0: bottom-left
  new THREE.Vector2(2, -2),   // 1: bottom-right
  new THREE.Vector2(2, 0),    // 2: right-middle (vertex being dragged)
  new THREE.Vector2(2, 2),    // 3: top-right
  new THREE.Vector2(-2, 2),   // 4: top-left
]

// Drag vertex 2 to somewhere that creates an X
// If we drag to (-1, 0.5), the edges become:
// v1(2,-2) -> newPos(-1, 0.5) - this should cross edge v3->v4 (2,2)->(-2,2)?
// Let's check: line from (2,-2) to (-1, 0.5)
// At x=0: y = -2 + (0.5-(-2))/((-1)-2) * (0-2) = -2 + 2.5/(-3) * (-2) = -2 + 1.67 = -0.33
// This line doesn't cross y=2 within the segment bounds

// Let me try dragging to (-1, 2.5) to definitely cross the top edge
test('Screenshot scenario: drag to cross top edge',
  wouldCauseSelfIntersection(screenshotPoly, 2, new THREE.Vector2(-1, 2.5)), true)

// Also test dragging to create the specific X pattern from screenshot
// The screenshot shows edges crossing in middle - likely dragging creates edges that
// cross the 4->0 edge (left edge: (-2,2)->(-2,-2))
test('Screenshot scenario: drag far left to cross left edge',
  wouldCauseSelfIntersection(screenshotPoly, 2, new THREE.Vector2(-3, 0)), true)

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`)
