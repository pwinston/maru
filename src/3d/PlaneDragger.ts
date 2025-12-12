import * as THREE from 'three'
import { Viewport3D } from './Viewport3D'
import { SketchPlane } from './SketchPlane'

/**
 * PlaneDragger
 *
 * Handles dragging planes to adjust height, create new planes from ground,
 * and delete planes by dragging below ground.
 */
export class PlaneDragger {
  private viewport3d: Viewport3D
  private planes: SketchPlane[]

  // Drag state
  private draggedPlane: SketchPlane | null = null
  private dragStartWorldY: number = 0
  private dragStartHeight: number = 0
  private isCreatingNewPlane: boolean = false
  private isDeletingPlane: boolean = false
  private deleteThreshold: number = 0.05

  // Callbacks
  private onPlaneHeightChange?: (plane: SketchPlane, height: number) => void
  private onPlaneCreate?: (plane: SketchPlane) => void
  private onPlaneDelete?: (plane: SketchPlane) => void
  private onOrbitEnabledChange?: (enabled: boolean) => void
  private onSelectionCleared?: () => void

  constructor(viewport3d: Viewport3D, planes: SketchPlane[]) {
    this.viewport3d = viewport3d
    this.planes = planes
  }

  /**
   * Check if currently dragging
   */
  isDragging(): boolean {
    return this.draggedPlane !== null
  }

  /**
   * Get the plane being dragged (if any)
   */
  getDraggedPlane(): SketchPlane | null {
    return this.draggedPlane
  }

  /**
   * Start dragging a plane (or create a new one if clicking ground)
   */
  startDrag(event: MouseEvent, intersectedMesh: THREE.Object3D): void {
    const plane = this.planes.find(p => p.getPlaneMesh() === intersectedMesh)
    if (!plane) return

    // Disable orbit immediately when clicking on a plane
    if (this.onOrbitEnabledChange) {
      this.onOrbitEnabledChange(false)
    }

    this.dragStartWorldY = this.viewport3d.getWorldYAtMouse(event) ?? 0
    this.dragStartHeight = plane.getHeight()

    // If this is the ground plane (height 0), we'll create a new plane
    if (plane.getHeight() === 0) {
      this.isCreatingNewPlane = true
      // Create a new plane by copying the ground plane's sketch
      const newPlane = new SketchPlane(4, 0) // Start at height 0
      newPlane.setVertices(plane.getVertices())
      this.draggedPlane = newPlane
    } else {
      this.isCreatingNewPlane = false
      this.draggedPlane = plane
    }
  }

  /**
   * Update plane height during drag
   */
  updateDrag(event: MouseEvent): void {
    if (!this.draggedPlane) return

    // If creating new plane, add it to scene on first drag
    if (this.isCreatingNewPlane && !this.planes.includes(this.draggedPlane)) {
      this.planes.push(this.draggedPlane)
      this.viewport3d.add(this.draggedPlane.getGroup())
      if (this.onPlaneCreate) {
        this.onPlaneCreate(this.draggedPlane)
      }
    }

    // Calculate new height based on world Y position
    const currentWorldY = this.viewport3d.getWorldYAtMouse(event) ?? this.dragStartWorldY
    const heightDelta = currentWorldY - this.dragStartWorldY
    const rawHeight = this.dragStartHeight + heightDelta

    // Check if dragging below delete threshold (only for non-ground planes)
    if (!this.isCreatingNewPlane && rawHeight < this.deleteThreshold) {
      this.isDeletingPlane = true
      this.draggedPlane.setHeight(rawHeight) // Let it go fully below ground
      this.draggedPlane.setVisualState('deleting')
    } else {
      this.isDeletingPlane = false
      const newHeight = Math.max(0.1, rawHeight)
      this.draggedPlane.setHeight(newHeight)
      this.draggedPlane.setVisualState('hovered')

      if (this.onPlaneHeightChange) {
        this.onPlaneHeightChange(this.draggedPlane, newHeight)
      }
    }
  }

  /**
   * End drag - delete plane if in delete state
   */
  endDrag(): void {
    if (this.isDeletingPlane && this.draggedPlane) {
      this.deletePlane(this.draggedPlane)
    }

    // Reset drag state
    this.draggedPlane = null
    this.isCreatingNewPlane = false
    this.isDeletingPlane = false

    // Re-enable orbit
    if (this.onOrbitEnabledChange) {
      this.onOrbitEnabledChange(true)
    }
  }

  /**
   * Cancel drag without deleting (e.g., if it was just a click)
   */
  cancelDrag(): void {
    // If we were creating a plane but it was never added, nothing to clean up
    this.draggedPlane = null
    this.isCreatingNewPlane = false
    this.isDeletingPlane = false

    // Re-enable orbit
    if (this.onOrbitEnabledChange) {
      this.onOrbitEnabledChange(true)
    }
  }

  /**
   * Delete a plane from the scene and planes array
   */
  private deletePlane(plane: SketchPlane): void {
    // Remove from scene
    this.viewport3d.remove(plane.getGroup())

    // Remove from planes array
    const index = this.planes.indexOf(plane)
    if (index !== -1) {
      this.planes.splice(index, 1)
    }

    // Notify that selection should be cleared if this was selected
    if (this.onSelectionCleared) {
      this.onSelectionCleared()
    }

    // Notify callback
    if (this.onPlaneDelete) {
      this.onPlaneDelete(plane)
    }
  }

  // Callback setters

  setOnPlaneHeightChange(callback: (plane: SketchPlane, height: number) => void): void {
    this.onPlaneHeightChange = callback
  }

  setOnPlaneCreate(callback: (plane: SketchPlane) => void): void {
    this.onPlaneCreate = callback
  }

  setOnPlaneDelete(callback: (plane: SketchPlane) => void): void {
    this.onPlaneDelete = callback
  }

  setOnOrbitEnabledChange(callback: (enabled: boolean) => void): void {
    this.onOrbitEnabledChange = callback
  }

  setOnSelectionCleared(callback: () => void): void {
    this.onSelectionCleared = callback
  }

  /**
   * Reset to a new set of planes
   */
  reset(newPlanes: SketchPlane[]): void {
    this.draggedPlane = null
    this.isCreatingNewPlane = false
    this.isDeletingPlane = false
    this.planes = newPlanes
  }
}
