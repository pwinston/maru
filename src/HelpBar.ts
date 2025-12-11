export interface HelpItem {
  key: string
  action: string
}

/**
 * Creates a help bar overlay showing keyboard/mouse shortcuts.
 * Styled as a floating pill at the bottom of its container.
 */
export class HelpBar {
  private element: HTMLElement

  constructor(items: HelpItem[]) {
    this.element = document.createElement('div')
    this.element.className = 'help-bar'

    items.forEach((item, index) => {
      if (index > 0) {
        const divider = document.createElement('span')
        divider.className = 'divider'
        this.element.appendChild(divider)
      }

      const helpItem = document.createElement('span')
      helpItem.className = 'help-item'
      helpItem.innerHTML = `<span class="help-key">${item.key}</span><span class="help-action">${item.action}</span>`
      this.element.appendChild(helpItem)
    })
  }

  /**
   * Append the help bar to a container element
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
