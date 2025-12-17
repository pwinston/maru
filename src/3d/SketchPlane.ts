import * as THREE from 'three'
import { Sketch } from '../2d/Sketch'
import { PLANE } from '../constants'

export type PlaneVisualState = 'default' | 'hovered' | 'selected' | 'deleting' | 'dimmed'

/**
 * Represents a 2D sketch plane in 3D space.
 * Contains a Sketch at a specific height (Y position).
 */
export interface PlaneBounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export class SketchPlane {
  private sketch: Sketch
  private height: number
  private planeGroup: THREE.Group
  private planeMesh: THREE.Mesh
  private sharedBounds: PlaneBounds | null = null

  constructor(size: number, height: number) {
    const vertices = SketchPlane.createSquare(size)
    this.sketch = new Sketch(vertices)
    this.height = height
    this.planeGroup = new THREE.Group()

    // Create the semi-transparent plane surface
    this.planeMesh = this.createPlaneMesh()
    this.planeGroup.add(this.planeMesh)

    // Add the sketch outline (no control points in 3D view)
    this.planeGroup.add(this.sketch.getLineGroup())

    // Position the group at the correct Y (vertical height)
    // Rotate to be horizontal (XZ plane instead of XY)
    this.planeGroup.position.y = height
    this.planeGroup.rotation.x = -Math.PI / 2
  }

  /**
   * Create a semi-transparent rectangular plane sized to bounds
   */
  private createPlaneMesh(): THREE.Mesh {
    const bounds = this.sharedBounds ?? this.getLocalBounds()

    const width = (bounds.maxX - bounds.minX) * (1 + 2 * PLANE.BORDER_PERCENT)
    const height = (bounds.maxY - bounds.minY) * (1 + 2 * PLANE.BORDER_PERCENT)
    const centerX = (bounds.minX + bounds.maxX) / 2
    const centerY = (bounds.minY + bounds.maxY) / 2

    const geometry = new THREE.PlaneGeometry(width, height)
    const defaultStyle = PLANE.STYLES.default
    const material = new THREE.MeshBasicMaterial({
      color: defaultStyle.color,
      transparent: true,
      opacity: defaultStyle.opacity,
      side: THREE.DoubleSide
    })

    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.x = centerX
    mesh.position.y = centerY

    return mesh
  }

  /**
   * Get this plane's local bounds from its sketch
   */
  private getLocalBounds(): PlaneBounds {
    const bounds = this.sketch.getBounds()
    return {
      minX: bounds.centerX - bounds.width / 2,
      maxX: bounds.centerX + bounds.width / 2,
      minY: bounds.centerY - bounds.height / 2,
      maxY: bounds.centerY + bounds.height / 2
    }
  }

  /**
   * Get bounds for external use (e.g., calculating max bounds)
   */
  getBounds(): PlaneBounds {
    return this.getLocalBounds()
  }

  /**
   * Set shared bounds (all planes use the same size)
   */
  setSharedBounds(bounds: PlaneBounds): void {
    this.sharedBounds = bounds
    this.rebuildPlaneMesh()
  }

  /**
   * Rebuild the plane mesh to match current bounds
   */
  private rebuildPlaneMesh(): void {
    this.planeGroup.remove(this.planeMesh)
    this.planeMesh = this.createPlaneMesh()
    this.planeGroup.add(this.planeMesh)
  }

  /**
   * Get the Three.js group representing this plane
   */
  getGroup(): THREE.Group {
    return this.planeGroup
  }

  /**
   * Get the plane mesh for raycasting
   */
  getPlaneMesh(): THREE.Mesh {
    return this.planeMesh
  }

  /**
   * Get the Sketch object
   */
  getSketch(): Sketch {
    return this.sketch
  }

  /**
   * Set visibility of the sketch outline (lines showing the shape)
   */
  setSketchOutlineVisible(visible: boolean): void {
    this.sketch.getLineGroup().visible = visible
  }

  /**
   * Get a copy of the 2D vertices of the sketch
   */
  getVertices(): THREE.Vector2[] {
    return this.sketch.getVertices()
  }

  /**
   * Get the height (Y position) of this plane
   */
  getHeight(): number {
    return this.height
  }

  /**
   * Set the height (Y position) of this plane
   */
  setHeight(height: number): void {
    this.height = height
    this.planeGroup.position.y = height
  }

  /**
   * Update a single vertex and refresh the visualization
   */
  setVertex(index: number, position: THREE.Vector2): void {
    this.sketch.setVertex(index, position)
    this.rebuildPlaneMesh()
  }

  /**
   * Insert a new vertex on a segment
   */
  insertVertex(segmentIndex: number, position: THREE.Vector2): void {
    this.sketch.insertVertex(segmentIndex, position)
    this.rebuildPlaneMesh()
  }

  /**
   * Delete a vertex
   */
  deleteVertex(index: number): boolean {
    const result = this.sketch.deleteVertex(index)
    if (result) this.rebuildPlaneMesh()
    return result
  }

  /**
   * Update all vertices and refresh the visualization
   */
  setVertices(vertices: THREE.Vector2[]): void {
    this.sketch.setVertices(vertices)
    this.rebuildPlaneMesh()
  }

  /**
   * Set the visual state of this plane
   */
  setVisualState(state: PlaneVisualState): void {
    const style = PLANE.STYLES[state]
    const material = this.planeMesh.material as THREE.MeshBasicMaterial
    material.color.setHex(style.color)
    material.opacity = style.opacity
  }

  /**
   * Set visibility of the sketch profile lines
   */
  setProfileVisible(visible: boolean): void {
    this.sketch.getLineGroup().visible = visible
  }

  /**
   * Create a centered square with the given size
   */
  private static createSquare(size: number): THREE.Vector2[] {
    const half = size / 2
    return [
      new THREE.Vector2(-half, -half),
      new THREE.Vector2(half, -half),
      new THREE.Vector2(half, half),
      new THREE.Vector2(-half, half),
    ]
  }
}
