import * as THREE from 'three'
import { Bounds } from './Bounds'

const VERTEX_SIZE = 0.15
const VERTEX_COLOR = 0xffff00
const LINE_COLOR = 0x00ff00

/**
 * Represents a 2D sketch. A polygon made up of lines and vertices.
 */
export class Sketch {
  private vertices: THREE.Vector2[]
  private lineGroup: THREE.Group
  private editorGroup: THREE.Group
  private line: THREE.Line | null = null
  private vertexMeshes: THREE.Mesh[] = []

  constructor(vertices: THREE.Vector2[]) {
    this.vertices = vertices.map(v => v.clone())
    this.lineGroup = new THREE.Group()
    this.editorGroup = new THREE.Group()

    this.rebuild()
  }

  /**
   * Rebuild the visual representation
   */
  private rebuild(): void {
    // Clear existing visuals
    this.lineGroup.clear()
    this.editorGroup.clear()
    this.vertexMeshes = []

    // Create the polygon outline (for 3D view)
    this.line = this.createLine()
    this.lineGroup.add(this.line)

    // Create editor visuals (line + control points for 2D view)
    this.editorGroup.add(this.createLine())
    for (let i = 0; i < this.vertices.length; i++) {
      const mesh = this.createVertexMesh(this.vertices[i])
      mesh.userData.vertexIndex = i
      this.vertexMeshes.push(mesh)
      this.editorGroup.add(mesh)
    }
  }

  /**
   * Create the polygon outline
   */
  private createLine(): THREE.Line {
    const points3d = this.vertices.map(v => new THREE.Vector3(v.x, v.y, 0))
    points3d.push(points3d[0].clone()) // Close the loop

    const geometry = new THREE.BufferGeometry().setFromPoints(points3d)
    const material = new THREE.LineBasicMaterial({ color: LINE_COLOR })
    return new THREE.Line(geometry, material)
  }

  /**
   * Create a control point mesh at a vertex position
   */
  private createVertexMesh(position: THREE.Vector2): THREE.Mesh {
    const geometry = new THREE.PlaneGeometry(VERTEX_SIZE, VERTEX_SIZE)
    const material = new THREE.MeshBasicMaterial({
      color: VERTEX_COLOR,
      side: THREE.DoubleSide
    })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(position.x, position.y, 0.01) // Slightly above the plane
    return mesh
  }

  /**
   * Get the line-only group (for 3D view - no control points)
   */
  getLineGroup(): THREE.Group {
    return this.lineGroup
  }

  /**
   * Get the editor group (for 2D view - includes control points)
   */
  getEditorGroup(): THREE.Group {
    return this.editorGroup
  }

  /**
   * Get a copy of the vertices
   */
  getVertices(): THREE.Vector2[] {
    return this.vertices.map(v => v.clone())
  }

  /**
   * Get the vertex meshes for raycasting/picking
   */
  getVertexMeshes(): THREE.Mesh[] {
    return this.vertexMeshes
  }

  /**
   * Update a single vertex position
   */
  setVertex(index: number, position: THREE.Vector2): void {
    if (index >= 0 && index < this.vertices.length) {
      this.vertices[index].copy(position)
      this.rebuild()
    }
  }

  /**
   * Set all vertices
   */
  setVertices(vertices: THREE.Vector2[]): void {
    this.vertices = vertices.map(v => v.clone())
    this.rebuild()
  }

  /**
   * Calculate bounding box of the sketch
   */
  getBounds(): Bounds {
    return Bounds.fromPoints(this.vertices)
  }

  /**
   * Get vertex index from a mesh (for raycasting results)
   */
  getVertexIndex(mesh: THREE.Mesh): number | null {
    const index = mesh.userData.vertexIndex
    return typeof index === 'number' ? index : null
  }
}
