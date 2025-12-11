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

## Implementation

### 3D Viewport
- **Viewport3D.ts** – the 3D scene with orbit controls  
- **PlaceSelector.ts** – handles hover and click on planes  
- **SketchPlane.ts** – 3D plane, renders the 2D sketch  

### 2D Sketch Editor
- **SketchEditor.ts** – mouse controls to drag vertices around  
- **Sketch.ts** – the 2D sketch: vertices and lines  
