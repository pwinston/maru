import * as THREE from 'three'
import { Sketch } from './Sketch'

/**
 * Manages the 2D sketch editor viewport for creating and editing profiles
 */
export class SketchEditor {
  private scene: THREE.Scene
  private camera: THREE.OrthographicCamera
  private renderer: THREE.WebGLRenderer
  private container: HTMLElement
  private frustumSize: number = 10
  private currentSketch: Sketch | null = null

  // Dragging state
  private raycaster: THREE.Raycaster
  private draggedVertexIndex: number | null = null  // null means not dragging
  private onVertexChange: ((index: number, position: THREE.Vector2) => void) | null = null

  constructor(container: HTMLElement) {
    this.container = container
    this.raycaster = new THREE.Raycaster()

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

    // Set up mouse event handlers for dragging
    this.setupMouseHandlers()
  }

  /**
   * Set up mouse event handlers for vertex dragging
   */
  private setupMouseHandlers(): void {
    const canvas = this.renderer.domElement

    canvas.addEventListener('mousedown', (e) => this.onMouseDown(e))
    canvas.addEventListener('mousemove', (e) => this.onMouseMove(e))
    canvas.addEventListener('mouseup', () => this.onMouseUp())
    canvas.addEventListener('mouseleave', () => this.onMouseUp())
  }

  /**
   * Convert mouse event to normalized device coordinates
   */
  private getMouseNDC(event: MouseEvent): THREE.Vector2 {
    const rect = this.container.getBoundingClientRect()
    return new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    )
  }

  /**
   * Convert mouse position to world coordinates
   */
  private getWorldPosition(event: MouseEvent): THREE.Vector2 {
    const ndc = this.getMouseNDC(event)
    const worldX = ndc.x * (this.camera.right - this.camera.left) / 2 + this.camera.position.x
    const worldY = ndc.y * (this.camera.top - this.camera.bottom) / 2 + this.camera.position.y
    return new THREE.Vector2(worldX, worldY)
  }

  /**
   * Handle mouse down - start dragging if clicking on a vertex
   */
  private onMouseDown(event: MouseEvent): void {
    if (!this.currentSketch) return

    const ndc = this.getMouseNDC(event)
    this.raycaster.setFromCamera(ndc, this.camera)

    const vertexMeshes = this.currentSketch.getVertexMeshes()
    const intersects = this.raycaster.intersectObjects(vertexMeshes)

    if (intersects.length > 0) {
      const mesh = intersects[0].object as THREE.Mesh
      const index = this.currentSketch.getVertexIndex(mesh)
      if (index !== null) {
        this.draggedVertexIndex = index
        this.container.style.cursor = 'grabbing'
      }
    }
  }

  /**
   * Handle mouse move - update vertex position if dragging
   */
  private onMouseMove(event: MouseEvent): void {
    if (!this.currentSketch) return

    if (this.draggedVertexIndex !== null) {
      // Update vertex position while dragging
      const worldPos = this.getWorldPosition(event)

      // Notify owner to update the vertex (owner is responsible for calling sketch.setVertex)
      if (this.onVertexChange) {
        this.onVertexChange(this.draggedVertexIndex, worldPos)
      }
    } else {
      // Update cursor when hovering over vertices
      const ndc = this.getMouseNDC(event)
      this.raycaster.setFromCamera(ndc, this.camera)

      const vertexMeshes = this.currentSketch.getVertexMeshes()
      const intersects = this.raycaster.intersectObjects(vertexMeshes)

      this.container.style.cursor = intersects.length > 0 ? 'grab' : 'default'
    }
  }

  /**
   * Handle mouse up - stop dragging
   */
  private onMouseUp(): void {
    this.draggedVertexIndex = null
    this.container.style.cursor = 'default'
  }

  /**
   * Set callback for when a vertex position changes
   */
  setOnVertexChange(callback: (index: number, position: THREE.Vector2) => void): void {
    this.onVertexChange = callback
  }

  /**
   * Set the sketch to display and edit
   */
  setSketch(sketch: Sketch): void {
    this.clear()
    this.currentSketch = sketch
    this.scene.add(sketch.getEditorGroup())
  }

  /**
   * Get the current sketch
   */
  getSketch(): Sketch | null {
    return this.currentSketch
  }

  /**
   * Clear the scene
   */
  clear(): void {
    if (this.currentSketch) {
      this.scene.remove(this.currentSketch.getEditorGroup())
      this.currentSketch = null
    }
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
