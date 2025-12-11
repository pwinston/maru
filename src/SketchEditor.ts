import * as THREE from 'three'
import { Sketch } from './Sketch'

const GHOST_VERTEX_SIZE = 0.12
const GHOST_VERTEX_COLOR = 0x88ff88 // Light green

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

  // Ghost vertex for segment hover (add vertex preview)
  private ghostVertex: THREE.Mesh
  private hoveredSegmentIndex: number | null = null
  private onVertexInsert: ((segmentIndex: number, position: THREE.Vector2) => void) | null = null

  constructor(container: HTMLElement) {
    this.container = container
    this.raycaster = new THREE.Raycaster()

    // Create scene
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x2a2a2a)

    // Create ghost vertex (hidden until hovering a segment)
    const ghostGeometry = new THREE.PlaneGeometry(GHOST_VERTEX_SIZE, GHOST_VERTEX_SIZE)
    const ghostMaterial = new THREE.MeshBasicMaterial({
      color: GHOST_VERTEX_COLOR,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide
    })
    this.ghostVertex = new THREE.Mesh(ghostGeometry, ghostMaterial)
    this.ghostVertex.visible = false
    this.ghostVertex.position.z = 0.02 // Above segments and lines
    this.scene.add(this.ghostVertex)

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
   * Handle mouse down - start dragging if clicking on a vertex, or insert if clicking on a segment
   */
  private onMouseDown(event: MouseEvent): void {
    if (!this.currentSketch) return

    const ndc = this.getMouseNDC(event)
    this.raycaster.setFromCamera(ndc, this.camera)

    // First check vertices (they have priority)
    const vertexMeshes = this.currentSketch.getVertexMeshes()
    const vertexIntersects = this.raycaster.intersectObjects(vertexMeshes)

    if (vertexIntersects.length > 0) {
      const mesh = vertexIntersects[0].object as THREE.Mesh
      const index = this.currentSketch.getVertexIndex(mesh)
      if (index !== null) {
        this.draggedVertexIndex = index
        this.container.style.cursor = 'grabbing'
      }
      return
    }

    // Check if clicking on a segment to insert a vertex
    this.tryInsertVertex(event)
  }

  /**
   * Try to insert a vertex at the hovered segment position
   */
  private tryInsertVertex(event: MouseEvent): void {
    if (!this.currentSketch || this.hoveredSegmentIndex === null) return

    const worldPos = this.getWorldPosition(event)
    const vertices = this.currentSketch.getVertices()
    const start = vertices[this.hoveredSegmentIndex]
    const end = vertices[(this.hoveredSegmentIndex + 1) % vertices.length]
    const insertPos = this.closestPointOnSegment(worldPos, start, end)

    if (this.onVertexInsert) {
      this.onVertexInsert(this.hoveredSegmentIndex, insertPos)
    }

    this.ghostVertex.visible = false
    this.hoveredSegmentIndex = null
  }

  /**
   * Handle mouse move - update vertex position if dragging, or show ghost vertex on segment hover
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
      return
    }

    const ndc = this.getMouseNDC(event)
    this.raycaster.setFromCamera(ndc, this.camera)

    // First check vertices (they have priority)
    const vertexMeshes = this.currentSketch.getVertexMeshes()
    const vertexIntersects = this.raycaster.intersectObjects(vertexMeshes)

    if (vertexIntersects.length > 0) {
      // Hovering over a vertex - hide ghost, show grab cursor
      this.ghostVertex.visible = false
      this.hoveredSegmentIndex = null
      this.container.style.cursor = 'grab'
      return
    }

    // Check segments for ghost vertex display
    if (this.updateGhostVertex(event)) {
      return
    }

    // Not hovering anything interactive
    this.ghostVertex.visible = false
    this.hoveredSegmentIndex = null
    this.container.style.cursor = 'default'
  }

  /**
   * Update ghost vertex position if hovering a segment. Returns true if hovering.
   */
  private updateGhostVertex(event: MouseEvent): boolean {
    if (!this.currentSketch) return false

    const segmentMeshes = this.currentSketch.getSegmentHitMeshes()
    const segmentIntersects = this.raycaster.intersectObjects(segmentMeshes)

    if (segmentIntersects.length === 0) return false

    const mesh = segmentIntersects[0].object as THREE.Mesh
    const segmentIndex = this.currentSketch.getSegmentIndex(mesh)
    if (segmentIndex === null) return false

    // Get the closest point on the segment to the cursor
    const worldPos = this.getWorldPosition(event)
    const vertices = this.currentSketch.getVertices()
    const start = vertices[segmentIndex]
    const end = vertices[(segmentIndex + 1) % vertices.length]
    const closestPoint = this.closestPointOnSegment(worldPos, start, end)

    // Show ghost vertex at the closest point
    this.ghostVertex.position.set(closestPoint.x, closestPoint.y, 0.02)
    this.ghostVertex.visible = true
    this.hoveredSegmentIndex = segmentIndex
    this.container.style.cursor = 'crosshair'
    return true
  }

  /**
   * Calculate the closest point on a line segment to a given point
   */
  private closestPointOnSegment(point: THREE.Vector2, start: THREE.Vector2, end: THREE.Vector2): THREE.Vector2 {
    const seg = new THREE.Vector2().subVectors(end, start)
    const len2 = seg.lengthSq()
    if (len2 === 0) return start.clone()

    const t = Math.max(0, Math.min(1, new THREE.Vector2().subVectors(point, start).dot(seg) / len2))
    return new THREE.Vector2(
      start.x + t * seg.x,
      start.y + t * seg.y
    )
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
   * Set callback for when a new vertex is inserted on a segment
   */
  setOnVertexInsert(callback: (segmentIndex: number, position: THREE.Vector2) => void): void {
    this.onVertexInsert = callback
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
