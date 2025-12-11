import * as THREE from 'three'

/**
 * Represents a 2D sketch plane in 3D space.
 * Contains a polygon outline at a specific Z position.
 */
export class SketchPlane {
  private vertices: THREE.Vector2[]
  private zPosition: number
  private planeGroup: THREE.Group
  private planeMesh: THREE.Mesh
  private outlineLine: THREE.Line

  constructor(vertices: THREE.Vector2[], zPosition: number) {
    this.vertices = vertices
    this.zPosition = zPosition
    this.planeGroup = new THREE.Group()

    // Create the semi-transparent plane surface
    this.planeMesh = this.createPlaneMesh()
    this.planeGroup.add(this.planeMesh)

    // Create the outline on the plane
    this.outlineLine = this.createOutline()
    this.planeGroup.add(this.outlineLine)

    // Position the group at the correct Y (vertical height)
    // Rotate to be horizontal (XZ plane instead of XY)
    this.planeGroup.position.y = zPosition
    this.planeGroup.rotation.x = -Math.PI / 2
  }

  /**
   * Create a semi-transparent rectangular plane
   */
  private createPlaneMesh(): THREE.Mesh {
    const planeSize = 10
    const geometry = new THREE.PlaneGeometry(planeSize, planeSize)
    const material = new THREE.MeshBasicMaterial({
      color: 0x444444,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide
    })
    return new THREE.Mesh(geometry, material)
  }

  /**
   * Create the polygon outline on the plane
   */
  private createOutline(): THREE.Line {
    // Convert 2D vertices to 3D points (z=0 in local coordinates)
    const points3d = this.vertices.map(v => new THREE.Vector3(v.x, v.y, 0))
    points3d.push(points3d[0].clone()) // Close the loop

    const geometry = new THREE.BufferGeometry().setFromPoints(points3d)
    const material = new THREE.LineBasicMaterial({
      color: 0x00ff00,
      linewidth: 2
    })
    return new THREE.Line(geometry, material)
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
   * Get the 2D vertices of the sketch
   */
  getVertices(): THREE.Vector2[] {
    return [...this.vertices]
  }

  /**
   * Get the Z position of this plane
   */
  getZPosition(): number {
    return this.zPosition
  }

  /**
   * Update the vertices and refresh the visualization
   */
  setVertices(vertices: THREE.Vector2[]): void {
    this.vertices = vertices

    // Remove old outline
    this.planeGroup.remove(this.outlineLine)

    // Create new outline
    this.outlineLine = this.createOutline()
    this.planeGroup.add(this.outlineLine)
  }

  /**
   * Highlight this plane (e.g., when selected)
   */
  setHighlight(highlighted: boolean): void {
    const material = this.planeMesh.material as THREE.MeshBasicMaterial
    if (highlighted) {
      material.color.setHex(0x666666)
      material.opacity = 0.4
    } else {
      material.color.setHex(0x444444)
      material.opacity = 0.2
    }
  }
}
