import * as THREE from 'three'

/**
 * Result from a tool's mouse handler
 */
export interface ToolResult {
  /** New vertex positions to apply */
  positions?: Map<number, THREE.Vector2>
  /** Vertices to select (for sweep selection). Rotation transforms world coords to screen-aligned coords. */
  selectInRect?: { min: THREE.Vector2; max: THREE.Vector2; rotation: number }
  /** Tool is finished and should be disposed */
  done?: boolean
}

/**
 * Interface for editor tools (sweep selection, transforms, etc.)
 */
export interface EditorTool {
  /** Handle mouse move, return results to apply */
  onMouseMove(worldPos: THREE.Vector2): ToolResult

  /** Handle mouse up, return results to apply */
  onMouseUp(worldPos: THREE.Vector2): ToolResult

  /** Clean up any visuals/resources */
  dispose(): void
}
