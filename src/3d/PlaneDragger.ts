import * as THREE from 'three'
import { Viewport3D } from './Viewport3D'
import { SketchPlane } from './SketchPlane'
import { INTERACTION } from '../constants'
import { Model } from '../model/Model'

/**
 * PlaneDragger
 *
 * Handles dragging planes to adjust height, create new planes from ground,
 * and delete planes by dragging below ground.
 */
export class PlaneDragger {
  private viewport3d: Viewport3D
  private model: Model

  // Drag state
  private draggedPlane: SketchPlane | null = null
  private dragStartWorldY: number = 0
  private dragStartHeight: number = 0
  private isCreatingNewPlane: boolean = false
  private isDeletingPlane: boolean = false

  // Callbacks
  private onPlaneHeightChange?: (plane: SketchPlane, height: number) => void
  private onPlaneCreate?: (plane: SketchPlane) => void
  private onPlaneDelete?: (plane: SketchPlane) => void
  private onOrbitEnabledChange?: (enabled: boolean) => void
  private onSelectionCleared?: () => void

  constructor(viewport3d: Viewport3D, model: Model) {
    this.viewport3d = viewport3d
    this.model = model
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
   * Start dragging a plane (or create a new one if clicking ground or shift-dragging)
   */
  startDrag(event: MouseEvent, intersectedMesh: THREE.Object3D): void {
    const plane = this.model.planes.find((p: SketchPlane) => p.getPlaneMesh() === intersectedMesh)
    if (!plane) return

    // Disable orbit immediately when clicking on a plane
    if (this.onOrbitEnabledChange) {
      this.onOrbitEnabledChange(false)
    }

    this.dragStartWorldY = this.viewport3d.getWorldYAtMouse(event) ?? 0
    this.dragStartHeight = plane.getHeight()

    // Create a new plane if: ground plane (height 0) OR shift is held
    if (plane.getHeight() === 0 || event.shiftKey) {
      this.isCreatingNewPlane = true
      // Create a new plane by copying the source plane's sketch
      const newPlane = new SketchPlane(4, plane.getHeight())
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
    if (this.isCreatingNewPlane && !this.model.planes.includes(this.draggedPlane)) {
      this.model.addPlane(this.draggedPlane)
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
    if (!this.isCreatingNewPlane && rawHeight < INTERACTION.DELETE_THRESHOLD) {
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
   * End drag - delete plane if in delete state.
   * Returns the newly created plane (if shift-drag created one), or null.
   */
  endDrag(): SketchPlane | null {
    let createdPlane: SketchPlane | null = null

    if (this.isDeletingPlane && this.draggedPlane) {
      this.deletePlane(this.draggedPlane)
    } else if (this.isCreatingNewPlane && this.draggedPlane) {
      // Return the newly created plane so caller can select it
      createdPlane = this.draggedPlane
    }

    // Reset drag state
    this.draggedPlane = null
    this.isCreatingNewPlane = false
    this.isDeletingPlane = false

    // Re-enable orbit
    if (this.onOrbitEnabledChange) {
      this.onOrbitEnabledChange(true)
    }

    return createdPlane
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
   * Delete a plane from the scene and model
   */
  private deletePlane(plane: SketchPlane): void {
    // Remove from scene
    this.viewport3d.remove(plane.getGroup())

    // Remove from model (this also syncs segment arrays)
    this.model.removePlane(plane)

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
   * Reset to a new model
   */
  reset(newModel: Model): void {
    this.draggedPlane = null
    this.isCreatingNewPlane = false
    this.isDeletingPlane = false
    this.model = newModel
  }
}
