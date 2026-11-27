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
npm run check:geometry # internals inside the skin, no see-through holes, markings on the skin
npm run test:e2e -- 'http://127.0.0.1:4173/?render=low' e2e-shots   # 96 browser checks + screenshots (preview server running)
```

Requires Node 20+. The end-to-end script uses Playwright with Chromium (it falls back to a global install).

## What is in it

The site opens directly on the aircraft. The viewer is the home page; the other pages are short editorial documents.

| Page | What you can do |
| --- | --- |
| Aircraft | Orbit / zoom / pan; seven presets (01 Front … 06 Detail, 07 Under); six render modes drawn from one model: Realistic, Transparent, Wireframe (hidden-line CAD edges and surface isoparms), Blueprint (navy sheet, long lens, dimension guides, title block), Illustration (white sheet, pencil-shaded surfaces with the structure drawn through the skin) and Flow field (illustrative aerodynamic surface colour ramp with drifting flow arrows, no CFD data); a module-release sequence in the open bay (non-weapon module leaving the rails with trailing positions); configurations Closed, Cutaway and Bay open; nine exploded assemblies with ID-numbered callouts; click any part for its NF-number, a leader-line callout and a description; Focus view, Isolate; a 58-second, five-scene cinematic presentation with a scrubbable timeline; a 31-second showcase reel (realistic → transparent → flow field → illustration → bay and pod release → reveal) with captured-frame transitions and a frame-exact video exporter; full-screen inspection (F). |
| Overview | Technical overview: design philosophy, configuration notes linked to the 3D parts, drawings, finish concept, what can and cannot be measured, how to use the viewer |
| Autonomy | Clickable 9-layer architecture, autonomy levels, capability matrix, safety mechanisms, synthetic scenario simulator with human authorisation and audit log |
| Specification | Spec tables by category, plus plan / side / front views computed from the model geometry |
| Research | 14 public-source references with labelled claims, filters and a comparison matrix |

Keys in the viewer: 1–7 presets · R reset view · F full-screen inspection · W wireframe · B blueprint · I illustration · A flow field · X systems separation (Transparent) · +/− zoom · Space pauses the presentation · Esc steps back.

## Rendering notes

- Every skin patch shades with an analytic normal from the shared mould-line functions, so patch joints are invisible.
- Panel lines are thin dark ribbons lying on the surface (not wireframe lines) and are never clickable.
- Finish: coated graphite composite (low metalness, satin clear coat) with a faint world-space roughness variation.
- Studio lighting from soft light cards (no external HDR files), a shadow-casting key light and contact shadows.
- Wireframe and blueprint use hidden-line drawing: surfaces write depth only, feature edges (`EdgesGeometry`, 28°) and isoparametric curves generated from the mould-line functions are drawn on top.
- Exploded assemblies (`src/data/assemblies.ts`, `src/aircraft/assemblyOffsets.ts`) separate along directions derived from the geometry, never at random; the cinematic timeline (`src/aircraft/cinema.ts`) is a pure function of time.
- The white-sheet looks (`src/aircraft/paper.ts`, `src/data/sheets.ts`) use flat paper materials and plain hemisphere light; the flow colour ramp is a function of position only and claims no pressure or velocity data.
- Component ID numbers (NF-1xx exterior, 3xx interior, 4xx autonomy, 5xx equipment, 7xx access) are generated in `src/data/assemblies.ts`.
- `?render=low` lowers resolution and turns shadows off; the automated tests use it on software GL.

## Promo stills

`?promo` renders the real model as a studio product shot: white seamless background, gear retracted,
soft grounding shadow, no interface (`src/aircraft/promo.ts`). Variants: `?promo` (front three-quarter,
port side), `?promo=starboard`, `?promo=low`. Open it in a browser at the size you want and take a
screenshot, or render headlessly with Playwright at any resolution.

## Showcase reel

A fast 31.5-second edit of the existing looks, for promo cuts (`src/aircraft/reel.ts`). Start it from
the rail (**Showcase reel · 0:31**) or open `?reel` (no interface; `?reel=clean` also drops the scene
labels). Same model, same parts, same motions as the viewer; the reel only sequences them.

| # | Time | Look | What happens |
|---|---|---|---|
| 01 | 0:00–4.6 | Realistic | Low front three-quarter, pulling out and turning; no text |
| 02 | 4.6–7.8 | Transparent | Scan-line hand-over; the orbit continues over the top while the systems lift slightly |
| 03 | 7.8–11.0 | Flow field | Scan from the other side; drifting flow arrows, labelled illustrative (not CFD) |
| 04 | 11.0–19.4 | Illustration | Dissolve; whole aircraft, then nose and outer wing with short callouts |
| 05 | 19.4–26.2 | Illustration | Low starboard view: bay doors open, the Atmospheric Survey Pod (non-weapon research module) leaves the rails with trailing positions |
| 06 | 26.2–31.5 | Realistic | Scan back to the studio look; NIGHTFALL / Corvane end card |

Look changes are real hand-overs, not cuts: at each change the outgoing look is rendered once more
and copied to an overlay canvas, which is then wiped away by a fine scan line or dissolved
(`TransitionLayer` in `CinemaOverlay.tsx`, capture in `CinemaDriver`). There is no audio and nothing is
timed to a soundtrack; the scene boundaries above are the natural cut points for music.

**Export to video** (frame-exact, independent of render speed; needs ffmpeg):

```bash
npm run build && npx vite preview --port 4173 &
node scripts/export-reel.mjs                                   # reel/nightfall-reel-1080p.mp4 (1920×1080, 30 fps)
node scripts/export-reel.mjs --size 1080x1350 --out reel/nightfall-reel-4x5.mp4
node scripts/export-reel.mjs --clean --fps 24                  # no labels, 24 fps
node scripts/export-reel.mjs --at 2,9,23 --out reel/frames     # stills
```

The exporter opens `?reel&export`, which stops the render loop; `__nightfall.step(t)` renders exactly
one frame per timestep.

## Where things live

- Entry point: `src/main.tsx` → `src/app/App.tsx`
- Airframe definition (coordinate system, planform, surface heights): `src/aircraft/geometry/airframe.ts`
- Mesh construction for every named part: `src/aircraft/parts.ts` (helpers in `geometry/builders.ts`)
- 3D scene, lights, camera rig, presets: `src/aircraft/AircraftScene.tsx`, `src/aircraft/presets.ts`
- Cinematic programmes: `src/aircraft/cinema.ts` (presentation), `src/aircraft/reel.ts` (showcase reel), shared shot/easing vocabulary in `src/aircraft/timeline.ts`; exporter `scripts/export-reel.mjs`
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
