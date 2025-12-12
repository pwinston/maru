import * as THREE from 'three'
import { Sketch } from './Sketch'
import { wouldCauseSelfIntersection } from '../util/Geometry'

const GHOST_VERTEX_SIZE = 0.12
const GHOST_VERTEX_COLOR = 0x88ff88 // Light green
const DELETE_VERTEX_COLOR = 0xff0000 // Red for deletion

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
  private onVertexDelete: ((index: number) => void) | null = null

  // Panning state
  private isPanning: boolean = false
  private lastPanPosition: THREE.Vector2 | null = null

  // Vertex deletion state (during drag)
  private isDeletingVertex: boolean = false
  private deletePreviewMarker: THREE.Mesh


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

    // Create delete preview marker (shown when dragging vertex causes self-intersection)
    const deleteGeometry = new THREE.PlaneGeometry(GHOST_VERTEX_SIZE, GHOST_VERTEX_SIZE)
    const deleteMaterial = new THREE.MeshBasicMaterial({
      color: DELETE_VERTEX_COLOR,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide
    })
    this.deletePreviewMarker = new THREE.Mesh(deleteGeometry, deleteMaterial)
    this.deletePreviewMarker.visible = false
    this.deletePreviewMarker.position.z = 0.03 // Above everything
    this.scene.add(this.deletePreviewMarker)

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
    canvas.addEventListener('mouseup', (e) => this.onMouseUp(e))
    canvas.addEventListener('mouseleave', (e) => this.onMouseUp(e))
    canvas.addEventListener('dblclick', (e) => this.onDoubleClick(e))
    canvas.addEventListener('wheel', (e) => this.onWheel(e))
    canvas.addEventListener('contextmenu', (e) => e.preventDefault())
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
   * Rotate a 2D point by an angle around the origin
   */
  private rotatePoint(x: number, y: number, angle: number): THREE.Vector2 {
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    return new THREE.Vector2(x * cos - y * sin, x * sin + y * cos)
  }

  /**
   * Convert mouse position to world coordinates, accounting for scene rotation
   */
  private getWorldPosition(event: MouseEvent): THREE.Vector2 {
    const ndc = this.getMouseNDC(event)
    const worldX = ndc.x * (this.camera.right - this.camera.left) / 2 + this.camera.position.x
    const worldY = ndc.y * (this.camera.top - this.camera.bottom) / 2 + this.camera.position.y

    // If scene is rotated, transform back to sketch-local coordinates
    const rotation = this.scene.rotation.z
    if (rotation !== 0) {
      return this.rotatePoint(worldX, worldY, -rotation)
    }

    return new THREE.Vector2(worldX, worldY)
  }

  /**
   * Handle mouse down - start dragging if clicking on a vertex, or insert if clicking on a segment
   */
  private onMouseDown(event: MouseEvent): void {
    // Right-click starts panning
    if (event.button === 2) {
      this.isPanning = true
      this.lastPanPosition = new THREE.Vector2(event.clientX, event.clientY)
      this.container.style.cursor = 'move'
      return
    }

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
        this.isDeletingVertex = false  // Reset delete state
        this.container.style.cursor = 'grabbing'
      }
      return
    }

    // Check if clicking on a segment to insert a vertex
    this.tryInsertVertex(event)
  }

  /**
   * Try to insert a vertex at the hovered segment position.
   * If successful, immediately start dragging the new vertex.
   */
  private tryInsertVertex(event: MouseEvent): void {
    if (!this.currentSketch || this.hoveredSegmentIndex === null) return

    const worldPos = this.getWorldPosition(event)
    const vertices = this.currentSketch.getVertices()
    const start = vertices[this.hoveredSegmentIndex]
    const end = vertices[(this.hoveredSegmentIndex + 1) % vertices.length]
    const insertPos = this.closestPointOnSegment(worldPos, start, end)

    // The new vertex will be inserted at segmentIndex + 1
    const newVertexIndex = this.hoveredSegmentIndex + 1

    if (this.onVertexInsert) {
      this.onVertexInsert(this.hoveredSegmentIndex, insertPos)
    }

    // Start dragging the newly inserted vertex
    this.draggedVertexIndex = newVertexIndex
    this.container.style.cursor = 'grabbing'

    this.ghostVertex.visible = false
    this.hoveredSegmentIndex = null
  }

  /**
   * Handle panning. Returns true if panning is active.
   */
  private updatePan(event: MouseEvent): boolean {
    if (!this.isPanning || !this.lastPanPosition) return false

    const deltaX = event.clientX - this.lastPanPosition.x
    const deltaY = event.clientY - this.lastPanPosition.y

    // Convert pixel delta to world units
    const worldUnitsPerPixelX = (this.camera.right - this.camera.left) / this.container.clientWidth
    const worldUnitsPerPixelY = (this.camera.top - this.camera.bottom) / this.container.clientHeight

    this.camera.position.x -= deltaX * worldUnitsPerPixelX
    this.camera.position.y += deltaY * worldUnitsPerPixelY

    this.lastPanPosition.set(event.clientX, event.clientY)
    return true
  }

  /**
   * Handle mouse move - update vertex position if dragging, or show ghost vertex on segment hover
   */
  private onMouseMove(event: MouseEvent): void {
    if (this.updatePan(event)) return

    if (!this.currentSketch) return

    if (this.draggedVertexIndex !== null) {
      const worldPos = this.getWorldPosition(event)
      const vertices = this.currentSketch.getVertices()
      const canDelete = vertices.length > 3

      // Check if this position would cause self-intersection
      const causesIntersection = wouldCauseSelfIntersection(
        vertices, this.draggedVertexIndex, worldPos
      )

      if (causesIntersection && canDelete) {
        // Mark vertex for deletion - show preview without this vertex
        this.isDeletingVertex = true
        this.currentSketch.rebuildWithoutVertex(this.draggedVertexIndex)
        this.deletePreviewMarker.position.set(worldPos.x, worldPos.y, 0.03)
        this.deletePreviewMarker.visible = true
      } else {
        // Normal drag - restore full sketch if we were in delete mode
        if (this.isDeletingVertex) {
          this.currentSketch.restoreFullRebuild()
        }
        this.isDeletingVertex = false
        this.deletePreviewMarker.visible = false

        // Notify owner to update the vertex
        if (this.onVertexChange) {
          this.onVertexChange(this.draggedVertexIndex, worldPos)
        }
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
   * Handle mouse up - stop dragging or panning, delete vertex if in delete mode
   */
  private onMouseUp(event: MouseEvent): void {
    if (event.button === 2) {
      this.isPanning = false
      this.lastPanPosition = null
      this.container.style.cursor = 'default'
      return
    }

    // Handle vertex deletion if we were in delete mode
    if (this.draggedVertexIndex !== null && this.isDeletingVertex) {
      if (this.onVertexDelete) {
        this.onVertexDelete(this.draggedVertexIndex)
      }
    }

    // Clean up drag state
    this.draggedVertexIndex = null
    this.isDeletingVertex = false
    this.deletePreviewMarker.visible = false
    this.container.style.cursor = 'default'
  }

  /**
   * Handle double-click - delete vertex if clicking on one
   */
  private onDoubleClick(event: MouseEvent): void {
    if (!this.currentSketch) return

    const ndc = this.getMouseNDC(event)
    this.raycaster.setFromCamera(ndc, this.camera)

    const vertexMeshes = this.currentSketch.getVertexMeshes()
    const intersects = this.raycaster.intersectObjects(vertexMeshes)

    if (intersects.length > 0) {
      const mesh = intersects[0].object as THREE.Mesh
      const index = this.currentSketch.getVertexIndex(mesh)
      if (index !== null && this.onVertexDelete) {
        this.onVertexDelete(index)
      }
    }
  }

  /**
   * Handle mouse wheel - zoom in/out
   */
  private onWheel(event: WheelEvent): void {
    event.preventDefault()

    const zoomFactor = event.deltaY > 0 ? 1.1 : 0.9
    this.frustumSize *= zoomFactor
    this.frustumSize = Math.max(2, Math.min(50, this.frustumSize)) // Clamp zoom

    const aspect = this.container.clientWidth / this.container.clientHeight
    this.camera.left = -this.frustumSize * aspect / 2
    this.camera.right = this.frustumSize * aspect / 2
    this.camera.top = this.frustumSize / 2
    this.camera.bottom = -this.frustumSize / 2
    this.camera.updateProjectionMatrix()
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
   * Set callback for when a vertex is deleted (double-click)
   */
  setOnVertexDelete(callback: (index: number) => void): void {
    this.onVertexDelete = callback
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

  /**
   * Set the rotation of the 2D sketch view to match the 3D camera orientation.
   * When enabled, the sketch rotates so "closest to camera" is at the bottom.
   * @param azimuth The camera azimuth angle in radians (0 = looking from +Z)
   */
  setRotation(azimuth: number): void {
    // Rotate the scene so that the direction facing the camera is "down" (toward viewer)
    // The sketch plane in 3D is rotated -90° around X, so sketch +Y maps to world -Z
    // When camera is at azimuth 0 (+Z), sketch +Y faces camera, so no rotation needed
    // As camera rotates, we rotate the 2D view to match
    this.scene.rotation.z = -azimuth
  }
}
