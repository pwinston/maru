import type { WireframeMode } from '../3d/Loft'
import { getAlgorithmNames } from '../loft/LoftAlgorithm'
import { LOFT } from '../constants'

export type LoftAlgorithmName = string

/**
 * Main toolbar for controlling visibility of planes, walls, roof, and wireframe mode.
 */
export class MainToolbar {
  private element: HTMLDivElement
  private toggleState = {
    planes: true,
    walls: false,
    roof: false,
  }
  private currentAlgorithm: LoftAlgorithmName = LOFT.DEFAULT_ALGORITHM

  private onPlanesChange?: (visible: boolean) => void
  private onWallsChange?: (visible: boolean) => void
  private onRoofChange?: (visible: boolean) => void
  private onWireframeChange?: (mode: WireframeMode) => void
  private onAlgorithmChange?: (name: LoftAlgorithmName) => void

  constructor(container: HTMLElement) {
    this.element = document.createElement('div')
    this.element.className = 'main-toolbar'
    const algorithmButtons = getAlgorithmNames()
      .map(name => {
        // Map algorithm names to display labels
        const label = name === 'perimeter-walk' ? 'Perimeter' : name
        const active = name === this.currentAlgorithm ? ' class="active"' : ''
        return `<button data-algo="${name}"${active}>${label}</button>`
      })
      .join('\n        ')

    this.element.innerHTML = `
      <div class="toolbar-section">
        <button data-toggle="planes" class="toggle active">Planes</button>
        <button data-toggle="walls" class="toggle">Walls</button>
        <button data-toggle="roof" class="toggle">Roof</button>
      </div>
      <div class="toolbar-section">
        <span class="toolbar-label">Wireframe</span>
        <button data-wire="off" class="active">Off</button>
        <button data-wire="normal">Normal</button>
        <button data-wire="tris">Tris</button>
      </div>
      <div class="toolbar-section">
        <span class="toolbar-label">Algorithm</span>
        ${algorithmButtons}
      </div>
    `
    container.appendChild(this.element)

    this.element.addEventListener('click', (e) => this.handleClick(e))
  }

  private handleClick(e: MouseEvent): void {
    const target = e.target as HTMLElement
    if (target.tagName !== 'BUTTON') return

    if (target.dataset.toggle) {
      const name = target.dataset.toggle as keyof typeof this.toggleState
      if (name === 'planes') {
        this.setPlanesVisible(!this.toggleState.planes)
      } else if (name === 'walls') {
        this.setWallsVisible(!this.toggleState.walls)
      } else if (name === 'roof') {
        this.setRoofVisible(!this.toggleState.roof)
      }
    } else if (target.dataset.wire) {
      this.setWireframeMode(target.dataset.wire as WireframeMode)
    } else if (target.dataset.algo) {
      this.setAlgorithm(target.dataset.algo)
    }
  }

  private updateToggleUI(name: string, active: boolean): void {
    const btn = this.element.querySelector(`[data-toggle="${name}"]`)
    btn?.classList.toggle('active', active)
  }

  setPlanesVisible(visible: boolean): void {
    this.toggleState.planes = visible
    this.updateToggleUI('planes', visible)
    this.onPlanesChange?.(visible)
  }

  setWallsVisible(visible: boolean): void {
    this.toggleState.walls = visible
    this.updateToggleUI('walls', visible)
    this.onWallsChange?.(visible)
  }

  setRoofVisible(visible: boolean): void {
    this.toggleState.roof = visible
    this.updateToggleUI('roof', visible)
    this.onRoofChange?.(visible)
  }

  setWireframeMode(mode: WireframeMode): void {
    this.element.querySelectorAll('[data-wire]').forEach(btn => btn.classList.remove('active'))
    this.element.querySelector(`[data-wire="${mode}"]`)?.classList.add('active')
    this.onWireframeChange?.(mode)
  }

  setAlgorithm(name: LoftAlgorithmName): void {
    this.currentAlgorithm = name
    this.element.querySelectorAll('[data-algo]').forEach(btn => btn.classList.remove('active'))
    this.element.querySelector(`[data-algo="${name}"]`)?.classList.add('active')
    this.onAlgorithmChange?.(name)
  }

  /**
   * Reset toolbar to default state
   */
  reset(): void {
    this.setPlanesVisible(true)
    this.setWallsVisible(false)
    this.setRoofVisible(false)
    this.setWireframeMode('off')
    this.setAlgorithm(LOFT.DEFAULT_ALGORITHM)
  }

  setOnPlanesChange(callback: (visible: boolean) => void): void {
    this.onPlanesChange = callback
  }

  setOnWallsChange(callback: (visible: boolean) => void): void {
    this.onWallsChange = callback
  }

  setOnRoofChange(callback: (visible: boolean) => void): void {
    this.onRoofChange = callback
  }

  setOnWireframeChange(callback: (mode: WireframeMode) => void): void {
    this.onWireframeChange = callback
  }

  setOnAlgorithmChange(callback: (name: LoftAlgorithmName) => void): void {
    this.onAlgorithmChange = callback
  }

  /**
   * Check if roof toggle is enabled
   */
  isRoofEnabled(): boolean {
    return this.toggleState.roof
  }

  /**
   * Get current algorithm name
   */
  getAlgorithm(): LoftAlgorithmName {
    return this.currentAlgorithm
  }
}
