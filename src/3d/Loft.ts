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

export type WireframeMode = 'off' | 'on' | 'tris'

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
      this.wireframeQuads.visible = this.wireframeMode === 'on' || this.wireframeMode === 'tris'
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

    // Collect all faces with their lock state
    const facesWithLockState: { face: LoftFace; isLocked: boolean }[] = []
    const allFaces: LoftFace[] = []
    for (const segment of model.segments) {
      for (const face of segment.faces) {
        facesWithLockState.push({ face, isLocked: segment.isLocked })
        allFaces.push(face)
      }
    }

    if (allFaces.length === 0) return

    // Build wall geometry from faces (with vertex colors for locked segments)
    const wallGeometry = this.buildGeometryFromFaces(facesWithLockState)
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
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
      vertexColors: true,  // Enable vertex colors for locked segment tinting
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

    // Diagonal wireframe (only the triangulation edges that split quads)
    const diagWireGeometry = this.buildDiagonalWireframeFromFaces(allFaces)
    const diagMaterial = new THREE.LineDashedMaterial({
      color: LOFT.DIAGONAL_WIRE_COLOR,
      dashSize: 0.3,
      gapSize: 0.15,
    })
    this.wireframeTris = new THREE.LineSegments(diagWireGeometry, diagMaterial)
    this.wireframeTris.computeLineDistances() // Required for dashed lines
    this.group.add(this.wireframeTris)

    this.updateVisibility()
  }

  /**
   * Build geometry from faces (quads and triangles).
   * Quads are split into two triangles for rendering.
   * Uses vertex colors to tint locked segments.
   */
  private buildGeometryFromFaces(
    facesWithState: { face: LoftFace; isLocked: boolean }[]
  ): THREE.BufferGeometry | null {
    if (facesWithState.length === 0) return null

    const positions: number[] = []
    const colors: number[] = []
    const indices: number[] = []

    // Get tint values for locked segments
    const tint = LOFT.LOCKED_TINT

    for (const { face, isLocked } of facesWithState) {
      const verts = face.vertices
      const baseIndex = positions.length / 3

      // Determine vertex color (white for normal, tinted for locked)
      const r = isLocked ? tint.r : 1.0
      const g = isLocked ? tint.g : 1.0
      const b = isLocked ? tint.b : 1.0

      // Add vertices (convert from our coordinate system to Three.js)
      // Our: x=right, y=forward, z=up
      // Three.js: x=right, y=up, z=-forward
      for (const v of verts) {
        positions.push(v.x, v.z, -v.y)
        colors.push(r, g, b)
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
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()

    return geometry
  }

  /**
   * Build wireframe showing only the diagonal edges that split quads into triangles.
   */
  private buildDiagonalWireframeFromFaces(faces: LoftFace[]): THREE.BufferGeometry {
    const linePositions: number[] = []

    for (const face of faces) {
      const verts = face.vertices
      // Only quads have a diagonal - triangles don't need splitting
      if (verts.length === 4) {
        // The diagonal goes from vertex 0 to vertex 2 (see buildGeometryFromFaces)
        const v1 = verts[0]
        const v2 = verts[2]
        linePositions.push(v1.x, v1.z, -v1.y)
        linePositions.push(v2.x, v2.z, -v2.y)
      }
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3))
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
    const colors: number[] = []
    for (const v of vertices) {
      positions.push(v.x, height, -v.y)
      colors.push(1, 1, 1)  // White vertex color (no tinting)
    }

    const roofTriangles = triangulatePolygon(vertices)
    if (roofTriangles.length === 0) return null

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    geometry.setIndex(roofTriangles)
    geometry.computeVertexNormals()

    return geometry
  }
}
