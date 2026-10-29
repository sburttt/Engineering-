# Corvane CX-7 NIGHTFALL — interactive concept viewer

An original, **fictional** uncrewed aerospace demonstrator presented as a real-time 3D engineering design review.
Corvane Aerosystems, the CX-7 and every specification here are invented. The concept is **not flight validated**
and is not an engineering design.

> CONCEPTUAL DEMONSTRATOR — NOT FLIGHT VALIDATED

## Run it

```bash
npm install
npm run dev            # http://localhost:5173
npm run build          # type-check + production build → dist/
npm run build:single   # one self-contained HTML file → artifact/nightfall.html
npm run validate       # data-integrity checks (no browser)
npm run test:e2e -- 'http://127.0.0.1:4173/?render=low' e2e-shots   # 69 browser checks + screenshots (preview server running)
```

Requires Node 20+. The end-to-end script uses Playwright with Chromium (it falls back to a global install).

## What is in it

The site opens directly on the aircraft. The viewer is the home page; the other pages are short editorial documents.

| Page | What you can do |
| --- | --- |
| Aircraft | Orbit / zoom / pan, six presets (Hero, Front, Side, Top, Rear, Under), click any part for a compact information panel, Focus view (returns to your previous camera), Isolate, a component index, and four modes: Exterior, Cutaway, Systems (with exploded view) and Payload (swap six non-weapon modules). **Inspect** (or F) opens a full-screen inspection mode. |
| Overview | Technical overview: design philosophy, configuration notes linked to the 3D parts, drawings, finish concept, what can and cannot be measured, how to use the viewer |
| Autonomy | Clickable 9-layer architecture, autonomy levels, capability matrix, safety mechanisms, synthetic scenario simulator with human authorisation and audit log |
| Specification | Spec tables by category, plus plan / side / front views computed from the model geometry |
| Research | 14 public-source references with labelled claims, filters and a comparison matrix |

Keys in the viewer: 1–6 presets · R reset view · F full-screen inspection · X exploded view (Systems) · +/− zoom · Esc steps back.

## Rendering notes

- Every skin patch shades with an analytic normal from the shared mould-line functions, so patch joints are invisible.
- Panel lines are thin dark ribbons lying on the surface (not wireframe lines) and are never clickable.
- Finish: coated graphite composite (low metalness, satin clear coat) with a faint world-space roughness variation.
- Studio lighting from soft light cards (no external HDR files), a shadow-casting key light and contact shadows.
- `?render=low` lowers resolution and turns shadows off; the automated tests use it on software GL.

## Where things live

- Entry point: `src/main.tsx` → `src/app/App.tsx`
- Airframe definition (coordinate system, planform, surface heights): `src/aircraft/geometry/airframe.ts`
- Mesh construction for every named part: `src/aircraft/parts.ts` (helpers in `geometry/builders.ts`)
- 3D scene, lights, camera rig, presets: `src/aircraft/AircraftScene.tsx`, `src/aircraft/presets.ts`
- Viewer interface (modes, presets, caption, focus bar): `src/components/viewer/ViewerChrome.tsx`
- Component information panel: `src/components/inspection/Inspector.tsx` · Index: `src/components/layout/SystemsTree.tsx`
- Technical overview page: `src/components/overview/TechnicalOverview.tsx`
- Selection / highlight / cutaway / explode logic per part: `src/aircraft/AircraftModel.tsx`
- Component metadata (59 records): `src/data/components.ts`
- Specifications: `src/data/aircraft.ts` · Equipment modules: `src/data/equipmentModules.ts`
- Autonomy architecture and scenarios: `src/data/autonomy.ts`
- Research library and source URLs: `src/data/research.ts`
- Brand: `src/data/brand.ts`, `src/components/brand/Logo.tsx`
- App state (Zustand): `src/state/store.ts`

## Coordinate system

`+X` forward (nose), `+Y` up, `+Z` starboard; metres; origin on the centreline near mid-length.
Ground (gear extended) is at `Y = -1.75`. Picking, camera fitting, clipping and explode offsets all use this frame.

## Stack

React 19 · TypeScript · Three.js · React Three Fiber · Drei · Zustand · Vite. Everything is generated locally;
no external models, textures or API keys. Research links are plain hyperlinks and the app works offline without them.

## Content rules followed

- Facts, interpretations and fictional decisions carry separate labels.
- No classified figures, signature-reduction implementation detail, weapons, targeting or operational tactics.
- Equipment bay modules are non-weapon (survey, mapping, relay, science, test, inert mass).
- The autonomy simulator uses synthetic data only and is not connected to anything.
