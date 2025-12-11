import './style.css'
import { Viewport3D } from './Viewport3D'
import { SketchEditor } from './SketchEditor'
import { SketchPlane } from './SketchPlane'
import { PlaneSelector } from './PlaneSelector'

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

const planeSelector = new PlaneSelector(viewport3d, sketchPlanes)

// Update 2D editor when plane selection changes
planeSelector.setOnSelectionChange((plane) => {
  sketchEditor.setSketch(plane.getSketch())
})

// Update 3D view when vertices are dragged in 2D editor
sketchEditor.setOnVertexChange((index, position) => {
  const selectedPlane = planeSelector.getSelectedPlane()
  if (selectedPlane) {
    selectedPlane.setVertex(index, position)
  }
})

// Insert vertex when clicking on a segment in 2D editor
sketchEditor.setOnVertexInsert((segmentIndex, position) => {
  const selectedPlane = planeSelector.getSelectedPlane()
  if (selectedPlane) {
    selectedPlane.insertVertex(segmentIndex, position)
  }
})

// Delete vertex on double-click in 2D editor
sketchEditor.setOnVertexDelete((index) => {
  const selectedPlane = planeSelector.getSelectedPlane()
  if (selectedPlane) {
    selectedPlane.deleteVertex(index)
  }
})

// Select the first plane by default
planeSelector.selectPlane(sketchPlanes[0])

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
