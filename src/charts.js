/* Rendu SVG des schémas et de la ligne d'influence. */

export const nf = (v, d = 2) =>
  Number.isFinite(v)
    ? new Intl.NumberFormat('fr-FR', {
        minimumFractionDigits: d,
        maximumFractionDigits: d,
      }).format(v)
    : '—';

export const nf0 = (v) =>
  Number.isFinite(v)
    ? new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(v)
    : '—';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ------------------------------------------------------------------ */
/* Coupe transversale                                                  */
/* ------------------------------------------------------------------ */

export function crossSectionSVG(project, selectedIndex = 0) {
  const { b, n, b0, bf, ba, hp, hd, Ltr, props } = project.base;
  const W = 1000;
  const H = 300;
  const ml = 66;
  const mr = 66;
  const sx = (x) => ml + ((x + b) / (2 * b)) * (W - ml - mr);
  const sxScale = (W - ml - mr) / (2 * b);
  const beamBottom = 214;
  const scaleY = 108 / Math.max(hp, 0.8);
  const slabTop = beamBottom - hp * scaleY;
  const slabH = hd * scaleY;
  const sidewalkH = Math.min(30, 0.24 * scaleY + 8);
  const sidewalkTop = slabTop - sidewalkH;

  const parts = [];
  parts.push(`<defs>
    <linearGradient id="deckGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#e8eef8"/><stop offset="1" stop-color="#d7e1ef"/>
    </linearGradient>
    <linearGradient id="beamSel" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0d9488"/><stop offset="1" stop-color="#0f766e"/>
    </linearGradient>
    <linearGradient id="beamGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#94a3b8"/><stop offset="1" stop-color="#64748b"/>
    </linearGradient>
    <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b"/>
    </marker>
  </defs>`);

  // sol / ligne de fond
  parts.push(`<line x1="${ml - 20}" y1="${beamBottom}" x2="${W - mr + 20}" y2="${beamBottom}" class="svg-ground"/>`);

  // trottoirs
  const sideW = Ltr * sxScale;
  for (const side of [-1, 1]) {
    const x = side < 0 ? sx(-b) : sx(b - Ltr);
    parts.push(`<rect x="${x}" y="${sidewalkTop}" width="${sideW}" height="${sidewalkH}" rx="2" class="svg-sidewalk"/>`);
    parts.push(`<line x1="${x}" y1="${sidewalkTop}" x2="${x + sideW}" y2="${sidewalkTop}" class="svg-curb"/>`);
  }

  // hourdis
  parts.push(`<rect x="${sx(-b)}" y="${slabTop}" width="${sx(b) - sx(-b)}" height="${Math.max(4, slabH)}" fill="url(#deckGrad)" stroke="#94a3b8" stroke-width="1"/>`);

  // chaussée
  parts.push(`<line x1="${sx(-b + Ltr)}" y1="${slabTop}" x2="${sx(b - Ltr)}" y2="${slabTop}" class="svg-road"/>`);

  // âmes
  const webTop = slabTop + Math.max(3, slabH);
  const webH = beamBottom - webTop;
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * b0;
    const w = Math.max(5, ba * sxScale);
    const selected = i === selectedIndex;
    parts.push(`<rect x="${sx(x) - w / 2}" y="${webTop}" width="${w}" height="${webH}" rx="1.5" fill="${selected ? 'url(#beamSel)' : 'url(#beamGrad)'}" stroke="${selected ? '#0f766e' : '#475569'}" stroke-width="${selected ? 1.8 : 0.9}"/>`);
    // petit gousset / talon
    parts.push(`<path d="M ${sx(x) - w / 2 - 3} ${beamBottom} L ${sx(x) + w / 2 + 3} ${beamBottom} L ${sx(x) + w / 2} ${beamBottom - 8} L ${sx(x) - w / 2} ${beamBottom - 8} Z" fill="${selected ? '#0f766e' : '#64748b'}"/>`);
    parts.push(`<text x="${sx(x)}" y="${beamBottom + 20}" class="svg-beam-label ${selected ? 'is-selected' : ''}">P${i + 1}</text>`);
  }

  // axe central
  parts.push(`<line x1="${sx(0)}" y1="${slabTop - 18}" x2="${sx(0)}" y2="${beamBottom + 8}" class="svg-center"/>`);

  // cotes
  const dimY1 = beamBottom + 38;
  const dimY2 = beamBottom + 62;
  const x1 = sx(0);
  const x2 = sx(b0);
  parts.push(`<line x1="${x1}" y1="${dimY1}" x2="${x2}" y2="${dimY1}" class="svg-dim"/>`);
  parts.push(`<line x1="${x1}" y1="${dimY1 - 4}" x2="${x1}" y2="${dimY1 + 4}" class="svg-dim"/>`);
  parts.push(`<line x1="${x2}" y1="${dimY1 - 4}" x2="${x2}" y2="${dimY1 + 4}" class="svg-dim"/>`);
  parts.push(`<text x="${(x1 + x2) / 2}" y="${dimY1 - 7}" class="svg-dim-label">b₀ = ${nf(b0)} m</text>`);

  const xa = sx(-b);
  const xb = sx(b);
  parts.push(`<line x1="${xa}" y1="${dimY2}" x2="${xb}" y2="${dimY2}" class="svg-dim" marker-start="url(#arrow)" marker-end="url(#arrow)"/>`);
  parts.push(`<text x="${(xa + xb) / 2}" y="${dimY2 - 7}" class="svg-dim-label">2b = ${nf(2 * b)} m · n = ${n} poutres</text>`);

  // cote trottoir
  const xt1 = sx(-b);
  const xt2 = sx(-b + Ltr);
  parts.push(`<line x1="${xt1}" y1="${sidewalkTop - 12}" x2="${xt2}" y2="${sidewalkTop - 12}" class="svg-dim"/>`);
  parts.push(`<line x1="${xt1}" y1="${sidewalkTop - 16}" x2="${xt1}" y2="${sidewalkTop - 8}" class="svg-dim"/>`);
  parts.push(`<line x1="${xt2}" y1="${sidewalkTop - 16}" x2="${xt2}" y2="${sidewalkTop - 8}" class="svg-dim"/>`);
  parts.push(`<text x="${(xt1 + xt2) / 2}" y="${sidewalkTop - 18}" class="svg-dim-label">Ltr = ${nf(Ltr)} m</text>`);

  // étiquette poutre sélectionnée
  const selX = sx((selectedIndex - (n - 1) / 2) * b0);
  const tagY = slabTop - sidewalkH - 34;
  const tagW = 172;
  parts.push(`<g class="svg-tag">
    <rect x="${selX - tagW / 2}" y="${tagY}" width="${tagW}" height="24" rx="12"/>
    <text x="${selX}" y="${tagY + 16}" text-anchor="middle">Poutre P${selectedIndex + 1} · y = ${nf(Math.abs((selectedIndex - (n - 1) / 2) * b0))} m</text>
  </g>`);
  parts.push(`<line x1="${selX}" y1="${tagY + 24}" x2="${selX}" y2="${slabTop - 4}" class="svg-tag-line"/>`);

  // valeurs
  parts.push(`<text x="${W - mr}" y="24" text-anchor="end" class="svg-note">bf = ${nf(bf)} m · ba = ${nf(ba)} m · hp = ${nf(hp)} m · hd = ${nf(hd)} m</text>`);
  parts.push(`<text x="${ml}" y="24" class="svg-note">Largeur active 2b = n·b₀ = ${nf(2 * b)} m</text>`);

  return `<svg viewBox="0 0 ${W} ${H}" class="cross-svg" role="img" aria-label="Coupe transversale du tablier">${parts.join('')}</svg>`;
}

/* ------------------------------------------------------------------ */
/* Détail de section de poutre                                         */
/* ------------------------------------------------------------------ */

export function beamSectionSVG(project) {
  const { bf, ba, hp, hd, props } = project.base;
  const W = 300;
  const H = 230;
  const ml = 42;
  const mr = 42;
  const mt = 34;
  const mb = 38;
  const sx = (x) => ml + (x / bf) * (W - ml - mr);
  const sy = (y) => H - mb - (y / hp) * (H - mt - mb);
  const flangeBottom = hp - hd;
  const x0 = sx(0);
  const x1 = sx(bf / 2);
  const webHalf = (ba / 2 / bf) * (W - ml - mr);

  const parts = [];
  parts.push(`<defs><linearGradient id="secGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e2e8f0"/><stop offset="1" stop-color="#cbd5e1"/></linearGradient></defs>`);
  parts.push(`<path d="M ${sx(0)} ${sy(hp)} L ${x1} ${sy(hp)} L ${x1} ${sy(flangeBottom)} L ${x0 + webHalf} ${sy(flangeBottom)} L ${x0 + webHalf} ${sy(0)} L ${x0 - webHalf} ${sy(0)} L ${x0 - webHalf} ${sy(flangeBottom)} L ${sx(0) - (x1 - x0)} ${sy(flangeBottom)} L ${sx(0) - (x1 - x0)} ${sy(hp)} Z" fill="url(#secGrad)" stroke="#64748b" stroke-width="1.2"/>`);
  // axe des centres de gravité
  const yg = sy(props.ybar);
  parts.push(`<line x1="${ml - 12}" y1="${yg}" x2="${W - mr + 12}" y2="${yg}" class="svg-centroid"/>`);
  parts.push(`<text x="${W - mr + 4}" y="${yg - 5}" class="svg-dim-label" text-anchor="end">G</text>`);

  // cotes
  parts.push(`<line x1="${sx(0) - (x1 - x0)}" y1="${mt - 12}" x2="${x1}" y2="${mt - 12}" class="svg-dim"/>`);
  parts.push(`<text x="${x0}" y="${mt - 17}" class="svg-dim-label" text-anchor="middle">bf = ${nf(bf)} m</text>`);

  parts.push(`<line x1="${W - mr + 8}" y1="${sy(hp)}" x2="${W - mr + 8}" y2="${sy(0)}" class="svg-dim"/>`);
  parts.push(`<text x="${W - mr + 14}" y="${(sy(hp) + sy(0)) / 2}" class="svg-dim-label" transform="rotate(90 ${W - mr + 14} ${(sy(hp) + sy(0)) / 2})" text-anchor="middle">hp = ${nf(hp)} m</text>`);

  parts.push(`<line x1="${x1 + 6}" y1="${sy(hp)}" x2="${x1 + 6}" y2="${sy(flangeBottom)}" class="svg-dim"/>`);
  parts.push(`<text x="${x1 + 12}" y="${(sy(hp) + sy(flangeBottom)) / 2 + 4}" class="svg-dim-label">hd</text>`);

  parts.push(`<line x1="${x0 - webHalf}" y1="${H - 22}" x2="${x0 + webHalf}" y2="${H - 22}" class="svg-dim"/>`);
  parts.push(`<text x="${x0}" y="${H - 8}" class="svg-dim-label" text-anchor="middle">ba = ${nf(ba)} m</text>`);

  return `<svg viewBox="0 0 ${W} ${H}" class="section-svg" role="img" aria-label="Section de poutre">${parts.join('')}</svg>`;
}

/* ------------------------------------------------------------------ */
/* Ligne d'influence                                                   */
/* ------------------------------------------------------------------ */

export function chrSVG(project, beam, chartLoad = 'AL', series = { k0: false, k1: false, k: true }) {
  const { b } = project.base;
  const curve = beam.curve;
  const W = 960;
  const H = 460;
  const ml = 64;
  const mr = 30;
  const mt = 34;
  const mb = 66;
  const plotW = W - ml - mr;
  const plotH = H - mt - mb;
  const x = (e) => ml + ((e + b) / (2 * b)) * plotW;

  const values = [];
  if (series.k !== false) for (let i = 0; i <= curve.N; i++) values.push(curve.k[i]);
  if (series.k0) for (let i = 0; i <= curve.N; i++) values.push(curve.k0[i]);
  if (series.k1) for (let i = 0; i <= curve.N; i++) values.push(curve.k1[i]);
  const minV = Math.min(0, ...values);
  const maxV = Math.max(0.8, ...values);
  const pad = (maxV - minV) * 0.08 || 0.2;
  const lo = minV - (minV < 0 ? pad : 0);
  const hi = maxV + pad;
  const y = (v) => mt + ((hi - v) / (hi - lo)) * plotH;

  const parts = [];
  parts.push(`<defs>
    <linearGradient id="liFill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2563eb" stop-opacity="0.20"/>
      <stop offset="1" stop-color="#2563eb" stop-opacity="0.01"/>
    </linearGradient>
    <filter id="dotShadow" x="-100%" y="-100%" width="300%" height="300%">
      <feDropShadow dx="0" dy="1" stdDeviation="1.2" flood-color="#0f172a" flood-opacity="0.22"/>
    </filter>
  </defs>`);

  // grille verticale
  const ticks = [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1];
  ticks.forEach((t) => {
    const xx = x(t * b);
    parts.push(`<line x1="${xx}" y1="${mt}" x2="${xx}" y2="${mt + plotH}" class="svg-grid"/>`);
    parts.push(`<text x="${xx}" y="${mt + plotH + 22}" class="svg-tick" text-anchor="middle">${nf(t, 2)}</text>`);
    parts.push(`<text x="${xx}" y="${mt + plotH + 40}" class="svg-tick svg-tick-sub" text-anchor="middle">${nf(t * b, 2)}</text>`);
  });

  // grille horizontale
  const ySteps = 6;
  for (let i = 0; i <= ySteps; i++) {
    const v = lo + ((hi - lo) * i) / ySteps;
    const yy = y(v);
    parts.push(`<line x1="${ml}" y1="${yy}" x2="${ml + plotW}" y2="${yy}" class="svg-grid"/>`);
    parts.push(`<text x="${ml - 10}" y="${yy + 4}" class="svg-tick" text-anchor="end">${nf(v, 1)}</text>`);
  }

  // zone nulle
  parts.push(`<line x1="${ml}" y1="${y(0)}" x2="${ml + plotW}" y2="${y(0)}" class="svg-zero"/>`);

  // aire
  if (series.k !== false) {
    let d = `M ${x(-b)} ${y(0)}`;
    for (let i = 0; i <= curve.N; i++) {
      const e = -b + i * curve.step;
      d += ` L ${x(e)} ${y(curve.k[i])}`;
    }
    d += ` L ${x(b)} ${y(0)} Z`;
    parts.push(`<path d="${d}" class="li-area" fill="url(#liFill)" stroke="none"/>`);
  }

  // courbes
  const pathOf = (arr) => {
    let d = '';
    for (let i = 0; i <= curve.N; i++) {
      const e = -b + i * curve.step;
      d += `${i ? ' L' : 'M'} ${x(e)} ${y(arr[i])}`;
    }
    return d;
  };
  if (series.k0) parts.push(`<path d="${pathOf(curve.k0)}" class="svg-curve-k0"/>`);
  if (series.k1) parts.push(`<path d="${pathOf(curve.k1)}" class="svg-curve-k1"/>`);
  if (series.k !== false) parts.push(`<path d="${pathOf(curve.k)}" class="svg-curve-main"/>`);

  // points remarquables
  if (series.k !== false) {
    ticks.forEach((t) => {
      const e = t * b;
      const i = Math.round(((e + b) / (2 * b)) * curve.N);
      const k = curve.k[clamp(i, 0, curve.N)];
      parts.push(`<circle cx="${x(e)}" cy="${y(k)}" r="3.2" class="svg-point"/>`);
    });
  }

  // chargement superposé
  const overlay = loadOverlay(project, beam, x, y, chartLoad);
  if (overlay) parts.push(overlay);

  // axes
  parts.push(`<line x1="${ml}" y1="${mt}" x2="${ml}" y2="${mt + plotH}" class="svg-axis"/>`);
  parts.push(`<line x1="${ml}" y1="${mt + plotH}" x2="${ml + plotW}" y2="${mt + plotH}" class="svg-axis"/>`);
  parts.push(`<text x="${ml + plotW}" y="${mt - 10}" class="svg-axis-title" text-anchor="end">e / b</text>`);
  parts.push(`<text x="${ml + plotW}" y="${H - 8}" class="svg-tick svg-tick-sub" text-anchor="end">excentricité e (m)</text>`);
  parts.push(`<text x="16" y="${mt + plotH / 2}" class="svg-axis-title" transform="rotate(-90 16 ${mt + plotH / 2})" text-anchor="middle">K(e)</text>`);

  // curseur
  parts.push(`<g id="li-cursor" class="li-cursor" style="opacity:0">
    <line id="li-cursor-line" x1="0" y1="${mt}" x2="0" y2="${mt + plotH}"/>
    <circle id="li-cursor-dot" cx="0" cy="0" r="5"/>
  </g>`);

  return `<svg id="li-chart" viewBox="0 0 ${W} ${H}" class="li-svg" data-b="${b}" role="img" aria-label="Ligne d'influence de K">${parts.join('')}</svg>`;
}

function loadOverlay(project, beam, x, y, type) {
  const { b, Ltr } = project.base;
  const loads = beam.loads;
  const parts = [];
  const top = 34;
  const bottom = 380;

  if (type === 'AL') {
    const c = loads.AL.best;
    if (!c) return '';
    parts.push(`<rect x="${x(c.start)}" y="${top}" width="${x(c.end) - x(c.start)}" height="${bottom - top}" class="svg-load-band al"/>`);
    parts.push(`<line x1="${x(c.start)}" y1="${top}" x2="${x(c.start)}" y2="${bottom}" class="svg-load-edge al"/>`);
    parts.push(`<line x1="${x(c.end)}" y1="${top}" x2="${x(c.end)}" y2="${bottom}" class="svg-load-edge al"/>`);
    parts.push(`<text x="${(x(c.start) + x(c.end)) / 2}" y="${top + 20}" class="svg-load-label al" text-anchor="middle">AL · ${c.lanes} voie${c.lanes > 1 ? 's' : ''} · LAl = ${nf(c.LAl)} m</text>`);
    parts.push(`<text x="${x(c.start) + 6}" y="${bottom + 16}" class="svg-tick svg-load-value" text-anchor="start">e = ${nf(c.start)} m</text>`);
    parts.push(`<text x="${x(c.end) - 6}" y="${bottom + 16}" class="svg-tick svg-load-value" text-anchor="end">e = ${nf(c.end)} m</text>`);
  } else if (type === 'qtr') {
    const kR = 0.5 * (beam.loads.qtr.values?.[0] ?? 0);
    const sides = [
      { a: -b, bb: -b + Ltr, label: 'qtr gauche' },
      { a: b - Ltr, bb: b, label: 'qtr droit' },
    ];
    sides.forEach((s) => {
      parts.push(`<rect x="${x(s.a)}" y="${top}" width="${x(s.bb) - x(s.a)}" height="${bottom - top}" class="svg-load-band qtr"/>`);
      parts.push(`<text x="${(x(s.a) + x(s.bb)) / 2}" y="${top + 20}" class="svg-load-label qtr" text-anchor="middle">${s.label}</text>`);
    });
  } else if (type === 'Bc') {
    const c = loads.Bc.best;
    if (!c) return '';
    c.positions.forEach((e, i) => {
      const k = beam.curve.k[clamp(Math.round(((e + b) / (2 * b)) * beam.curve.N), 0, beam.curve.N)];
      parts.push(`<line x1="${x(e)}" y1="${top + 12}" x2="${x(e)}" y2="${y(k)}" class="svg-load-edge bc"/>`);
      parts.push(`<path d="M ${x(e) - 5} ${top + 12} L ${x(e) + 5} ${top + 12} L ${x(e)} ${top + 22} Z" class="svg-wheel"/>`);
      parts.push(`<circle cx="${x(e)}" cy="${y(k)}" r="3.4" class="svg-wheel-dot"/>`);
      parts.push(`<text x="${x(e)}" y="${top + 8}" class="svg-tick svg-load-value" text-anchor="middle">${nf(e, 2)}</text>`);
    });
    parts.push(`<text x="${x(c.start)}" y="${bottom + 16}" class="svg-tick svg-load-value" text-anchor="middle">${c.files} file${c.files > 1 ? 's' : ''} · bc = ${nf(c.bc, 2)}</text>`);
  } else if (type === 'Mc') {
    const c = loads.Mc.best;
    if (!c) return '';
    const tracks = [
      [c.edges[0], c.edges[1]],
      [c.edges[2], c.edges[3]],
    ];
    tracks.forEach(([a, bb], i) => {
      parts.push(`<rect x="${x(bb)}" y="${top}" width="${x(a) - x(bb)}" height="${bottom - top}" class="svg-load-band mc"/>`);
      parts.push(`<line x1="${x(a)}" y1="${top}" x2="${x(a)}" y2="${bottom}" class="svg-load-edge mc"/>`);
      parts.push(`<line x1="${x(bb)}" y1="${top}" x2="${x(bb)}" y2="${bottom}" class="svg-load-edge mc"/>`);
      parts.push(`<text x="${(x(a) + x(bb)) / 2}" y="${top + 20}" class="svg-load-label mc" text-anchor="middle">chenille ${i + 1}</text>`);
    });
  }
  return parts.join('');
}

/* ------------------------------------------------------------------ */
/* Barres de placement transversale                                    */
/* ------------------------------------------------------------------ */

export function placementBar(project, items = []) {
  const b = project.base.b;
  const pct = (v) => ((v + b) / (2 * b)) * 100;
  const bars = [];
  for (const item of items) {
    if (item.type === 'band') {
      bars.push(`<span class="pl-band" style="left:${pct(item.from)}%;width:${Math.max(0.4, pct(item.to) - pct(item.from))}%;--c:${item.color || 'var(--blue)'}"></span>`);
    } else if (item.type === 'line') {
      bars.push(`<span class="pl-line" style="left:${pct(item.at)}%;--c:${item.color || 'var(--violet)'}"></span>`);
    }
  }
  return `<div class="placement">
    <div class="placement-deck">${bars.join('')}</div>
    <div class="placement-axis"><span>−b</span><span>0</span><span>+b</span></div>
  </div>`;
}

export function formatSigned(v, d = 2) {
  if (!Number.isFinite(v)) return '—';
  return `${v > 0 ? '+' : ''}${nf(v, d)}`;
}
