import * as THREE from 'three'

export type HandleType = 'none' | 'move' | 'scale' | 'rotate'

/**
 * Visual handles for transforming selected vertices.
 * Shows move (center), scale (left), and rotate (right) handles.
 */
export class SelectionHandles {
  private group: THREE.Group
  private moveHandle: THREE.Group
  private scaleHandle: THREE.Group
  private rotateHandle: THREE.Group

  private bounds: { min: THREE.Vector2; max: THREE.Vector2; center: THREE.Vector2 } | null = null
  private handleSize: number = 0.5  // Will be updated based on zoom

  constructor() {
    this.group = new THREE.Group()
    this.group.visible = false

    // Create move handle (four-way arrows in center)
    this.moveHandle = this.createMoveIcon()
    this.moveHandle.userData.handleType = 'move'
    this.group.add(this.moveHandle)

    // Create scale handle (up/down arrows, offset to left)
    this.scaleHandle = this.createScaleIcon()
    this.scaleHandle.userData.handleType = 'scale'
    this.group.add(this.scaleHandle)

    // Create rotate handle (curved arrow, offset to right)
    this.rotateHandle = this.createRotateIcon()
    this.rotateHandle.userData.handleType = 'rotate'
    this.group.add(this.rotateHandle)
  }

  /**
   * Create the move icon (four-way arrows)
   */
  private createMoveIcon(): THREE.Group {
    const group = new THREE.Group()
    const material = new THREE.MeshBasicMaterial({
      color: 0x44cc44,  // Green for move
      side: THREE.DoubleSide
    })

    // Horizontal line
    const hLineGeom = new THREE.PlaneGeometry(1.2, 0.15)
    group.add(new THREE.Mesh(hLineGeom, material))

    // Vertical line
    const vLineGeom = new THREE.PlaneGeometry(0.15, 1.2)
    group.add(new THREE.Mesh(vLineGeom, material))

    // Right arrow head
    const arrowRight = new THREE.BufferGeometry()
    arrowRight.setAttribute('position', new THREE.Float32BufferAttribute([
      0.6, 0, 0,
      0.3, 0.25, 0,
      0.3, -0.25, 0
    ], 3))
    arrowRight.setIndex([0, 1, 2])
    group.add(new THREE.Mesh(arrowRight, material))

    // Left arrow head
    const arrowLeft = new THREE.BufferGeometry()
    arrowLeft.setAttribute('position', new THREE.Float32BufferAttribute([
      -0.6, 0, 0,
      -0.3, 0.25, 0,
      -0.3, -0.25, 0
    ], 3))
    arrowLeft.setIndex([0, 2, 1])
    group.add(new THREE.Mesh(arrowLeft, material))

    // Up arrow head
    const arrowUp = new THREE.BufferGeometry()
    arrowUp.setAttribute('position', new THREE.Float32BufferAttribute([
      0, 0.6, 0,
      -0.25, 0.3, 0,
      0.25, 0.3, 0
    ], 3))
    arrowUp.setIndex([0, 1, 2])
    group.add(new THREE.Mesh(arrowUp, material))

    // Down arrow head
    const arrowDown = new THREE.BufferGeometry()
    arrowDown.setAttribute('position', new THREE.Float32BufferAttribute([
      0, -0.6, 0,
      -0.25, -0.3, 0,
      0.25, -0.3, 0
    ], 3))
    arrowDown.setIndex([0, 2, 1])
    group.add(new THREE.Mesh(arrowDown, material))

    // Hit area (invisible larger box for easier clicking)
    const hitArea = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 1.5),
      new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide })
    )
    hitArea.userData.handleType = 'move'
    group.add(hitArea)

    group.position.z = 0.04
    return group
  }

  /**
   * Create the scale icon (up/down arrows)
   */
  private createScaleIcon(): THREE.Group {
    const group = new THREE.Group()
    const material = new THREE.MeshBasicMaterial({
      color: 0x44aaff,  // Blue for scale
      side: THREE.DoubleSide
    })

    // Vertical line
    const lineGeom = new THREE.PlaneGeometry(0.15, 1.2)
    const line = new THREE.Mesh(lineGeom, material)
    group.add(line)

    // Up arrow head
    const arrowUp = new THREE.BufferGeometry()
    arrowUp.setAttribute('position', new THREE.Float32BufferAttribute([
      0, 0.6, 0,
      -0.25, 0.3, 0,
      0.25, 0.3, 0
    ], 3))
    arrowUp.setIndex([0, 1, 2])
    group.add(new THREE.Mesh(arrowUp, material))

    // Down arrow head
    const arrowDown = new THREE.BufferGeometry()
    arrowDown.setAttribute('position', new THREE.Float32BufferAttribute([
      0, -0.6, 0,
      -0.25, -0.3, 0,
      0.25, -0.3, 0
    ], 3))
    arrowDown.setIndex([0, 2, 1])
    group.add(new THREE.Mesh(arrowDown, material))

    // Hit area (invisible larger box for easier clicking)
    const hitArea = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1.5),
      new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide })
    )
    hitArea.userData.handleType = 'scale'
    group.add(hitArea)

    group.position.z = 0.04
    return group
  }

  /**
   * Create the rotate icon (curved arrow)
   */
  private createRotateIcon(): THREE.Group {
    const group = new THREE.Group()
    const material = new THREE.MeshBasicMaterial({
      color: 0xff8800,  // Orange for rotate
      side: THREE.DoubleSide
    })

    // Create a curved arc
    const arcShape = new THREE.Shape()

    // Create thick arc by making inner and outer curves
    const innerRadius = 0.3
    const outerRadius = 0.5
    arcShape.absarc(0, 0, outerRadius, 0, Math.PI * 1.3, false)
    arcShape.absarc(0, 0, innerRadius, Math.PI * 1.3, 0, true)

    const arcGeom = new THREE.ShapeGeometry(arcShape)
    const arc = new THREE.Mesh(arcGeom, material)
    group.add(arc)

    // Arrow head at end of arc
    const angle = Math.PI * 1.3
    const arrowX = Math.cos(angle) * 0.4
    const arrowY = Math.sin(angle) * 0.4

    const arrowHead = new THREE.BufferGeometry()
    // Point tangent to the arc
    const tangentAngle = angle + Math.PI / 2
    arrowHead.setAttribute('position', new THREE.Float32BufferAttribute([
      arrowX + Math.cos(tangentAngle) * 0.25, arrowY + Math.sin(tangentAngle) * 0.25, 0,
      arrowX - Math.cos(angle) * 0.15, arrowY - Math.sin(angle) * 0.15, 0,
      arrowX + Math.cos(angle) * 0.15, arrowY + Math.sin(angle) * 0.15, 0
    ], 3))
    arrowHead.setIndex([0, 1, 2])
    group.add(new THREE.Mesh(arrowHead, material))

    // Hit area (invisible circle for easier clicking)
    const hitArea = new THREE.Mesh(
      new THREE.CircleGeometry(0.6, 16),
      new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide })
    )
    hitArea.userData.handleType = 'rotate'
    group.add(hitArea)

    group.position.z = 0.04
    return group
  }

  /**
   * Get the Three.js group containing all handle visuals
   */
  getGroup(): THREE.Group {
    return this.group
  }

  /**
   * Update handles to match the given vertices
   */
  update(vertices: THREE.Vector2[], selectedIndices: number[]): void {
    if (selectedIndices.length < 2) {
      this.group.visible = false
      this.bounds = null
      return
    }

    // Calculate bounding box of selected vertices
    let minX = Infinity, minY = Infinity
    let maxX = -Infinity, maxY = -Infinity

    for (const idx of selectedIndices) {
      const v = vertices[idx]
      minX = Math.min(minX, v.x)
      minY = Math.min(minY, v.y)
      maxX = Math.max(maxX, v.x)
      maxY = Math.max(maxY, v.y)
    }

    this.bounds = {
      min: new THREE.Vector2(minX, minY),
      max: new THREE.Vector2(maxX, maxY),
      center: new THREE.Vector2((minX + maxX) / 2, (minY + maxY) / 2)
    }

    const iconSize = this.handleSize * 2
    const boxWidth = maxX - minX
    const offset = Math.max(boxWidth / 2 + iconSize * 1.5, iconSize * 2)

    // Position move handle at center
    this.moveHandle.position.set(this.bounds.center.x, this.bounds.center.y, 0.04)
    this.moveHandle.scale.set(iconSize, iconSize, 1)

    // Position scale handle outside the bounding box (to the left)
    this.scaleHandle.position.set(this.bounds.center.x - offset, this.bounds.center.y, 0.04)
    this.scaleHandle.scale.set(iconSize, iconSize, 1)

    // Position rotate handle outside the bounding box (to the right)
    this.rotateHandle.position.set(this.bounds.center.x + offset, this.bounds.center.y, 0.04)
    this.rotateHandle.scale.set(iconSize, iconSize, 1)

    this.group.visible = true
  }

  /**
   * Hide the handles
   */
  hide(): void {
    this.group.visible = false
    this.bounds = null
  }

  /**
   * Set the handle size (for zoom-invariant sizing)
   */
  setHandleSize(size: number): void {
    this.handleSize = size
  }

  /**
   * Get all objects for raycasting (includes children with handleType)
   */
  getHandleMeshes(): THREE.Object3D[] {
    const meshes: THREE.Object3D[] = []
    // Get all children that have handleType userData
    this.moveHandle.traverse((child) => {
      if (child.userData.handleType) meshes.push(child)
    })
    this.scaleHandle.traverse((child) => {
      if (child.userData.handleType) meshes.push(child)
    })
    this.rotateHandle.traverse((child) => {
      if (child.userData.handleType) meshes.push(child)
    })
    return meshes
  }

  /**
   * Get the handle type from an object (checks parents too)
   */
  getHandleType(obj: THREE.Object3D): HandleType {
    // Check the object itself
    if (obj.userData.handleType) {
      return obj.userData.handleType as HandleType
    }
    // Check parent chain
    let parent = obj.parent
    while (parent) {
      if (parent.userData.handleType) {
        return parent.userData.handleType as HandleType
      }
      parent = parent.parent
    }
    return 'none'
  }

  /**
   * Get the current bounds (null if not visible)
   */
  getBounds(): { min: THREE.Vector2; max: THREE.Vector2; center: THREE.Vector2 } | null {
    return this.bounds
  }

  /**
   * Check if handles are currently visible
   */
  isVisible(): boolean {
    return this.group.visible
  }
}
