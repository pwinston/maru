import * as THREE from 'three'
import { Viewport3D } from './Viewport3D'
import { SketchPlane } from './SketchPlane'

/**
 * Handles mouse interaction for selecting sketch planes in the 3D viewport
 */
export class PlaneSelector {
  private viewport3d: Viewport3D
  private planes: SketchPlane[]
  private selectedPlane: SketchPlane | null = null
  private hoveredPlane: SketchPlane | null = null
  private mouseDownPos: { x: number; y: number } | null = null
  private clickThreshold: number = 5 // pixels
  private onSelectionChange?: (plane: SketchPlane) => void

  constructor(viewport3d: Viewport3D, planes: SketchPlane[]) {
    this.viewport3d = viewport3d
    this.planes = planes

    this.setupEventListeners()
  }

  /**
   * Set up mouse event listeners
   */
  private setupEventListeners(): void {
    const canvas = this.viewport3d.getElement()

    canvas.addEventListener('mousedown', (event) => this.handleMouseDown(event))
    canvas.addEventListener('mousemove', (event) => this.handleMouseMove(event))
    canvas.addEventListener('mouseup', (event) => this.handleMouseUp(event))
  }

  /**
   * Track mouse down position to detect dragging vs clicking
   */
  private handleMouseDown(event: MouseEvent): void {
    this.mouseDownPos = { x: event.clientX, y: event.clientY }
  }

  /**
   * Handle mouse move for hover feedback
   */
  private handleMouseMove(event: MouseEvent): void {
    const planeMeshes = this.planes.map(p => p.getPlaneMesh())
    const intersects = this.viewport3d.raycast(event, planeMeshes)

    // Clear previous hover
    if (this.hoveredPlane && this.hoveredPlane !== this.selectedPlane) {
      this.hoveredPlane.setHighlight(false)
    }
    this.hoveredPlane = null

    // Highlight hovered plane
    if (intersects.length > 0) {
      const intersectedMesh = intersects[0].object
      const plane = this.planes.find(p => p.getPlaneMesh() === intersectedMesh)
      if (plane && plane !== this.selectedPlane) {
        plane.setHighlight(true)
        this.hoveredPlane = plane
      }
    }
  }

  /**
   * Handle mouse up for selection (only if not dragging)
   */
  private handleMouseUp(event: MouseEvent): void {
    // Check if this was a click (not a drag)
    if (this.mouseDownPos) {
      const dx = event.clientX - this.mouseDownPos.x
      const dy = event.clientY - this.mouseDownPos.y
      const distance = Math.sqrt(dx * dx + dy * dy)

      // Only select if mouse didn't move much (not a drag)
      if (distance < this.clickThreshold && event.button === 0) {
        const planeMeshes = this.planes.map(p => p.getPlaneMesh())
        const intersects = this.viewport3d.raycast(event, planeMeshes)

        if (intersects.length > 0) {
          const intersectedMesh = intersects[0].object
          const plane = this.planes.find(p => p.getPlaneMesh() === intersectedMesh)
          if (plane) {
            this.selectPlane(plane)
          }
        }
      }
    }

    this.mouseDownPos = null
  }

  /**
   * Select a plane
   */
  selectPlane(plane: SketchPlane): void {
    // Deselect previous plane
    if (this.selectedPlane) {
      this.selectedPlane.setHighlight(false)
    }

    // Select new plane
    this.selectedPlane = plane
    this.selectedPlane.setHighlight(true)

    // Notify callback
    if (this.onSelectionChange) {
      this.onSelectionChange(plane)
    }
  }

  /**
   * Set callback for when selection changes
   */
  setOnSelectionChange(callback: (plane: SketchPlane) => void): void {
    this.onSelectionChange = callback
  }

  /**
   * Get the currently selected plane
   */
  getSelectedPlane(): SketchPlane | null {
    return this.selectedPlane
  }
}
