# Maru

CAD-like tool to create, visualize and interactively edit "lofted" shapes in three.js.

## Specification

### Creating a loft

- The user sketches two or more 2D profiles.
- Each profile is a closed non-crossing polygon with vertices and straight lines between them.
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
│   └── Loft.ts                  # 3D surface connecting sketch planes
│
├── loft/
│   ├── LoftAlgorithms.ts        # Algorithm registry (register/get by name)
│   ├── makeLoftable.ts          # Entry point: makeLoftable(planes, algorithm?)
│   ├── UniformResampleAlgorithm.ts   # Simple arc-length resampling
│   └── AnchorResampleAlgorithm.ts    # Anchor-based chunk resampling
│
└── util/
    ├── Geometry.ts              # Polygon math (area, winding, resampling, intersection)
    ├── Bounds.ts                # 2D axis-aligned bounding box
    ├── GridHelper.ts            # Grid line rendering
    ├── HelpBar.ts               # Legacy help bar (deprecated)
    └── HelpPanel.ts             # Keyboard shortcut help overlay
```