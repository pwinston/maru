# Segment Locking Algorithm

## Purpose

When editing a multi-floor building, the loft algorithm recomputes vertex correspondence between floors on every edit. This can cause the mesh topology to "jump" as vertices get matched differently.

**Locking** freezes a segment's topology so that:
1. Which vertices connect to which faces stays fixed
2. But vertex positions can still be edited (dragging in 2D sketch)

## Current Implementation (v9)

### Data Flow

```
User edits sketch vertex
       ↓
rebuildLoft() called
       ↓
LoftableModel.fromPlanes() checks each segment:
  - If locked: preserve old segment object (topology frozen)
  - If unlocked: run perimeterWalkAlgorithm() to rebuild
       ↓
For locked segments: call updatePositionsFromSketches()
       ↓
Rebuild THREE.js mesh from faces
```

### Key Data Structure: VertexSource

Each face vertex stores where it came from:

```typescript
interface VertexSource {
  loop: 'A' | 'B'        // 'A' = bottom sketch, 'B' = top sketch
  originalIndex: number  // Index in original sketch, or -1 if interpolated
}

interface LoftFace {
  vertices: Vector3[]    // 3D positions (3 for triangle, 4 for quad)
  sources: VertexSource[] // One per vertex
}
```

### Position Update (updatePositionsFromSketches)

When locked, topology stays same but positions update:

```typescript
for (const face of this.faces) {
  for (let i = 0; i < face.vertices.length; i++) {
    const { loop, originalIndex } = face.sources[i]

    if (originalIndex >= 0) {
      // Original vertex - update from current sketch
      const sketch = (loop === 'A') ? bottomSketch : topSketch
      const vert2D = sketch.vertices[originalIndex]
      face.vertices[i].set(vert2D.x, vert2D.y, height)
    }
    // Interpolated vertices (originalIndex === -1): keep old position
  }
}
```

### Why originalIndex Tracking is Needed

The loft algorithm transforms input vertices:
1. **Winding normalization**: Ensures CCW winding
2. **Adaptive subdivision**: Adds interpolated vertices on long edges
3. **Loop rotation**: Rotates loop B so vertex 0 aligns with loop A's vertex 0

So "processed index 5" might correspond to "original sketch index 2" (or might be interpolated).

The `originalIndex` is computed during face building and baked directly into each `VertexSource`.

---

## Alternative Approach: Two Data Structures

A cleaner architecture would separate "dynamic loft" from "frozen snapshot":

### 1. Dynamic Loft (unlocked segments)

Just the faces, rebuilt from scratch each time:

```typescript
interface DynamicSegment {
  bottomPlane: SketchPlane
  topPlane: SketchPlane
  faces: LoftFace[]  // No source tracking needed!
}
```

### 2. Frozen Snapshot (locked segments)

When user locks a segment, capture a snapshot:

```typescript
interface FrozenVertex {
  position: Vector3           // Current 3D position
  sketch: 'bottom' | 'top'    // Which sketch this vertex follows
  sketchIndex: number         // Index in that sketch (-1 if interpolated)
}

interface FrozenFace {
  vertices: FrozenVertex[]    // 3 or 4 vertices
}

interface FrozenSegment {
  bottomPlane: SketchPlane
  topPlane: SketchPlane
  faces: FrozenFace[]
}
```

### Locking Workflow

```
User clicks "Lock" on segment
       ↓
Create FrozenSegment from current DynamicSegment:
  - For each face vertex:
    - Copy position
    - Determine which sketch it came from (by Z height)
    - Find nearest sketch vertex (or mark as interpolated)
       ↓
Store FrozenSegment, discard DynamicSegment
```

### Position Update (frozen)

```typescript
function updateFrozenPositions(frozen: FrozenSegment): void {
  const bottomVerts = frozen.bottomPlane.getSketch().getVertices()
  const topVerts = frozen.topPlane.getSketch().getVertices()

  for (const face of frozen.faces) {
    for (const v of face.vertices) {
      if (v.sketchIndex >= 0) {
        const verts = (v.sketch === 'bottom') ? bottomVerts : topVerts
        const height = (v.sketch === 'bottom') ? bottomHeight : topHeight
        const vert2D = verts[v.sketchIndex]
        v.position.set(vert2D.x, vert2D.y, height)
      }
    }
  }
}
```

### Unlocking Workflow

```
User clicks "Unlock" on segment
       ↓
Discard FrozenSegment
       ↓
Run perimeterWalkAlgorithm() to create fresh DynamicSegment
       ↓
Topology may change (vertices may reconnect differently)
```

---

## Comparison

| Aspect | Current (v9) | Two Data Structures |
|--------|--------------|---------------------|
| Loft algorithm | Must track originalIndex | Pure geometry, no tracking |
| LoftFace | Has `sources` array | Just `vertices` |
| Locked segment | Same type as unlocked | Different type (FrozenSegment) |
| Complexity | Tracking baked into algorithm | Separate concerns |
| Lock operation | Set boolean flag | Convert to different type |

### Pros of Two Data Structures

1. **Cleaner loft algorithm**: No need to track origins during face building
2. **Explicit state**: Type system enforces locked vs unlocked behavior
3. **Simpler LoftFace**: No `sources` array when not needed
4. **Snapshot semantics**: Clear that locking captures a moment in time

### Cons of Two Data Structures

1. **More code**: Two types to maintain
2. **Conversion logic**: Need to map dynamic faces to frozen faces at lock time
3. **Finding sketch index**: At lock time, need to determine which sketch vertex each face vertex corresponds to (could use distance heuristic or track during build)

---

## Interpolated Vertices

Both approaches must handle interpolated vertices (added by adaptive subdivision):

**Current approach**: Keep old position (doesn't move with edits)

**Better approach**: Store the edge endpoints and interpolation factor:

```typescript
interface FrozenVertex {
  position: Vector3
  source:
    | { type: 'original'; sketch: 'bottom' | 'top'; index: number }
    | { type: 'interpolated'; sketch: 'bottom' | 'top'; edgeStart: number; edgeEnd: number; t: number }
}
```

Then interpolated vertices can be recomputed:
```typescript
if (v.source.type === 'interpolated') {
  const p0 = verts[v.source.edgeStart]
  const p1 = verts[v.source.edgeEnd]
  const t = v.source.t
  v.position.set(
    p0.x + t * (p1.x - p0.x),
    p0.y + t * (p1.y - p0.y),
    height
  )
}
```

This ensures interpolated vertices stay on their edge as the edge endpoints move.
