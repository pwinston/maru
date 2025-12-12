import * as THREE from 'three'
import { Sketch } from '../2d/Sketch'

const BORDER_PERCENT = 0.15 // 15% border around sketch

export type PlaneVisualState = 'default' | 'hovered' | 'selected' | 'deleting'

const PLANE_STYLES: Record<PlaneVisualState, { color: number; opacity: number }> = {
  default:  { color: 0x444444, opacity: 0.2 },
  hovered:  { color: 0x998866, opacity: 0.3 },  // gray-gold
  selected: { color: 0xffcc00, opacity: 0.4 },  // bright gold
  deleting: { color: 0xff0000, opacity: 0.5 },
}

/**
 * Represents a 2D sketch plane in 3D space.
 * Contains a Sketch at a specific height (Y position).
 */
export class SketchPlane {
  private sketch: Sketch
  private height: number
  private planeGroup: THREE.Group
  private planeMesh: THREE.Mesh

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
   * Create a semi-transparent rectangular plane sized to the sketch
   */
  private createPlaneMesh(): THREE.Mesh {
    const bounds = this.sketch.getBounds()

    const width = bounds.width * (1 + 2 * BORDER_PERCENT)
    const height = bounds.height * (1 + 2 * BORDER_PERCENT)

    const geometry = new THREE.PlaneGeometry(width, height)
    const material = new THREE.MeshBasicMaterial({
      color: 0x444444,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide
    })

    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.x = bounds.centerX
    mesh.position.y = bounds.centerY

    return mesh
  }

  /**
   * Rebuild the plane mesh to match current sketch bounds
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
    const style = PLANE_STYLES[state]
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
