import * as THREE from 'three'
import { SketchPlane } from '../3d/SketchPlane'
import { DEFAULT_BUILDING_SIZE } from '../constants'
import {
  deserializeFrozenSegment,
  serializeFrozenSegment
} from '../loft/FrozenSegment'
import { Model } from '../model/Model'
import type { BuildingData, BuildingDataV2 } from './BuildingTypes'

/**
 * Serializes Model to/from BuildingData format.
 */
export class BuildingSerializer {
  /**
   * Convert Model to BuildingData for saving.
   * Uses v2 format when there are frozen segments, v1 otherwise.
   */
  static serialize(model: Model): BuildingData {
    let minX = Infinity, minY = Infinity, minZ = Infinity
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity

    const planeData = model.planes.map(plane => {
      const z = plane.getHeight()
      const vertices = plane.getVertices()

      minZ = Math.min(minZ, z)
      maxZ = Math.max(maxZ, z)

      const verts: [number, number][] = vertices.map(v => {
        minX = Math.min(minX, v.x)
        minY = Math.min(minY, v.y)
        maxX = Math.max(maxX, v.x)
        maxY = Math.max(maxY, v.y)
        return [v.x, v.y]
      })

      return { z, vertices: verts }
    })

    const bounds = {
      min: [minX, minY, minZ] as [number, number, number],
      max: [maxX, maxY, maxZ] as [number, number, number]
    }

    // Check if we have any frozen segments
    const hasFrozenSegments = model.frozenSegments.some(f => f !== null)

    if (hasFrozenSegments) {
      // Use v2 format with frozen segment data
      const frozenSegments = model.frozenSegments.map(frozen =>
        frozen ? serializeFrozenSegment(frozen) : null
      )

      return {
        version: 2,
        name: model.name,
        bounds,
        planes: planeData,
        segmentLocked: [...model.segmentLocked],
        frozenSegments
      } satisfies BuildingDataV2
    } else {
      // Use v1 format (no frozen segments needed)
      return {
        version: 1,
        name: model.name,
        bounds,
        planes: planeData,
        segmentLocked: [...model.segmentLocked]
      }
    }
  }

  /**
   * Convert BuildingData to Model for loading.
   * Handles both v1 and v2 formats.
   */
  static deserialize(data: BuildingData): Model {
    const planes = data.planes.map(planeData => {
      const vertices = planeData.vertices.map(([x, y]) => new THREE.Vector2(x, y))
      const plane = new SketchPlane(DEFAULT_BUILDING_SIZE, planeData.z)
      plane.setVertices(vertices)
      return plane
    })

    const model = new Model(data.name, planes)

    // Restore segment lock states if present
    if (data.segmentLocked) {
      for (let i = 0; i < data.segmentLocked.length && i < model.segmentLocked.length; i++) {
        model.segmentLocked[i] = data.segmentLocked[i]
      }
    }

    // Restore frozen segments if v2 format
    if (data.version === 2 && data.frozenSegments) {
      for (let i = 0; i < data.frozenSegments.length && i < model.frozenSegments.length; i++) {
        const frozenData = data.frozenSegments[i]
        model.frozenSegments[i] = frozenData ? deserializeFrozenSegment(frozenData) : null
      }
    }

    return model
  }
}
