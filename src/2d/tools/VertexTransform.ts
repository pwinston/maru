import * as THREE from 'three'

/**
 * Handles transform operations (translate, scale, rotate) on a set of vertices.
 * Created when starting a transform, provides new positions during drag.
 */
export class VertexTransform {
  private startPositions: Map<number, THREE.Vector2>
  private center: THREE.Vector2
  private startMouse: THREE.Vector2
  private startAngle: number
  private selectionRadius: number

  constructor(
    vertices: THREE.Vector2[],
    selectedIndices: number[],
    mousePos: THREE.Vector2
  ) {
    // Store original positions
    this.startPositions = new Map()
    for (const idx of selectedIndices) {
      this.startPositions.set(idx, vertices[idx].clone())
    }

    // Calculate center of selection
    let minX = Infinity, minY = Infinity
    let maxX = -Infinity, maxY = -Infinity
    for (const idx of selectedIndices) {
      const v = vertices[idx]
      minX = Math.min(minX, v.x)
      minY = Math.min(minY, v.y)
      maxX = Math.max(maxX, v.x)
      maxY = Math.max(maxY, v.y)
    }
    this.center = new THREE.Vector2((minX + maxX) / 2, (minY + maxY) / 2)

    this.startMouse = mousePos.clone()
    this.startAngle = Math.atan2(
      mousePos.y - this.center.y,
      mousePos.x - this.center.x
    )
    // Half the diagonal of bounding box - used to normalize scale sensitivity
    this.selectionRadius = Math.sqrt((maxX - minX) ** 2 + (maxY - minY) ** 2) / 2
  }

  /**
   * Get the center point of the transform
   */
  getCenter(): THREE.Vector2 {
    return this.center
  }

  /**
   * Get the selected indices
   */
  getSelectedIndices(): number[] {
    return Array.from(this.startPositions.keys())
  }

  /**
   * Calculate translated positions based on mouse delta
   */
  translate(currentMouse: THREE.Vector2): Map<number, THREE.Vector2> {
    const delta = new THREE.Vector2(
      currentMouse.x - this.startMouse.x,
      currentMouse.y - this.startMouse.y
    )

    const result = new Map<number, THREE.Vector2>()
    for (const [index, startPos] of this.startPositions) {
      result.set(index, new THREE.Vector2(
        startPos.x + delta.x,
        startPos.y + delta.y
      ))
    }
    return result
  }

  /**
   * Calculate scaled positions based on vertical mouse movement.
   * Moving up = scale up, moving down = scale down.
   * Delta is normalized by selection size for zoom-independent behavior.
   */
  scale(currentMouse: THREE.Vector2): Map<number, THREE.Vector2> {
    const deltaY = currentMouse.y - this.startMouse.y

    // Normalize delta by selection size so scaling feels consistent at any zoom
    // Moving up by the selection's radius = 2x scale
    const normalizedDelta = this.selectionRadius > 0
      ? deltaY / this.selectionRadius
      : deltaY
    const scaleFactor = Math.max(0.1, 1 + normalizedDelta)

    const result = new Map<number, THREE.Vector2>()
    for (const [index, startPos] of this.startPositions) {
      result.set(index, new THREE.Vector2(
        this.center.x + (startPos.x - this.center.x) * scaleFactor,
        this.center.y + (startPos.y - this.center.y) * scaleFactor
      ))
    }
    return result
  }

  /**
   * Calculate rotated positions based on mouse angle around center
   */
  rotate(currentMouse: THREE.Vector2): Map<number, THREE.Vector2> {
    const currentAngle = Math.atan2(
      currentMouse.y - this.center.y,
      currentMouse.x - this.center.x
    )
    const deltaAngle = currentAngle - this.startAngle

    const result = new Map<number, THREE.Vector2>()
    for (const [index, startPos] of this.startPositions) {
      // Translate to origin
      const relX = startPos.x - this.center.x
      const relY = startPos.y - this.center.y

      // Rotate
      const cos = Math.cos(deltaAngle)
      const sin = Math.sin(deltaAngle)
      const rotX = relX * cos - relY * sin
      const rotY = relX * sin + relY * cos

      // Translate back
      result.set(index, new THREE.Vector2(
        rotX + this.center.x,
        rotY + this.center.y
      ))
    }
    return result
  }
}
