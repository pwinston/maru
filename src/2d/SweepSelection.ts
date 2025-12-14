import * as THREE from 'three'
import { SKETCH } from '../constants'
import type { EditorTool, ToolResult } from './EditorTool'

/**
 * Handles rectangle sweep selection of vertices.
 * Creates visual rectangle, tracks bounds, determines which vertices are inside.
 */
export class SweepSelection implements EditorTool {
  private scene: THREE.Scene
  private startPos: THREE.Vector2
  private rect: THREE.Mesh
  private rectEdge: THREE.Line
  private sceneRotation: number

  constructor(scene: THREE.Scene, startPos: THREE.Vector2, sceneRotation: number = 0) {
    this.scene = scene
    this.startPos = startPos.clone()
    this.sceneRotation = sceneRotation

    // Create selection rectangle fill
    const geometry = new THREE.PlaneGeometry(0.001, 0.001)
    const material = new THREE.MeshBasicMaterial({
      color: SKETCH.SELECTION_RECT_COLOR,
      transparent: true,
      opacity: SKETCH.SELECTION_RECT_OPACITY,
      side: THREE.DoubleSide
    })
    this.rect = new THREE.Mesh(geometry, material)
    this.rect.position.z = 0.02
    // Counter-rotate to stay screen-aligned
    this.rect.rotation.z = -sceneRotation
    scene.add(this.rect)

    // Create selection rectangle edge
    const edgeGeometry = new THREE.BufferGeometry()
    const edgeMaterial = new THREE.LineBasicMaterial({ color: SKETCH.SELECTION_RECT_EDGE_COLOR })
    this.rectEdge = new THREE.Line(edgeGeometry, edgeMaterial)
    this.rectEdge.position.z = 0.025
    // Counter-rotate to stay screen-aligned
    this.rectEdge.rotation.z = -sceneRotation
    scene.add(this.rectEdge)
  }

  /**
   * EditorTool: Handle mouse move - update selection rectangle
   */
  onMouseMove(worldPos: THREE.Vector2): ToolResult {
    this.update(worldPos)
    return {}
  }

  /**
   * EditorTool: Handle mouse up - return selection bounds
   */
  onMouseUp(worldPos: THREE.Vector2): ToolResult {
    return {
      selectInRect: this.getBounds(worldPos),
      done: true
    }
  }

  /**
   * Rotate a point around origin
   */
  private rotatePoint(x: number, y: number, angle: number): THREE.Vector2 {
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    return new THREE.Vector2(
      x * cos - y * sin,
      x * sin + y * cos
    )
  }

  /**
   * Update the rectangle to current mouse position.
   * Rectangle is drawn screen-aligned by working in screen space.
   */
  private update(currentPos: THREE.Vector2): void {
    // Convert world coords to screen-aligned coords
    const screenStart = this.rotatePoint(this.startPos.x, this.startPos.y, this.sceneRotation)
    const screenEnd = this.rotatePoint(currentPos.x, currentPos.y, this.sceneRotation)

    // Calculate rectangle dimensions in screen space
    const width = Math.abs(screenEnd.x - screenStart.x)
    const height = Math.abs(screenEnd.y - screenStart.y)
    const screenCenterX = (screenStart.x + screenEnd.x) / 2
    const screenCenterY = (screenStart.y + screenEnd.y) / 2

    // Convert center back to world coords for positioning
    const worldCenter = this.rotatePoint(screenCenterX, screenCenterY, -this.sceneRotation)

    // Update rectangle fill
    this.rect.geometry.dispose()
    this.rect.geometry = new THREE.PlaneGeometry(
      Math.max(width, 0.001),
      Math.max(height, 0.001)
    )
    this.rect.position.set(worldCenter.x, worldCenter.y, 0.02)

    // Update rectangle edge (in local/screen-aligned space, centered at origin)
    const halfW = width / 2
    const halfH = height / 2
    const edgePoints = [
      new THREE.Vector3(-halfW, -halfH, 0),
      new THREE.Vector3(halfW, -halfH, 0),
      new THREE.Vector3(halfW, halfH, 0),
      new THREE.Vector3(-halfW, halfH, 0),
      new THREE.Vector3(-halfW, -halfH, 0)
    ]
    this.rectEdge.geometry.dispose()
    this.rectEdge.geometry = new THREE.BufferGeometry().setFromPoints(edgePoints)
    this.rectEdge.position.set(worldCenter.x, worldCenter.y, 0.025)
  }

  /**
   * Get the selection bounds in screen-aligned space.
   * Returns bounds and rotation so caller can test vertices correctly.
   */
  private getBounds(endPos: THREE.Vector2): { min: THREE.Vector2; max: THREE.Vector2; rotation: number } {
    // Convert to screen-aligned coords for bounds
    const screenStart = this.rotatePoint(this.startPos.x, this.startPos.y, this.sceneRotation)
    const screenEnd = this.rotatePoint(endPos.x, endPos.y, this.sceneRotation)

    return {
      min: new THREE.Vector2(
        Math.min(screenStart.x, screenEnd.x),
        Math.min(screenStart.y, screenEnd.y)
      ),
      max: new THREE.Vector2(
        Math.max(screenStart.x, screenEnd.x),
        Math.max(screenStart.y, screenEnd.y)
      ),
      rotation: this.sceneRotation
    }
  }

  /**
   * Clean up and remove visuals from scene
   */
  dispose(): void {
    this.scene.remove(this.rect)
    this.rect.geometry.dispose()
    ;(this.rect.material as THREE.Material).dispose()

    this.scene.remove(this.rectEdge)
    this.rectEdge.geometry.dispose()
    ;(this.rectEdge.material as THREE.Material).dispose()
  }
}
