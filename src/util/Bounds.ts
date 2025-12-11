/**
 * 2D axis-aligned bounding box
 */
export class Bounds {
  minX: number
  maxX: number
  minY: number
  maxY: number

  constructor(minX: number, maxX: number, minY: number, maxY: number) {
    this.minX = minX
    this.maxX = maxX
    this.minY = minY
    this.maxY = maxY
  }

  get width(): number {
    return this.maxX - this.minX
  }

  get height(): number {
    return this.maxY - this.minY
  }

  get centerX(): number {
    return (this.minX + this.maxX) / 2
  }

  get centerY(): number {
    return (this.minY + this.maxY) / 2
  }

  /**
   * Create bounds from an array of points
   */
  static fromPoints(points: { x: number; y: number }[]): Bounds {
    if (points.length === 0) {
      return new Bounds(-1, 1, -1, 1)
    }

    let minX = points[0].x
    let maxX = points[0].x
    let minY = points[0].y
    let maxY = points[0].y

    for (const point of points) {
      minX = Math.min(minX, point.x)
      maxX = Math.max(maxX, point.x)
      minY = Math.min(minY, point.y)
      maxY = Math.max(maxY, point.y)
    }

    return new Bounds(minX, maxX, minY, maxY)
  }
}
