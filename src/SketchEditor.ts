import * as THREE from 'three'

/**
 * Manages the 2D sketch editor viewport for creating and editing profiles
 */
export class SketchEditor {
  private scene: THREE.Scene
  private camera: THREE.OrthographicCamera
  private renderer: THREE.WebGLRenderer
  private container: HTMLElement
  private frustumSize: number = 10

  constructor(container: HTMLElement) {
    this.container = container

    // Create scene
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x2a2a2a)

    // Create orthographic camera for 2D view
    const aspect = container.clientWidth / container.clientHeight
    this.camera = new THREE.OrthographicCamera(
      -this.frustumSize * aspect / 2,
      this.frustumSize * aspect / 2,
      this.frustumSize / 2,
      -this.frustumSize / 2,
      0.1,
      100
    )
    this.camera.position.z = 5

    // Create renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setSize(container.clientWidth, container.clientHeight)
    container.appendChild(this.renderer.domElement)
  }

  /**
   * Create a simple polygon sketch
   */
  createPolygon(vertices: THREE.Vector2[]): THREE.Line {
    // Convert 2D points to 3D (z=0) and close the loop
    const points3d = vertices.map(v => new THREE.Vector3(v.x, v.y, 0))
    points3d.push(points3d[0].clone()) // Close the loop

    const geometry = new THREE.BufferGeometry().setFromPoints(points3d)
    const material = new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 2 })
    const line = new THREE.Line(geometry, material)

    this.scene.add(line)
    return line
  }

  /**
   * Add an object to the 2D scene
   */
  add(object: THREE.Object3D): void {
    this.scene.add(object)
  }

  /**
   * Remove an object from the 2D scene
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
    const aspect = width / height

    this.camera.left = -this.frustumSize * aspect / 2
    this.camera.right = this.frustumSize * aspect / 2
    this.camera.top = this.frustumSize / 2
    this.camera.bottom = -this.frustumSize / 2
    this.camera.updateProjectionMatrix()

    this.renderer.setSize(width, height)
  }

  /**
   * Get the camera for external access
   */
  getCamera(): THREE.OrthographicCamera {
    return this.camera
  }

  /**
   * Get the scene for direct access if needed
   */
  getScene(): THREE.Scene {
    return this.scene
  }
}
