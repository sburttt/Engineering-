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
npm run test:e2e -- http://127.0.0.1:5173/ e2e-shots   # browser checks + screenshots (dev server running)
```

Requires Node 20+. The end-to-end script uses Playwright with Chromium (it falls back to a global install).

## What is in it

| Section | What you can do |
| --- | --- |
| Overview | Brand, concept statement, design priorities, live rotating model |
| Exterior | Orbit / zoom / pan, 9 camera presets, click any part, enlarge, isolate, elevon pitch/roll sliders |
| Cutaway | Starboard upper shell clipped away to show the internal layout |
| Internal systems | Shell ghosted; every module, frame, spar and rib is selectable |
| Autonomy | Clickable 9-layer architecture, autonomy levels, capability matrix, safety mechanisms, synthetic scenario simulator with human authorisation and audit log |
| Equipment bay | Bay doors open; swap between six non-weapon mission modules |
| Specifications | Spec tables by category, plus plan / side / front views computed from the model geometry |
| Research library | 14 public-source references with labelled claims, filters and a comparison matrix |

## Where things live

- Entry point: `src/main.tsx` → `src/app/App.tsx`
- Airframe definition (coordinate system, planform, surface heights): `src/aircraft/geometry/airframe.ts`
- Mesh construction for every named part: `src/aircraft/parts.ts` (helpers in `geometry/builders.ts`)
- 3D scene, lights, camera rig, presets: `src/aircraft/AircraftScene.tsx`, `src/aircraft/presets.ts`
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
