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

  constructor(scene: THREE.Scene, startPos: THREE.Vector2) {
    this.scene = scene
    this.startPos = startPos.clone()

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
    scene.add(this.rect)

    // Create selection rectangle edge
    const edgeGeometry = new THREE.BufferGeometry()
    const edgeMaterial = new THREE.LineBasicMaterial({ color: SKETCH.SELECTION_RECT_EDGE_COLOR })
    this.rectEdge = new THREE.Line(edgeGeometry, edgeMaterial)
    this.rectEdge.position.z = 0.025
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
   * Update the rectangle to current mouse position
   */
  private update(currentPos: THREE.Vector2): void {
    // Calculate rectangle dimensions
    const width = Math.abs(currentPos.x - this.startPos.x)
    const height = Math.abs(currentPos.y - this.startPos.y)
    const centerX = (currentPos.x + this.startPos.x) / 2
    const centerY = (currentPos.y + this.startPos.y) / 2

    // Update rectangle fill
    this.rect.geometry.dispose()
    this.rect.geometry = new THREE.PlaneGeometry(
      Math.max(width, 0.001),
      Math.max(height, 0.001)
    )
    this.rect.position.set(centerX, centerY, 0.02)

    // Update rectangle edge
    const minX = Math.min(this.startPos.x, currentPos.x)
    const maxX = Math.max(this.startPos.x, currentPos.x)
    const minY = Math.min(this.startPos.y, currentPos.y)
    const maxY = Math.max(this.startPos.y, currentPos.y)

    const edgePoints = [
      new THREE.Vector3(minX, minY, 0),
      new THREE.Vector3(maxX, minY, 0),
      new THREE.Vector3(maxX, maxY, 0),
      new THREE.Vector3(minX, maxY, 0),
      new THREE.Vector3(minX, minY, 0)
    ]
    this.rectEdge.geometry.dispose()
    this.rectEdge.geometry = new THREE.BufferGeometry().setFromPoints(edgePoints)
  }

  /**
   * Get the selection bounds (min/max corners)
   */
  private getBounds(endPos: THREE.Vector2): { min: THREE.Vector2; max: THREE.Vector2 } {
    return {
      min: new THREE.Vector2(
        Math.min(this.startPos.x, endPos.x),
        Math.min(this.startPos.y, endPos.y)
      ),
      max: new THREE.Vector2(
        Math.max(this.startPos.x, endPos.x),
        Math.max(this.startPos.y, endPos.y)
      )
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
