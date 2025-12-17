const SIDE_OPTIONS = [3, 4, 5, 6, 7, 8, 10, 12, 16, 20, 100]

/**
 * Generate SVG path for a regular polygon
 */
function polygonPath(sides: number, size: number = 10): string {
  const points: string[] = []
  const cx = size
  const cy = size
  const r = size * 0.8
  // Start from top (-90 degrees)
  for (let i = 0; i < sides; i++) {
    const angle = (i * 2 * Math.PI / sides) - Math.PI / 2
    const x = cx + r * Math.cos(angle)
    const y = cy + r * Math.sin(angle)
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`)
  }
  return `M${points.join('L')}Z`
}

/**
 * Create an SVG element for a polygon
 */
function createPolygonSvg(sides: number, size: number = 20): string {
  const displaySides = sides > 20 ? 24 : sides  // Cap visual sides for circle-like shapes
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <path d="${polygonPath(displaySides, size / 2)}" fill="none" stroke="currentColor" stroke-width="1.5"/>
  </svg>`
}

/**
 * Toolbar for the 2D sketch viewport.
 * Handles orientation mode (fixed/rotate), ghost toggle, and shape presets.
 */
export class SketchToolbar {
  private orientationElement: HTMLDivElement
  private ghostElement: HTMLDivElement
  private drawElement: HTMLDivElement
  private shapeElement: HTMLDivElement
  private shapeButton: HTMLButtonElement
  private shapeDropdown: HTMLDivElement
  private orientationMode: 'fixed' | 'rotate' = 'fixed'
  private ghostEnabled: boolean = false
  private selectedSides: number | null = null
  private dropdownOpen: boolean = false
  private hasSketch: boolean = false

  private onOrientationChange?: (mode: 'fixed' | 'rotate') => void
  private onGhostChange?: (enabled: boolean) => void
  private onDrawStart?: () => void
  private onShapeSelect?: (sides: number) => void

  constructor(container: HTMLElement) {
    // Create orientation toolbar (left side)
    this.orientationElement = document.createElement('div')
    this.orientationElement.className = 'orientation-toolbar'
    this.orientationElement.innerHTML = `
      <button data-mode="fixed" class="active">Fixed</button>
      <button data-mode="rotate">Rotate</button>
    `
    container.appendChild(this.orientationElement)

    // Create ghost toggle (next to orientation)
    this.ghostElement = document.createElement('div')
    this.ghostElement.className = 'ghost-toolbar'
    this.ghostElement.innerHTML = `<button data-ghost="toggle">Ghost</button>`
    container.appendChild(this.ghostElement)

    this.ghostElement.addEventListener('click', () => this.toggleGhost())

    // Create draw button
    this.drawElement = document.createElement('div')
    this.drawElement.className = 'draw-toolbar'
    this.drawElement.innerHTML = `<button data-draw="start">Draw</button>`
    container.appendChild(this.drawElement)

    this.drawElement.addEventListener('click', () => this.startDraw())

    // Create shape dropdown (right side)
    this.shapeElement = document.createElement('div')
    this.shapeElement.className = 'shape-dropdown'

    // Create trigger button
    this.shapeButton = document.createElement('button')
    this.shapeButton.className = 'shape-dropdown-trigger'
    this.shapeButton.innerHTML = `<span class="shape-label">Sides</span><span class="dropdown-arrow">▼</span>`
    this.shapeElement.appendChild(this.shapeButton)

    // Create dropdown menu
    this.shapeDropdown = document.createElement('div')
    this.shapeDropdown.className = 'shape-dropdown-menu'
    this.shapeDropdown.innerHTML = this.createShapeOptionsHtml()
    this.shapeElement.appendChild(this.shapeDropdown)

    container.appendChild(this.shapeElement)

    // Event listeners
    this.orientationElement.addEventListener('click', (e) => this.handleOrientationClick(e))
    this.shapeButton.addEventListener('click', () => this.toggleDropdown())
    this.shapeDropdown.addEventListener('click', (e) => this.handleShapeClick(e))

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!this.shapeElement.contains(e.target as Node)) {
        this.closeDropdown()
      }
    })
  }

  private toggleDropdown(): void {
    // Don't open dropdown if no sketch is selected
    if (!this.hasSketch && !this.dropdownOpen) {
      return
    }
    this.dropdownOpen = !this.dropdownOpen
    this.shapeDropdown.classList.toggle('open', this.dropdownOpen)
    this.shapeButton.classList.toggle('open', this.dropdownOpen)
  }

  private createShapeOptionsHtml(): string {
    return SIDE_OPTIONS.map(sides =>
      `<button data-sides="${sides}" class="shape-option">
        ${createPolygonSvg(sides, 18)}
        <span>${sides}</span>
      </button>`
    ).join('')
  }

  private closeDropdown(): void {
    this.dropdownOpen = false
    this.shapeDropdown.classList.remove('open')
    this.shapeButton.classList.remove('open')
  }

  private handleOrientationClick(e: MouseEvent): void {
    const target = e.target as HTMLElement
    if (target.tagName !== 'BUTTON') return

    const mode = target.dataset.mode as 'fixed' | 'rotate'
    if (mode) {
      this.setOrientationMode(mode)
    }
  }

  private handleShapeClick(e: MouseEvent): void {
    const target = (e.target as HTMLElement).closest('button') as HTMLElement | null
    if (!target || !target.dataset.sides) return

    const sides = parseInt(target.dataset.sides, 10)
    this.setActiveSides(sides)
    this.closeDropdown()
    this.onShapeSelect?.(sides)
  }

  /**
   * Set the active sides button (or clear if null)
   */
  setActiveSides(sides: number | null): void {
    this.selectedSides = sides
    // Update dropdown item highlighting
    this.shapeDropdown.querySelectorAll('button').forEach(btn => btn.classList.remove('active'))
    if (sides !== null) {
      this.shapeDropdown.querySelector(`[data-sides="${sides}"]`)?.classList.add('active')
      // Update trigger button to show polygon icon
      this.shapeButton.innerHTML = `${createPolygonSvg(sides, 16)}<span class="dropdown-arrow">▼</span>`
    } else {
      // Reset to "Sides" label
      this.shapeButton.innerHTML = `<span class="shape-label">Sides</span><span class="dropdown-arrow">▼</span>`
    }
  }

  /**
   * Clear the active sides button (shape has been edited)
   */
  clearActiveSides(): void {
    this.setActiveSides(null)
  }

  setOrientationMode(mode: 'fixed' | 'rotate'): void {
    this.orientationMode = mode
    this.orientationElement.querySelectorAll('button').forEach(btn => btn.classList.remove('active'))
    this.orientationElement.querySelector(`[data-mode="${mode}"]`)?.classList.add('active')
    this.onOrientationChange?.(mode)
  }

  getOrientationMode(): 'fixed' | 'rotate' {
    return this.orientationMode
  }

  setOnOrientationChange(callback: (mode: 'fixed' | 'rotate') => void): void {
    this.onOrientationChange = callback
  }

  setOnShapeSelect(callback: (sides: number) => void): void {
    this.onShapeSelect = callback
  }

  /**
   * Start draw mode
   */
  private startDraw(): void {
    const btn = this.drawElement.querySelector('button')
    if (btn) {
      btn.classList.add('active')
    }
    this.onDrawStart?.()
  }

  /**
   * End draw mode (called when drawing completes or is cancelled)
   */
  endDrawMode(): void {
    const btn = this.drawElement.querySelector('button')
    if (btn) {
      btn.classList.remove('active')
    }
  }

  /**
   * Set callback for when draw mode starts
   */
  setOnDrawStart(callback: () => void): void {
    this.onDrawStart = callback
  }

  /**
   * Toggle ghost sketch visibility
   */
  private toggleGhost(): void {
    this.ghostEnabled = !this.ghostEnabled
    const btn = this.ghostElement.querySelector('button')
    if (btn) {
      btn.classList.toggle('active', this.ghostEnabled)
    }
    this.onGhostChange?.(this.ghostEnabled)
  }

  /**
   * Check if ghost is enabled
   */
  isGhostEnabled(): boolean {
    return this.ghostEnabled
  }

  /**
   * Get currently selected sides (null if edited/custom)
   */
  getSelectedSides(): number | null {
    return this.selectedSides
  }

  /**
   * Set callback for when ghost toggle changes
   */
  setOnGhostChange(callback: (enabled: boolean) => void): void {
    this.onGhostChange = callback
  }

  /**
   * Set whether a sketch is currently selected
   * Updates UI to show/hide shape options accordingly
   */
  setSketchSelected(hasSketch: boolean): void {
    this.hasSketch = hasSketch

    if (!hasSketch) {
      // Close dropdown if open
      this.closeDropdown()
      // Show "no sketch" message
      this.shapeDropdown.innerHTML = `<div class="no-sketch-message">No Sketch is selected</div>`
      this.shapeButton.classList.add('disabled')
    } else {
      // Restore shape options
      this.shapeDropdown.innerHTML = this.createShapeOptionsHtml()
      this.shapeButton.classList.remove('disabled')
      // Re-apply selected state if any
      if (this.selectedSides !== null) {
        this.shapeDropdown.querySelector(`[data-sides="${this.selectedSides}"]`)?.classList.add('active')
      }
    }
  }
}
