/**
 * LoftAlgorithm.ts
 *
 * Defines the interface for loft algorithms that connect two 2D sketches
 * into a 3D mesh of quads and triangles.
 */

import * as THREE from 'three'

/**
 * A single face in the loft mesh.
 *
 * - Triangle: exactly 3 vertices
 * - Quad: exactly 4 vertices (in winding order)
 *
 * Vertices are 3D points (x, y on the sketch plane, z is the height).
 */
export interface LoftFace {
  /** 3 vertices for triangle, 4 for quad, in winding order */
  vertices: THREE.Vector3[]
}

/**
 * Result of running a loft algorithm on two sketches.
 */
export interface LoftResult {
  /** The faces connecting the two sketches */
  faces: LoftFace[]
}

/**
 * A loft algorithm takes two sketches (as 2D vertex loops) at different heights
 * and produces a mesh connecting them.
 *
 * @param loopA - Vertices of the bottom sketch (2D, will be placed at heightA)
 * @param heightA - Z-height of the bottom sketch
 * @param loopB - Vertices of the top sketch (2D, will be placed at heightB)
 * @param heightB - Z-height of the top sketch
 * @returns Mesh faces (quads and triangles) connecting the two loops
 */
export type LoftAlgorithm = (
  loopA: THREE.Vector2[],
  heightA: number,
  loopB: THREE.Vector2[],
  heightB: number
) => LoftResult
