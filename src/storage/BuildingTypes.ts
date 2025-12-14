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
 * Full serialized building format.
 */
export interface BuildingData {
  version: 1
  name: string
  bounds: BoundsData
  planes: PlaneData[]
}

/**
 * Summary info for listing buildings.
 */
export interface BuildingSummary {
  name: string
  planeCount: number
}
