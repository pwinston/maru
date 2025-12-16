import * as THREE from 'three'
import { Sketch } from './Sketch'
import { SelectionHandles } from './tools/SelectionHandles'
import type { HandleType } from './tools/SelectionHandles'
import type { EditorTool } from './tools/EditorTool'
import { SweepSelection } from './tools/SweepSelection'
import { TransformTool } from './tools/TransformTool'
import { DrawTool } from './tools/DrawTool'
import { wouldCauseSelfIntersection } from '../util/Geometry'
import { createGrid } from '../util/GridHelper'
import { GRID, VIEWPORT_2D, SKETCH } from '../constants'

/**
 * Manages the 2D sketch editor viewport for creating and editing profiles
 */
export class SketchEditor {
  private scene: THREE.Scene
  private camera: THREE.OrthographicCamera
  private renderer: THREE.WebGLRenderer
  private container: HTMLElement
  private frustumSize: number = VIEWPORT_2D.FRUSTUM_SIZE
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
  private onPlaneDeleteRequest: (() => void) | null = null

  // Panning state
  private isPanning: boolean = false
  private lastPanPosition: THREE.Vector2 | null = null

  // Vertex deletion state (during drag)
  private isDeletingVertex: boolean = false
  private deletePreviewMarker: THREE.Mesh

  // No selection message overlay
  private noSelectionMessage: HTMLDivElement

  // Active editor tool (sweep selection, transform, etc.)
  private activeTool: EditorTool | null = null

  // Selection handles
  private selectionHandles: SelectionHandles
  private activeHandle: HandleType = 'none'

  // Ghost sketch (reference outline from another plane)
  private ghostGroup: THREE.Group | null = null

  // Draw mode state
  private savedVerticesForRestore: THREE.Vector2[] | null = null
  private onDrawComplete: ((vertices: THREE.Vector2[]) => void) | null = null
  private onDrawCancel: (() => void) | null = null

  constructor(container: HTMLElement) {
    this.container = container
    this.raycaster = new THREE.Raycaster()

    // Create scene
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(VIEWPORT_2D.BACKGROUND_COLOR)

    // Add ground grid (already in XY plane)
    const grid = createGrid(GRID.SPACING_2D)
    grid.position.z = -0.01  // Behind everything else
    this.scene.add(grid)

    // Create ghost vertex (hidden until hovering a segment) - unit size, scaled dynamically
    const ghostGeometry = new THREE.PlaneGeometry(1, 1)
    const ghostMaterial = new THREE.MeshBasicMaterial({
      color: SKETCH.GHOST_VERTEX_COLOR,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide
    })
    this.ghostVertex = new THREE.Mesh(ghostGeometry, ghostMaterial)
    this.ghostVertex.visible = false
    this.ghostVertex.position.z = 0.02 // Above segments and lines
    this.scene.add(this.ghostVertex)

    // Create delete preview marker (shown when dragging vertex causes self-intersection)
    const deleteGeometry = new THREE.PlaneGeometry(1, 1)
    const deleteMaterial = new THREE.MeshBasicMaterial({
      color: SKETCH.DELETE_COLOR,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide
    })
    this.deletePreviewMarker = new THREE.Mesh(deleteGeometry, deleteMaterial)
    this.deletePreviewMarker.visible = false
    this.deletePreviewMarker.position.z = 0.03 // Above everything
    this.scene.add(this.deletePreviewMarker)

    // Create selection handles for scale/rotate
    this.selectionHandles = new SelectionHandles()
    this.scene.add(this.selectionHandles.getGroup())

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

    // Create "no selection" message overlay
    this.noSelectionMessage = document.createElement('div')
    this.noSelectionMessage.className = 'no-selection-message'
    this.noSelectionMessage.textContent = 'Select a plane to edit its sketch'
    container.appendChild(this.noSelectionMessage)

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

    // ESC clears selection and cancels any active operation
    window.addEventListener('keydown', (e) => this.onKeyDown(e))
  }

  /**
   * Handle keyboard events
   */
  private onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.cancelAllOperations()
      if (this.currentSketch) {
        this.currentSketch.clearSelection()
        this.updateSelectionHandles()
      }
    }

    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (this.currentSketch) {
        const selectedIndices = this.currentSketch.getSelectedIndices()
        if (selectedIndices.length > 0) {
          // Delete selected vertices
          this.deleteSelectedVertices()
        } else {
          // No vertices selected - request plane deletion
          this.onPlaneDeleteRequest?.()
        }
      } else {
        // No sketch loaded - might still want to delete the plane
        this.onPlaneDeleteRequest?.()
      }
    }
  }

  /**
   * Delete selected vertices, keeping at least 3 vertices
   */
  private deleteSelectedVertices(): void {
    if (!this.currentSketch || !this.onVertexDelete) return

    const vertices = this.currentSketch.getVertices()
    const selectedIndices = this.currentSketch.getSelectedIndices()
    if (selectedIndices.length === 0) return

    // Calculate how many we can delete (must keep at least 3)
    const maxDeletions = Math.max(0, vertices.length - 3)
    if (maxDeletions === 0) return

    // Sort indices in descending order to delete from end first (avoids index shifting)
    const indicesToDelete = [...selectedIndices]
      .sort((a, b) => b - a)
      .slice(0, maxDeletions)

    // Delete each vertex
    for (const index of indicesToDelete) {
      this.onVertexDelete(index)
    }

    // Clear selection and update handles
    this.currentSketch.clearSelection()
    this.updateSelectionHandles()
  }

  /**
   * Cancel all active operations and reset state
   */
  private cancelAllOperations(): void {
    // Handle draw mode cancellation
    if (this.activeTool instanceof DrawTool && this.savedVerticesForRestore) {
      // Restore original sketch
      if (this.currentSketch) {
        this.currentSketch.getEditorGroup().visible = true
      }
      this.savedVerticesForRestore = null
      this.onDrawCancel?.()
    }

    // Clean up active tool
    if (this.activeTool) {
      this.activeTool.dispose()
      this.activeTool = null
    }

    // Reset all drag/interaction state
    this.draggedVertexIndex = null
    this.isDeletingVertex = false
    this.deletePreviewMarker.visible = false
    this.isPanning = false
    this.lastPanPosition = null
    this.activeHandle = 'none'
    this.container.style.cursor = 'default'
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

    // If draw tool is active, don't process normal interactions
    // (DrawTool handles clicks via onMouseUp)
    if (this.activeTool instanceof DrawTool) {
      return
    }

    if (!this.currentSketch) return

    const ndc = this.getMouseNDC(event)
    this.raycaster.setFromCamera(ndc, this.camera)

    // First check selection handles (they have highest priority)
    if (this.selectionHandles.isVisible()) {
      const handleMeshes = this.selectionHandles.getHandleMeshes()
      const handleIntersects = this.raycaster.intersectObjects(handleMeshes)

      if (handleIntersects.length > 0) {
        const mesh = handleIntersects[0].object as THREE.Mesh
        this.activeHandle = this.selectionHandles.getHandleType(mesh)
        this.setupTransformTool(event)
        this.selectionHandles.hide()  // Hide handles during manipulation
        this.container.style.cursor = this.activeHandle === 'rotate' ? 'grab'
                                   : this.activeHandle === 'move' ? 'move'
                                   : 'ns-resize'
        return
      }
    }

    // Check vertices
    const vertexMeshes = this.currentSketch.getVertexMeshes()
    const vertexIntersects = this.raycaster.intersectObjects(vertexMeshes)

    if (vertexIntersects.length > 0) {
      const mesh = vertexIntersects[0].object as THREE.Mesh
      const index = this.currentSketch.getVertexIndex(mesh)
      if (index !== null) {
        this.draggedVertexIndex = index
        this.isDeletingVertex = false  // Reset delete state
        this.container.style.cursor = 'grabbing'

        // If clicking a selected vertex, prepare to drag all selected vertices
        if (this.currentSketch.isSelected(index)) {
          this.setupTransformTool(event)
          this.selectionHandles.hide()
        } else {
          // Clicking unselected vertex clears selection and selects this vertex
          this.currentSketch.clearSelection()
          this.currentSketch.selectVertex(index)
          this.selectionHandles.hide()
        }
      }
      return
    }

    // Check if clicking on a segment to insert a vertex
    if (this.hoveredSegmentIndex !== null) {
      this.currentSketch.clearSelection()
      this.selectionHandles.hide()
      this.tryInsertVertex(event)
      return
    }

    // Clicking on empty space - start sweep selection
    this.startSweepSelection(event)
  }

  /**
   * Set up transform tool for multi-vertex operations
   */
  private setupTransformTool(event: MouseEvent): void {
    if (!this.currentSketch) return

    const selectedIndices = this.currentSketch.getSelectedIndices()
    if (selectedIndices.length <= 1) return  // Single vertex drag handled normally

    const vertices = this.currentSketch.getVertices()
    const mousePos = this.getWorldPosition(event)

    // Determine transform mode from activeHandle
    const mode = this.activeHandle === 'rotate' ? 'rotate'
               : this.activeHandle === 'scale' ? 'scale'
               : 'translate'

    this.activeTool = new TransformTool(vertices, selectedIndices, mousePos, mode)
  }

  /**
   * Start sweep selection tool
   */
  private startSweepSelection(event: MouseEvent): void {
    if (!this.currentSketch) return
    // Shift key adds to selection, otherwise clear first
    if (!event.shiftKey) {
      this.currentSketch.clearSelection()
    }
    this.activeTool = new SweepSelection(this.scene, this.getWorldPosition(event), this.scene.rotation.z)
  }

  /**
   * Apply results from a tool operation
   */
  private applyToolResult(result: import('./tools/EditorTool').ToolResult): void {
    if (!this.currentSketch) return

    // Apply position changes
    if (result.positions && this.onVertexChange) {
      for (const [index, newPos] of result.positions) {
        this.onVertexChange(index, newPos)
      }
    }

    // Apply selection rectangle
    if (result.selectInRect) {
      this.currentSketch.selectVerticesInRect(
        result.selectInRect.min,
        result.selectInRect.max,
        result.selectInRect.rotation
      )
    }

    // Handle completed draw
    if (result.drawnVertices) {
      this.savedVerticesForRestore = null  // Clear restore state
      if (this.currentSketch) {
        this.currentSketch.getEditorGroup().visible = true
      }
      this.onDrawComplete?.(result.drawnVertices)
    }

    // Clean up if tool is done
    if (result.done) {
      this.activeTool?.dispose()
      this.activeTool = null
      this.updateSelectionHandles()
    }
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

    // Highlight the newly inserted vertex yellow while dragging
    this.currentSketch.setVertexColor(newVertexIndex, SKETCH.SELECTED_COLOR)

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

    // Handle active tool (sweep selection, transform, etc.)
    if (this.activeTool) {
      const result = this.activeTool.onMouseMove(this.getWorldPosition(event))
      this.applyToolResult(result)
      // Maintain crosshair cursor during draw mode
      if (this.activeTool instanceof DrawTool) {
        this.container.style.cursor = 'crosshair'
      }
      return
    }

    if (this.draggedVertexIndex !== null) {

      // Single vertex drag
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

    // First check selection handles (highest priority)
    if (this.selectionHandles.isVisible()) {
      const handleMeshes = this.selectionHandles.getHandleMeshes()
      const handleIntersects = this.raycaster.intersectObjects(handleMeshes)

      if (handleIntersects.length > 0) {
        // Hovering over a handle - hide ghost, show appropriate cursor
        this.ghostVertex.visible = false
        this.hoveredSegmentIndex = null
        const handleType = this.selectionHandles.getHandleType(handleIntersects[0].object)
        this.container.style.cursor = handleType === 'rotate' ? 'grab'
                                    : handleType === 'move' ? 'move'
                                    : 'ns-resize'
        return
      }
    }

    // Check vertices (they have priority)
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
    // Handle right-click (pan) release
    if (event.button === 2) {
      this.isPanning = false
      this.lastPanPosition = null
      this.container.style.cursor = 'default'
      return
    }

    // Handle active tool completion
    if (this.activeTool) {
      const result = this.activeTool.onMouseUp(this.getWorldPosition(event))
      this.applyToolResult(result)
    }

    // Handle vertex deletion if we were in delete mode
    if (this.draggedVertexIndex !== null && this.isDeletingVertex) {
      if (this.onVertexDelete) {
        this.onVertexDelete(this.draggedVertexIndex)
      }
    }

    // ALWAYS clean up all drag/interaction state on mouse up
    this.draggedVertexIndex = null
    this.isDeletingVertex = false
    this.deletePreviewMarker.visible = false
    this.activeHandle = 'none'
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

    const zoomFactor = event.deltaY > 0 ? 1.08 : 0.93
    this.frustumSize *= zoomFactor
    this.frustumSize = Math.max(2, this.frustumSize) // Clamp min zoom only

    const aspect = this.container.clientWidth / this.container.clientHeight
    this.camera.left = -this.frustumSize * aspect / 2
    this.camera.right = this.frustumSize * aspect / 2
    this.camera.top = this.frustumSize / 2
    this.camera.bottom = -this.frustumSize / 2
    this.camera.updateProjectionMatrix()

    this.updateVertexScales()
  }

  /**
   * Update vertex scales to maintain constant screen size regardless of zoom
   */
  private updateVertexScales(): void {
    // Calculate world units per pixel based on current frustum and viewport
    const worldUnitsPerPixel = this.frustumSize / this.container.clientHeight

    // Scale vertices to target screen pixel size
    const vertexScale = SKETCH.VERTEX_SCREEN_PX * worldUnitsPerPixel
    const ghostScale = SKETCH.GHOST_SCREEN_PX * worldUnitsPerPixel

    if (this.currentSketch) {
      this.currentSketch.setVertexScale(vertexScale)
    }
    this.ghostVertex.scale.set(ghostScale, ghostScale, 1)
    this.deletePreviewMarker.scale.set(ghostScale, ghostScale, 1)

    // Update ghost group vertex scales (Mesh children, not the Line)
    if (this.ghostGroup) {
      this.ghostGroup.children.forEach((child) => {
        if (child instanceof THREE.Mesh) {
          child.scale.set(vertexScale, vertexScale, 1)
        }
      })
    }

    // Update selection handles size
    this.selectionHandles.setHandleSize(vertexScale)
    this.updateSelectionHandles()
  }

  /**
   * Update selection handles to match current selection
   */
  private updateSelectionHandles(): void {
    if (!this.currentSketch) {
      this.selectionHandles.hide()
      return
    }

    const selectedIndices = this.currentSketch.getSelectedIndices()
    if (selectedIndices.length < 2) {
      this.selectionHandles.hide()
      return
    }

    const vertices = this.currentSketch.getVertices()
    this.selectionHandles.update(vertices, selectedIndices)
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
   * Set callback for when plane deletion is requested (Delete key with no vertex selection)
   */
  setOnPlaneDeleteRequest(callback: () => void): void {
    this.onPlaneDeleteRequest = callback
  }

  /**
   * Set callback for when draw mode completes
   */
  setOnDrawComplete(callback: (vertices: THREE.Vector2[]) => void): void {
    this.onDrawComplete = callback
  }

  /**
   * Set callback for when draw mode is cancelled
   */
  setOnDrawCancel(callback: () => void): void {
    this.onDrawCancel = callback
  }

  /**
   * Start draw mode - user clicks to place vertices
   */
  startDrawMode(): void {
    if (!this.currentSketch) return

    // Save current vertices for restore on cancel
    this.savedVerticesForRestore = this.currentSketch.getVertices()

    // Hide current sketch while drawing
    this.currentSketch.getEditorGroup().visible = false

    // Calculate vertex scale for the draw tool
    const worldUnitsPerPixel = this.frustumSize / this.container.clientHeight
    const vertexScale = SKETCH.VERTEX_SCREEN_PX * worldUnitsPerPixel

    // Create and activate draw tool
    this.activeTool = new DrawTool(this.scene, vertexScale)

    // Set crosshair cursor for draw mode
    this.container.style.cursor = 'crosshair'
  }

  /**
   * Check if draw mode is active
   */
  isDrawModeActive(): boolean {
    return this.activeTool instanceof DrawTool
  }

  /**
   * Cancel draw mode without restoring (used when switching to preset shape)
   */
  cancelDrawMode(): void {
    if (this.activeTool instanceof DrawTool) {
      this.activeTool.dispose()
      this.activeTool = null
      this.savedVerticesForRestore = null
      if (this.currentSketch) {
        this.currentSketch.getEditorGroup().visible = true
      }
    }
  }

  /**
   * Set the sketch to display and edit
   */
  setSketch(sketch: Sketch): void {
    this.clear()
    this.currentSketch = sketch
    this.scene.add(sketch.getEditorGroup())
    this.updateVertexScales()
    this.noSelectionMessage.style.display = 'none'
  }

  /**
   * Set a ghost sketch to display as a reference (non-interactive outline)
   */
  setGhostSketch(sketch: Sketch | null): void {
    // Remove existing ghost group
    if (this.ghostGroup) {
      this.scene.remove(this.ghostGroup)
      // Dispose all children
      this.ghostGroup.traverse((child) => {
        if (child instanceof THREE.Line || child instanceof THREE.Mesh) {
          child.geometry.dispose()
          if (child.material instanceof THREE.Material) {
            child.material.dispose()
          }
        }
      })
      this.ghostGroup = null
    }

    if (!sketch) return

    this.ghostGroup = new THREE.Group()

    // Create ghost line from sketch vertices
    const vertices = sketch.getVertices()
    const points3d = vertices.map(v => new THREE.Vector3(v.x, v.y, -0.005))
    points3d.push(points3d[0].clone()) // Close the loop

    const lineGeometry = new THREE.BufferGeometry().setFromPoints(points3d)
    const lineMaterial = new THREE.LineBasicMaterial({
      color: SKETCH.GHOST_LINE_COLOR,
      transparent: true,
      opacity: SKETCH.GHOST_LINE_OPACITY
    })
    const ghostLine = new THREE.Line(lineGeometry, lineMaterial)
    this.ghostGroup.add(ghostLine)

    // Create ghost vertices (same size as real vertices, but ghost color)
    const vertexMaterial = new THREE.MeshBasicMaterial({
      color: SKETCH.GHOST_LINE_COLOR,
      transparent: true,
      opacity: SKETCH.GHOST_LINE_OPACITY,
      side: THREE.DoubleSide
    })

    // Calculate vertex scale (same as updateVertexScales)
    const worldUnitsPerPixel = this.frustumSize / this.container.clientHeight
    const vertexScale = SKETCH.VERTEX_SCREEN_PX * worldUnitsPerPixel

    for (const v of vertices) {
      const vertexGeometry = new THREE.PlaneGeometry(1, 1)
      const vertexMesh = new THREE.Mesh(vertexGeometry, vertexMaterial.clone())
      vertexMesh.position.set(v.x, v.y, -0.004) // Slightly in front of ghost line
      vertexMesh.scale.set(vertexScale, vertexScale, 1)
      this.ghostGroup.add(vertexMesh)
    }

    this.scene.add(this.ghostGroup)
  }

  /**
   * Clear the ghost sketch
   */
  clearGhostSketch(): void {
    this.setGhostSketch(null)
  }

  /**
   * Get the current sketch
   */
  getSketch(): Sketch | null {
    return this.currentSketch
  }

  /**
   * Clear the scene and show "no selection" message
   */
  clear(): void {
    if (this.currentSketch) {
      this.scene.remove(this.currentSketch.getEditorGroup())
      this.currentSketch = null
    }
    this.clearGhostSketch()
    this.noSelectionMessage.style.display = 'flex'
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
