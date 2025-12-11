import * as THREE from 'three'
import { Bounds } from '../util/Bounds'

const VERTEX_SIZE = 0.15
const VERTEX_COLOR = 0xffff00
const LINE_COLOR = 0x00ff00
const DELETE_VERTEX_COLOR = 0xff0000
const SEGMENT_HIT_WIDTH = 0.3 // Width of invisible hit area for segments
const VERTEX_SAFE_ZONE = 0.25 // Distance from vertex where segment hit is disabled

/**
 * Represents a 2D sketch. A polygon made up of lines and vertices.
 */
export class Sketch {
  private vertices: THREE.Vector2[]
  private lineGroup: THREE.Group
  private editorGroup: THREE.Group
  private line: THREE.Line | null = null
  private vertexMeshes: THREE.Mesh[] = []
  private segmentHitMeshes: THREE.Mesh[] = []

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
    this.segmentHitMeshes = []

    // Create the polygon outline (for 3D view)
    this.line = this.createLine()
    this.lineGroup.add(this.line)

    // Create editor visuals (line + control points for 2D view)
    this.editorGroup.add(this.createLine())

    // Create invisible segment hit areas (for click detection)
    for (let i = 0; i < this.vertices.length; i++) {
      const nextIndex = (i + 1) % this.vertices.length
      const segmentMesh = this.createSegmentHitMesh(this.vertices[i], this.vertices[nextIndex], i)
      this.segmentHitMeshes.push(segmentMesh)
      this.editorGroup.add(segmentMesh)
    }

    // Create vertex control points (on top of segments)
    for (let i = 0; i < this.vertices.length; i++) {
      const mesh = this.createVertexMesh(this.vertices[i])
      mesh.userData.vertexIndex = i
      this.vertexMeshes.push(mesh)
      this.editorGroup.add(mesh)
    }
  }

  /**
   * Create an invisible hit area for a line segment (with safe zones near vertices)
   */
  private createSegmentHitMesh(start: THREE.Vector2, end: THREE.Vector2, segmentIndex: number): THREE.Mesh {
    const dir = new THREE.Vector2().subVectors(end, start)
    const fullLength = dir.length()
    const angle = Math.atan2(dir.y, dir.x)

    // Shrink the hit area by safe zone on each end
    const hitLength = Math.max(0, fullLength - 2 * VERTEX_SAFE_ZONE)
    const center = new THREE.Vector2().addVectors(start, end).multiplyScalar(0.5)

    const geometry = new THREE.PlaneGeometry(hitLength, SEGMENT_HIT_WIDTH)
    const material = new THREE.MeshBasicMaterial({
      visible: false, // Invisible but still raycastable
      side: THREE.DoubleSide
    })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(center.x, center.y, 0.005) // Between line and vertices
    mesh.rotation.z = angle
    mesh.userData.segmentIndex = segmentIndex
    return mesh
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
   * Get the segment hit meshes for raycasting/picking
   */
  getSegmentHitMeshes(): THREE.Mesh[] {
    return this.segmentHitMeshes
  }

  /**
   * Get segment index from a mesh (for raycasting results)
   */
  getSegmentIndex(mesh: THREE.Mesh): number | null {
    const index = mesh.userData.segmentIndex
    return typeof index === 'number' ? index : null
  }

  /**
   * Insert a vertex on a segment, splitting it into two
   * @param segmentIndex The index of the segment (same as start vertex index)
   * @param position The position of the new vertex
   */
  insertVertex(segmentIndex: number, position: THREE.Vector2): void {
    if (segmentIndex < 0 || segmentIndex >= this.vertices.length) return
    // Insert after segmentIndex (which is the start of the segment)
    this.vertices.splice(segmentIndex + 1, 0, position.clone())
    this.rebuild()
  }

  /**
   * Delete a vertex (must have at least 3 vertices to remain a valid polygon)
   */
  deleteVertex(index: number): boolean {
    if (this.vertices.length <= 3) return false
    if (index < 0 || index >= this.vertices.length) return false
    this.vertices.splice(index, 1)
    this.rebuild()
    return true
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

  /**
   * Get the number of vertices
   */
  getVertexCount(): number {
    return this.vertices.length
  }

  /**
   * Set the color of a specific vertex
   */
  setVertexColor(index: number, color: number): void {
    if (index >= 0 && index < this.vertexMeshes.length) {
      const material = this.vertexMeshes[index].material as THREE.MeshBasicMaterial
      material.color.setHex(color)
    }
  }

  /**
   * Reset a vertex to the default color
   */
  resetVertexColor(index: number): void {
    this.setVertexColor(index, VERTEX_COLOR)
  }

  /**
   * Mark a vertex as being deleted (red color)
   */
  setVertexDeleting(index: number): void {
    this.setVertexColor(index, DELETE_VERTEX_COLOR)
  }

  /**
   * Temporarily rebuild the sketch visualization without a specific vertex.
   * Used for preview during drag-to-delete.
   */
  rebuildWithoutVertex(excludeIndex: number): void {
    if (excludeIndex < 0 || excludeIndex >= this.vertices.length) return
    if (this.vertices.length <= 3) return

    const tempVertices = this.vertices.filter((_, i) => i !== excludeIndex)
    this.rebuildVisualsFrom(tempVertices)
  }

  /**
   * Restore the full rebuild with all vertices
   */
  restoreFullRebuild(): void {
    this.rebuild()
  }

  /**
   * Rebuild visuals from a given vertex array (may differ from this.vertices)
   */
  private rebuildVisualsFrom(verts: THREE.Vector2[]): void {
    // Clear existing visuals
    this.lineGroup.clear()
    this.editorGroup.clear()
    this.vertexMeshes = []
    this.segmentHitMeshes = []

    // Create the polygon outline (for 3D view)
    this.line = this.createLineFrom(verts)
    this.lineGroup.add(this.line)

    // Create editor visuals (line + control points for 2D view)
    this.editorGroup.add(this.createLineFrom(verts))

    // Create invisible segment hit areas (for click detection)
    for (let i = 0; i < verts.length; i++) {
      const nextIndex = (i + 1) % verts.length
      const segmentMesh = this.createSegmentHitMesh(verts[i], verts[nextIndex], i)
      this.segmentHitMeshes.push(segmentMesh)
      this.editorGroup.add(segmentMesh)
    }

    // Create vertex control points (on top of segments)
    for (let i = 0; i < verts.length; i++) {
      const mesh = this.createVertexMesh(verts[i])
      mesh.userData.vertexIndex = i
      this.vertexMeshes.push(mesh)
      this.editorGroup.add(mesh)
    }
  }

  /**
   * Create a line from arbitrary vertices
   */
  private createLineFrom(verts: THREE.Vector2[]): THREE.Line {
    const points3d = verts.map(v => new THREE.Vector3(v.x, v.y, 0))
    points3d.push(points3d[0].clone()) // Close the loop

    const geometry = new THREE.BufferGeometry().setFromPoints(points3d)
    const material = new THREE.LineBasicMaterial({ color: LINE_COLOR })
    return new THREE.Line(geometry, material)
  }
}
