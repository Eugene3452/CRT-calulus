/* Jeu d'icônes SVG minimalistes (trait 1,7 — 24 × 24). */

const p = (d, extra = '') =>
  `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"${extra}/></svg>`;

export const icons = {
  gauge: p('M4 18a8 8 0 1 1 16 0M12 18l4.5-4.5M7 18h10'),
  torsion: p('M5 6c0-2 2-3 3.5-1.5S11 8 12 6s2.5-3 4 0M5 12c0-2 2-3 3.5-1.5S11 14 12 12s2.5-3 4 0M5 18c0-2 2-3 3.5-1.5S11 20 12 18s2.5-3 4 0'),
  width: p('M3 8v8M21 8v8M3 12h18M6 9l-3 3 3 3M18 9l3 3-3 3'),
  span: p('M3 17h18M5 17V9m14 8V9M5 9c4 4 10 4 14 0M5 6v3m14-3v3'),
  class: p('M4 20V9l8-5 8 5v11M9 20v-6h6v6M4 20h16'),
  road: p('M4 20 8 4m12 16L16 4M12 5v2m0 3v2m0 3v2m0 3v1'),
  truck: p('M3 16V7h10v9M13 10h4l3 3v3M6 19a1.7 1.7 0 1 0 0-3.4A1.7 1.7 0 0 0 6 19Zm11 0a1.7 1.7 0 1 0 0-3.4 1.7 1.7 0 0 0 0 3.4ZM3 16h16'),
  tandem: p('M3 17h18M5 17V8h5v9M14 17V8h5v9M5 11h5m4 0h5'),
  chart: p('M3 20h18M5 20V9m5 11V5m5 15v-8m5 8V7'),
  table: p('M4 4h16v16H4zM4 9h16M4 15h16M9 4v16M15 4v16'),
  info: p('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-9v5m0-8v.5'),
  warn: p('M12 4 2.8 20h18.4L12 4Zm0 5v5m0 3v.5'),
  check: p('m4 12.5 5 5L20 6.5'),
  download: p('M12 4v11m0 0 4-4m-4 4-4-4M4 19h16'),
  print: p('M7 8V3h10v5M7 17H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M7 14h10v7H7z'),
  beam: p('M4 6h16v4H4zM8 10v9m8-9v9M6 19h4m4 0h4'),
  slab: p('M3 7h18v3H3zM6 10v8m12-8v8M4 18h16'),
  target: p('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-4a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0-4a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z'),
  layers: p('m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 17l9 5 9-5'),
  arrow: p('M4 12h16m0 0-6-6m6 6-6 6'),
};

export const icon = (name) => icons[name] || '';
