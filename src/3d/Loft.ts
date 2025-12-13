/**
 * Loft.ts
 *
 * Creates a 3D mesh by lofting through sketch planes at different heights.
 * Renders quads and triangles from the loft algorithm output.
 */

import * as THREE from 'three'
import { LOFT } from '../constants'
import { triangulatePolygon } from '../util/Geometry'
import { LoftableModel } from '../loft/LoftableModel'
import type { LoftFace } from '../loft/LoftAlgorithm'

export type WireframeMode = 'off' | 'normal' | 'tris'

/**
 * Creates a 3D mesh by lofting through sketch planes at different heights.
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
      this.wireframeQuads.visible = this.wireframeMode === 'normal'
    }
    if (this.wireframeTris) {
      this.wireframeTris.visible = this.wireframeMode === 'tris'
    }
  }

  /**
   * Rebuild the loft from a LoftableModel.
   */
  rebuildFromModel(model: LoftableModel): void {
    // Clear existing geometry
    this.group.clear()
    this.mesh = null
    this.roofMesh = null
    this.wireframeQuads = null
    this.wireframeTris = null

    if (model.segments.length === 0) return

    // Collect all faces from all segments
    const allFaces: LoftFace[] = []
    for (const segment of model.segments) {
      allFaces.push(...segment.faces)
    }

    if (allFaces.length === 0) return

    // Build wall geometry from faces
    const wallGeometry = this.buildGeometryFromFaces(allFaces)
    if (!wallGeometry) return

    // Build roof geometry
    const roofVerts = model.getRoofVertices()
    const roofHeight = model.getRoofHeight()
    const roofGeometry = roofVerts ? this.buildRoofGeometry(roofVerts, roofHeight) : null

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

    // Create wireframe geometries
    const wireMaterial = new THREE.LineBasicMaterial({ color: LOFT.WIRE_COLOR })

    // Quad wireframe (face edges only, no triangle diagonals)
    const quadWireGeometry = this.buildQuadWireframeFromFaces(allFaces)
    this.wireframeQuads = new THREE.LineSegments(quadWireGeometry, wireMaterial)
    this.group.add(this.wireframeQuads)

    // Triangle wireframe (all edges including diagonals)
    const triWireGeometry = new THREE.WireframeGeometry(wallGeometry)
    this.wireframeTris = new THREE.LineSegments(triWireGeometry, wireMaterial.clone())
    this.group.add(this.wireframeTris)

    this.updateVisibility()
  }

  /**
   * Build geometry from faces (quads and triangles).
   * Quads are split into two triangles for rendering.
   */
  private buildGeometryFromFaces(faces: LoftFace[]): THREE.BufferGeometry | null {
    if (faces.length === 0) return null

    const positions: number[] = []
    const indices: number[] = []

    for (const face of faces) {
      const verts = face.vertices
      const baseIndex = positions.length / 3

      // Add vertices (convert from our coordinate system to Three.js)
      // Our: x=right, y=forward, z=up
      // Three.js: x=right, y=up, z=-forward
      for (const v of verts) {
        positions.push(v.x, v.z, -v.y)
      }

      if (verts.length === 3) {
        // Triangle
        indices.push(baseIndex, baseIndex + 1, baseIndex + 2)
      } else if (verts.length === 4) {
        // Quad - split into two triangles
        // Vertices are in order: a0, a1, b1, b0 (see FaceBuilder.addQuad)
        // Triangle 1: a0, a1, b1
        // Triangle 2: a0, b1, b0
        indices.push(baseIndex, baseIndex + 1, baseIndex + 2)
        indices.push(baseIndex, baseIndex + 2, baseIndex + 3)
      }
    }

    if (positions.length === 0) return null

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()

    return geometry
  }

  /**
   * Build wireframe showing face edges (quads shown as quads, not triangulated).
   */
  private buildQuadWireframeFromFaces(faces: LoftFace[]): THREE.BufferGeometry {
    const linePositions: number[] = []

    for (const face of faces) {
      const verts = face.vertices
      const n = verts.length

      // Draw edges of the face (closed loop)
      for (let i = 0; i < n; i++) {
        const v1 = verts[i]
        const v2 = verts[(i + 1) % n]

        // Convert coordinates
        linePositions.push(v1.x, v1.z, -v1.y)
        linePositions.push(v2.x, v2.z, -v2.y)
      }
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3))
    return geometry
  }

  /**
   * Build roof geometry from 2D vertices.
   */
  private buildRoofGeometry(vertices: THREE.Vector2[], height: number): THREE.BufferGeometry | null {
    if (vertices.length < 3) return null

    const positions: number[] = []
    for (const v of vertices) {
      positions.push(v.x, height, -v.y)
    }

    const roofTriangles = triangulatePolygon(vertices)
    if (roofTriangles.length === 0) return null

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setIndex(roofTriangles)
    geometry.computeVertexNormals()

    return geometry
  }
}
