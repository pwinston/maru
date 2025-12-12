export interface HelpItem {
  key: string
  action: string
}

/**
 * Creates a help panel overlay showing keyboard/mouse shortcuts.
 * Positioned at bottom-left, can be extended with additional content.
 */
export class HelpPanel {
  private element: HTMLElement
  private contentArea: HTMLElement

  constructor(items: HelpItem[]) {
    this.element = document.createElement('div')
    this.element.className = 'help-panel'

    this.contentArea = document.createElement('div')
    this.contentArea.className = 'help-panel-content'
    this.element.appendChild(this.contentArea)

    this.setItems(items)
  }

  /**
   * Set the help items to display
   */
  setItems(items: HelpItem[]): void {
    this.contentArea.innerHTML = ''

    for (const item of items) {
      const row = document.createElement('div')
      row.className = 'help-row'
      row.innerHTML = `<span class="help-key">${item.key}</span><span class="help-action">${item.action}</span>`
      this.contentArea.appendChild(row)
    }
  }

  /**
   * Append the help panel to a container element
   */
  appendTo(container: HTMLElement): void {
    container.appendChild(this.element)
  }

  /**
   * Get the underlying DOM element
   */
  getElement(): HTMLElement {
    return this.element
  }
}
