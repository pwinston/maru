/**
 * Model.ts
 *
 * The central data structure representing a lofted 3D shape.
 * Contains planes (2D sketches at different heights) and metadata
 * about the segments connecting them.
 */

import { SketchPlane } from '../3d/SketchPlane'
import type { FrozenSegment } from '../loft/FrozenSegment'

/**
 * A Model is the core data structure for a lofted shape.
 * It owns the planes and segment metadata (like lock state).
 */
export class Model {
  /** The name of this model */
  name: string

  /** The sketch planes (floors) that define the shape */
  planes: SketchPlane[]

  /** Lock state for each segment (length = planes.length - 1) */
  segmentLocked: boolean[]

  /**
   * Frozen segment data for locked segments.
   * frozenSegments[i] is non-null iff segmentLocked[i] is true.
   * Contains the topology snapshot captured at lock time.
   */
  frozenSegments: (FrozenSegment | null)[]

  constructor(name: string, planes: SketchPlane[] = []) {
    this.name = name
    this.planes = planes
    this.segmentLocked = this.createSegmentLockArray()
    this.frozenSegments = this.createFrozenSegmentArray()
  }

  /**
   * Create a properly-sized segment lock array (all unlocked)
   */
  private createSegmentLockArray(): boolean[] {
    const segmentCount = Math.max(0, this.planes.length - 1)
    return new Array(segmentCount).fill(false)
  }

  /**
   * Create a properly-sized frozen segment array (all null)
   */
  private createFrozenSegmentArray(): (FrozenSegment | null)[] {
    const segmentCount = Math.max(0, this.planes.length - 1)
    return new Array(segmentCount).fill(null)
  }

  /**
   * Get the number of segments (planes.length - 1)
   */
  getSegmentCount(): number {
    return Math.max(0, this.planes.length - 1)
  }

  /**
   * Ensure segment arrays match plane count.
   * Call this before accessing segment data if planes may have been modified externally.
   */
  ensureArraysInSync(): void {
    const expected = this.getSegmentCount()
    if (this.segmentLocked.length !== expected) {
      console.log(`[Model.ensureArraysInSync] Syncing arrays: was ${this.segmentLocked.length}, need ${expected}`)
      this.syncSegmentLockArray()
    }
  }

  /**
   * Check if a segment is locked
   */
  isSegmentLocked(index: number): boolean {
    this.ensureArraysInSync()
    return this.segmentLocked[index] ?? false
  }

  /**
   * Set lock state for a segment.
   * Note: When locking, caller should also call setFrozenSegment with the frozen data.
   * When unlocking, this automatically clears the frozen segment.
   */
  setSegmentLocked(index: number, locked: boolean): void {
    this.ensureArraysInSync()
    console.log(`[Model.setSegmentLocked] index=${index}, locked=${locked}, segmentLocked.length=${this.segmentLocked.length}, planes.length=${this.planes.length}`)
    if (index >= 0 && index < this.segmentLocked.length) {
      this.segmentLocked[index] = locked
      if (!locked) {
        // Clear frozen data when unlocking
        this.frozenSegments[index] = null
      }
    } else {
      console.warn(`[Model.setSegmentLocked] Index ${index} out of bounds! segmentLocked.length=${this.segmentLocked.length}`)
    }
  }

  /**
   * Get the frozen segment data for a locked segment
   */
  getFrozenSegment(index: number): FrozenSegment | null {
    this.ensureArraysInSync()
    return this.frozenSegments[index] ?? null
  }

  /**
   * Set the frozen segment data (call when locking a segment)
   */
  setFrozenSegment(index: number, frozen: FrozenSegment | null): void {
    this.ensureArraysInSync()
    if (index >= 0 && index < this.frozenSegments.length) {
      this.frozenSegments[index] = frozen
    }
  }

  /**
   * Add a plane and update segment lock array
   */
  addPlane(plane: SketchPlane): void {
    this.planes.push(plane)
    this.syncSegmentLockArray()
  }

  /**
   * Remove a plane and update segment lock array
   */
  removePlane(plane: SketchPlane): boolean {
    const index = this.planes.indexOf(plane)
    if (index === -1) return false

    this.planes.splice(index, 1)
    this.syncSegmentLockArray()
    return true
  }

  /**
   * Sync the segment arrays to match current plane count.
   * Preserves existing data where possible.
   */
  private syncSegmentLockArray(): void {
    const segmentCount = this.getSegmentCount()

    // Add false/null for new segments
    while (this.segmentLocked.length < segmentCount) {
      this.segmentLocked.push(false)
      this.frozenSegments.push(null)
    }

    // Trim if planes were removed
    this.segmentLocked.length = segmentCount
    this.frozenSegments.length = segmentCount
  }

  /**
   * Get planes sorted by height (bottom to top)
   */
  getPlanesSortedByHeight(): SketchPlane[] {
    return [...this.planes].sort((a, b) => a.getHeight() - b.getHeight())
  }
}
