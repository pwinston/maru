import { Viewport3D } from './3d/Viewport3D'
import { PlaneSelector } from './3d/PlaneSelector'
import { SketchEditor } from './2d/SketchEditor'
import { SketchPlane } from './3d/SketchPlane'
import { HelpPanel } from './util/HelpPanel'
import { Loft } from './3d/Loft'
import { DEFAULT_BUILDING_SIZE } from './constants'
import { LoftableModel } from './loft/LoftableModel'
import { MainToolbar } from './ui/MainToolbar'
import { SketchToolbar } from './ui/SketchToolbar'
import { createRegularPolygon } from './util/Geometry'
import { FileMenu } from './ui/FileMenu'
import { BuildingSerializer } from './storage/BuildingSerializer'
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

  // State
  private sketchPlanes: SketchPlane[] = []

  constructor(container3d: HTMLDivElement, container2d: HTMLDivElement) {
    this.container3d = container3d
    this.container2d = container2d

    // Create viewports
    this.viewport3d = new Viewport3D(container3d)
    this.sketchEditor = new SketchEditor(container2d)

    // Create initial plane
    this.sketchPlanes = [new SketchPlane(DEFAULT_BUILDING_SIZE, 0)]
    this.sketchPlanes.forEach(plane => this.viewport3d.add(plane.getGroup()))

    // Create loft
    this.loft = new Loft()
    this.viewport3d.add(this.loft.getGroup())

    // Create toolbars
    this.mainToolbar = new MainToolbar(container3d)
    this.sketchToolbar = new SketchToolbar(container2d)
    this.fileMenu = new FileMenu(container3d)

    // Create plane selector
    this.planeSelector = new PlaneSelector(this.viewport3d, this.sketchPlanes)

    // Wire up all callbacks
    this.setupCallbacks()

    // Create help panels
    this.createHelpPanels()

    // Initial build
    this.rebuildLoft()
  }

  /**
   * Start the application (animation loop, initial selection)
   */
  start(): void {
    // Select first plane
    this.planeSelector.selectPlane(this.sketchPlanes[0])

    // Start animation loop
    this.animate()

    // Handle window resize
    window.addEventListener('resize', () => {
      this.viewport3d.resize()
      this.sketchEditor.resize()
    })
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
   * Rebuild the loft mesh from current planes
   */
  private rebuildLoft(): void {
    const model = LoftableModel.fromPlanes(this.sketchPlanes)
    this.loft.rebuildFromModel(model)
  }

  /**
   * Get the top plane (highest height)
   */
  private getTopPlane(): SketchPlane | null {
    if (this.sketchPlanes.length === 0) return null
    return this.sketchPlanes.reduce((top, plane) =>
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
   * Reset to a single square plane at ground level
   */
  private newModel(): void {
    // Remove all existing planes
    this.sketchPlanes.forEach(plane => this.viewport3d.remove(plane.getGroup()))

    // Create a single plane
    const newPlane = new SketchPlane(DEFAULT_BUILDING_SIZE, 0)
    this.sketchPlanes.length = 0
    this.sketchPlanes.push(newPlane)

    // Add to viewport
    this.viewport3d.add(newPlane.getGroup())

    // Reset plane selector
    this.planeSelector.reset(this.sketchPlanes)

    // Reset display settings
    this.mainToolbar.reset()

    // Rebuild loft
    this.rebuildLoft()

    // Select the new plane
    this.planeSelector.selectPlane(newPlane)
  }

  /**
   * Load a building from saved data
   */
  private loadBuilding(data: BuildingData): void {
    // Remove all existing planes
    this.sketchPlanes.forEach(plane => this.viewport3d.remove(plane.getGroup()))
    this.sketchPlanes.length = 0

    // Deserialize and add new planes
    const newPlanes = BuildingSerializer.deserialize(data)
    for (const plane of newPlanes) {
      this.sketchPlanes.push(plane)
      this.viewport3d.add(plane.getGroup())
    }

    // Reset plane selector
    this.planeSelector.reset(this.sketchPlanes)

    // Rebuild loft
    this.rebuildLoft()

    // Select first plane
    if (this.sketchPlanes.length > 0) {
      this.planeSelector.selectPlane(this.sketchPlanes[0])
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
      } else {
        this.sketchEditor.clear()
      }
      this.updateRoofVisibility()
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
        this.rebuildLoft()
      }
    })

    this.sketchEditor.setOnVertexInsert((segmentIndex, position) => {
      const selectedPlane = this.planeSelector.getSelectedPlane()
      if (selectedPlane) {
        selectedPlane.insertVertex(segmentIndex, position)
        this.rebuildLoft()
      }
    })

    this.sketchEditor.setOnVertexDelete((index) => {
      const selectedPlane = this.planeSelector.getSelectedPlane()
      if (selectedPlane) {
        selectedPlane.deleteVertex(index)
        this.rebuildLoft()
      }
    })

    // Main toolbar callbacks
    this.mainToolbar.setOnPlanesChange((visible) => {
      this.sketchPlanes.forEach(plane => plane.getGroup().visible = visible)
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
      const selectedPlane = this.planeSelector.getSelectedPlane()
      if (selectedPlane) {
        const vertices = createRegularPolygon(sides, DEFAULT_BUILDING_SIZE)
        selectedPlane.setVertices(vertices)
        this.rebuildLoft()
      }
    })

    // File menu callbacks
    this.fileMenu.setOnNew(() => {
      this.newModel()
    })

    this.fileMenu.setOnLoad((data: BuildingData) => {
      this.loadBuilding(data)
    })

    this.fileMenu.setOnGetCurrentData(() => {
      return BuildingSerializer.serialize(this.sketchPlanes)
    })
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
      { key: 'Shift-drag', action: 'Copy floor' },
      { key: 'Drag down', action: 'Delete floor' },
    ]).appendTo(this.container3d)

    new HelpPanel([
      { key: 'Scroll', action: 'Zoom' },
      { key: 'Right-drag', action: 'Pan' },
      { key: 'Double-click', action: 'Delete vertex' },
    ]).appendTo(this.container2d)
  }
}
