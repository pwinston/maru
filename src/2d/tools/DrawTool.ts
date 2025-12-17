import * as THREE from 'three'
import type { EditorTool, ToolResult } from './EditorTool'
import { SKETCH } from '../../constants'

const CLOSE_THRESHOLD = 1.5  // Screen-space snap distance to first vertex (in vertex-scale units)
const DRAW_LINE_COLOR = 0x99bb99  // Desaturated/whitish green during drawing
const CLOSE_LINE_COLOR = 0x44cc44  // Brighter green when about to close

/**
 * Tool for drawing polygons vertex by vertex.
 * Click to place vertices, click on first vertex or double-click to close.
 */
export class DrawTool implements EditorTool {
  private vertices: THREE.Vector2[] = []
  private previewLine: THREE.Line
  private cursorVertex: THREE.Mesh
  private vertexMeshes: THREE.Mesh[] = []  // Visual markers for all placed vertices
  private scene: THREE.Scene
  private vertexScale: number
  private isNearFirstVertex: boolean = false

  constructor(scene: THREE.Scene, vertexScale: number) {
    this.scene = scene
    this.vertexScale = vertexScale

    // Create preview line (will be updated as vertices are added)
    const lineMaterial = new THREE.LineBasicMaterial({ color: DRAW_LINE_COLOR })
    const lineGeometry = new THREE.BufferGeometry()
    this.previewLine = new THREE.Line(lineGeometry, lineMaterial)
    this.previewLine.position.z = 0.01
    this.scene.add(this.previewLine)

    // Create cursor vertex (ghost style) - hidden until first vertex placed
    const cursorGeom = new THREE.PlaneGeometry(1, 1)
    const cursorMat = new THREE.MeshBasicMaterial({
      color: SKETCH.GHOST_VERTEX_COLOR,
      side: THREE.DoubleSide
    })
    this.cursorVertex = new THREE.Mesh(cursorGeom, cursorMat)
    this.cursorVertex.scale.set(vertexScale, vertexScale, 1)
    this.cursorVertex.position.z = 0.02
    this.cursorVertex.visible = false  // Hidden until first vertex placed
    this.scene.add(this.cursorVertex)
  }

  /**
   * Add a vertex at the given position
   */
  private addVertex(pos: THREE.Vector2): void {
    this.vertices.push(pos.clone())

    // Create vertex mesh for visual feedback
    const geom = new THREE.PlaneGeometry(1, 1)
    const mat = new THREE.MeshBasicMaterial({
      color: SKETCH.VERTEX_COLOR,
      side: THREE.DoubleSide
    })
    const mesh = new THREE.Mesh(geom, mat)
    mesh.position.set(pos.x, pos.y, 0.015)
    mesh.scale.set(this.vertexScale, this.vertexScale, 1)
    this.scene.add(mesh)
    this.vertexMeshes.push(mesh)

    // Show cursor vertex after first vertex is placed
    if (this.vertices.length === 1) {
      this.cursorVertex.visible = true
    }

    this.updatePreviewLine(this.vertices[this.vertices.length - 1])
  }

  /**
   * Update the preview line to show all vertices plus rubber band to cursor
   */
  private updatePreviewLine(cursorPos: THREE.Vector2): void {
    const points: THREE.Vector3[] = []

    for (const v of this.vertices) {
      points.push(new THREE.Vector3(v.x, v.y, 0))
    }

    // Add rubber band to cursor if we have at least one vertex
    if (this.vertices.length > 0) {
      points.push(new THREE.Vector3(cursorPos.x, cursorPos.y, 0))
    }

    this.previewLine.geometry.dispose()
    this.previewLine.geometry = new THREE.BufferGeometry().setFromPoints(points)
  }

  /**
   * Check if position is near the first vertex (for closing)
   */
  private checkNearFirstVertex(pos: THREE.Vector2): boolean {
    if (this.vertices.length < 3) return false
    const first = this.vertices[0]
    const dist = pos.distanceTo(first)
    return dist < CLOSE_THRESHOLD * this.vertexScale
  }

  /**
   * Update visual feedback based on hover state near first vertex
   */
  private updateCloseHoverFeedback(isNear: boolean): void {
    const canClose = isNear && this.vertices.length >= 3

    // Update first vertex color
    if (this.vertexMeshes.length > 0) {
      const mat = this.vertexMeshes[0].material as THREE.MeshBasicMaterial
      mat.color.setHex(canClose ? CLOSE_LINE_COLOR : SKETCH.VERTEX_COLOR)
    }

    // Update line color - brighter green when about to close
    const lineMat = this.previewLine.material as THREE.LineBasicMaterial
    lineMat.color.setHex(canClose ? CLOSE_LINE_COLOR : DRAW_LINE_COLOR)
  }

  onMouseMove(worldPos: THREE.Vector2): ToolResult {
    // Check if near first vertex for close
    this.isNearFirstVertex = this.checkNearFirstVertex(worldPos)
    const canClose = this.isNearFirstVertex && this.vertices.length >= 3

    // Snap to first vertex when in close zone
    const effectivePos = canClose ? this.vertices[0] : worldPos

    // Update cursor vertex position (snap when closing)
    this.cursorVertex.position.set(effectivePos.x, effectivePos.y, 0.02)
    this.cursorVertex.visible = this.vertices.length > 0 && !canClose  // Hide cursor when snapped

    // Update preview line with snapped position
    this.updatePreviewLine(effectivePos)

    this.updateCloseHoverFeedback(this.isNearFirstVertex)

    return {}
  }

  onMouseUp(worldPos: THREE.Vector2): ToolResult {
    // Close on click near first vertex (with 3+ vertices)
    if (this.isNearFirstVertex && this.vertices.length >= 3) {
      return { drawnVertices: [...this.vertices], done: true }
    }

    // Otherwise add a new vertex
    this.addVertex(worldPos)

    return {}
  }

  dispose(): void {
    // Remove and dispose preview line
    this.scene.remove(this.previewLine)
    this.previewLine.geometry.dispose()
    ;(this.previewLine.material as THREE.Material).dispose()

    // Remove and dispose cursor vertex
    this.scene.remove(this.cursorVertex)
    this.cursorVertex.geometry.dispose()
    ;(this.cursorVertex.material as THREE.Material).dispose()

    // Remove and dispose all vertex meshes
    for (const mesh of this.vertexMeshes) {
      this.scene.remove(mesh)
      mesh.geometry.dispose()
      ;(mesh.material as THREE.Material).dispose()
    }
    this.vertexMeshes = []
  }
}
