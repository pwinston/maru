/**
 * LoftGeometry.ts
 *
 * Computed geometry for a lofted shape, organized as segments
 * where each segment contains the mesh faces connecting two planes.
 * Ephemeral - rebuilt on every model change.
 */

import * as THREE from 'three'
import { SketchPlane } from '../3d/SketchPlane'
import { Model } from '../model/Model'
import {
  createFrozenSegment,
  frozenFacesToLoftFaces,
  updateFrozenPositions
} from './FrozenSegment'
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

  /** Whether this segment is locked (topology frozen) */
  isLocked: boolean

  constructor(
    bottomPlane: SketchPlane,
    topPlane: SketchPlane,
    faces: LoftFace[],
    isLocked: boolean = false
  ) {
    this.bottomPlane = bottomPlane
    this.topPlane = topPlane
    this.faces = faces
    this.isLocked = isLocked
  }

  getBottomHeight(): number {
    return this.bottomPlane.getHeight()
  }

  getTopHeight(): number {
    return this.topPlane.getHeight()
  }
}

/**
 * Computed loft geometry consisting of segments between adjacent planes.
 */
export class LoftGeometry {
  segments: LoftSegment[]

  constructor(segments: LoftSegment[]) {
    this.segments = segments
  }

  /**
   * Create a LoftGeometry from an array of sketch planes.
   * Always rebuilds all segments (ignores lock states).
   */
  static fromPlanes(planes: SketchPlane[]): LoftGeometry {
    if (planes.length < 2) {
      return new LoftGeometry([])
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

    return new LoftGeometry(segments)
  }

  /**
   * Create a LoftGeometry from a Model, respecting lock states.
   *
   * For locked segments with frozen data:
   * - Uses the frozen topology (face connectivity stays fixed)
   * - Updates vertex positions from current sketch vertices
   *
   * For unlocked segments:
   * - Rebuilds using perimeterWalkAlgorithm (topology may change)
   */
  static fromModel(model: Model): LoftGeometry {
    if (model.planes.length < 2) {
      return new LoftGeometry([])
    }

    // Sort planes by height
    const sortedPlanes = [...model.planes].sort((a, b) => a.getHeight() - b.getHeight())

    const segments: LoftSegment[] = []

    for (let i = 0; i < sortedPlanes.length - 1; i++) {
      const bottomPlane = sortedPlanes[i]
      const topPlane = sortedPlanes[i + 1]
      const isLocked = model.isSegmentLocked(i)
      const frozen = model.getFrozenSegment(i)

      let faces: LoftFace[]

      if (isLocked && frozen) {
        // Locked segment with frozen topology:
        // Update positions from current sketches, keep topology fixed
        updateFrozenPositions(
          frozen,
          bottomPlane.getSketch().getVertices(),
          bottomPlane.getHeight(),
          topPlane.getSketch().getVertices(),
          topPlane.getHeight()
        )
        faces = frozenFacesToLoftFaces(frozen.faces)
      } else {
        // Unlocked segment (or locked without frozen data):
        // Rebuild from scratch
        const result = perimeterWalkAlgorithm(
          bottomPlane.getSketch().getVertices(),
          bottomPlane.getHeight(),
          topPlane.getSketch().getVertices(),
          topPlane.getHeight()
        )
        faces = result.faces
      }

      segments.push(new LoftSegment(bottomPlane, topPlane, faces, isLocked))
    }

    return new LoftGeometry(segments)
  }

  /**
   * Capture frozen segment data for a segment.
   * Call this when locking a segment to snapshot its current topology.
   */
  static freezeSegment(
    bottomPlane: SketchPlane,
    topPlane: SketchPlane,
    faces: LoftFace[]
  ) {
    return createFrozenSegment(
      faces,
      bottomPlane.getSketch().getVertices(),
      bottomPlane.getHeight(),
      topPlane.getSketch().getVertices(),
      topPlane.getHeight()
    )
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

  /**
   * Export debug data for all segments.
   * Use this to capture loft input data for debugging/testing.
   */
  exportDebugData(): LoftDebugData {
    return {
      timestamp: new Date().toISOString(),
      segmentCount: this.segments.length,
      segments: this.segments.map((seg, i) => ({
        index: i,
        bottom: {
          height: seg.getBottomHeight(),
          vertices: seg.bottomPlane.getVertices().map(v => [v.x, v.y] as [number, number])
        },
        top: {
          height: seg.getTopHeight(),
          vertices: seg.topPlane.getVertices().map(v => [v.x, v.y] as [number, number])
        },
        faceCount: seg.faces.length,
        faceTypes: {
          triangles: seg.faces.filter(f => f.vertices.length === 3).length,
          quads: seg.faces.filter(f => f.vertices.length === 4).length
        }
      }))
    }
  }
}

/**
 * Debug data structure for loft segments.
 */
export interface LoftDebugData {
  timestamp: string
  segmentCount: number
  segments: Array<{
    index: number
    bottom: {
      height: number
      vertices: [number, number][]
    }
    top: {
      height: number
      vertices: [number, number][]
    }
    faceCount: number
    faceTypes: {
      triangles: number
      quads: number
    }
  }>
}
