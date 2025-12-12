import './style.css'
import { Viewport3D } from './3d/Viewport3D'
import { PlaneSelector } from './3d/PlaneSelector'
import { SketchEditor } from './2d/SketchEditor'
import { SketchPlane } from './3d/SketchPlane'
import { HelpBar } from './util/HelpBar'
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

// Default planes.
const sketchPlanes = [
  new SketchPlane(4, 0),    // Ground floor
  new SketchPlane(3, 1),    // First floor
  new SketchPlane(2, 2),    // Second floor
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

// Create help bars for each viewport
new HelpBar([
  { key: 'Scroll', action: 'Zoom' },
  { key: 'Right-drag', action: 'Pan' },
  { key: 'Left-drag', action: 'Orbit' },
  { key: 'Drag plane', action: 'Adjust height' },
  { key: 'Drag ground', action: 'Add floor' },
  { key: 'Drag down', action: 'Delete floor' },
]).appendTo(container3d)

// Create render mode toolbar
const renderToolbar = document.createElement('div')
renderToolbar.className = 'render-toolbar'
renderToolbar.innerHTML = `
  <button data-mode="none">None</button>
  <button data-mode="solid">Solid</button>
  <button data-mode="wire">Wire</button>
  <button data-mode="both" class="active">Both</button>
`
container3d.appendChild(renderToolbar)

// Update profile visibility based on render mode
function updateProfileVisibility(mode: RenderMode): void {
  const showProfiles = mode === 'none'
  sketchPlanes.forEach(plane => plane.setProfileVisible(showProfiles))
}

// Initially hide profiles since we start in 'both' mode
updateProfileVisibility('both')

// Handle render mode button clicks
renderToolbar.addEventListener('click', (e) => {
  const target = e.target as HTMLElement
  if (target.tagName === 'BUTTON') {
    const mode = target.dataset.mode as RenderMode
    loft.setRenderMode(mode)
    updateProfileVisibility(mode)
    renderToolbar.querySelectorAll('button').forEach(btn => btn.classList.remove('active'))
    target.classList.add('active')
  }
})

new HelpBar([
  { key: 'Scroll', action: 'Zoom' },
  { key: 'Right-drag', action: 'Pan' },
  { key: 'Double-click', action: 'Delete vertex' },
]).appendTo(container2d)

// Resize handler
window.addEventListener('resize', () => {
  viewport3d.resize()
  sketchEditor.resize()
})

// Animation loop
function animate() {
  requestAnimationFrame(animate)

  // Render both viewports
  viewport3d.render()
  sketchEditor.render()
}

// Start animation loop!
animate()
