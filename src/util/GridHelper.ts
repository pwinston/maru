import * as THREE from 'three'
import { GRID_SIZE, GRID_SPACING } from '../constants'

const GRID_COLOR = 0x444444  // Subtle gray for grid lines
const AXIS_X_COLOR = 0x884444  // Muted red for X axis
const AXIS_Y_COLOR = 0x448844  // Muted green for Y/Z axis

/**
 * Create a 2D grid with colored axis lines.
 * Grid is in the XY plane, centered at origin.
 * Use for 2D sketch editor (XY) or rotate for 3D floor (XZ).
 */
export function createGrid(): THREE.Group {
  const group = new THREE.Group()
  const halfSize = GRID_SIZE / 2
  const divisions = GRID_SIZE / GRID_SPACING

  // Grid lines (excluding axes which we'll draw separately)
  const gridMaterial = new THREE.LineBasicMaterial({ color: GRID_COLOR, transparent: true, opacity: 0.3 })

  // Vertical lines (parallel to Y axis)
  for (let i = -divisions / 2; i <= divisions / 2; i++) {
    const x = i * GRID_SPACING
    if (x === 0) continue // Skip axis
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x, -halfSize, 0),
      new THREE.Vector3(x, halfSize, 0)
    ])
    group.add(new THREE.Line(geometry, gridMaterial))
  }

  // Horizontal lines (parallel to X axis)
  for (let i = -divisions / 2; i <= divisions / 2; i++) {
    const y = i * GRID_SPACING
    if (y === 0) continue // Skip axis
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-halfSize, y, 0),
      new THREE.Vector3(halfSize, y, 0)
    ])
    group.add(new THREE.Line(geometry, gridMaterial))
  }

  // X axis (red) - horizontal
  const xAxisMaterial = new THREE.LineBasicMaterial({ color: AXIS_X_COLOR, transparent: true, opacity: 0.6 })
  const xAxisGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-halfSize, 0, 0),
    new THREE.Vector3(halfSize, 0, 0)
  ])
  group.add(new THREE.Line(xAxisGeometry, xAxisMaterial))

  // Y axis (green) - vertical in 2D, becomes Z in 3D
  const yAxisMaterial = new THREE.LineBasicMaterial({ color: AXIS_Y_COLOR, transparent: true, opacity: 0.6 })
  const yAxisGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, -halfSize, 0),
    new THREE.Vector3(0, halfSize, 0)
  ])
  group.add(new THREE.Line(yAxisGeometry, yAxisMaterial))

  return group
}
