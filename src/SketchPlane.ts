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
   * Create a semi-transparent rectangular plane sized to the sketch
   */
  private createPlaneMesh(): THREE.Mesh {
    const bounds = this.calculateBounds()
    const borderPercent = 0.05 // 5% border

    const width = bounds.width * (1 + 2 * borderPercent)
    const height = bounds.height * (1 + 2 * borderPercent)

    const geometry = new THREE.PlaneGeometry(width, height)
    const material = new THREE.MeshBasicMaterial({
      color: 0x444444,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide
    })

    const mesh = new THREE.Mesh(geometry, material)
    // Center the plane on the sketch
    mesh.position.x = bounds.centerX
    mesh.position.y = bounds.centerY

    return mesh
  }

  /**
   * Calculate bounding box of the sketch vertices
   */
  private calculateBounds(): { width: number; height: number; centerX: number; centerY: number } {
    if (this.vertices.length === 0) {
      return { width: 2, height: 2, centerX: 0, centerY: 0 }
    }

    let minX = this.vertices[0].x
    let maxX = this.vertices[0].x
    let minY = this.vertices[0].y
    let maxY = this.vertices[0].y

    for (const vertex of this.vertices) {
      minX = Math.min(minX, vertex.x)
      maxX = Math.max(maxX, vertex.x)
      minY = Math.min(minY, vertex.y)
      maxY = Math.max(maxY, vertex.y)
    }

    return {
      width: maxX - minX,
      height: maxY - minY,
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2
    }
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

    // Remove old plane and outline
    this.planeGroup.remove(this.planeMesh)
    this.planeGroup.remove(this.outlineLine)

    // Create new plane and outline
    this.planeMesh = this.createPlaneMesh()
    this.planeGroup.add(this.planeMesh)

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
