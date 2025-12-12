import './style.css'
import { Viewport3D } from './3d/Viewport3D'
import { PlaneSelector } from './3d/PlaneSelector'
import { SketchEditor } from './2d/SketchEditor'
import { SketchPlane } from './3d/SketchPlane'
import { HelpPanel } from './util/HelpPanel'
import { Loft } from './3d/Loft'
import { DEFAULT_BUILDING_SIZE } from './constants'
import { makeLoftable } from './loft/makeLoftable'
import { MainToolbar } from './ui/MainToolbar'
import { SketchToolbar } from './ui/SketchToolbar'
import { createRegularPolygon } from './util/Geometry'

// Set up HTML structure
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div id="viewport-3d"></div>
  <div id="viewport-2d"></div>
`


// Get container elements.
const container3d = document.querySelector<HTMLDivElement>('#viewport-3d')!
const container2d = document.querySelector<HTMLDivElement>('#viewport-2d')!

// Create Viewports.
const viewport3d = new Viewport3D(container3d)
const sketchEditor = new SketchEditor(container2d)

// Default planes - just the ground floor to start
const sketchPlanes = [
  new SketchPlane(DEFAULT_BUILDING_SIZE, 0),    // Ground floor
]

// Add planes to the 3D viewport.
sketchPlanes.forEach(plane => {
  viewport3d.add(plane.getGroup())
})

// Create loft and add to 3D viewport
const loft = new Loft()
viewport3d.add(loft.getGroup())

// Helper function to rebuild loft with vertex resampling
function rebuildLoft(): void {
  const loftableVertices = makeLoftable(sketchPlanes)
  loft.rebuildFromVertices(sketchPlanes, loftableVertices)
}

// Helper to find the top plane (highest height)
function getTopPlane(): SketchPlane | null {
  if (sketchPlanes.length === 0) return null
  return sketchPlanes.reduce((top, plane) =>
    plane.getHeight() > top.getHeight() ? plane : top
  )
}

// Update roof visibility based on selection and toggle state
function updateRoofVisibility(): void {
  const roofEnabled = mainToolbar.isRoofEnabled()
  const selectedPlane = planeSelector.getSelectedPlane()
  const topPlane = getTopPlane()

  // Show roof only if enabled AND selected plane is not the top plane
  const showRoof = roofEnabled && selectedPlane !== topPlane
  loft.setRoofVisible(showRoof)
}

rebuildLoft()

const planeSelector = new PlaneSelector(viewport3d, sketchPlanes)

// User clicked on a plane, or in empty space.
planeSelector.setOnSelectionChange((plane) => {
  if (plane) {
    // SketchEditor should show the selected plane's sketch.
    sketchEditor.setSketch(plane.getSketch())
  } else {
    // SketchEditor should show nothing.
    sketchEditor.clear()
  }
  updateRoofVisibility()
})

// Rebuild loft when plane height changes
planeSelector.setOnPlaneHeightChange(() => {
  rebuildLoft()
  updateRoofVisibility()
})

// Rebuild loft when new plane is created
planeSelector.setOnPlaneCreate(() => {
  rebuildLoft()
  updateRoofVisibility()
})

// Rebuild loft when plane is deleted
planeSelector.setOnPlaneDelete(() => {
  rebuildLoft()
  updateRoofVisibility()
})

// Update 3D view when vertices are dragged in 2D editor
sketchEditor.setOnVertexChange((index, position) => {
  const selectedPlane = planeSelector.getSelectedPlane()
  if (selectedPlane) {
    selectedPlane.setVertex(index, position)
    rebuildLoft()
  }
})

// Insert vertex when clicking on a segment in 2D editor
sketchEditor.setOnVertexInsert((segmentIndex, position) => {
  const selectedPlane = planeSelector.getSelectedPlane()
  if (selectedPlane) {
    selectedPlane.insertVertex(segmentIndex, position)
    rebuildLoft()
  }
})

// Delete vertex on double-click in 2D editor
sketchEditor.setOnVertexDelete((index) => {
  const selectedPlane = planeSelector.getSelectedPlane()
  if (selectedPlane) {
    selectedPlane.deleteVertex(index)
    rebuildLoft()
  }
})

// Create help panels for each viewport
new HelpPanel([
  { key: 'Scroll', action: 'Zoom' },
  { key: 'Right-drag', action: 'Pan' },
  { key: 'Left-drag', action: 'Orbit' },
  { key: 'Drag plane', action: 'Adjust height' },
  { key: 'Shift-drag', action: 'Copy floor' },
  { key: 'Drag down', action: 'Delete floor' },
]).appendTo(container3d)

// Create main toolbar
const mainToolbar = new MainToolbar(container3d)

// Wire up toolbar callbacks
mainToolbar.setOnPlanesChange((visible) => {
  sketchPlanes.forEach(plane => plane.getGroup().visible = visible)
  if (!visible) {
    planeSelector.deselectAll()
  }
  planeSelector.setEnabled(visible)
})

mainToolbar.setOnWallsChange((visible) => {
  loft.setSolidVisible(visible)
})

mainToolbar.setOnRoofChange(() => {
  updateRoofVisibility()
})

mainToolbar.setOnWireframeChange((mode) => {
  loft.setWireframeMode(mode)
})

// Reset to a single 1x1 square plane at ground level
function newModel(): void {
  // Remove all existing planes from 3D viewport
  sketchPlanes.forEach(plane => viewport3d.remove(plane.getGroup()))

  // Create a single plane with default building size at ground level
  const newPlane = new SketchPlane(DEFAULT_BUILDING_SIZE, 0)

  // Update sketchPlanes array in place (clear and add new plane)
  sketchPlanes.length = 0
  sketchPlanes.push(newPlane)

  // Add to 3D viewport
  viewport3d.add(newPlane.getGroup())

  // Reset the plane selector with the updated sketchPlanes
  planeSelector.reset(sketchPlanes)

  // Reset display settings
  mainToolbar.reset()

  // Rebuild loft (will be empty with just 1 plane)
  rebuildLoft()

  // Select the new plane
  planeSelector.selectPlane(newPlane)
}

// Create action toolbar (right side)
const actionToolbar = document.createElement('div')
actionToolbar.className = 'action-toolbar'
actionToolbar.innerHTML = `
  <button data-action="new">New</button>
`
container3d.appendChild(actionToolbar)

// Handle action toolbar button clicks
actionToolbar.addEventListener('click', (e) => {
  const target = e.target as HTMLElement
  if (target.tagName === 'BUTTON') {
    const action = target.dataset.action
    if (action === 'new') {
      newModel()
    }
  }
})

new HelpPanel([
  { key: 'Scroll', action: 'Zoom' },
  { key: 'Right-drag', action: 'Pan' },
  { key: 'Double-click', action: 'Delete vertex' },
]).appendTo(container2d)

// Create sketch toolbar for 2D viewport
const sketchToolbar = new SketchToolbar(container2d)

sketchToolbar.setOnOrientationChange((mode) => {
  if (mode === 'fixed') {
    sketchEditor.setRotation(0)
  }
})

sketchToolbar.setOnShapeSelect((sides) => {
  const selectedPlane = planeSelector.getSelectedPlane()
  if (selectedPlane) {
    const vertices = createRegularPolygon(sides, DEFAULT_BUILDING_SIZE)
    selectedPlane.setVertices(vertices)
    rebuildLoft()
  }
})

// Resize handler
window.addEventListener('resize', () => {
  viewport3d.resize()
  sketchEditor.resize()
})

// Animation loop
function animate() {
  requestAnimationFrame(animate)

  // Update 2D sketch rotation if in rotate mode
  if (sketchToolbar.getOrientationMode() === 'rotate') {
    sketchEditor.setRotation(viewport3d.getCameraAzimuth())
  }

  // Render both viewports
  viewport3d.render()
  sketchEditor.render()
}

// Select the first plane by default (after all toolbars are initialized)
planeSelector.selectPlane(sketchPlanes[0])

// Start animation loop!
animate()
