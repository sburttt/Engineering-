/** Small line icons drawn on a 16-unit grid with a 1.25 stroke, to match the hairline interface. */
const PATHS: Record<string, string> = {
  expand: 'M2.5 6V2.5H6 M10 2.5h3.5V6 M13.5 10v3.5H10 M6 13.5H2.5V10',
  collapse: 'M6 2.5V6H2.5 M13.5 6H10V2.5 M10 13.5V10h3.5 M2.5 10H6v3.5',
  close: 'M3.5 3.5l9 9 M12.5 3.5l-9 9',
  menu: 'M2.5 5h11 M2.5 11h11',
  plus: 'M8 3v10 M3 8h10',
  minus: 'M3 8h10',
  reset: 'M3.2 6.2A5 5 0 1 1 3 9.5 M3 2.8v3.6h3.6',
  index: 'M2.5 4h1 M6 4h7.5 M2.5 8h1 M6 8h7.5 M2.5 12h1 M6 12h7.5',
  sliders: 'M2.5 5h6 M11.5 5h2 M2.5 11h2 M7.5 11h6 M10 3.2v3.6 M6 9.2v3.6',
  focus: 'M8 2v2.5 M8 11.5V14 M2 8h2.5 M11.5 8H14 M8 5.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5',
  back: 'M9.5 3.5L5 8l4.5 4.5',
  arrow: 'M3 8h10 M9 4l4 4-4 4',
};

export function Icon({ name, size = 16 }: { name: keyof typeof PATHS | string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.25} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={PATHS[name]} />
    </svg>
  );
}
