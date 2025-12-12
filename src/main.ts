import './style.css'
import { Viewport3D } from './3d/Viewport3D'
import { PlaneSelector } from './3d/PlaneSelector'
import { SketchEditor } from './2d/SketchEditor'
import { SketchPlane } from './3d/SketchPlane'
import { HelpPanel } from './util/HelpPanel'
import { Loft, type RenderMode } from './3d/Loft'

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
  new SketchPlane(1, 0),    // Ground floor
]

// Add planes to the 3D viewport.
sketchPlanes.forEach(plane => {
  viewport3d.add(plane.getGroup())
})

// Create loft and add to 3D viewport
const loft = new Loft()
viewport3d.add(loft.getGroup())
loft.rebuild(sketchPlanes)

const planeSelector = new PlaneSelector(viewport3d, sketchPlanes)

// Update 2D editor when plane selection changes
planeSelector.setOnSelectionChange((plane) => {
  sketchEditor.setSketch(plane.getSketch())
})

// Rebuild loft when plane height changes
planeSelector.setOnPlaneHeightChange(() => {
  loft.rebuild(sketchPlanes)
})

// Rebuild loft when new plane is created
planeSelector.setOnPlaneCreate(() => {
  loft.rebuild(sketchPlanes)
})

// Rebuild loft when plane is deleted
planeSelector.setOnPlaneDelete(() => {
  loft.rebuild(sketchPlanes)
  // Switch to 'none' mode if down to 1 plane (no loft to show)
  if (sketchPlanes.length < 2) {
    setRenderMode('none')
  }
})

// Update 3D view when vertices are dragged in 2D editor
sketchEditor.setOnVertexChange((index, position) => {
  const selectedPlane = planeSelector.getSelectedPlane()
  if (selectedPlane) {
    selectedPlane.setVertex(index, position)
    loft.rebuild(sketchPlanes)
  }
})

// Insert vertex when clicking on a segment in 2D editor
sketchEditor.setOnVertexInsert((segmentIndex, position) => {
  const selectedPlane = planeSelector.getSelectedPlane()
  if (selectedPlane) {
    selectedPlane.insertVertex(segmentIndex, position)
    loft.rebuild(sketchPlanes)
  }
})

// Delete vertex on double-click in 2D editor
sketchEditor.setOnVertexDelete((index) => {
  const selectedPlane = planeSelector.getSelectedPlane()
  if (selectedPlane) {
    selectedPlane.deleteVertex(index)
    loft.rebuild(sketchPlanes)
  }
})

// Select the first plane by default
planeSelector.selectPlane(sketchPlanes[0])

// Create help panels for each viewport
new HelpPanel([
  { key: 'Scroll', action: 'Zoom' },
  { key: 'Right-drag', action: 'Pan' },
  { key: 'Left-drag', action: 'Orbit' },
  { key: 'Drag plane', action: 'Adjust height' },
  { key: 'Shift-drag', action: 'Copy floor' },
  { key: 'Drag down', action: 'Delete floor' },
]).appendTo(container3d)

// Create render mode toolbar
const renderToolbar = document.createElement('div')
renderToolbar.className = 'render-toolbar'
renderToolbar.innerHTML = `
  <button data-mode="none" class="active">None</button>
  <button data-mode="solid">Solid</button>
  <button data-mode="wire">Wire</button>
  <button data-mode="both">Both</button>
`
container3d.appendChild(renderToolbar)

// Update profile visibility based on render mode
function updateProfileVisibility(mode: RenderMode): void {
  const showProfiles = mode === 'none'
  sketchPlanes.forEach(plane => plane.setProfileVisible(showProfiles))
}

// Set render mode and update UI
function setRenderMode(mode: RenderMode): void {
  loft.setRenderMode(mode)
  updateProfileVisibility(mode)
  renderToolbar.querySelectorAll('button').forEach(btn => btn.classList.remove('active'))
  renderToolbar.querySelector(`button[data-mode="${mode}"]`)?.classList.add('active')
}

// Start in 'none' mode since we only have 1 plane (no loft)
loft.setRenderMode('none')
updateProfileVisibility('none')

// Handle render mode button clicks
renderToolbar.addEventListener('click', (e) => {
  const target = e.target as HTMLElement
  if (target.tagName === 'BUTTON') {
    const mode = target.dataset.mode as RenderMode
    setRenderMode(mode)
  }
})

// Reset to a single 1x1 square plane at ground level
function newModel(): void {
  // Remove all existing planes from 3D viewport
  sketchPlanes.forEach(plane => viewport3d.remove(plane.getGroup()))

  // Create a single plane with 1x1 square at ground level
  const newPlane = new SketchPlane(1, 0)
  const newPlanes = [newPlane]

  // Add to 3D viewport
  viewport3d.add(newPlane.getGroup())

  // Reset the plane selector with new planes
  planeSelector.reset(newPlanes)

  // Switch to 'none' mode since there's no loft with 1 plane
  setRenderMode('none')

  // Rebuild loft (will be empty with just 1 plane)
  loft.rebuild(newPlanes)

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

// Create orientation toolbar for 2D viewport
const orientationToolbar = document.createElement('div')
orientationToolbar.className = 'orientation-toolbar'
orientationToolbar.innerHTML = `
  <button data-mode="fixed" class="active">Fixed</button>
  <button data-mode="rotate">Rotate</button>
`
container2d.appendChild(orientationToolbar)

// Orientation mode state
let orientationMode: 'fixed' | 'rotate' = 'fixed'

// Handle orientation toolbar button clicks
orientationToolbar.addEventListener('click', (e) => {
  const target = e.target as HTMLElement
  if (target.tagName === 'BUTTON') {
    orientationMode = target.dataset.mode as 'fixed' | 'rotate'
    orientationToolbar.querySelectorAll('button').forEach(btn => btn.classList.remove('active'))
    target.classList.add('active')
    // Reset rotation when switching to fixed
    if (orientationMode === 'fixed') {
      sketchEditor.setRotation(0)
    }
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
  if (orientationMode === 'rotate') {
    sketchEditor.setRotation(viewport3d.getCameraAzimuth())
  }

  // Render both viewports
  viewport3d.render()
  sketchEditor.render()
}

// Start animation loop!
animate()
