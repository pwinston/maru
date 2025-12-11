import './style.css'
import * as THREE from 'three'
import { Viewport3D } from './Viewport3D'
import { SketchEditor } from './SketchEditor'
import { SketchPlane } from './SketchPlane'

// Set up HTML structure
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div id="viewport-3d"></div>
  <div id="viewport-2d"></div>
`

// Get container elements
const viewport3dContainer = document.querySelector<HTMLDivElement>('#viewport-3d')!
const viewport2dContainer = document.querySelector<HTMLDivElement>('#viewport-2d')!

// Create viewports
const viewport3d = new Viewport3D(viewport3dContainer)
const sketchEditor = new SketchEditor(viewport2dContainer)

// === CREATE SKETCH PLANES ===

// Create three sketch planes at different heights (y=0, y=1, y=2)
const plane1Vertices = [
  new THREE.Vector2(-2, -2),
  new THREE.Vector2(2, -2),
  new THREE.Vector2(2, 2),
  new THREE.Vector2(-2, 2),
]

const plane2Vertices = [
  new THREE.Vector2(-1.5, -1.5),
  new THREE.Vector2(1.5, -1.5),
  new THREE.Vector2(1.5, 1.5),
  new THREE.Vector2(-1.5, 1.5),
]

const plane3Vertices = [
  new THREE.Vector2(-1, -1),
  new THREE.Vector2(1, -1),
  new THREE.Vector2(1, 1),
  new THREE.Vector2(-1, 1),
]

const sketchPlanes = [
  new SketchPlane(plane1Vertices, 0),    // Ground floor
  new SketchPlane(plane2Vertices, 1),    // First floor
  new SketchPlane(plane3Vertices, 2),    // Second floor
]

// Add all planes to the 3D viewport
sketchPlanes.forEach(plane => {
  viewport3d.add(plane.getGroup())
})

// === PLANE SELECTION ===

let selectedPlane: SketchPlane | null = null

function selectPlane(plane: SketchPlane) {
  // Deselect previous plane
  if (selectedPlane) {
    selectedPlane.setHighlight(false)
  }

  // Select new plane
  selectedPlane = plane
  selectedPlane.setHighlight(true)

  // Update 2D editor with selected plane's vertices
  sketchEditor.clear()
  sketchEditor.createPolygon(plane.getVertices())
}

// Select the first plane by default
selectPlane(sketchPlanes[0])

// === MOUSE INTERACTION ===

let hoveredPlane: SketchPlane | null = null

// Handle mouse move for hover feedback
viewport3d.getElement().addEventListener('mousemove', (event) => {
  const planeMeshes = sketchPlanes.map(p => p.getPlaneMesh())
  const intersects = viewport3d.raycast(event, planeMeshes)

  // Clear previous hover
  if (hoveredPlane && hoveredPlane !== selectedPlane) {
    hoveredPlane.setHighlight(false)
  }
  hoveredPlane = null

  // Highlight hovered plane
  if (intersects.length > 0) {
    const intersectedMesh = intersects[0].object
    const plane = sketchPlanes.find(p => p.getPlaneMesh() === intersectedMesh)
    if (plane && plane !== selectedPlane) {
      plane.setHighlight(true)
      hoveredPlane = plane
    }
  }
})

// Handle click for selection
viewport3d.getElement().addEventListener('click', (event) => {
  const planeMeshes = sketchPlanes.map(p => p.getPlaneMesh())
  const intersects = viewport3d.raycast(event, planeMeshes)

  if (intersects.length > 0) {
    const intersectedMesh = intersects[0].object
    const plane = sketchPlanes.find(p => p.getPlaneMesh() === intersectedMesh)
    if (plane) {
      selectPlane(plane)
    }
  }
})

// === ANIMATION LOOP ===

function animate() {
  requestAnimationFrame(animate)

  // Render both viewports
  viewport3d.render()
  sketchEditor.render()
}

// === WINDOW RESIZE HANDLER ===

window.addEventListener('resize', () => {
  viewport3d.resize()
  sketchEditor.resize()
})

animate()
