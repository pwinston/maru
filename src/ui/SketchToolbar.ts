/**
 * Toolbar for the 2D sketch viewport.
 * Handles orientation mode (fixed/rotate) and shape presets.
 */
export class SketchToolbar {
  private orientationElement: HTMLDivElement
  private shapeElement: HTMLDivElement
  private orientationMode: 'fixed' | 'rotate' = 'fixed'

  private onOrientationChange?: (mode: 'fixed' | 'rotate') => void
  private onShapeSelect?: (sides: number) => void

  constructor(container: HTMLElement) {
    // Create orientation toolbar (centered)
    this.orientationElement = document.createElement('div')
    this.orientationElement.className = 'orientation-toolbar'
    this.orientationElement.innerHTML = `
      <button data-mode="fixed" class="active">Fixed</button>
      <button data-mode="rotate">Rotate</button>
    `
    container.appendChild(this.orientationElement)

    // Create shape toolbar (right side)
    this.shapeElement = document.createElement('div')
    this.shapeElement.className = 'shape-toolbar'
    this.shapeElement.innerHTML = `
      <span class="toolbar-label">Shape</span>
      <button data-sides="3">3</button>
      <button data-sides="4" class="active">4</button>
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

    // Update active state
    this.shapeElement.querySelectorAll('button').forEach(btn => btn.classList.remove('active'))
    target.classList.add('active')

    this.onShapeSelect?.(sides)
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
}
