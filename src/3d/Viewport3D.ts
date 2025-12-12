import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { createGrid } from '../util/GridHelper'
import { GRID, VIEWPORT_3D, LIGHTING } from '../constants'

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
    this.scene.background = new THREE.Color(VIEWPORT_3D.BACKGROUND_COLOR)

    // Create camera - positioned to view building from an angle
    this.camera = new THREE.PerspectiveCamera(
      VIEWPORT_3D.CAMERA_FOV,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    )
    this.camera.position.set(
      VIEWPORT_3D.CAMERA_POSITION.x,
      VIEWPORT_3D.CAMERA_POSITION.y,
      VIEWPORT_3D.CAMERA_POSITION.z
    )
    this.camera.lookAt(
      VIEWPORT_3D.CAMERA_TARGET.x,
      VIEWPORT_3D.CAMERA_TARGET.y,
      VIEWPORT_3D.CAMERA_TARGET.z
    )

    // Create renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setSize(container.clientWidth, container.clientHeight)
    container.appendChild(this.renderer.domElement)

    // Add orbit controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = VIEWPORT_3D.DAMPING_FACTOR
    this.controls.target.set(
      VIEWPORT_3D.CAMERA_TARGET.x,
      VIEWPORT_3D.CAMERA_TARGET.y,
      VIEWPORT_3D.CAMERA_TARGET.z
    )
    this.controls.update()

    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, LIGHTING.AMBIENT_INTENSITY)
    this.scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, LIGHTING.DIRECTIONAL_INTENSITY)
    directionalLight.position.set(
      LIGHTING.DIRECTIONAL_POSITION.x,
      LIGHTING.DIRECTIONAL_POSITION.y,
      LIGHTING.DIRECTIONAL_POSITION.z
    )
    this.scene.add(directionalLight)

    // Add ground grid (rotated to XZ plane)
    const grid = createGrid(GRID.SPACING_3D)
    grid.rotation.x = -Math.PI / 2  // Rotate from XY to XZ plane
    grid.position.y = 0  // On ground level
    this.scene.add(grid)
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

  /**
   * Get the camera's azimuth angle (horizontal rotation around Y axis).
   * Returns angle in radians where 0 = looking from +Z toward origin.
   */
  getCameraAzimuth(): number {
    const cameraPos = this.camera.position.clone()
    const target = this.controls.target.clone()
    const delta = cameraPos.sub(target)
    // atan2(x, z) gives angle from +Z axis
    return Math.atan2(delta.x, delta.z)
  }
}
