import * as THREE from 'three'
import { SketchPlane } from '../3d/SketchPlane'
import { DEFAULT_BUILDING_SIZE } from '../constants'
import type { BuildingData } from './BuildingTypes'

/**
 * Serializes SketchPlane arrays to/from BuildingData format.
 */
export class BuildingSerializer {
  /**
   * Convert SketchPlane array to BuildingData for saving.
   */
  static serialize(planes: SketchPlane[]): BuildingData {
    let minX = Infinity, minY = Infinity, minZ = Infinity
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity

    const planeData = planes.map(plane => {
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

    return {
      version: 1,
      name: 'building',
      bounds: {
        min: [minX, minY, minZ],
        max: [maxX, maxY, maxZ]
      },
      planes: planeData
    }
  }

  /**
   * Convert BuildingData to SketchPlane array for loading.
   */
  static deserialize(data: BuildingData): SketchPlane[] {
    return data.planes.map(planeData => {
      const vertices = planeData.vertices.map(([x, y]) => new THREE.Vector2(x, y))
      const plane = new SketchPlane(DEFAULT_BUILDING_SIZE, planeData.z)
      plane.setVertices(vertices)
      return plane
    })
  }
}
