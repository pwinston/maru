import './style.css'
import { App } from './App'

// Set up HTML structure
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div id="viewport-3d"></div>
  <div id="viewport-2d"></div>
`

// Get container elements
const container3d = document.querySelector<HTMLDivElement>('#viewport-3d')!
const container2d = document.querySelector<HTMLDivElement>('#viewport-2d')!

// Create and start the app
const app = new App(container3d, container2d)
app.start()
