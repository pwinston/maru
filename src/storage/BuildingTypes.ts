import type { FrozenSegmentData } from '../loft/FrozenSegment'

/**
 * Serialized format for a building's plane (floor).
 */
export interface PlaneData {
  z: number
  vertices: [number, number][]
}

/**
 * 3D bounding box for the building.
 */
export interface BoundsData {
  min: [number, number, number]
  max: [number, number, number]
}

/**
 * Version 1 building format (legacy).
 * Lock states stored but no frozen topology.
 */
export interface BuildingDataV1 {
  version: 1
  name: string
  bounds: BoundsData
  planes: PlaneData[]
  /** Lock state for each segment (optional for backwards compatibility) */
  segmentLocked?: boolean[]
}

/**
 * Version 2 building format.
 * Locked segments store frozen topology for position-only updates.
 */
export interface BuildingDataV2 {
  version: 2
  name: string
  bounds: BoundsData
  planes: PlaneData[]
  /** Lock state for each segment */
  segmentLocked: boolean[]
  /**
   * Frozen segment data for locked segments.
   * frozenSegments[i] is non-null iff segmentLocked[i] is true.
   */
  frozenSegments: (FrozenSegmentData | null)[]
}

/**
 * Union of all building data versions.
 * Deserializer handles migration from older versions.
 */
export type BuildingData = BuildingDataV1 | BuildingDataV2

/**
 * Summary info for listing buildings.
 */
export interface BuildingSummary {
  name: string
  planeCount: number
}
