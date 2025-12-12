import * as THREE from 'three'
import { SketchPlane } from './SketchPlane'
import { LOFT } from '../constants'
import { triangulatePolygon } from '../util/Geometry'
import { LoftableModel, LoftSegment } from '../loft/LoftableModel'

export type WireframeMode = 'off' | 'triangles' | 'quads'

/**
 * Creates a 3D mesh by lofting through sketch planes at different heights.
 * Connects corresponding vertices between planes with triangulated quads.
 */
export class Loft {
  private mesh: THREE.Mesh | null = null
  private roofMesh: THREE.Mesh | null = null
  private wireframeQuads: THREE.LineSegments | null = null
  private wireframeTris: THREE.LineSegments | null = null
  private group: THREE.Group
  private solidVisible = false
  private roofVisible = false
  private wireframeMode: WireframeMode = 'off'

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
   * Set solid mesh visibility
   */
  setSolidVisible(visible: boolean): void {
    this.solidVisible = visible
    this.updateVisibility()
  }

  /**
   * Get solid mesh visibility
   */
  getSolidVisible(): boolean {
    return this.solidVisible
  }

  /**
   * Set wireframe mode (off, triangles, or quads)
   */
  setWireframeMode(mode: WireframeMode): void {
    this.wireframeMode = mode
    this.updateVisibility()
  }

  /**
   * Get current wireframe mode
   */
  getWireframeMode(): WireframeMode {
    return this.wireframeMode
  }

  /**
   * Set roof visibility
   */
  setRoofVisible(visible: boolean): void {
    this.roofVisible = visible
    this.updateVisibility()
  }

  /**
   * Get roof visibility
   */
  getRoofVisible(): boolean {
    return this.roofVisible
  }

  /**
   * Update visibility based on current settings
   */
  private updateVisibility(): void {
    if (this.mesh) {
      this.mesh.visible = this.solidVisible
    }
    if (this.roofMesh) {
      this.roofMesh.visible = this.roofVisible
    }
    if (this.wireframeQuads) {
      this.wireframeQuads.visible = this.wireframeMode === 'quads'
    }
    if (this.wireframeTris) {
      this.wireframeTris.visible = this.wireframeMode === 'triangles'
    }
  }

  /**
   * Rebuild the loft from a LoftableModel with per-segment vertex counts.
   * Each segment can have its own vertex count, optimized for that pair.
   */
  rebuildFromModel(model: LoftableModel): void {
    // Clear existing geometry
    this.group.clear()
    this.mesh = null
    this.roofMesh = null
    this.wireframeQuads = null
    this.wireframeTris = null

    if (model.segments.length === 0) return

    // Sort segments by height (bottom to top)
    const sortedSegments = [...model.segments].sort(
      (a, b) => a.getBottomHeight() - b.getBottomHeight()
    )

    // Build wall geometry from all segments
    const wallGeometry = this.buildWallGeometryFromSegments(sortedSegments)
    if (!wallGeometry) return

    // Build roof geometry from top of last segment
    const roofGeometry = this.buildRoofGeometryFromSegment(sortedSegments[sortedSegments.length - 1])

    // Create wall mesh
    const material = new THREE.MeshStandardMaterial({
      color: LOFT.SOLID_COLOR,
      side: THREE.DoubleSide,
      flatShading: false,
    })
    this.mesh = new THREE.Mesh(wallGeometry, material)
    this.group.add(this.mesh)

    // Create roof mesh
    if (roofGeometry) {
      this.roofMesh = new THREE.Mesh(roofGeometry, material.clone())
      this.group.add(this.roofMesh)
    }

    // Create both wireframe types
    const wireMaterial = new THREE.LineBasicMaterial({ color: LOFT.WIRE_COLOR })

    // Quad wireframe (without triangle diagonals)
    const quadWireGeometry = this.buildQuadWireframeFromSegments(sortedSegments)
    this.wireframeQuads = new THREE.LineSegments(quadWireGeometry, wireMaterial)
    this.group.add(this.wireframeQuads)

    // Triangle wireframe (all edges including diagonals) - walls only
    const triWireGeometry = new THREE.WireframeGeometry(wallGeometry)
    this.wireframeTris = new THREE.LineSegments(triWireGeometry, wireMaterial.clone())
    this.group.add(this.wireframeTris)

    this.updateVisibility()
  }

  /**
   * Build wall geometry from segments (each segment can have different vertex count).
   */
  private buildWallGeometryFromSegments(segments: LoftSegment[]): THREE.BufferGeometry | null {
    const allPositions: number[] = []
    const allIndices: number[] = []
    let vertexOffset = 0

    for (const segment of segments) {
      const numVerts = segment.getVertexCount()
      if (numVerts === 0) continue

      const bottomHeight = segment.getBottomHeight()
      const topHeight = segment.getTopHeight()

      // Add bottom vertices
      for (const v of segment.bottomVertices) {
        allPositions.push(v.x, bottomHeight, -v.y)
      }
      // Add top vertices
      for (const v of segment.topVertices) {
        allPositions.push(v.x, topHeight, -v.y)
      }

      // Build triangles for this segment
      for (let v = 0; v < numVerts; v++) {
        const nextV = (v + 1) % numVerts
        const bl = vertexOffset + v
        const br = vertexOffset + nextV
        const tl = vertexOffset + numVerts + v
        const tr = vertexOffset + numVerts + nextV

        allIndices.push(bl, br, tr)
        allIndices.push(bl, tr, tl)
      }

      vertexOffset += numVerts * 2
    }

    if (allPositions.length === 0) return null

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(allPositions, 3))
    geometry.setIndex(allIndices)
    geometry.computeVertexNormals()

    return geometry
  }

  /**
   * Build quad wireframe from segments.
   */
  private buildQuadWireframeFromSegments(segments: LoftSegment[]): THREE.BufferGeometry {
    const linePositions: number[] = []

    for (const segment of segments) {
      const numVerts = segment.getVertexCount()
      if (numVerts === 0) continue

      const bottomHeight = segment.getBottomHeight()
      const topHeight = segment.getTopHeight()

      // Convert to 3D
      const bottom3d = segment.bottomVertices.map(v => new THREE.Vector3(v.x, bottomHeight, -v.y))
      const top3d = segment.topVertices.map(v => new THREE.Vector3(v.x, topHeight, -v.y))

      // Horizontal edges (bottom polygon)
      for (let v = 0; v < numVerts; v++) {
        const nextV = (v + 1) % numVerts
        const v1 = bottom3d[v]
        const v2 = bottom3d[nextV]
        linePositions.push(v1.x, v1.y, v1.z, v2.x, v2.y, v2.z)
      }

      // Horizontal edges (top polygon)
      for (let v = 0; v < numVerts; v++) {
        const nextV = (v + 1) % numVerts
        const v1 = top3d[v]
        const v2 = top3d[nextV]
        linePositions.push(v1.x, v1.y, v1.z, v2.x, v2.y, v2.z)
      }

      // Vertical edges
      for (let v = 0; v < numVerts; v++) {
        const v1 = bottom3d[v]
        const v2 = top3d[v]
        linePositions.push(v1.x, v1.y, v1.z, v2.x, v2.y, v2.z)
      }
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3))
    return geometry
  }

  /**
   * Build roof geometry from the top of a segment.
   */
  private buildRoofGeometryFromSegment(segment: LoftSegment): THREE.BufferGeometry | null {
    const topVerts = segment.topVertices
    const topHeight = segment.getTopHeight()

    if (topVerts.length < 3) return null

    const positions: number[] = []
    for (const v of topVerts) {
      positions.push(v.x, topHeight, -v.y)
    }

    const roofTriangles = triangulatePolygon(topVerts)
    if (roofTriangles.length === 0) return null

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setIndex(roofTriangles)
    geometry.computeVertexNormals()

    return geometry
  }

  /**
   * Build quad wireframe from pre-computed vertices.
   */
  private buildQuadWireframeFromVertices(
    sortedPlanes: SketchPlane[],
    sortedVertices: THREE.Vector2[][]
  ): THREE.BufferGeometry {
    const numPlanes = sortedPlanes.length
    const numVerticesPerPlane = sortedVertices[0].length

    // Convert 2D to 3D coordinates
    const allVertices: THREE.Vector3[][] = []
    for (let p = 0; p < numPlanes; p++) {
      const height = sortedPlanes[p].getHeight()
      const verts2d = sortedVertices[p]
      const verts3d = verts2d.map(v => new THREE.Vector3(v.x, height, -v.y))
      allVertices.push(verts3d)
    }

    const linePositions: number[] = []

    // Horizontal edges (polygon outline on each plane)
    for (let p = 0; p < numPlanes; p++) {
      for (let v = 0; v < numVerticesPerPlane; v++) {
        const nextV = (v + 1) % numVerticesPerPlane
        const v1 = allVertices[p][v]
        const v2 = allVertices[p][nextV]
        linePositions.push(v1.x, v1.y, v1.z, v2.x, v2.y, v2.z)
      }
    }

    // Vertical edges (connecting corresponding vertices between adjacent planes)
    for (let p = 0; p < numPlanes - 1; p++) {
      for (let v = 0; v < numVerticesPerPlane; v++) {
        const v1 = allVertices[p][v]
        const v2 = allVertices[p + 1][v]
        linePositions.push(v1.x, v1.y, v1.z, v2.x, v2.y, v2.z)
      }
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3))
    return geometry
  }

  /**
   * Build wall geometry from pre-computed vertices (no roof).
   */
  private buildWallGeometry(
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

    // Build triangles for walls only
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

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()

    return geometry
  }

  /**
   * Build roof geometry from top plane vertices.
   */
  private buildRoofGeometry(
    sortedPlanes: SketchPlane[],
    sortedVertices: THREE.Vector2[][]
  ): THREE.BufferGeometry | null {
    const numPlanes = sortedPlanes.length
    const topHeight = sortedPlanes[numPlanes - 1].getHeight()
    const topVerts2d = sortedVertices[numPlanes - 1]

    if (topVerts2d.length < 3) return null

    // Convert to 3D
    const positions: number[] = []
    for (const v of topVerts2d) {
      positions.push(v.x, topHeight, -v.y)
    }

    // Triangulate
    const roofTriangles = triangulatePolygon(topVerts2d)
    if (roofTriangles.length === 0) return null

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setIndex(roofTriangles)
    geometry.computeVertexNormals()

    return geometry
  }
}
