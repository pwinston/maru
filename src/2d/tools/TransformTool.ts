import * as THREE from 'three'
import type { EditorTool, ToolResult } from './EditorTool'
import { VertexTransform } from './VertexTransform'

export type TransformMode = 'translate' | 'scale' | 'rotate'

/**
 * EditorTool for transforming selected vertices.
 * Wraps VertexTransform and routes to translate/scale/rotate based on mode.
 */
export class TransformTool implements EditorTool {
  private transform: VertexTransform
  private mode: TransformMode

  constructor(
    vertices: THREE.Vector2[],
    selectedIndices: number[],
    mousePos: THREE.Vector2,
    mode: TransformMode
  ) {
    this.transform = new VertexTransform(vertices, selectedIndices, mousePos)
    this.mode = mode
  }

  /**
   * Handle mouse move - return new positions based on transform mode
   */
  onMouseMove(worldPos: THREE.Vector2): ToolResult {
    let positions: Map<number, THREE.Vector2>

    switch (this.mode) {
      case 'rotate':
        positions = this.transform.rotate(worldPos)
        break
      case 'scale':
        positions = this.transform.scale(worldPos)
        break
      default:
        positions = this.transform.translate(worldPos)
    }

    return { positions }
  }

  /**
   * Handle mouse up - transform is complete
   */
  onMouseUp(_worldPos: THREE.Vector2): ToolResult {
    return { done: true }
  }

  /**
   * No cleanup needed for transform tool
   */
  dispose(): void {
    // Nothing to dispose
  }
}
