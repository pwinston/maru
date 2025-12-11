import * as THREE from 'three'

/**
 * Manages the 3D viewport for viewing lofted shapes and sketch planes
 */
export class Viewport3D {
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private renderer: THREE.WebGLRenderer
  private container: HTMLElement

  constructor(container: HTMLElement) {
    this.container = container

    // Create scene
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x1a1a1a)

    // Create camera
    this.camera = new THREE.PerspectiveCamera(
      75,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    )
    this.camera.position.set(3, 3, 5)
    this.camera.lookAt(0, 0, 0)

    // Create renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setSize(container.clientWidth, container.clientHeight)
    container.appendChild(this.renderer.domElement)

    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
    this.scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(5, 5, 5)
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
}
