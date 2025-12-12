import * as THREE from 'three'
import { SketchPlane } from './SketchPlane'
import { LOFT } from '../constants'
import { triangulatePolygon } from '../util/Geometry'

export type RenderMode = 'solid' | 'wire' | 'both' | 'none'

/**
 * Creates a 3D mesh by lofting through sketch planes at different heights.
 * Connects corresponding vertices between planes with triangulated quads.
 */
export class Loft {
  private mesh: THREE.Mesh | null = null
  private wireframe: THREE.LineSegments | null = null
  private group: THREE.Group
  private renderMode: RenderMode = 'both'

  constructor() {
    this.group = new THREE.Group()
  }

  /**
   * Get the Three.js group containing the loft geometry
   */
  getGroup(): THREE.Group {
    return this.group
  }

  /**
   * Set the render mode (solid, wire, or both)
   */
  setRenderMode(mode: RenderMode): void {
    this.renderMode = mode
    this.updateVisibility()
  }

  /**
   * Get the current render mode
   */
  getRenderMode(): RenderMode {
    return this.renderMode
  }

  /**
   * Update visibility based on render mode
   */
  private updateVisibility(): void {
    if (this.mesh) {
      this.mesh.visible = this.renderMode === 'solid' || this.renderMode === 'both'
    }
    if (this.wireframe) {
      this.wireframe.visible = this.renderMode === 'wire' || this.renderMode === 'both'
    }
  }

  /**
   * Check if loft is visible (not in 'none' mode)
   */
  isVisible(): boolean {
    return this.renderMode !== 'none'
  }

  /**
   * Rebuild the loft mesh from the given planes.
   * Planes are sorted by height and connected with triangulated quads.
   */
  rebuild(planes: SketchPlane[]): void {
    // Clear existing geometry
    this.group.clear()
    this.mesh = null
    this.wireframe = null

    // Need at least 2 planes to create a loft
    if (planes.length < 2) return

    // Sort planes by height (Y position)
    const sortedPlanes = [...planes].sort((a, b) => a.getHeight() - b.getHeight())

    // Check that all planes have the same vertex count
    const vertexCounts = sortedPlanes.map(p => p.getSketch().getVertexCount())
    const firstCount = vertexCounts[0]
    if (!vertexCounts.every(c => c === firstCount)) {
      console.warn('Loft: All planes must have the same vertex count')
      return
    }

    // Build the geometry
    const geometry = this.buildGeometry(sortedPlanes)
    if (!geometry) return

    // Create solid mesh
    const material = new THREE.MeshStandardMaterial({
      color: LOFT.SOLID_COLOR,
      side: THREE.DoubleSide,
      flatShading: false,
    })
    this.mesh = new THREE.Mesh(geometry, material)
    this.group.add(this.mesh)

    // Create wireframe
    const wireGeometry = new THREE.WireframeGeometry(geometry)
    const wireMaterial = new THREE.LineBasicMaterial({ color: LOFT.WIRE_COLOR })
    this.wireframe = new THREE.LineSegments(wireGeometry, wireMaterial)
    this.group.add(this.wireframe)

    this.updateVisibility()
  }

  /**
   * Build the BufferGeometry for the loft
   */
  private buildGeometry(sortedPlanes: SketchPlane[]): THREE.BufferGeometry | null {
    const numPlanes = sortedPlanes.length
    const numVerticesPerPlane = sortedPlanes[0].getSketch().getVertexCount()

    // Collect all 3D vertices: convert 2D sketch coords to 3D world coords
    // Sketch is in XY, plane is rotated -90 around X and positioned at height Y
    // So sketch (x, y) becomes world (x, height, -y)
    const allVertices: THREE.Vector3[][] = []

    for (const plane of sortedPlanes) {
      const height = plane.getHeight()
      const verts2d = plane.getVertices()
      const verts3d = verts2d.map(v => new THREE.Vector3(v.x, height, -v.y))
      allVertices.push(verts3d)
    }

    // Build triangles connecting adjacent planes
    // Each quad between planes becomes 2 triangles
    const positions: number[] = []
    const indices: number[] = []

    // First, add all vertex positions
    for (let p = 0; p < numPlanes; p++) {
      for (let v = 0; v < numVerticesPerPlane; v++) {
        const vert = allVertices[p][v]
        positions.push(vert.x, vert.y, vert.z)
      }
    }

    // Build indices for quads between adjacent planes
    for (let p = 0; p < numPlanes - 1; p++) {
      const baseIndex = p * numVerticesPerPlane
      const nextBaseIndex = (p + 1) * numVerticesPerPlane

      for (let v = 0; v < numVerticesPerPlane; v++) {
        const nextV = (v + 1) % numVerticesPerPlane

        // Quad corners:
        // bottomLeft = current plane, current vertex
        // bottomRight = current plane, next vertex
        // topLeft = next plane, current vertex
        // topRight = next plane, next vertex
        const bl = baseIndex + v
        const br = baseIndex + nextV
        const tl = nextBaseIndex + v
        const tr = nextBaseIndex + nextV

        // Two triangles per quad (CCW winding when viewed from outside)
        // Triangle 1: bl, br, tr
        indices.push(bl, br, tr)
        // Triangle 2: bl, tr, tl
        indices.push(bl, tr, tl)
      }
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()

    return geometry
  }

  /**
   * Rebuild the loft using pre-computed loftable vertices.
   * This bypasses the vertex count check since vertices are already matched.
   * @param planes The original sketch planes (for height information)
   * @param loftableVertices Pre-resampled vertex arrays, all with same count
   */
  rebuildFromVertices(planes: SketchPlane[], loftableVertices: THREE.Vector2[][]): void {
    // Clear existing geometry
    this.group.clear()
    this.mesh = null
    this.wireframe = null

    if (planes.length < 2) return
    if (loftableVertices.length !== planes.length) {
      console.warn('Loft: vertices array count must match planes count')
      return
    }

    // Verify all vertex arrays have the same count
    const counts = loftableVertices.map(v => v.length)
    if (!counts.every(c => c === counts[0])) {
      console.warn('Loft: all loftable vertex arrays must have the same count')
      return
    }

    // Sort planes by height, reorder vertices to match
    const indexed = planes.map((p, i) => ({ height: p.getHeight(), index: i }))
    indexed.sort((a, b) => a.height - b.height)

    const sortedPlanes = indexed.map(item => planes[item.index])
    const sortedVertices = indexed.map(item => loftableVertices[item.index])

    // Build geometry using sortedVertices
    const geometry = this.buildGeometryFromVertices(sortedPlanes, sortedVertices)
    if (!geometry) return

    // Create mesh and wireframe
    const material = new THREE.MeshStandardMaterial({
      color: LOFT.SOLID_COLOR,
      side: THREE.DoubleSide,
      flatShading: false,
    })
    this.mesh = new THREE.Mesh(geometry, material)
    this.group.add(this.mesh)

    const wireGeometry = new THREE.WireframeGeometry(geometry)
    const wireMaterial = new THREE.LineBasicMaterial({ color: LOFT.WIRE_COLOR })
    this.wireframe = new THREE.LineSegments(wireGeometry, wireMaterial)
    this.group.add(this.wireframe)

    this.updateVisibility()
  }

  /**
   * Build geometry from pre-computed vertices.
   */
  private buildGeometryFromVertices(
    sortedPlanes: SketchPlane[],
    sortedVertices: THREE.Vector2[][]
  ): THREE.BufferGeometry | null {
    const numPlanes = sortedPlanes.length
    const numVerticesPerPlane = sortedVertices[0].length

    if (numVerticesPerPlane === 0) return null

    // Convert 2D to 3D coordinates
    const allVertices: THREE.Vector3[][] = []
    for (let p = 0; p < numPlanes; p++) {
      const height = sortedPlanes[p].getHeight()
      const verts2d = sortedVertices[p]
      const verts3d = verts2d.map(v => new THREE.Vector3(v.x, height, -v.y))
      allVertices.push(verts3d)
    }

    // Build triangles (same logic as existing buildGeometry)
    const positions: number[] = []
    const indices: number[] = []

    for (let p = 0; p < numPlanes; p++) {
      for (let v = 0; v < numVerticesPerPlane; v++) {
        const vert = allVertices[p][v]
        positions.push(vert.x, vert.y, vert.z)
      }
    }

    for (let p = 0; p < numPlanes - 1; p++) {
      const baseIndex = p * numVerticesPerPlane
      const nextBaseIndex = (p + 1) * numVerticesPerPlane

      for (let v = 0; v < numVerticesPerPlane; v++) {
        const nextV = (v + 1) % numVerticesPerPlane
        const bl = baseIndex + v
        const br = baseIndex + nextV
        const tl = nextBaseIndex + v
        const tr = nextBaseIndex + nextV

        indices.push(bl, br, tr)
        indices.push(bl, tr, tl)
      }
    }

    // Add roof cap (triangulate top plane)
    const topBaseIndex = (numPlanes - 1) * numVerticesPerPlane
    const topVerts2d = sortedVertices[numPlanes - 1]
    const roofTriangles = triangulatePolygon(topVerts2d)
    for (const idx of roofTriangles) {
      indices.push(topBaseIndex + idx)
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()

    return geometry
  }
}
