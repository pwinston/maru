import * as THREE from 'three'
import { SketchPlane } from '../3d/SketchPlane'
import { getLoftAlgorithm } from './LoftAlgorithms'
import { LOFT } from '../constants'

// Import algorithms to register them
import './AnchorResampleAlgorithm'
import './UniformResampleAlgorithm'

/**
 * A single floor-to-floor segment with matched vertex arrays.
 * Both vertex arrays have the same count, optimized for this specific pair.
 */
export class LoftSegment {
  bottomPlane: SketchPlane
  topPlane: SketchPlane
  bottomVertices: THREE.Vector2[]
  topVertices: THREE.Vector2[]

  constructor(
    bottomPlane: SketchPlane,
    topPlane: SketchPlane,
    bottomVertices: THREE.Vector2[],
    topVertices: THREE.Vector2[]
  ) {
    this.bottomPlane = bottomPlane
    this.topPlane = topPlane
    this.bottomVertices = bottomVertices
    this.topVertices = topVertices
  }

  getVertexCount(): number {
    return this.bottomVertices.length
  }

  getBottomHeight(): number {
    return this.bottomPlane.getHeight()
  }

  getTopHeight(): number {
    return this.topPlane.getHeight()
  }
}

/**
 * A loftable model consisting of segments between adjacent planes.
 * Each segment can have its own vertex count, optimized for that specific pair.
 */
export class LoftableModel {
  segments: LoftSegment[]

  constructor(segments: LoftSegment[]) {
    this.segments = segments
  }

  /**
   * Create a LoftableModel from an array of sketch planes.
   * Uses the specified algorithm (or default) to match vertices pairwise.
   */
  static fromPlanes(planes: SketchPlane[], algorithmName?: string): LoftableModel {
    if (planes.length < 2) {
      return new LoftableModel([])
    }

    const name = algorithmName ?? LOFT.DEFAULT_ALGORITHM ?? 'uniform'
    const algorithm = getLoftAlgorithm(name)

    if (!algorithm) {
      console.warn(`Unknown loft algorithm: ${name}, using uniform`)
      const fallback = getLoftAlgorithm('uniform')
      if (!fallback) {
        throw new Error('No loft algorithms registered')
      }
      return LoftableModel.buildPairwise(planes, fallback)
    }

    return LoftableModel.buildPairwise(planes, algorithm)
  }

  /**
   * Build segments pairwise using the given algorithm.
   * Each pair of adjacent planes gets its own optimized vertex count.
   */
  private static buildPairwise(
    planes: SketchPlane[],
    algorithm: (sketches: import('../2d/Sketch').Sketch[]) => THREE.Vector2[][]
  ): LoftableModel {
    const segments: LoftSegment[] = []

    for (let i = 0; i < planes.length - 1; i++) {
      const bottomPlane = planes[i]
      const topPlane = planes[i + 1]

      // Process just this pair
      const [bottomVerts, topVerts] = algorithm([
        bottomPlane.getSketch(),
        topPlane.getSketch()
      ])

      segments.push(new LoftSegment(bottomPlane, topPlane, bottomVerts, topVerts))
    }

    return new LoftableModel(segments)
  }

  /**
   * Get the roof vertices (top of the last segment).
   * Returns null if there are no segments.
   */
  getRoofVertices(): THREE.Vector2[] | null {
    if (this.segments.length === 0) return null
    return this.segments[this.segments.length - 1].topVertices
  }

  /**
   * Get the roof height (top of the last segment).
   */
  getRoofHeight(): number {
    if (this.segments.length === 0) return 0
    return this.segments[this.segments.length - 1].getTopHeight()
  }

  /**
   * Get all planes in order (bottom to top).
   */
  getPlanes(): SketchPlane[] {
    if (this.segments.length === 0) return []
    const planes = [this.segments[0].bottomPlane]
    for (const segment of this.segments) {
      planes.push(segment.topPlane)
    }
    return planes
  }
}
