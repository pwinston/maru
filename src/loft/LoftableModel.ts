/**
 * LoftableModel.ts
 *
 * Represents a lofted shape as a collection of segments,
 * where each segment contains the mesh faces connecting two planes.
 */

import * as THREE from 'three'
import { SketchPlane } from '../3d/SketchPlane'
import { perimeterWalkAlgorithm } from './PerimeterWalkAlgorithm'
import type { LoftFace } from './LoftAlgorithm'

/**
 * A single floor-to-floor segment containing mesh faces.
 */
export class LoftSegment {
  /** Bottom plane reference */
  bottomPlane: SketchPlane

  /** Top plane reference */
  topPlane: SketchPlane

  /** Mesh faces (quads and triangles) connecting the two planes */
  faces: LoftFace[]

  constructor(
    bottomPlane: SketchPlane,
    topPlane: SketchPlane,
    faces: LoftFace[]
  ) {
    this.bottomPlane = bottomPlane
    this.topPlane = topPlane
    this.faces = faces
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
 */
export class LoftableModel {
  segments: LoftSegment[]

  constructor(segments: LoftSegment[]) {
    this.segments = segments
  }

  /**
   * Create a LoftableModel from an array of sketch planes.
   */
  static fromPlanes(planes: SketchPlane[]): LoftableModel {
    if (planes.length < 2) {
      return new LoftableModel([])
    }

    // Sort planes by height
    const sortedPlanes = [...planes].sort((a, b) => a.getHeight() - b.getHeight())

    const segments: LoftSegment[] = []

    for (let i = 0; i < sortedPlanes.length - 1; i++) {
      const bottomPlane = sortedPlanes[i]
      const topPlane = sortedPlanes[i + 1]

      const result = perimeterWalkAlgorithm(
        bottomPlane.getSketch().getVertices(),
        bottomPlane.getHeight(),
        topPlane.getSketch().getVertices(),
        topPlane.getHeight()
      )

      segments.push(new LoftSegment(bottomPlane, topPlane, result.faces))
    }

    return new LoftableModel(segments)
  }

  /**
   * Get the roof vertices (top of the last segment).
   * Returns null if there are no segments.
   */
  getRoofVertices(): THREE.Vector2[] | null {
    if (this.segments.length === 0) return null
    const topPlane = this.segments[this.segments.length - 1].topPlane
    return topPlane.getSketch().getVertices()
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
