/**
 * Minimap showing the building structure with planes and segments.
 * Allows toggling segment lock status.
 */
export class Minimap {
  private element: HTMLDivElement
  private planeCount: number = 1
  private segmentLocked: boolean[] = []
  private selectedPlaneIndex: number = -1

  private onSegmentLockChange?: (segmentIndex: number, locked: boolean) => void
  private onPlaneSelect?: (planeIndex: number) => void

  constructor(container: HTMLElement) {
    this.element = document.createElement('div')
    this.element.className = 'minimap'
    container.appendChild(this.element)

    this.render()
  }

  /**
   * Update the minimap to reflect the current number of planes
   */
  setPlaneCount(count: number): void {
    if (count === this.planeCount) return

    this.planeCount = count
    const segmentCount = Math.max(0, count - 1)

    // Preserve existing lock states, add false for new segments
    while (this.segmentLocked.length < segmentCount) {
      this.segmentLocked.push(false)
    }
    // Trim if planes were removed
    this.segmentLocked.length = segmentCount

    this.render()
  }

  /**
   * Get current lock states for all segments
   */
  getSegmentLockStates(): boolean[] {
    return [...this.segmentLocked]
  }

  /**
   * Set lock state for a specific segment
   */
  setSegmentLocked(segmentIndex: number, locked: boolean): void {
    if (segmentIndex >= 0 && segmentIndex < this.segmentLocked.length) {
      this.segmentLocked[segmentIndex] = locked
      this.render()
    }
  }

  /**
   * Set callback for when segment lock status changes
   */
  setOnSegmentLockChange(callback: (segmentIndex: number, locked: boolean) => void): void {
    this.onSegmentLockChange = callback
  }

  /**
   * Set callback for when a plane is clicked
   */
  setOnPlaneSelect(callback: (planeIndex: number) => void): void {
    this.onPlaneSelect = callback
  }

  /**
   * Set which plane is currently selected (for visual highlight)
   */
  setSelectedPlane(planeIndex: number): void {
    if (this.selectedPlaneIndex !== planeIndex) {
      this.selectedPlaneIndex = planeIndex
      this.render()
    }
  }

  /**
   * Render the minimap
   */
  private render(): void {
    this.element.innerHTML = ''

    // Build from top to bottom (highest plane first)
    for (let i = this.planeCount - 1; i >= 0; i--) {
      // Plane line
      const planeIndex = i
      const isSelected = planeIndex === this.selectedPlaneIndex
      const planeLine = document.createElement('div')
      planeLine.className = `minimap-plane${isSelected ? ' selected' : ''}`
      planeLine.innerHTML = `<span class="minimap-plane-label">${i}</span><span class="minimap-plane-line"></span>`
      planeLine.addEventListener('click', () => this.onPlaneSelect?.(planeIndex))
      this.element.appendChild(planeLine)

      // Segment block (if not the bottom plane)
      if (i > 0) {
        const segmentIndex = i - 1
        const segment = document.createElement('div')
        const locked = this.segmentLocked[segmentIndex] ?? false
        segment.className = `minimap-segment ${locked ? 'locked' : 'unlocked'}`
        segment.dataset.segment = String(segmentIndex)
        if (locked) {
          segment.innerHTML = '<span class="minimap-segment-icon">🔒</span>'
        }
        segment.addEventListener('click', () => this.handleSegmentClick(segmentIndex))
        this.element.appendChild(segment)
      }
    }

  }

  /**
   * Handle click on a segment to toggle lock status
   */
  private handleSegmentClick(segmentIndex: number): void {
    if (segmentIndex >= 0 && segmentIndex < this.segmentLocked.length) {
      this.segmentLocked[segmentIndex] = !this.segmentLocked[segmentIndex]
      this.render()
      this.onSegmentLockChange?.(segmentIndex, this.segmentLocked[segmentIndex])
    }
  }
}
