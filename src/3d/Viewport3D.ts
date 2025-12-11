import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

/**
 * The 3D Viewport displays the sketch planes and the lofted shape.
 */
export class Viewport3D { 
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private renderer: THREE.WebGLRenderer
  private container: HTMLElement
  private controls: OrbitControls
  private raycaster: THREE.Raycaster = new THREE.Raycaster()
  private mouse: THREE.Vector2 = new THREE.Vector2()

  constructor(container: HTMLElement) {
    this.container = container

    // Create scene
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x1a1a1a)

    // Create camera - positioned to view building from an angle
    this.camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    )
    this.camera.position.set(8, 6, 8)
    this.camera.lookAt(0, 1, 0)

    // Create renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setSize(container.clientWidth, container.clientHeight)
    container.appendChild(this.renderer.domElement)

    // Add orbit controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.15
    this.controls.target.set(0, 1, 0)
    this.controls.update()

    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    this.scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(5, 10, 5)
    this.scene.add(directionalLight)
  }

  /**
   * Add an object to the 3D scene
   */
  add(object: THREE.Object3D): void {
    this.scene.add(object)
  }

  /**
   * Remove an object from the 3D scene
   */
  remove(object: THREE.Object3D): void {
    this.scene.remove(object)
  }

  /**
   * Render the scene
   */
  render(): void {
    this.controls.update()
    this.renderer.render(this.scene, this.camera)
  }

  /**
   * Handle window resize
   */
  resize(): void {
    const width = this.container.clientWidth
    const height = this.container.clientHeight
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height)
  }

  /**
   * Get the camera for external manipulation (e.g., orbit controls)
   */
  getCamera(): THREE.PerspectiveCamera {
    return this.camera
  }

  /**
   * Get the scene for direct access if needed
   */
  getScene(): THREE.Scene {
    return this.scene
  }

  /**
   * Get the DOM element (canvas) for event listeners
   */
  getElement(): HTMLCanvasElement {
    return this.renderer.domElement
  }

  /**
   * Enable or disable orbit controls
   */
  setOrbitEnabled(enabled: boolean): void {
    this.controls.enabled = enabled
  }

  /**
   * Perform raycasting to find intersected objects
   */
  raycast(event: MouseEvent, objects: THREE.Object3D[]): THREE.Intersection[] {
    this.updateMouseNDC(event)
    this.raycaster.setFromCamera(this.mouse, this.camera)
    return this.raycaster.intersectObjects(objects, true)
  }

  /**
   * Get the world Y coordinate where the mouse ray intersects a vertical plane facing the camera
   */
  getWorldYAtMouse(event: MouseEvent): number | null {
    this.updateMouseNDC(event)
    this.raycaster.setFromCamera(this.mouse, this.camera)

    // Create a vertical plane facing the camera (perpendicular to camera's XZ direction)
    // Use camera's forward direction projected onto XZ plane as the plane normal
    const cameraDir = new THREE.Vector3()
    this.camera.getWorldDirection(cameraDir)
    cameraDir.y = 0 // Project onto XZ plane
    cameraDir.normalize()

    // Plane passes through origin, facing camera
    const plane = new THREE.Plane(cameraDir, 0)
    const intersection = new THREE.Vector3()

    if (this.raycaster.ray.intersectPlane(plane, intersection)) {
      return intersection.y
    }
    return null
  }

  /**
   * Update mouse NDC from event
   */
  private updateMouseNDC(event: MouseEvent): void {
    const rect = this.container.getBoundingClientRect()
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  }
}
