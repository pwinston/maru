import './style.css'
import * as THREE from 'three'
import { Viewport3D } from './Viewport3D'
import { SketchEditor } from './SketchEditor'

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

// === DEMO CONTENT ===

// Add a cube to the 3D viewport for demonstration
const cubeGeometry = new THREE.BoxGeometry(2, 2, 2)
const cubeMaterial = new THREE.MeshStandardMaterial({
  color: 0x4a9eff,
  roughness: 0.5,
  metalness: 0.1
})
const cube = new THREE.Mesh(cubeGeometry, cubeMaterial)
viewport3d.add(cube)

// Add a square to the 2D sketch editor for demonstration
const squareVertices = [
  new THREE.Vector2(-1.5, -1.5),
  new THREE.Vector2(1.5, -1.5),
  new THREE.Vector2(1.5, 1.5),
  new THREE.Vector2(-1.5, 1.5),
]
sketchEditor.createPolygon(squareVertices)

// === ANIMATION LOOP ===

function animate() {
  requestAnimationFrame(animate)

  // Rotate cube slowly for demonstration
  cube.rotation.x += 0.005
  cube.rotation.y += 0.01

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
