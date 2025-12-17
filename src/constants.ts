// App version (increment to verify code changes are live)
export const VERSION = 23

// Grid configuration
export const GRID = {
  SIZE: 100,              // Total grid extent (meters, centered at origin)
  SPACING_2D: 1,          // 1 meter between grid lines in 2D
  SPACING_3D: 10,         // 10 meters between grid lines in 3D
  COLOR: 0x444444,
  AXIS_X_COLOR: 0x884444,
  AXIS_Y_COLOR: 0x448844,
}

// Default building dimensions
export const DEFAULT_BUILDING_SIZE = 10  // 10m x 10m default building

// 3D viewport configuration
export const VIEWPORT_3D = {
  BACKGROUND_COLOR: 0x1a1a1a,
  CAMERA_FOV: 50,
  CAMERA_POSITION: { x: 40, y: 30, z: 40 },
  CAMERA_TARGET: { x: 0, y: 5, z: 0 },
  DAMPING_FACTOR: 0.15,
}

// 2D viewport configuration
export const VIEWPORT_2D = {
  BACKGROUND_COLOR: 0x2a2a2a,
  FRUSTUM_SIZE: 40,
}

// Lighting
export const LIGHTING = {
  AMBIENT_INTENSITY: 0.6,
  DIRECTIONAL_INTENSITY: 0.8,
  DIRECTIONAL_POSITION: { x: 5, y: 10, z: 5 },
}

// Sketch editor (2D vertex/segment interaction)
export const SKETCH = {
  VERTEX_SCREEN_PX: 12,         // Target vertex size in screen pixels
  VERTEX_COLOR: 0xffffff,       // White for normal vertices
  SELECTED_COLOR: 0xffff00,     // Yellow for selected vertices
  LINE_COLOR: 0x00ff00,
  GHOST_SCREEN_PX: 10,          // Target ghost vertex size in screen pixels
  GHOST_VERTEX_COLOR: 0x88ff88,
  GHOST_LINE_COLOR: 0x888888,   // Gray for ghost sketch outline
  GHOST_LINE_OPACITY: 0.4,
  DELETE_COLOR: 0xff0000,
  SEGMENT_HIT_WIDTH: 0.3,
  VERTEX_SAFE_ZONE: 0.25,
  SELECTION_RECT_COLOR: 0xffffff,
  SELECTION_RECT_OPACITY: 0.15,
  SELECTION_RECT_EDGE_COLOR: 0xffff00,
}

// Sketch plane (3D plane visuals)
export const PLANE = {
  BORDER_PERCENT: 0.15,
  STYLES: {
    default:  { color: 0x444444, opacity: 0.2 },
    hovered:  { color: 0x998866, opacity: 0.3 },
    selected: { color: 0xffcc00, opacity: 0.4 },
    deleting: { color: 0xff0000, opacity: 0.5 },
    dimmed:   { color: 0x333333, opacity: 0.15 },
  },
}

// Loft rendering
export const LOFT = {
  SOLID_COLOR: 0x4488cc,
  WIRE_COLOR: 0xdddddd,  // Light gray wireframe for quad edges
  DIAGONAL_WIRE_COLOR: 0xff8844,  // Orange dashed for triangulation diagonals
  // Locked segment tint - warm shift (r, g, b multipliers)
  LOCKED_TINT: { r: 1.5, g: 1.0, b: 0.5 },  // DRAMATIC for testing
}

// Interaction thresholds
export const INTERACTION = {
  CLICK_THRESHOLD_PX: 5,
  DELETE_THRESHOLD: 0.05,
}
