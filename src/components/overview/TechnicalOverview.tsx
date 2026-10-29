import { useStore } from '../../state/store';
import { BRAND } from '../../data/brand';
import { DIMENSIONS, MATURITY, NOT_ESTABLISHED } from '../../data/aircraft';
import { TopView, SideView } from '../specifications/ThreeView';
import { Icon } from '../viewer/Icon';

/** Visible features of the model, each linked to the part in the 3D viewer. */
const FEATURES: { id: string; title: string; text: string }[] = [
  {
    id: 'fwd-fuselage',
    title: 'Ogive chined nose',
    text: 'The nose is one smooth ogive in plan. Its sharp side chine runs back without a break into the wing leading edge, and the whole forward section droops slightly.',
  },
  {
    id: 'ctr-body',
    title: 'Blended centre body',
    text: 'The body is not a tube with wings attached. It is a thickened region of the same surface, and it fades into the outer wings without a visible join.',
  },
  {
    id: 'fairing',
    title: 'Dorsal propulsion fairing',
    text: 'A low spine carries the engine above the wing. Its raked inlet sits behind the nose and is out of sight from below.',
  },
  {
    id: 'exhaust',
    title: 'Slot exhaust',
    text: 'The exhaust is a flattened slot set into the straight centre section of the trailing edge, between the two aft notches.',
  },
  {
    id: 'wing-stbd',
    title: 'Cranked outer wing',
    text: 'The outer wing is swept at about 40°. Its trailing edge follows a sawtooth whose outboard segments run parallel to each other.',
  },
  {
    id: 'tip-stbd',
    title: 'Drooped tip blades',
    text: 'The last 0.8 m of each wing curves gently downward. This is the most recognisable Nightfall cue when seen from the front.',
  },
  {
    id: 'elevon-stbd-out',
    title: 'Four elevons',
    text: 'Two hinged surfaces on each wing replace a tail. They are shown on a common hinge line, and you can move them in the viewer.',
  },
  {
    id: 'bay-doors',
    title: 'Ventral equipment bay',
    text: 'A single bay sits under the centre body and takes non-weapon research modules on common rails.',
  },
];

export function TechnicalOverview() {
  const setTab = useStore((s) => s.setTab);
  const select = useStore((s) => s.select);
  const setMode = useStore((s) => s.setMode);
  const show = (id: string) => {
    setTab('aircraft');
    if (id === 'bay-doors') setMode('payload');
    else setMode('exterior');
    // let the viewer become visible before the camera moves
    requestAnimationFrame(() => select(id, { fly: true }));
  };

  return (
    <article className="doc overview-doc">
      <div className="doc-inner">
        <header className="doc-head">
          <span className="eyebrow">Technical overview</span>
          <h1>Nightfall, a visual design study</h1>
          <p>
            Nightfall (CX-7) is a concept for an uncrewed, tailless research aircraft by {BRAND.name}. The aircraft, the company and
            every description on this site are fictional. This page sets out what the model is, what it is trying to say through its
            shape, and which numbers can be read from it. It also says plainly which numbers do not exist.
          </p>
        </header>

        <dl className="status-strip">
          <div>
            <dt>Configuration</dt>
            <dd>Conceptual: tailless, blended, uncrewed</dd>
          </div>
          <div>
            <dt>Nature of the work</dt>
            <dd>Visual design study</dd>
          </div>
          <div>
            <dt>Format</dt>
            <dd>Interactive 3D prototype</dd>
          </div>
          <div>
            <dt>Maturity</dt>
            <dd>{MATURITY.toLowerCase().replace('conceptual demonstrator — ', 'Concept — ')}</dd>
          </div>
        </dl>

        <section className="doc-sec">
          <h2>
            <span className="sec-n">01</span>Design philosophy
          </h2>
          <div className="doc-cols">
            <p className="lead">
              “{BRAND.tagline}” Nightfall is shaped as one continuous surface. One planform and one height definition generate the
              nose, the body and the wings together, so nothing reads as attached afterwards.
            </p>
            <ul className="plain">
              <li>
                <b>Coordinated edges.</b> The leading edges, trailing-edge segments and major panel boundaries are designed as one
                family of angles, not set independently.
              </li>
              <li>
                <b>No cockpit, no tail.</b> The aircraft is uncrewed, so there is no canopy. Elevons do the work of a tail, which leaves
                the upper surface uninterrupted.
              </li>
              <li>
                <b>Built to be opened.</b> Every major internal module sits behind its own access panel. A single ventral bay takes
                interchangeable research equipment.
              </li>
            </ul>
          </div>
        </section>

        <section className="doc-sec">
          <h2>
            <span className="sec-n">02</span>Configuration
          </h2>
          <p className="sec-intro">
            These observations come from the model itself, and each one links to the part in the viewer. They describe form, not
            performance.
          </p>
          <ol className="features">
            {FEATURES.map((f) => (
              <li key={f.id}>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
                <button className="txt-btn" onClick={() => show(f.id)}>
                  Show in 3D <Icon name="arrow" />
                </button>
              </li>
            ))}
          </ol>
        </section>

        <section className="doc-sec">
          <h2>
            <span className="sec-n">03</span>Drawings
          </h2>
          <p className="sec-intro">
            Plan and profile views drawn from the same functions that generate the 3D surfaces, so they cannot disagree with the
            model.
          </p>
          <div className="drawings">
            <figure>
              <TopView />
              <figcaption>Plan view, nose up</figcaption>
            </figure>
            <figure>
              <SideView />
              <figcaption>Profile on the centreline, gear extended</figcaption>
            </figure>
          </div>
        </section>

        <section className="doc-sec">
          <h2>
            <span className="sec-n">04</span>Material and finish
          </h2>
          <div className="doc-cols">
            <p className="lead">
              The finish is a deep graphite coated composite, presented as a pristine prototype. It is never pure black, so the
              shape stays readable in shadow.
            </p>
            <ul className="plain">
              <li>
                <b>Main skins.</b> Satin graphite with a low-gloss clear coat and almost no metallic response, like painted
                composite rather than bare metal.
              </li>
              <li>
                <b>Radome, elevons, fairing.</b> The same colour with a slightly smoother sheen, so major assemblies separate under
                light without becoming patchy.
              </li>
              <li>
                <b>Apertures.</b> Flush smoked glass for the sensor windows: reflective, but not transparent and not emissive.
              </li>
              <li>
                <b>Markings.</b> A small number of stencils: the Corvane mark, the airframe serial, no-step and intake-area warnings.
              </li>
            </ul>
          </div>
        </section>

        <section className="doc-sec">
          <h2>
            <span className="sec-n">05</span>What can and cannot be measured
          </h2>
          <div className="measure">
            <div>
              <h3 className="cp-h">Read from the 3D model</h3>
              <dl className="kv big">
                <dt>Length</dt>
                <dd className="tnum">{DIMENSIONS.length.toFixed(1)} m</dd>
                <dt>Span</dt>
                <dd className="tnum">{DIMENSIONS.span.toFixed(1)} m</dd>
                <dt>Height, gear down</dt>
                <dd className="tnum">{DIMENSIONS.height.toFixed(2)} m</dd>
                <dt>Planform area</dt>
                <dd className="tnum">≈ {DIMENSIONS.planformArea} m²</dd>
              </dl>
              <p className="note">These are measurements of a concept model, not engineering data.</p>
            </div>
            <div>
              <h3 className="cp-h">{NOT_ESTABLISHED}</h3>
              <ul className="na">
                {['Speed', 'Range and endurance', 'Service ceiling', 'Engine thrust', 'Mass and payload', 'Radar cross-section and signature', 'Sensor performance', 'Production status'].map((k) => (
                  <li key={k}>
                    <span>{k}</span>
                    <span>—</span>
                  </li>
                ))}
              </ul>
              <p className="note">No figures are given for any of these. The project is a visualisation, and filling these lines with invented numbers would misrepresent it.</p>
            </div>
          </div>
        </section>

        <section className="doc-sec">
          <h2>
            <span className="sec-n">06</span>Using the viewer
          </h2>
          <div className="doc-cols">
            <p className="lead">The viewer is the main part of this project. It is built for close inspection rather than display.</p>
            <dl className="kv howto">
              <dt>Orbit</dt>
              <dd>Drag with one finger or the left mouse button</dd>
              <dt>Zoom</dt>
              <dd>Scroll or pinch; the view stays centred on the aircraft</dd>
              <dt>Pan</dt>
              <dd>Right-drag or two-finger drag</dd>
              <dt>Views</dt>
              <dd>Hero, Front, Side, Top, Rear, Under (keys 1–6), R to reset</dd>
              <dt>Inspect</dt>
              <dd>Select a part, then use Focus view; Esc returns</dd>
              <dt>Modes</dt>
              <dd>Exterior, Cutaway, Systems (with exploded view) and Payload</dd>
              <dt>Full screen</dt>
              <dd>Inspect, or F</dd>
            </dl>
          </div>
          <button className="cta" onClick={() => setTab('aircraft')}>
            Open the viewer <Icon name="arrow" />
          </button>
        </section>

        <p className="disclaimer">
          {BRAND.name} ({BRAND.founded}), the CX-7 and Nightfall are fictional. This is concept art and design exploration. It is not an
          aircraft programme, it is not validated engineering, and no shape or detail here is presented as a functional or
          signature-reducing design.
        </p>
      </div>
    </article>
  );
}
