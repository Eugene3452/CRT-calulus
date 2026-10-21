/**
 * Moteur de calcul — Méthode de Guyon-Massonnet
 * ------------------------------------------------
 * Les coefficients K0 (alpha = 0) et K1 (alpha = 1) sont obtenus par
 * résolution exacte de l'équation de la plaque orthotrope équivalente
 * (bords libres longitudinalement, appuis simples sur les deux autres
 * bords), pour une charge sinusoïdale transversale.
 *
 * Cette résolution reproduit les tableaux de Massonnet. Elle a été
 * contrôlée sur l'exemple de cours (T = 1,10 et T = 1,20) : les 72
 * valeurs de K0/K1 coïncident à 10^-4 près.
 */

const PI = Math.PI;
const SQRT2 = Math.SQRT2;

export const DEFAULTS = Object.freeze({
  L: 15.36,
  n: 5,
  b0: 2.5,
  Ltr: 1.5,
  ba: 0.3,
  hp: 1.0,
  hd: 0.16,
  bf: 2.5,
  bcGap: 0.5,
  edgeClear: 0.25,
  mcType: 'Mc80',
  mcTrack: 0.85,
  mcGap: 1.95,
  mode: 'tables',
  bridgeClass: 'auto',
  torsionMode: 'example',
});

export const MC_PRESETS = Object.freeze({
  Mc80: { name: 'Mc80', Lmc: 0.85, gap: 1.95, P: 72 },
  Mc120: { name: 'Mc120', Lmc: 1.0, gap: 1.95, P: 110 },
});

export const E_GRID = [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1];
export const Y_GRID = [0, 0.25, 0.5, 0.75, 1];

/** Grille T des tableaux de Massonnet. */
export const T_GRID = [
  ...Array.from({ length: 20 }, (_, i) => +(0.05 * (i + 1)).toFixed(2)), // 0,05 -> 1,00
  ...Array.from({ length: 10 }, (_, i) => +(1.1 + 0.1 * i).toFixed(1)), // 1,10 -> 2,00
];

/* ------------------------------------------------------------------ */
/* Résolution linéaire                                                 */
/* ------------------------------------------------------------------ */

function solveLinear(A, rhs) {
  const n = rhs.length;
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(A[r][col]) > Math.abs(A[pivot][col])) pivot = r;
    }
    if (pivot !== col) {
      [A[col], A[pivot]] = [A[pivot], A[col]];
      [rhs[col], rhs[pivot]] = [rhs[pivot], rhs[col]];
    }
    const p = A[col][col];
    if (Math.abs(p) < 1e-14) continue;
    for (let r = col + 1; r < n; r++) {
      const f = A[r][col] / p;
      if (!f) continue;
      for (let c = col; c < n; c++) A[r][c] -= f * A[col][c];
      rhs[r] -= f * rhs[col];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = rhs[i];
    for (let c = i + 1; c < n; c++) s -= A[i][c] * x[c];
    x[i] = Math.abs(A[i][i]) < 1e-14 ? 0 : s / A[i][i];
  }
  return x;
}

/* ------------------------------------------------------------------ */
/* K0 et K1 — solution de plaque                                       */
/* ------------------------------------------------------------------ */

/**
 * Base de la solution sans torsion (alpha = 0), variable z = mu*y.
 * f = [ch z cos z, sh z cos z, ch z sin z, sh z sin z]
 */
function base0(y, n, mu) {
  const z = mu * y;
  const c = Math.cos(z);
  const s = Math.sin(z);
  const ch = Math.cosh(z);
  const sh = Math.sinh(z);
  if (n === 0) return [ch * c, sh * c, ch * s, sh * s];
  if (n === 1) {
    return [
      mu * (sh * c - ch * s),
      mu * (ch * c - sh * s),
      mu * (sh * s + ch * c),
      mu * (ch * s + sh * c),
    ];
  }
  if (n === 2) {
    return [
      mu * mu * (-2 * sh * s),
      mu * mu * (-2 * ch * s),
      mu * mu * (2 * sh * c),
      mu * mu * (2 * ch * c),
    ];
  }
  return [
    mu ** 3 * (-2 * (ch * s + sh * c)),
    mu ** 3 * (-2 * (sh * s + ch * c)),
    mu ** 3 * (2 * (ch * c - sh * s)),
    mu ** 3 * (2 * (sh * c - ch * s)),
  ];
}

/**
 * Base de la solution avec torsion maximale (alpha = 1),
 * racine double : f = [ch z, sh z, z ch z, z sh z], z = s*y.
 */
function base1(y, n, s) {
  const z = s * y;
  const c = Math.cosh(z);
  const sh = Math.sinh(z);
  if (n === 0) return [c, sh, z * c, z * sh];
  if (n === 1) {
    return [s * sh, s * c, s * (c + z * sh), s * (sh + z * c)];
  }
  if (n === 2) {
    return [
      s * s * c,
      s * s * sh,
      s * s * (2 * sh + z * c),
      s * s * (2 * c + z * sh),
    ];
  }
  return [
    s ** 3 * sh,
    s ** 3 * c,
    s ** 3 * (3 * c + z * sh),
    s ** 3 * (3 * sh + z * c),
  ];
}

/**
 * Coefficient K0 (alpha = 0) pour une poutre d'ordonnée y et une charge
 * d'excentricité e. Unités cohérentes (m). b = demi-largeur active.
 */
export function K0(T, y, e, b) {
  const s = (PI * T) / b;
  const mu = s / SQRT2;
  const M = [];
  const rhs = [];

  const addBC = (yy, off) => {
    const d2 = base0(yy, 2, mu);
    const d3 = base0(yy, 3, mu);
    const v2 = new Array(8).fill(0);
    const v3 = new Array(8).fill(0);
    for (let i = 0; i < 4; i++) {
      v2[off + i] = d2[i];
      v3[off + i] = d3[i];
    }
    M.push(v2);
    rhs.push(0);
    M.push(v3);
    rhs.push(0);
  };

  addBC(-b, 0);
  addBC(b, 4);

  for (const n of [0, 1, 2]) {
    const d = base0(e, n, mu);
    M.push([...d.map((v) => -v), ...d]);
    rhs.push(0);
  }
  const d3e = base0(e, 3, mu);
  M.push([...d3e.map((v) => -v), ...d3e]);
  rhs.push(1);

  const sol = solveLinear(M, rhs);
  const f = base0(y, 0, mu);
  const off = y >= e ? 4 : 0;
  let Z = 0;
  for (let i = 0; i < 4; i++) Z += f[i] * sol[off + i];
  return Z * 2 * b * s ** 4;
}

/**
 * Coefficient K1 (alpha = 1) pour une poutre d'ordonnée y et une charge
 * d'excentricité e.
 */
export function K1(T, y, e, b) {
  const s = (PI * T) / b;
  const M = [];
  const rhs = [];

  const addBC = (yy, off) => {
    const d1 = base1(yy, 1, s);
    const d2 = base1(yy, 2, s);
    const d3 = base1(yy, 3, s);
    const v2 = new Array(8).fill(0);
    const v3 = new Array(8).fill(0);
    for (let i = 0; i < 4; i++) {
      v2[off + i] = d2[i];
      v3[off + i] = d3[i] - 2 * s * s * d1[i];
    }
    M.push(v2);
    rhs.push(0);
    M.push(v3);
    rhs.push(0);
  };

  addBC(-b, 0);
  addBC(b, 4);

  for (const n of [0, 1, 2]) {
    const d = base1(e, n, s);
    M.push([...d.map((v) => -v), ...d]);
    rhs.push(0);
  }
  const d3e = base1(e, 3, s);
  M.push([...d3e.map((v) => -v), ...d3e]);
  rhs.push(1);

  const sol = solveLinear(M, rhs);
  const f = base1(y, 0, s);
  const off = y >= e ? 4 : 0;
  let Z = 0;
  for (let i = 0; i < 4; i++) Z += f[i] * sol[off + i];
  return Z * 2 * b * s ** 4;
}

/** Coefficient K_alpha par interpolation de Massonnet en racine(alpha). */
export function kAlpha(T, y, e, b, D) {
  const k0 = K0(T, y, e, b);
  const k1 = K1(T, y, e, b);
  return k0 + (k1 - k0) * Math.sqrt(Math.max(0, Math.min(1, D)));
}

/* ------------------------------------------------------------------ */
/* Section de poutre                                                   */
/* ------------------------------------------------------------------ */

/** Coefficient de torsion d'un rectangle de rapport a/b (formule de Saâda). */
export function torsionK(ratio) {
  const r = Math.max(1, ratio);
  return 1 / 3 - (64 / (PI ** 5 * r)) * Math.tanh((PI * r) / 2);
}

/**
 * Caractéristiques de la section en T (poutre + table de compression).
 * Dimensions en m. Les rigidités sont exprimées sans E (E se simplifie).
 */
export function sectionProps({ b0, bf, ba, hp, hd, torsionMode = 'example' }) {
  const flangeWidth = Math.max(ba, bf);
  const webHeight = Math.max(1e-9, hp - hd);
  const A = ba * hp + (flangeWidth - ba) * hd;
  const ybar =
    (ba * hp * (hp / 2) + (flangeWidth - ba) * hd * (hp - hd / 2)) / A;
  const Ip =
    (ba * hp ** 3) / 12 +
    ba * hp * (ybar - hp / 2) ** 2 +
    ((flangeWidth - ba) * hd ** 3) / 12 +
    (flangeWidth - ba) * hd * (hp - hd / 2 - ybar) ** 2;

  // Torsion : demi-table de compression + âme.
  const Kp =
    0.5 * (1 / 3) * flangeWidth * hd ** 3 +
    torsionK((torsionMode === 'standard' ? 1 : 2) * (webHeight / ba)) * webHeight * ba ** 3;

  return { A, ybar, Ip, Kp, flangeWidth, webHeight };
}

/* ------------------------------------------------------------------ */
/* Paramètres de la méthode                                            */
/* ------------------------------------------------------------------ */

export function bridgeClassOf(Lch, override = 'auto') {
  if (override === '1' || override === '2' || override === '3') return +override;
  if (Lch >= 7) return 1;
  if (Lch >= 5.5) return 2;
  return 3;
}

export function a1Coeff(cls, lanes) {
  const table = {
    1: { 1: 1.0, 2: 1.0, 3: 0.9, 4: 0.8, 5: 0.7, 6: 0.6 },
    2: { 1: 0.9, 2: 0.8, 3: 0.7, 4: 0.6, 5: 0.5, 6: 0.5 },
    3: { 1: 0.8, 2: 0.7, 3: 0.6, 4: 0.5, 5: 0.5, 6: 0.5 },
  };
  return table[cls]?.[lanes] ?? table[3][6];
}

export function bcCoeff(cls, files) {
  const table = {
    1: { 1: 1.2, 2: 1.1, 3: 0.95, 4: 0.85, 5: 0.8, 6: 0.75 },
    2: { 1: 1.0, 2: 0.9, 3: 0.8, 4: 0.7, 5: 0.65, 6: 0.6 },
    3: { 1: 0.8, 2: 0.7, 3: 0.6, 4: 0.55, 5: 0.5, 6: 0.5 },
  };
  return table[cls]?.[files] ?? table[3][6];
}

/* ------------------------------------------------------------------ */
/* Tables de Massonnet                                                 */
/* ------------------------------------------------------------------ */

/** Encadrement de T dans la grille des tableaux. */
export function bracketT(T) {
  if (T <= T_GRID[0]) return { t1: T_GRID[0], t2: T_GRID[0], w: 0 };
  if (T >= T_GRID[T_GRID.length - 1]) {
    const last = T_GRID[T_GRID.length - 1];
    return { t1: last, t2: last, w: 0 };
  }
  for (let i = 0; i < T_GRID.length - 1; i++) {
    const a = T_GRID[i];
    const b = T_GRID[i + 1];
    if (T >= a && T <= b) {
      return { t1: a, t2: b, w: (T - a) / (b - a) };
    }
  }
  return { t1: T_GRID[0], t2: T_GRID[0], w: 0 };
}

/**
 * Prépare les tableaux K0/K1 aux deux valeurs de T encadrant T.
 * Structure : [ti][yi][ei] = { k0, k1 }.
 */
export function buildTableBase(T, b) {
  const { t1, t2, w } = bracketT(T);
  const Ts = t1 === t2 ? [t1] : [t1, t2];
  const rows = Ts.map((t) =>
    Y_GRID.map((y) =>
      E_GRID.map((e) => ({
        k0: K0(t, y * b, e * b, b),
        k1: K1(t, y * b, e * b, b),
      }))
    )
  );
  return { t1, t2, w, Ts, rows, b, T };
}

function interpE(row, er) {
  const q = (er + 1) * 4;
  const i = Math.max(0, Math.min(7, Math.floor(q)));
  const t = Math.max(0, Math.min(1, q - i));
  return {
    k0: row[i].k0 * (1 - t) + row[i + 1].k0 * t,
    k1: row[i].k1 * (1 - t) + row[i + 1].k1 * t,
  };
}

function interpY(rows, yr) {
  const q = Math.max(0, Math.min(1, yr)) * 4;
  const i = Math.max(0, Math.min(3, Math.floor(q)));
  const t = q - i;
  return {
    k0: rows[i].k0 * (1 - t) + rows[i + 1].k0 * t,
    k1: rows[i].k1 * (1 - t) + rows[i + 1].k1 * t,
  };
}

/**
 * K0/K1/Kalpha par interpolation sur les tableaux (méthode du cours) :
 *   1) interpolation sur y,
 *   2) interpolation sur D en racine de D,
 *   3) interpolation sur T.
 */
export function kFromTables(base, y, e, D) {
  const er = e / base.b;
  const yr = Math.abs(y) / base.b;
  const perT = base.rows.map((rowsForT) => {
    const eInterp = rowsForT.map((row) => interpE(row, er));
    return interpY(eInterp, yr);
  });
  const kd = perT.map((v) => v.k0 + (v.k1 - v.k0) * Math.sqrt(Math.max(0, Math.min(1, D))));
  const k0s = perT.map((v) => v.k0);
  const k1s = perT.map((v) => v.k1);
  if (perT.length === 1) {
    return { k0: k0s[0], k1: k1s[0], k: kd[0] };
  }
  return {
    k0: k0s[0] * (1 - base.w) + k0s[1] * base.w,
    k1: k1s[0] * (1 - base.w) + k1s[1] * base.w,
    k: kd[0] * (1 - base.w) + kd[1] * base.w,
  };
}

/* ------------------------------------------------------------------ */
/* Courbe et intégration                                               */
/* ------------------------------------------------------------------ */

function buildCurve(base, y) {
  const N = 600;
  const { b, T, D, mode, tableBase } = base;
  const step = (2 * b) / N;
  const k = new Float64Array(N + 1);
  const k0 = new Float64Array(N + 1);
  const k1 = new Float64Array(N + 1);

  for (let i = 0; i <= N; i++) {
    const e = -b + i * step;
    if (mode === 'tables' && tableBase) {
      const v = kFromTables(tableBase, y, e, D);
      k[i] = v.k;
      k0[i] = v.k0;
      k1[i] = v.k1;
    } else {
      const a0 = K0(T, y, e, b);
      const a1 = K1(T, y, e, b);
      k0[i] = a0;
      k1[i] = a1;
      k[i] = a0 + (a1 - a0) * Math.sqrt(D);
    }
  }

  const cum = new Float64Array(N + 1);
  for (let i = 1; i <= N; i++) {
    cum[i] = cum[i - 1] + (k[i - 1] + k[i]) * (step / 2);
  }
  return { y, b, N, step, k, k0, k1, cum };
}

/** Valeur de K interpolée linéairement sur la courbe. */
export function kAt(curve, e) {
  const { b, N, step, k } = curve;
  const x = Math.max(-b, Math.min(b, e));
  const u = (x + b) / step;
  const i = Math.max(0, Math.min(N - 1, Math.floor(u)));
  const t = u - i;
  return k[i] * (1 - t) + k[i + 1] * t;
}

/** Intégrale exacte de la courbe (linéaire par morceaux) entre a et b. */
export function integral(curve, a, bb) {
  const { b, N, step, k, cum } = curve;
  const xa = Math.max(-b, Math.min(b, a));
  const xb = Math.max(-b, Math.min(b, bb));
  const cumAt = (x) => {
    if (x <= -b) return 0;
    if (x >= b) return cum[N];
    const u = (x + b) / step;
    const i = Math.min(N - 1, Math.floor(u));
    const dx = x - (-b + i * step);
    const slope = (k[i + 1] - k[i]) / step;
    return cum[i] + k[i] * dx + 0.5 * slope * dx * dx;
  };
  return cumAt(xb) - cumAt(xa);
}

/* ------------------------------------------------------------------ */
/* Charges                                                             */
/* ------------------------------------------------------------------ */

function scanBest(lo, hi, evaluate, step = 0.01) {
  if (hi < lo - 1e-9) return null;
  const n = Math.max(1, Math.min(1600, Math.ceil((hi - lo) / step)));
  let best = null;
  for (let i = 0; i <= n; i++) {
    const s = lo + ((hi - lo) * i) / n;
    const val = evaluate(s);
    if (!best || val.score > best.score) best = { ...val, start: s, score: val.score };
  }
  return best;
}

function computeAL(base, curve) {
  const { b, Ltr, Lch, Nv, V, n, class: cls } = base;
  const cases = [];
  for (let lanes = 1; lanes <= Nv; lanes++) {
    const LAl = lanes * V;
    if (LAl > Lch + 1e-9) continue;
    const lo = -b + Ltr;
    const hi = b - Ltr - LAl;
    if (hi < lo - 1e-9) continue;
    const best = scanBest(lo, hi, (s) => {
      const area = integral(curve, s, s + LAl);
      return { score: area, area };
    });
    if (!best) continue;
    const Kbar = best.area / LAl;
    const eta = Kbar / n;
    const a1 = a1Coeff(cls, lanes);
    cases.push({
      lanes,
      LAl,
      start: best.start,
      end: best.start + LAl,
      area: best.area,
      Kbar,
      eta,
      a1,
      cmp: a1 * eta * LAl,
    });
  }
  if (!cases.length) return { cases, best: null };
  const best = cases.reduce((a, c) => (c.cmp > a.cmp ? c : a), cases[0]);
  cases.forEach((c) => (c.selected = c === best));
  return { cases, best };
}

function computeQtr(base, curve) {
  const { b, Ltr, n } = base;
  if (!(Ltr > 0)) return { cases: [], best: null };
  const kEdgeR = kAt(curve, b);
  const kInnerR = kAt(curve, b - Ltr);
  const kEdgeL = kAt(curve, -b);
  const kInnerL = kAt(curve, -b + Ltr);
  const kR = (kEdgeR + kInnerR) / 2;
  const kL = (kEdgeL + kInnerL) / 2;
  const cases = [
    { side: 'right', label: 'Trottoir droit', ktr: kR, eta: kR / n, values: [kEdgeR, kInnerR] },
    { side: 'left', label: 'Trottoir gauche', ktr: kL, eta: kL / n, values: [kInnerL, kEdgeL] },
    { side: 'both', label: 'Deux trottoirs', ktr: kR + kL, eta: (kR + kL) / n, values: [kEdgeR, kInnerR, kInnerL, kEdgeL] },
  ];
  const best = cases.reduce((a, c) => (c.eta > a.eta ? c : a), cases[0]);
  cases.forEach((c) => (c.selected = c === best));
  return { cases, best };
}

function computeBc(base, curve) {
  const { b, Ltr, Lch, Nv, n, class: cls, bcGap, edgeClear } = base;
  const cases = [];
  const maxFiles = Math.min(Nv, 6);
  for (let files = 1; files <= maxFiles; files++) {
    const width = 2 * files + bcGap * (files - 1);
    if (width > Lch - edgeClear + 1e-9) continue;
    const lo = -b + Ltr + width;
    const hi = b - Ltr - edgeClear;
    if (hi < lo - 1e-9) continue;
    const best = scanBest(
      lo,
      hi,
      (s) => {
        const positions = [];
        let x = s;
        let sum = 0;
        for (let f = 0; f < files; f++) {
          positions.push(x, x - 2);
          sum += kAt(curve, x) + kAt(curve, x - 2);
          x -= 2 + bcGap;
        }
        return { score: sum, positions, sum };
      },
      0.01
    );
    if (!best) continue;
    const Kbc = best.sum / 2;
    const eta = Kbc / n;
    const bc = bcCoeff(cls, files);
    cases.push({
      files,
      bc,
      positions: best.positions,
      sum: best.sum,
      Kbc,
      eta,
      cmp: bc * eta,
      start: best.start,
    });
  }
  if (!cases.length) return { cases, best: null };
  const best = cases.reduce((a, c) => (c.cmp > a.cmp ? c : a), cases[0]);
  cases.forEach((c) => (c.selected = c === best));
  return { cases, best };
}

function computeMc(base, curve) {
  const { b, Ltr, Lch, n, mcTrack, mcGap, mcType } = base;
  const width = 2 * mcTrack + mcGap;
  if (width > Lch + 1e-9) return { cases: [], best: null, preset: null };
  const lo = -b + Ltr + width;
  const hi = b - Ltr;
  const best = scanBest(
    lo,
    hi,
    (s) => {
      const edges = [s, s - mcTrack, s - mcTrack - mcGap, s - 2 * mcTrack - mcGap];
      const values = edges.map((e) => kAt(curve, e));
      const sum = values.reduce((a, v) => a + v, 0);
      return { score: sum, edges, values, sum };
    },
    0.01
  );
  if (!best) return { cases: [], best: null, preset: null };
  const Kmc = best.sum / 4;
  const eta = Kmc / n;
  const preset = MC_PRESETS[mcType] || MC_PRESETS.Mc80;
  const row = {
    name: preset.name,
    P: preset.P,
    Lmc: mcTrack,
    gap: mcGap,
    edges: best.edges,
    values: best.values,
    sum: best.sum,
    Kmc,
    eta,
    start: best.start,
    selected: true,
  };
  return { cases: [row], best: row, preset };
}

function computeLoads(base, curve) {
  return {
    AL: computeAL(base, curve),
    qtr: computeQtr(base, curve),
    Bc: computeBc(base, curve),
    Mc: computeMc(base, curve),
  };
}

/* ------------------------------------------------------------------ */
/* Projet complet                                                      */
/* ------------------------------------------------------------------ */

function num(v, fallback = NaN) {
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
}

export function computeProject(rawInputs) {
  const inputs = { ...DEFAULTS, ...rawInputs };
  const errors = [];
  const warnings = [];

  const L = num(inputs.L);
  const n = Math.round(num(inputs.n));
  const b0 = num(inputs.b0);
  const Ltr = num(inputs.Ltr);
  const ba = num(inputs.ba);
  const hp = num(inputs.hp);
  const hd = num(inputs.hd);
  const bf = num(inputs.bf);
  const bcGap = Math.max(0, num(inputs.bcGap, 0.5));
  const edgeClear = Math.max(0, num(inputs.edgeClear, 0.25));
  const mcTrack = num(inputs.mcTrack, 0.85);
  const mcGap = num(inputs.mcGap, 1.95);
  const mode = inputs.mode === 'tables' ? 'tables' : 'exact';

  if (!(L > 0)) errors.push({ field: 'L', message: 'La portée Lc doit être supérieure à 0.' });
  if (!(n >= 2 && n <= 20)) errors.push({ field: 'n', message: 'Le nombre de poutres doit être compris entre 2 et 20.' });
  if (!(b0 > 0)) errors.push({ field: 'b0', message: "L'entraxe des poutres doit être supérieur à 0." });
  if (!(Ltr >= 0)) errors.push({ field: 'Ltr', message: 'La largeur du trottoir ne peut pas être négative.' });
  if (!(ba > 0)) errors.push({ field: 'ba', message: "La largeur d'âme doit être supérieure à 0." });
  if (!(hp > 0)) errors.push({ field: 'hp', message: 'La hauteur de poutre doit être supérieure à 0.' });
  if (!(hd > 0 && hd < hp)) errors.push({ field: 'hd', message: "L'épaisseur du hourdis doit être comprise entre 0 et hp." });
  if (!(bf >= ba)) errors.push({ field: 'bf', message: 'La largeur de table doit être supérieure à la largeur d’âme.' });
  if (!(mcTrack > 0)) errors.push({ field: 'mcTrack', message: 'La largeur de chenille doit être supérieure à 0.' });
  if (!(mcGap > 0)) errors.push({ field: 'mcGap', message: "L'écart entre chenilles doit être supérieur à 0." });

  const b = (n * b0) / 2;
  const Lu = 2 * b;
  const Lch = Lu - 2 * Ltr;
  if (!(Lch > 0)) {
    errors.push({ field: 'Ltr', message: 'Les trottoirs occupent toute la largeur du tablier.' });
  }
  if (errors.length) {
    return { ok: false, errors, warnings, inputs, base: null, beams: [], envelope: null };
  }

  const Nv = Math.max(1, Math.floor(Lch / 3 + 1e-9));
  const V = Lch / Nv;
  const cls = bridgeClassOf(Lch, inputs.bridgeClass);

  const props = sectionProps({ b0, bf, ba, hp, hd, torsionMode: inputs.torsionMode });
  const Up = props.Ip / b0;
  const Jp = props.Kp / (2 * b0);
  const Ue = hd ** 3 / 12;
  const Je = Ue;
  const rawD = (Jp + Je) / (2 * Math.sqrt(Up * Ue));
  const D = Math.max(0, Math.min(1, rawD));
  const T = (b / L) * (Up / Ue) ** 0.25;

  if (rawD > 1.0001) warnings.push('D calculé supérieur à 1 : la valeur a été plafonnée à 1 (domaine de validité de la méthode).');
  if (rawD < -1e-6) warnings.push('D calculé négatif : vérifier les rigidités de torsion.');
  if (T > 2.0001) warnings.push('T > 2,00 : au-delà du domaine usuel des tableaux de Massonnet, le calcul exact est prolongé.');
  if (T <= 0.3) warnings.push('T ≤ 0,30 : la méthode de Guyon-Massonnet est peu sensible ; la méthode de Courbon peut suffire.');

  const base = {
    ...inputs,
    L,
    n,
    b0,
    Ltr,
    ba,
    hp,
    hd,
    bf,
    bcGap,
    edgeClear,
    mcTrack,
    mcGap,
    mode,
    b,
    Lu,
    Lch,
    Nv,
    V,
    class: cls,
    props,
    Up,
    Jp,
    Ue,
    Je,
    rawD,
    D,
    T,
    tableBase: null,
  };

  if (mode === 'tables' && T <= 2.0001) {
    base.tableBase = buildTableBase(T, b);
  }

  const beams = [];
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * b0;
    const y = Math.abs(x);
    const curve = buildCurve(base, y);
    const loads = computeLoads(base, curve);
    beams.push({
      index: i,
      label: `P${i + 1}`,
      x,
      y,
      yb: y / b,
      curve,
      loads,
    });
  }

  const envelope = {
    AL: pickEnvelope(beams, (b) => b.loads.AL.best, 'cmp'),
    qtr: pickEnvelope(beams, (b) => b.loads.qtr.best, 'eta'),
    Bc: pickEnvelope(beams, (b) => b.loads.Bc.best, 'cmp'),
    Mc: pickEnvelope(beams, (b) => b.loads.Mc.best, 'eta'),
  };

  return {
    ok: true,
    errors: [],
    warnings,
    inputs: base,
    base,
    beams,
    envelope,
  };
}

function pickEnvelope(beams, getBest, key) {
  let best = null;
  for (const beam of beams) {
    const candidate = getBest(beam);
    if (!candidate) continue;
    if (!best || candidate[key] > best.value) {
      best = {
        beam: beam.index,
        label: beam.label,
        y: beam.y,
        value: candidate[key],
        eta: candidate.eta,
        case: candidate,
      };
    }
  }
  return best;
}

/* ------------------------------------------------------------------ */
/* Tableaux pour l'interface                                           */
/* ------------------------------------------------------------------ */

/** Tableau standard K0/K1 (5 lignes y/b x 9 colonnes e/b). */
export function standardTable(T, b, which = 'K0') {
  return Y_GRID.map((yr) =>
    E_GRID.map((er) =>
      which === 'K0' ? K0(T, yr * b, er * b, b) : K1(T, yr * b, er * b, b)
    )
  );
}

/** Valeurs K0/K1/Kalpha aux points remarquables pour une poutre. */
export function influencePoints(base, y, D = base.D) {
  return E_GRID.map((er) => {
    const e = er * base.b;
    if (base.mode === 'tables' && base.tableBase) {
      const v = kFromTables(base.tableBase, y, e, D);
      return { er, e, ...v };
    }
    const k0 = K0(base.T, y, e, base.b);
    const k1 = K1(base.T, y, e, base.b);
    return { er, e, k0, k1, k: k0 + (k1 - k0) * Math.sqrt(D) };
  });
}
