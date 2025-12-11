import './style.css'
import * as THREE from 'three'

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div>
    <h1>Hello Three.js!</h1>
    <p>A rotating 3D cube</p>
    <div id="canvas-container"></div>
  </div>
`

// Set canvas dimensions
const canvasWidth = 1280
const canvasHeight = 1024

// Create scene
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x1a1a1a)

// Create camera
const camera = new THREE.PerspectiveCamera(
  75,
  canvasWidth / canvasHeight,
  0.1,
  1000
)
camera.position.z = 5

// Create renderer
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(canvasWidth, canvasHeight)
document.querySelector('#canvas-container')!.appendChild(renderer.domElement)

// Create cube
const geometry = new THREE.BoxGeometry(2, 2, 2)
const material = new THREE.MeshBasicMaterial({
  color: 0x00ff00,
  wireframe: true
})
const cube = new THREE.Mesh(geometry, material)
scene.add(cube)

// Animation loop
function animate() {
  requestAnimationFrame(animate)

  cube.rotation.x += 0.01
  cube.rotation.y += 0.01

  renderer.render(scene, camera)
}

// Handle window resize (optional - keeps canvas at fixed size)
// window.addEventListener('resize', () => {
//   camera.aspect = canvasWidth / canvasHeight
//   camera.updateProjectionMatrix()
//   renderer.setSize(canvasWidth, canvasHeight)
// })

animate()
