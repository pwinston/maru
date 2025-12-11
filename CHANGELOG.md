# AI Usage

I used ChatGPT during the planning phase and Claude Code during development.

I've been experimenting with Claude Code for several months so I knew it would
be the right tool for this task. I've done Claude Code wrongly enough now, I've
learned a pretty good flow:

1. Use Claude Code to generate the next step quickly.
2. Iterate until functional, if needed, make sure it works fully.
3. Examine the code closely and refactor by hand or with Claude Code.
4. Go to step 1.

Also commit often so if you make a change that doesn't work out you can easily
revert it. For this project I'm using branches like this:

1. `dev` is rapid iteration with Claude Code.
2. PRs into `main` only when well-understood and cleaned up.

# Planning

I created README.md and wrote my version of the spec/requirements. I used
ChatGPT to discuss which libraries to use and what the general UI should look
like. I added all decisions to the README.

# PRs

[PR #1](https://github.com/pwinston/maru/pull/1) - Split Screen: 3D viewport on left, 2d sketch view on right  
1. Initial split-screen view
2. 3D Viewport on the left for planes and loft
3. 2D Viewport on the right for editing sketches
![](images/01.jpg)

[PR #2](https://github.com/pwinston/maru/pull/2) - Three hard-coded planes with picking/selection  
1. 3D view: show 3 hard-coded sketches, just different sized squares
2. 3D view: orbit controls + left-click for picking/selection 
3. Sketch view: shows the selected hard-coded sketch
![](images/02.jpg)

[PR #3](https://github.com/pwinston/maru/pull/3) - Simple sketch editing  
1. Introduce `Sketch` class, the polygon itself
2. `SketchEditor` can now move vertices around
3. Add `Bounds` class as cleanup
4. Improve `PlaneSelector` and have 3 colors: normnal, hover, and selected
![](images/03.jpg)

[PR #4](https://github.com/pwinston/maru/pull/4) - Ability to Add and Delete vertexes  
1. Modify `Sketch` and `SketchEditor` so we can add/delete vertices
2. Add mouse-wheel-zoom to `SketchEditor`
![](images/04.jpg)

[PR #5](https://github.com/pwinston/maru/pull/5) - 3D: Add, move and delete planes. 2D: detect self-intersections.
1. 3D: Drag planes to move them in Z
2. 3D: Add planes by dragging base upward
3. 3D: Delete planes by dragging planes below ground, turns red, let go
4. 2D: Detect self-intersections, dragged vert turns red, drop red vert to delete
4. 2D: New `Geometry.ts` file

Also re-organized code, added subdirectories under src: 2d, 3d, util
![](images/05.jpg)