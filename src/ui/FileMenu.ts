import { BuildingStorage } from '../storage/BuildingStorage'
import type { BuildingData } from '../storage/BuildingTypes'

/**
 * File menu UI for save/load/new operations.
 */
export class FileMenu {
  private container: HTMLDivElement
  private menuButton: HTMLButtonElement
  private dropdown: HTMLDivElement
  private isOpen = false

  private onNew: (() => void) | null = null
  private onLoad: ((data: BuildingData) => void) | null = null
  private onGetCurrentData: (() => BuildingData) | null = null

  constructor(parent: HTMLElement) {
    this.container = document.createElement('div')
    this.container.className = 'file-menu'

    // Menu button
    this.menuButton = document.createElement('button')
    this.menuButton.textContent = 'File'
    this.menuButton.className = 'file-menu-button'
    this.menuButton.addEventListener('click', () => this.toggleMenu())
    this.container.appendChild(this.menuButton)

    // Dropdown
    this.dropdown = document.createElement('div')
    this.dropdown.className = 'file-menu-dropdown'
    this.dropdown.style.display = 'none'
    this.container.appendChild(this.dropdown)

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!this.container.contains(e.target as Node)) {
        this.closeMenu()
      }
    })

    parent.appendChild(this.container)
  }

  /**
   * Toggle menu open/closed
   */
  private toggleMenu(): void {
    if (this.isOpen) {
      this.closeMenu()
    } else {
      this.openMenu()
    }
  }

  /**
   * Open the dropdown and populate it
   */
  private async openMenu(): Promise<void> {
    this.isOpen = true
    this.dropdown.style.display = 'block'
    this.menuButton.classList.add('active')

    // Populate dropdown
    this.dropdown.innerHTML = ''

    // New button
    const newBtn = document.createElement('button')
    newBtn.textContent = 'New'
    newBtn.addEventListener('click', () => {
      this.closeMenu()
      this.onNew?.()
    })
    this.dropdown.appendChild(newBtn)

    // Save button
    const saveBtn = document.createElement('button')
    saveBtn.textContent = 'Save...'
    saveBtn.addEventListener('click', () => {
      this.closeMenu()
      this.showSaveDialog()
    })
    this.dropdown.appendChild(saveBtn)

    // Divider
    const divider = document.createElement('div')
    divider.className = 'file-menu-divider'
    this.dropdown.appendChild(divider)

    // Load label
    const loadLabel = document.createElement('div')
    loadLabel.className = 'file-menu-label'
    loadLabel.textContent = 'Load:'
    this.dropdown.appendChild(loadLabel)

    // Fetch and show saved buildings
    try {
      const buildings = await BuildingStorage.list()
      if (buildings.length === 0) {
        const empty = document.createElement('div')
        empty.className = 'file-menu-empty'
        empty.textContent = '(no saved buildings)'
        this.dropdown.appendChild(empty)
      } else {
        for (const building of buildings) {
          const btn = document.createElement('button')
          btn.textContent = `${building.name} (${building.planeCount} planes)`
          btn.addEventListener('click', () => this.loadBuilding(building.name))
          this.dropdown.appendChild(btn)
        }
      }
    } catch (err) {
      const errDiv = document.createElement('div')
      errDiv.className = 'file-menu-error'
      errDiv.textContent = 'Failed to load list'
      this.dropdown.appendChild(errDiv)
    }
  }

  /**
   * Close the dropdown
   */
  private closeMenu(): void {
    this.isOpen = false
    this.dropdown.style.display = 'none'
    this.menuButton.classList.remove('active')
  }

  /**
   * Show save dialog (prompt for name)
   */
  private async showSaveDialog(): Promise<void> {
    const name = prompt('Save building as:', 'building-1')
    if (!name) return

    if (!this.onGetCurrentData) {
      alert('Cannot save: no data provider')
      return
    }

    const data = this.onGetCurrentData()
    data.name = name

    try {
      await BuildingStorage.save(data)
      alert(`Saved "${name}"`)
    } catch (err) {
      alert(`Failed to save: ${err}`)
    }
  }

  /**
   * Load a building by name
   */
  private async loadBuilding(name: string): Promise<void> {
    this.closeMenu()

    try {
      const data = await BuildingStorage.load(name)
      this.onLoad?.(data)
    } catch (err) {
      alert(`Failed to load: ${err}`)
    }
  }

  /**
   * Set callback for New action
   */
  setOnNew(callback: () => void): void {
    this.onNew = callback
  }

  /**
   * Set callback for Load action
   */
  setOnLoad(callback: (data: BuildingData) => void): void {
    this.onLoad = callback
  }

  /**
   * Set callback to get current building data for Save
   */
  setOnGetCurrentData(callback: () => BuildingData): void {
    this.onGetCurrentData = callback
  }
}
