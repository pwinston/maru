/**
 * Toolbar for the 2D sketch viewport.
 * Handles orientation mode (fixed/rotate), ghost toggle, and shape presets.
 */
export class SketchToolbar {
  private orientationElement: HTMLDivElement
  private ghostElement: HTMLDivElement
  private drawElement: HTMLDivElement
  private shapeElement: HTMLDivElement
  private orientationMode: 'fixed' | 'rotate' = 'fixed'
  private ghostEnabled: boolean = false

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

    // Create shape toolbar (right side)
    this.shapeElement = document.createElement('div')
    this.shapeElement.className = 'shape-toolbar'
    this.shapeElement.innerHTML = `
      <span class="toolbar-label">Sides</span>
      <button data-sides="3">3</button>
      <button data-sides="4">4</button>
      <button data-sides="5">5</button>
      <button data-sides="6">6</button>
      <button data-sides="7">7</button>
      <button data-sides="8">8</button>
      <button data-sides="10">10</button>
      <button data-sides="12">12</button>
      <button data-sides="16">16</button>
      <button data-sides="20">20</button>
      <button data-sides="100">100</button>
    `
    container.appendChild(this.shapeElement)

    // Event listeners
    this.orientationElement.addEventListener('click', (e) => this.handleOrientationClick(e))
    this.shapeElement.addEventListener('click', (e) => this.handleShapeClick(e))
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
    const target = e.target as HTMLElement
    if (target.tagName !== 'BUTTON' || !target.dataset.sides) return

    const sides = parseInt(target.dataset.sides, 10)
    this.setActiveSides(sides)
    this.onShapeSelect?.(sides)
  }

  /**
   * Set the active sides button (or clear if null)
   */
  setActiveSides(sides: number | null): void {
    this.shapeElement.querySelectorAll('button').forEach(btn => btn.classList.remove('active'))
    if (sides !== null) {
      this.shapeElement.querySelector(`[data-sides="${sides}"]`)?.classList.add('active')
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
   * Set callback for when ghost toggle changes
   */
  setOnGhostChange(callback: (enabled: boolean) => void): void {
    this.onGhostChange = callback
  }
}
