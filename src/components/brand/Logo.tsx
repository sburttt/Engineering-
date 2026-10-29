import { EMBLEM, polyPoints } from '../../data/brand';

/** Compact emblem: forward chevron split by a horizon line, with a nested vane. Works mono or two-tone. */
export function Emblem({ size = 28, mono = false, title = 'Corvane emblem' }: { size?: number; mono?: boolean; title?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={title}>
      <polygon points={polyPoints(EMBLEM.outerUpper)} fill="currentColor" />
      <polygon points={polyPoints(EMBLEM.outerLower)} fill="currentColor" opacity={mono ? 1 : 0.62} />
      <polygon points={polyPoints(EMBLEM.vaneUpper)} fill={mono ? 'currentColor' : 'var(--accent)'} />
      <polygon points={polyPoints(EMBLEM.vaneLower)} fill={mono ? 'currentColor' : 'var(--accent)'} opacity={0.62} />
    </svg>
  );
}

export function Wordmark({ size = 28 }: { size?: number }) {
  return (
    <span className="brand" aria-label="Corvane Aerosystems">
      <Emblem size={size} />
      <span>
        <div className="brand-name">CORVANE</div>
        <div className="brand-sub">AEROSYSTEMS</div>
      </span>
    </span>
  );
}
