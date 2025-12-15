import { Viewport3D } from './3d/Viewport3D'
import { PlaneSelector } from './3d/PlaneSelector'
import { SketchEditor } from './2d/SketchEditor'
import { SketchPlane, type PlaneBounds } from './3d/SketchPlane'
import { HelpPanel } from './util/HelpPanel'
import { Loft } from './3d/Loft'
import { DEFAULT_BUILDING_SIZE, VERSION } from './constants'
import { LoftableModel } from './loft/LoftableModel'
import { MainToolbar } from './ui/MainToolbar'
import { SketchToolbar } from './ui/SketchToolbar'
import { createRegularPolygon } from './util/Geometry'
import { FileMenu } from './ui/FileMenu'
import { Minimap } from './ui/Minimap'
import { BuildingSerializer } from './storage/BuildingSerializer'
import { Model } from './model/Model'
import type { BuildingData } from './storage/BuildingTypes'

/**
 * Main application class. Owns all state and coordinates components.
 */
export class App {
  // Containers
  private container3d: HTMLDivElement
  private container2d: HTMLDivElement

  // Core components
  private viewport3d: Viewport3D
  private sketchEditor: SketchEditor
  private planeSelector: PlaneSelector
  private loft: Loft

  // UI
  private mainToolbar: MainToolbar
  private sketchToolbar: SketchToolbar
  private fileMenu: FileMenu
  private minimap: Minimap

  // State
  private model: Model

  constructor(container3d: HTMLDivElement, container2d: HTMLDivElement) {
    this.container3d = container3d
    this.container2d = container2d

    // Create viewports
    this.viewport3d = new Viewport3D(container3d)
    this.sketchEditor = new SketchEditor(container2d)

    // Create initial model with one plane
    this.model = new Model('untitled', [new SketchPlane(DEFAULT_BUILDING_SIZE, 0)])
    this.model.planes.forEach(plane => this.viewport3d.add(plane.getGroup()))

    // Create loft
    this.loft = new Loft()
    this.viewport3d.add(this.loft.getGroup())

    // Create toolbars
    this.mainToolbar = new MainToolbar(container3d)
    this.sketchToolbar = new SketchToolbar(container2d)
    this.fileMenu = new FileMenu(container3d)
    this.minimap = new Minimap(container2d)

    // Create plane selector
    this.planeSelector = new PlaneSelector(this.viewport3d, this.model)

    // Wire up all callbacks
    this.setupCallbacks()

    // Create help panels
    this.createHelpPanels()

    // Create version badge
    this.createVersionBadge()

    // Initial build
    this.rebuildLoft()
  }

  /**
   * Start the application (animation loop, initial selection)
   */
  start(): void {
    // Select first plane
    this.planeSelector.selectPlane(this.model.planes[0])

    // Start animation loop
    this.animate()

    // Handle window resize
    window.addEventListener('resize', () => {
      this.viewport3d.resize()
      this.sketchEditor.resize()
    })

    // Debug key handler
    window.addEventListener('keydown', (e) => {
      if (e.key === 'd' || e.key === 'D') {
        this.exportLoftDebugData()
      }
    })
  }

  /**
   * Export loft debug data to console and download as JSON
   */
  private exportLoftDebugData(): void {
    const model = LoftableModel.fromPlanes(this.model.planes)
    const debugData = model.exportDebugData()

    // Log to console
    console.log('=== LOFT DEBUG DATA ===')
    console.log(JSON.stringify(debugData, null, 2))

    // Download as JSON file
    const blob = new Blob([JSON.stringify(debugData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `loft-debug-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)

    console.log('Debug data downloaded!')
  }

  /**
   * Animation loop
   */
  private animate = (): void => {
    requestAnimationFrame(this.animate)

    // Update 2D sketch rotation if in rotate mode
    if (this.sketchToolbar.getOrientationMode() === 'rotate') {
      this.sketchEditor.setRotation(this.viewport3d.getCameraAzimuth())
    }

    // Render both viewports
    this.viewport3d.render()
    this.sketchEditor.render()
  }

  /**
   * Rebuild the loft mesh from current planes.
   * Respects segment lock states - locked segments keep their topology.
   */
  private rebuildLoft(): void {
    this.syncPlaneSizes()
    const loftModel = LoftableModel.fromModel(this.model)
    this.loft.rebuildFromModel(loftModel)
    this.minimap.setPlaneCount(this.model.planes.length)

    // Store reference to current loft model for freezing segments
    this.currentLoftModel = loftModel
  }

  /** Current loft model, needed for capturing frozen segments */
  private currentLoftModel: LoftableModel | null = null

  /**
   * Called when a sketch is modified by the user (vertex moved, inserted, deleted)
   */
  private onSketchModified(): void {
    this.rebuildLoft()
    this.sketchToolbar.clearActiveSides()
  }

  /**
   * Make all planes the same size (the max bounds across all planes)
   */
  private syncPlaneSizes(): void {
    if (this.model.planes.length === 0) return

    // Calculate max bounds across all planes
    let minX = Infinity, maxX = -Infinity
    let minY = Infinity, maxY = -Infinity

    for (const plane of this.model.planes) {
      const bounds = plane.getBounds()
      minX = Math.min(minX, bounds.minX)
      maxX = Math.max(maxX, bounds.maxX)
      minY = Math.min(minY, bounds.minY)
      maxY = Math.max(maxY, bounds.maxY)
    }

    const sharedBounds: PlaneBounds = { minX, maxX, minY, maxY }

    // Apply to all planes
    for (const plane of this.model.planes) {
      plane.setSharedBounds(sharedBounds)
    }
  }

  /**
   * Get the top plane (highest height)
   */
  private getTopPlane(): SketchPlane | null {
    if (this.model.planes.length === 0) return null
    return this.model.planes.reduce((top, plane) =>
      plane.getHeight() > top.getHeight() ? plane : top
    )
  }

  /**
   * Update roof visibility based on selection and toggle state
   */
  private updateRoofVisibility(): void {
    const roofEnabled = this.mainToolbar.isRoofEnabled()
    const selectedPlane = this.planeSelector.getSelectedPlane()
    const topPlane = this.getTopPlane()

    const showRoof = roofEnabled && selectedPlane !== topPlane
    this.loft.setRoofVisible(showRoof)
  }

  /**
   * Update ghost sketch based on selection and toggle state
   */
  private updateGhostSketch(): void {
    if (!this.sketchToolbar.isGhostEnabled()) {
      this.sketchEditor.clearGhostSketch()
      return
    }

    const selectedPlane = this.planeSelector.getSelectedPlane()
    if (!selectedPlane) {
      this.sketchEditor.clearGhostSketch()
      return
    }

    // Find the plane below the selected one
    const sortedPlanes = [...this.model.planes].sort((a, b) => a.getHeight() - b.getHeight())
    const selectedIndex = sortedPlanes.indexOf(selectedPlane)

    if (selectedIndex > 0) {
      // Show the plane below as ghost
      const planeBelow = sortedPlanes[selectedIndex - 1]
      this.sketchEditor.setGhostSketch(planeBelow.getSketch())
    } else {
      // No plane below (this is the bottom plane)
      this.sketchEditor.clearGhostSketch()
    }
  }

  /**
   * Reset to a single square plane at ground level
   */
  private newModel(): void {
    // Remove all existing planes from viewport
    this.model.planes.forEach(plane => this.viewport3d.remove(plane.getGroup()))

    // Create fresh model with single plane
    this.model = new Model('untitled', [new SketchPlane(DEFAULT_BUILDING_SIZE, 0)])

    // Add to viewport
    this.model.planes.forEach(plane => this.viewport3d.add(plane.getGroup()))

    // Reset plane selector
    this.planeSelector.reset(this.model)

    // Reset display settings
    this.mainToolbar.reset()

    // Rebuild loft
    this.rebuildLoft()

    // Select the first plane
    this.planeSelector.selectPlane(this.model.planes[0])
  }

  /**
   * Load a building from saved data
   */
  private loadBuilding(data: BuildingData): void {
    // Remove all existing planes from viewport
    this.model.planes.forEach(plane => this.viewport3d.remove(plane.getGroup()))

    // Deserialize into new model
    this.model = BuildingSerializer.deserialize(data)

    // Add new planes to viewport
    this.model.planes.forEach(plane => this.viewport3d.add(plane.getGroup()))

    // Sync minimap lock states from model
    this.syncMinimapFromModel()

    // Reset plane selector
    this.planeSelector.reset(this.model)

    // Rebuild loft
    this.rebuildLoft()

    // Select first plane
    if (this.model.planes.length > 0) {
      this.planeSelector.selectPlane(this.model.planes[0])
    }
  }

  /**
   * Sync minimap lock states from model
   */
  private syncMinimapFromModel(): void {
    for (let i = 0; i < this.model.segmentLocked.length; i++) {
      this.minimap.setSegmentLocked(i, this.model.segmentLocked[i])
    }
  }

  /**
   * Wire up all component callbacks
   */
  private setupCallbacks(): void {
    // Plane selector callbacks
    this.planeSelector.setOnSelectionChange((plane) => {
      if (plane) {
        this.sketchEditor.setSketch(plane.getSketch())
        // Update minimap selection (planes sorted by height, 0 = bottom)
        const sortedPlanes = [...this.model.planes].sort((a, b) => a.getHeight() - b.getHeight())
        const planeIndex = sortedPlanes.indexOf(plane)
        this.minimap.setSelectedPlane(planeIndex)
      } else {
        this.sketchEditor.clear()
        this.minimap.setSelectedPlane(-1)
      }
      this.updateRoofVisibility()
      this.updateGhostSketch()
      this.sketchToolbar.clearActiveSides()
    })

    this.planeSelector.setOnPlaneHeightChange(() => {
      this.rebuildLoft()
      this.updateRoofVisibility()
    })

    this.planeSelector.setOnPlaneCreate(() => {
      this.rebuildLoft()
      this.updateRoofVisibility()
    })

    this.planeSelector.setOnPlaneDelete(() => {
      this.rebuildLoft()
      this.updateRoofVisibility()
    })

    // Sketch editor callbacks
    this.sketchEditor.setOnVertexChange((index, position) => {
      const selectedPlane = this.planeSelector.getSelectedPlane()
      if (selectedPlane) {
        selectedPlane.setVertex(index, position)
        this.onSketchModified()
      }
    })

    this.sketchEditor.setOnVertexInsert((segmentIndex, position) => {
      const selectedPlane = this.planeSelector.getSelectedPlane()
      if (selectedPlane) {
        selectedPlane.insertVertex(segmentIndex, position)
        this.onSketchModified()
      }
    })

    this.sketchEditor.setOnVertexDelete((index) => {
      const selectedPlane = this.planeSelector.getSelectedPlane()
      if (selectedPlane) {
        selectedPlane.deleteVertex(index)
        this.onSketchModified()
      }
    })

    this.sketchEditor.setOnDrawComplete((vertices) => {
      const selectedPlane = this.planeSelector.getSelectedPlane()
      if (selectedPlane) {
        selectedPlane.setVertices(vertices)
        this.onSketchModified()
      }
      this.sketchToolbar.endDrawMode()
    })

    this.sketchEditor.setOnDrawCancel(() => {
      this.sketchToolbar.endDrawMode()
    })

    // Main toolbar callbacks
    this.mainToolbar.setOnPlanesChange((visible) => {
      this.model.planes.forEach(plane => plane.getGroup().visible = visible)
      if (!visible) {
        this.planeSelector.deselectAll()
      }
      this.planeSelector.setEnabled(visible)
    })

    this.mainToolbar.setOnWallsChange((visible) => {
      this.loft.setSolidVisible(visible)
    })

    this.mainToolbar.setOnRoofChange(() => {
      this.updateRoofVisibility()
    })

    this.mainToolbar.setOnWireframeChange((mode) => {
      this.loft.setWireframeMode(mode)
    })

    // Sketch toolbar callbacks
    this.sketchToolbar.setOnOrientationChange((mode) => {
      if (mode === 'fixed') {
        this.sketchEditor.setRotation(0)
      }
    })

    this.sketchToolbar.setOnShapeSelect((sides) => {
      // Cancel draw mode if active
      if (this.sketchEditor.isDrawModeActive()) {
        this.sketchEditor.cancelDrawMode()
        this.sketchToolbar.endDrawMode()
      }

      const selectedPlane = this.planeSelector.getSelectedPlane()
      if (selectedPlane) {
        const vertices = createRegularPolygon(sides, DEFAULT_BUILDING_SIZE)
        selectedPlane.setVertices(vertices)
        // Re-set sketch in 2D editor to sync with new shape
        this.sketchEditor.setSketch(selectedPlane.getSketch())
        this.rebuildLoft()
      }
    })

    this.sketchToolbar.setOnGhostChange(() => {
      this.updateGhostSketch()
    })

    this.sketchToolbar.setOnDrawStart(() => {
      this.sketchEditor.startDrawMode()
    })

    // File menu callbacks
    this.fileMenu.setOnNew(() => {
      this.newModel()
    })

    this.fileMenu.setOnLoad((data: BuildingData) => {
      this.loadBuilding(data)
    })

    this.fileMenu.setOnGetCurrentData(() => {
      return BuildingSerializer.serialize(this.model)
    })

    // Minimap callbacks
    this.minimap.setOnSegmentLockChange((segmentIndex, locked) => {

      if (locked && this.currentLoftModel) {
        // Locking: capture frozen segment data from current topology
        const segment = this.currentLoftModel.segments[segmentIndex]
        if (segment) {
          const frozen = LoftableModel.freezeSegment(
            segment.bottomPlane,
            segment.topPlane,
            segment.faces
          )
          this.model.setFrozenSegment(segmentIndex, frozen)
        }
      }
      this.model.setSegmentLocked(segmentIndex, locked)

      // Rebuild loft to update the view
      this.rebuildLoft()
    })

    this.minimap.setOnPlaneSelect((planeIndex) => {
      // Planes are sorted by height (0 = bottom, higher = top)
      const sortedPlanes = [...this.model.planes].sort((a, b) => a.getHeight() - b.getHeight())
      if (planeIndex >= 0 && planeIndex < sortedPlanes.length) {
        this.planeSelector.selectPlane(sortedPlanes[planeIndex])
      }
    })
  }

  /**
   * Create version badge in corner of 3D viewport
   */
  private createVersionBadge(): void {
    const badge = document.createElement('div')
    badge.className = 'version-badge'
    badge.textContent = `v${VERSION}`
    this.container3d.appendChild(badge)
  }

  /**
   * Create help panels for both viewports
   */
  private createHelpPanels(): void {
    new HelpPanel([
      { key: 'Scroll', action: 'Zoom' },
      { key: 'Right-drag', action: 'Pan' },
      { key: 'Left-drag', action: 'Orbit' },
      { key: 'Drag plane', action: 'Adjust height' },
      { key: 'Shift-drag', action: 'Copy plane' },
      { key: 'Drag down', action: 'Delete plane' },
    ]).appendTo(this.container3d)

    new HelpPanel([
      { key: 'Scroll', action: 'Zoom' },
      { key: 'Right-drag', action: 'Pan' },
      { key: 'Left-drag', action: 'Sweep select' },
      { key: 'Double-click', action: 'Delete vertex' },
    ]).appendTo(this.container2d)
  }
}
