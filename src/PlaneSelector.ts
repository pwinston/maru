import { Viewport3D } from './Viewport3D'
import { SketchPlane } from './SketchPlane'

/**
 * PlaneSelector
 * 
 * Handles hovering over and clicking to select SketchPlanes.
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
   * Highlight the plane we are hovering over
   */
  private handleMouseMove(event: MouseEvent): void {
    const planeMeshes = this.planes.map(p => p.getPlaneMesh())
    const intersects = this.viewport3d.raycast(event, planeMeshes)

    // Clear previous hover (restore to default, not selected)
    if (this.hoveredPlane && this.hoveredPlane !== this.selectedPlane) {
      this.hoveredPlane.setVisualState('default')
    }
    this.hoveredPlane = null

    // Highlight hovered plane (but not if it's already selected)
    if (intersects.length > 0) {
      const intersectedMesh = intersects[0].object
      const plane = this.planes.find(p => p.getPlaneMesh() === intersectedMesh)
      if (plane && plane !== this.selectedPlane) {
        plane.setVisualState('hovered')
        this.hoveredPlane = plane
      }
    }
  }

  /**
   * Handle mouse up - detect clicks vs drags
   */
  private handleMouseUp(event: MouseEvent): void {
    if (this.mouseDownPos && event.button === 0) {
      const dx = event.clientX - this.mouseDownPos.x
      const dy = event.clientY - this.mouseDownPos.y
      const distance = Math.sqrt(dx * dx + dy * dy)

      if (distance < this.clickThreshold) {
        this.handleClick(event)
      }
    }
    this.mouseDownPos = null
  }

  /**
   * Handle click - select plane under cursor
   */
  private handleClick(event: MouseEvent): void {
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

  /**
   * Select a plane
   */
  selectPlane(plane: SketchPlane): void {
    // Deselect previous plane
    if (this.selectedPlane) {
      this.selectedPlane.setVisualState('default')
    }

    // Select new plane
    this.selectedPlane = plane
    this.selectedPlane.setVisualState('selected')

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
