# Maru

CAD-like tool to create, visualize and interactively edit "lofted" shapes in three.js.

## Specification

Three steps: creating the loft, visualizing it, and editing it.

### Creating a loft

- The user sketches two or more 2D profiles.
- Each profile is a closed non-crossing polygon with vertices and line segments between them.
- Each profile might contain a different number of vertices.
- The profiles can be positioned in 3D space, but they all must be parallel to each other.
- When the "loft" button is pressed a closed 3D shape is created based on the profiles.
- User can rotate/zoom/pan to see the shape from multiple views. 

### Visualizing the loft

The four vertices that make up one face might not be planar, in which case that portion
of the loft is curved. It's TBD how we render the curved surface. We will start with 
the simplest possible thing which is just render a quad, such that the two triangles
of the quad very roughly depict the curve.

If we decide to go for more visual quality we can play around with tessellating
that that quad, or possibly using nurbs patches. However we might decide
spending time on better interactive editing is a better use of time compared to 
improving visual quality.

### Editing the loft

At a minimum operations should include:
- Rotating one of the sketches along its normal to twist the loft
- Moving a vertex in any of the sketches
- Merging adjacent vertices in a sketch
- Inserting a new vertex in a sketch, splitting that edge into two

Note that rotating sketch after the loft is created should twist the exist
loft whereas rotating a sketch and then lofting might produce a different
shape based since different vertices might be paired up.

## Planning

I used ChatGPT to discuss which libraries to use and come up with a general UI
strategy.

### Libraries

1. Core rendering and interaction: [Three.js](https://threejs.org/)
2. Possibly later on if we want true nurbs rendering: [verb](http://verbnurbs.com/)
3. Typescript + simple build tool: [vite](https://vite.dev/)
4. No front-end framework, it's one big viewport.

### Rendering

We'll start with rendering 1 quad per face, this will very crudely approximate a
curve with just two non-planar triangles. From there we can explore tessellating
each face into more quads/triangles to better approximate the curved surface. If
time permits we could explore true nurbs rendering. However, my assumption based
on the wording of the assignment, and the company’s product, is that time is
better spent on the UI and interactivity than in getting mathematically perfect
shapes.

### UI

Show the sketch planes and the lofted shape in 3D, but create and edit sketches
in 2D with a normal top-down 2D view.  Editing the sketches while the plane is
at a 3D angle would be a lot harder without really adding much value.

## Implementation Layout

```
src/
├── main.ts                      # App entry point, wires together viewports and event handlers
├── constants.ts                 # Configuration values (colors, sizes, thresholds)
│
├── 2d/
│   ├── Sketch.ts                # 2D polygon: vertices, lines, visual meshes
│   └── SketchEditor.ts          # 2D viewport with vertex drag/insert/delete
│
├── 3d/
│   ├── Viewport3D.ts            # 3D scene with orbit controls and lighting
│   ├── SketchPlane.ts           # Sketch positioned at a height in 3D
│   ├── PlaneSelector.ts         # Hover/click plane selection
│   ├── PlaneDragger.ts          # Drag to move/create/delete planes
│   └── Loft.ts                  # Renders mesh faces (quads/triangles) from LoftableModel
│
├── loft/
│   ├── LoftAlgorithm.ts         # Algorithm interface & registry
│   ├── LoftableModel.ts         # Model with segments containing mesh faces
│   └── PerimeterWalkAlgorithm.ts # Perimeter-walk loft algorithm (see below)
│
├── ui/
│   ├── MainToolbar.ts           # 3D viewport toolbar (planes, walls, roof, wireframe, algorithm)
│   └── SketchToolbar.ts         # 2D viewport toolbar (orientation, shape presets)
│
└── util/
    ├── Geometry.ts              # Polygon math (area, winding, triangulation, intersection)
    ├── Geometry.test.ts         # Unit tests for Geometry
    ├── Bounds.ts                # 2D axis-aligned bounding box
    ├── GridHelper.ts            # Grid line rendering
    ├── HelpBar.ts               # Legacy help bar (deprecated)
    └── HelpPanel.ts             # Keyboard shortcut help overlay
```

## Loft Algorithm

The loft algorithm connects two 2D polygon loops into a 3D mesh of quads (and occasionally
triangles). The interface is:

```typescript
type LoftAlgorithm = (
  loopA: Vector2[], heightA: number,
  loopB: Vector2[], heightB: number
) => { faces: LoftFace[] }
```

### Perimeter Walk Algorithm

The current algorithm (`PerimeterWalkAlgorithm.ts`) works by "walking" both polygon
perimeters simultaneously, parameterized by arc length:

1. **Parameterize** both loops by cumulative perimeter distance, normalized to [0, 1]
2. **Walk** both loops together, starting at vertex 0 on each
3. At each step, compare the parameter of the next vertex on each loop:
   - **Case 1 (Quad):** Both loops reach their next vertex at the same parameter → create a quad, advance both
   - **Case 2 (Subdivide B):** A's next vertex comes first → interpolate a point on B's edge, create quad, advance A only
   - **Case 3 (Subdivide A):** B's next vertex comes first → interpolate a point on A's edge, create quad, advance B only

Key properties:
- Produces mostly quads (good for rendering and further subdivision)
- Handles loops with different vertex counts
- Preserves original polygon shapes exactly (no resampling/distortion)
- Vertices are connected based on relative position along perimeter

### Per-Edge Adaptive Subdivision

When connecting loops with different vertex counts, some edges on one loop may "span"
multiple vertices from the other loop. Without intervention, this creates ugly triangle
fans radiating from single vertices.

The algorithm uses **per-edge adaptive subdivision**: for each edge, it counts how many
vertices from the other loop fall within that edge's parameter range. If an edge spans
N ≥ 3 vertices, N-1 intermediate points are inserted on that edge. Small mismatches
(2 vertices per edge) are handled naturally by the perimeter walk without subdivision.

Example: Square edge spanning 5 circle vertices
- Edge parameter range: [0.0, 0.25] (one side of square)
- Circle vertices in range: 5 (at params 0.0, 0.05, 0.10, 0.15, 0.20)
- Insert 4 intermediate points on the square edge
- Result: 5 quads instead of a fan of 5 triangles

This approach is smarter than global subdivision because:
- Only edges that need it get subdivided
- Works correctly even with irregular polygons (dense verts in some areas, sparse in others)
- Produces balanced geometry regardless of total vertex count ratio

**Future: Per-segment options**

The subdivision behavior can be customized with options:
- `threshold`: minimum vertices to trigger subdivision (default: 3)
- `maxPerEdge`: cap on intermediate points per edge (default: unlimited)
- `enabled`: turn subdivision on/off entirely

These could be exposed per-segment for multi-floor buildings where different transitions
need different tessellation density.