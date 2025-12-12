import { Viewport3D } from './Viewport3D'
import { SketchPlane } from './SketchPlane'
import { PlaneDragger } from './PlaneDragger'
import { INTERACTION } from '../constants'

/**
 * PlaneSelector
 *
 * Handles hovering over and clicking to select SketchPlanes.
 * Delegates dragging behavior to PlaneDragger.
 */
export class PlaneSelector {
  private viewport3d: Viewport3D
  private planes: SketchPlane[]
  private selectedPlane: SketchPlane | null = null
  private hoveredPlane: SketchPlane | null = null
  private mouseDownPos: { x: number; y: number } | null = null
  private onSelectionChange?: (plane: SketchPlane | null) => void
  private enabled = true

  private dragger: PlaneDragger

  constructor(viewport3d: Viewport3D, planes: SketchPlane[]) {
    this.viewport3d = viewport3d
    this.planes = planes

    // Create dragger and wire up callbacks
    this.dragger = new PlaneDragger(viewport3d, planes)
    this.dragger.setOnOrbitEnabledChange((enabled) => {
      this.viewport3d.setOrbitEnabled(enabled)
    })
    this.dragger.setOnSelectionCleared(() => {
      if (this.selectedPlane && !this.planes.includes(this.selectedPlane)) {
        this.selectedPlane = null
      }
    })

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
   * Enable or disable plane selection and interaction
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    // Clear hover state when disabled
    if (!enabled && this.hoveredPlane) {
      const state = this.hoveredPlane === this.selectedPlane ? 'selected' : 'default'
      this.hoveredPlane.setVisualState(state)
      this.hoveredPlane = null
    }
  }

  /**
   * Track mouse down position and start dragging if on a plane
   */
  private handleMouseDown(event: MouseEvent): void {
    if (!this.enabled) return
    if (event.button !== 0) return // Only left click

    this.mouseDownPos = { x: event.clientX, y: event.clientY }

    // Check if clicking on a plane to start dragging
    const planeMeshes = this.planes.map(p => p.getPlaneMesh())
    const intersects = this.viewport3d.raycast(event, planeMeshes)

    if (intersects.length > 0) {
      this.dragger.startDrag(event, intersects[0].object)
    }
  }

  /**
   * Handle dragging or highlight the plane we are hovering over
   */
  private handleMouseMove(event: MouseEvent): void {
    if (!this.enabled) return

    // Handle plane dragging
    if (this.dragger.isDragging() && this.mouseDownPos) {
      const dx = event.clientX - this.mouseDownPos.x
      const dy = event.clientY - this.mouseDownPos.y
      const distance = Math.sqrt(dx * dx + dy * dy)

      // Only start actual drag after threshold (to distinguish from click)
      if (distance >= INTERACTION.CLICK_THRESHOLD_PX) {
        this.dragger.updateDrag(event)
      }
      return
    }

    // Normal hover behavior
    const planeMeshes = this.planes.map(p => p.getPlaneMesh())
    const intersects = this.viewport3d.raycast(event, planeMeshes)

    // Clear previous hover
    if (this.hoveredPlane) {
      // Restore to selected or default based on current selection
      const state = this.hoveredPlane === this.selectedPlane ? 'selected' : 'default'
      this.hoveredPlane.setVisualState(state)
    }
    this.hoveredPlane = null

    // Highlight hovered plane (including selected plane for "alive" feel)
    if (intersects.length > 0) {
      const intersectedMesh = intersects[0].object
      const plane = this.planes.find(p => p.getPlaneMesh() === intersectedMesh)
      if (plane) {
        plane.setVisualState('hovered')
        this.hoveredPlane = plane
      }
    }
  }

  /**
   * Handle mouse up - detect clicks vs drags
   */
  private handleMouseUp(event: MouseEvent): void {
    if (!this.enabled) return

    if (this.mouseDownPos && event.button === 0) {
      const dx = event.clientX - this.mouseDownPos.x
      const dy = event.clientY - this.mouseDownPos.y
      const distance = Math.sqrt(dx * dx + dy * dy)

      if (distance < INTERACTION.CLICK_THRESHOLD_PX) {
        // Was a click, not a drag - cancel any pending drag
        this.dragger.cancelDrag()
        this.handleClick(event)
      } else {
        // Was a drag - end it (may delete if in delete state)
        this.dragger.endDrag()
      }
    }

    this.mouseDownPos = null
  }

  /**
   * Handle click - select plane under cursor, or deselect if clicking empty space
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
    } else {
      // Clicked empty space - deselect
      this.deselectAll()
    }
  }

  /**
   * Deselect all planes
   */
  deselectAll(): void {
    if (this.selectedPlane) {
      this.selectedPlane.setVisualState('default')
      this.selectedPlane = null

      if (this.onSelectionChange) {
        this.onSelectionChange(null)
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
   * Set callback for when selection changes (null means deselected)
   */
  setOnSelectionChange(callback: (plane: SketchPlane | null) => void): void {
    this.onSelectionChange = callback
  }

  /**
   * Set callback for when a plane's height changes (during drag)
   */
  setOnPlaneHeightChange(callback: (plane: SketchPlane, height: number) => void): void {
    this.dragger.setOnPlaneHeightChange(callback)
  }

  /**
   * Set callback for when a new plane is created (by dragging from ground)
   */
  setOnPlaneCreate(callback: (plane: SketchPlane) => void): void {
    this.dragger.setOnPlaneCreate(callback)
  }

  /**
   * Set callback for when a plane is deleted (by dragging below ground)
   */
  setOnPlaneDelete(callback: (plane: SketchPlane) => void): void {
    this.dragger.setOnPlaneDelete(callback)
  }

  /**
   * Get the currently selected plane
   */
  getSelectedPlane(): SketchPlane | null {
    return this.selectedPlane
  }

  /**
   * Reset to a new set of planes, clearing selection
   */
  reset(newPlanes: SketchPlane[]): void {
    // Clear selection state
    if (this.selectedPlane) {
      this.selectedPlane.setVisualState('default')
    }
    this.selectedPlane = null
    this.hoveredPlane = null

    // Update planes reference if different (avoid clearing then pushing same array)
    if (this.planes !== newPlanes) {
      this.planes.length = 0
      this.planes.push(...newPlanes)
    }

    // Reset the dragger's planes reference
    this.dragger.reset(newPlanes)
  }
}
