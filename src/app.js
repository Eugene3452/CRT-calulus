/* Application — état, formulaire, navigation et interactions. */

import {
  computeProject,
  sectionProps,
  standardTable,
  T_GRID,
  E_GRID,
  DEFAULTS,
  MC_PRESETS,
} from './engine.js';
import { nf, nf0, formatSigned, crossSectionSVG } from './charts.js';
import { icon } from './icons.js';
import {
  viewSynthese,
  viewInfluence,
  viewCharges,
  viewTables,
  viewMethode,
  LOAD_LABELS,
  loadValue,
} from './views.js';

const STORAGE_KEY = 'crt-gm:state:v1';
const VIEWS = ['synthese', 'influence', 'charges', 'tables', 'methode'];
const VIEW_FN = {
  synthese: viewSynthese,
  influence: viewInfluence,
  charges: viewCharges,
  tables: viewTables,
  methode: viewMethode,
};
const FIELD_IDS = [
  'L', 'n', 'b0', 'Ltr', 'ba', 'hp', 'hd', 'bf',
  'mcType', 'mcTrack', 'mcGap', 'bridgeClass',
  'mode', 'torsionMode', 'bcGap', 'edgeClear',
];

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const num = (v, fallback = NaN) => {
  const x = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(x) ? x : fallback;
};

const state = {
  inputs: { ...DEFAULTS },
  view: 'synthese',
  beam: 0,
  chartLoad: 'AL',
  series: { k: false, k0: false, k1: false },
  gmWhich: 'K0',
  gmT: 'project',
  result: null,
  errors: [],
  stale: false,
};

let validation = null;
let debounce = null;
let toastTimer = null;
let printing = false;
let jumpRaf = 0;

/* ------------------------------------------------------------------ */
/* Persistance                                                         */
/* ------------------------------------------------------------------ */

function saveState() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        inputs: collectInputs(),
        view: state.view,
        beam: state.beam,
        chartLoad: state.chartLoad,
        series: state.series,
        gmWhich: state.gmWhich,
        gmT: state.gmT,
      })
    );
  } catch {
    /* stockage indisponible : on continue sans persistance */
  }
}

function restoreState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (saved.inputs && typeof saved.inputs === 'object') {
      state.inputs = { ...DEFAULTS, ...saved.inputs };
    }
    if (VIEWS.includes(saved.view)) state.view = saved.view;
    if (Number.isInteger(saved.beam)) state.beam = saved.beam;
    if (LOAD_LABELS[saved.chartLoad]) state.chartLoad = saved.chartLoad;
    if (saved.series && typeof saved.series === 'object') {
      state.series = {
        k: false,
        k0: !!saved.series.k0,
        k1: !!saved.series.k1,
      };
    }
    if (saved.gmWhich === 'K0' || saved.gmWhich === 'K1') state.gmWhich = saved.gmWhich;
    if (saved.gmT != null) state.gmT = saved.gmT;
  } catch {
    /* état corrompu : valeurs par défaut */
  }
}

/* ------------------------------------------------------------------ */
/* Formulaire                                                          */
/* ------------------------------------------------------------------ */

function collectInputs() {
  const out = {};
  for (const id of FIELD_IDS) {
    const el = $(id);
    if (el) out[id] = el.value.trim();
  }
  return out;
}

function fillForm(inputs) {
  for (const id of FIELD_IDS) {
    const el = $(id);
    if (!el) continue;
    const v = inputs[id] ?? DEFAULTS[id] ?? '';
    el.value = String(v);
  }
}

function handleMcPreset() {
  const type = $('mcType').value;
  const preset = MC_PRESETS[type];
  if (!preset) return;
  $('mcTrack').value = preset.Lmc;
  $('mcGap').value = preset.gap;
}

/* ------------------------------------------------------------------ */
/* Barre latérale                                                      */
/* ------------------------------------------------------------------ */

function renderSidebar() {
  const raw = collectInputs();
  const n = Math.round(num(raw.n, 5));
  const b0 = num(raw.b0, 2.5);
  const Ltr = num(raw.Ltr, 0);
  const b = (n * b0) / 2;
  const Lch = 2 * b - 2 * Ltr;
  const Nv = Lch > 0 ? Math.max(1, Math.floor(Lch / 3 + 1e-9)) : 0;
  const V = Nv > 0 ? Lch / Nv : 0;

  $('geoStrip').innerHTML = [
    ['2b', `${nf(2 * b)} m`],
    ['Lch', `${nf(Lch)} m`],
    ['Nv', `${Nv}`],
    ['V', `${nf(V)} m`],
  ]
    .map(([k, v]) => `<span>${k} <b>${v}</b></span>`)
    .join('');

  let props = null;
  try {
    props = sectionProps({
      b0,
      bf: num(raw.bf, 2.5),
      ba: num(raw.ba, 0.3),
      hp: num(raw.hp, 1),
      hd: num(raw.hd, 0.16),
      torsionMode: raw.torsionMode === 'standard' ? 'standard' : 'example',
    });
  } catch {
    props = null;
  }
  if (props && Number.isFinite(props.A)) {
    const Up = props.Ip / b0;
    const hd = num(raw.hd, 0.16);
    const Ue = hd ** 3 / 12;
    $('sectionStats').innerHTML = [
      ['Ip', `${nf(props.Ip * 1e3, 1)} ·10⁻³ m⁴`],
      ['Kp', `${nf(props.Kp * 1e3, 2)} ·10⁻³ m⁴`],
      ['Up', `${nf(Up * 1e3, 2)} ·10⁻³ m³`],
      ['Ue', `${nf(Ue * 1e6, 1)} ·10⁻⁶ m³`],
    ]
      .map(([k, v]) => `<div class="mini-stat"><span>${k}</span><b>${v}</b></div>`)
      .join('');
  } else {
    $('sectionStats').innerHTML = '';
  }
}

/* ------------------------------------------------------------------ */
/* Calcul                                                              */
/* ------------------------------------------------------------------ */

function recompute() {
  const inputs = collectInputs();
  let res;
  try {
    res = computeProject(inputs);
  } catch (err) {
    console.error(err);
    state.errors = [{ field: null, message: 'Erreur inattendue pendant le calcul. Vérifier les paramètres.' }];
    state.stale = !!state.result;
    renderAll();
    return;
  }

  if (res.ok) {
    state.result = res;
    state.errors = [];
    state.stale = false;
    state.inputs = inputs;
    if (state.beam >= res.beams.length) state.beam = 0;
    saveState();
  } else {
    state.errors = res.errors;
    state.stale = !!state.result;
  }
  renderAll();
}

function scheduleRecompute() {
  renderSidebar();
  renderStatus('calcul');
  clearTimeout(debounce);
  debounce = setTimeout(recompute, 130);
}

/* ------------------------------------------------------------------ */
/* Rendu général                                                       */
/* ------------------------------------------------------------------ */

function renderAll() {
  renderSidebar();
  renderErrors();
  renderStatus();
  updateTabs();
  renderPrintDate();
  if (state.result) {
    renderKpis();
    renderCross();
    renderHero();
    renderView();
  } else {
    $('kpiGrid').innerHTML = '';
    $('crossSection').innerHTML = `<div class="empty-state"><b>Aucune coupe à afficher</b>Corrigez les paramètres du tablier pour lancer le calcul.</div>`;
    $('sectionPill').textContent = '';
    $('sectionSubtitle').textContent = 'Tablier et positions des poutres';
    $('heroSummary').innerHTML = `<div class="empty-state"><b>Calcul interrompu</b>Les paramètres saisis ne permettent pas de définir un tablier valide.</div>`;
    $('viewRoot').innerHTML = `<div class="empty-state"><b>Rien à calculer</b>Vérifiez la géométrie, les trottoirs et les caractéristiques de section.</div>`;
  }
}

function renderStatus(pending) {
  const chip = $('statusChip');
  if (!chip) return;
  chip.classList.remove('is-warn');
  if (pending === 'calcul') {
    chip.textContent = 'Calcul en cours…';
    return;
  }
  if (state.errors.length) {
    chip.textContent = 'Paramètres à corriger';
    chip.classList.add('is-warn');
    return;
  }
  const nWarn = state.result?.warnings?.length ?? 0;
  if (nWarn) {
    chip.textContent = `Calcul à jour · ${nWarn} avertissement${nWarn > 1 ? 's' : ''}`;
    chip.classList.add('is-warn');
  } else {
    chip.textContent = 'Calcul à jour';
  }
}

function renderErrors() {
  const banner = $('errorBanner');
  document.querySelectorAll('.is-invalid').forEach((el) => el.classList.remove('is-invalid'));
  if (!state.errors.length) {
    banner.hidden = true;
    banner.innerHTML = '';
    return;
  }
  banner.hidden = false;
  const messages = [...new Set(state.errors.map((e) => e.message))];
  banner.innerHTML = `<div class="alert alert-error">${icon('warn')}<div>
    <b>Paramètres invalides${state.stale ? ' — les résultats affichés sont les derniers valides' : ''}</b>
    <ul class="alert-list">${messages.map((m) => `<li>${m}</li>`).join('')}</ul>
  </div></div>`;
  state.errors.forEach((e) => {
    if (e.field) $(e.field)?.classList.add('is-invalid');
  });
}

function updateTabs() {
  document.querySelectorAll('#tabs .tab').forEach((tab) => {
    tab.classList.toggle('is-active', tab.dataset.view === state.view);
    tab.setAttribute('aria-selected', String(tab.dataset.view === state.view));
  });
}

function renderPrintDate() {
  const el = $('printDate');
  if (!el) return;
  el.textContent = new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date());
}

/* ------------------------------------------------------------------ */
/* Indicateurs, coupe, synthèse                                        */
/* ------------------------------------------------------------------ */

function renderKpis() {
  const base = state.result.base;
  const clsLabel = base.class === 1 ? '1ʳᵉ' : base.class === 2 ? '2ᵉ' : '3ᵉ';
  const torsionLabel = base.torsionMode === 'standard' ? 'k(a/b)' : 'k(2a/b)';
  const cards = [
    {
      label: 'Paramètre T',
      value: nf(base.T, 3),
      unit: '',
      icon: 'gauge',
      accent: 'blue',
      badge: `b/Lc = ${nf(base.b / base.L, 3)}`,
      sub: 'élancement relatif de la dalle',
    },
    {
      label: 'Coefficient D',
      value: nf(base.D, 3),
      unit: '',
      icon: 'torsion',
      accent: 'teal',
      badge: `√D = ${nf(Math.sqrt(base.D), 2)}`,
      sub: `torsion d’âme · ${torsionLabel}`,
    },
    {
      label: 'Largeur chargeable',
      value: nf(base.Lch, 2),
      unit: 'm',
      icon: 'width',
      accent: 'amber',
      badge: `${base.Nv} voie${base.Nv > 1 ? 's' : ''}`,
      sub: `V = ${nf(base.V)} m · 2b = ${nf(base.Lu)} m`,
    },
    {
      label: 'Classe du pont',
      value: clsLabel,
      unit: '',
      icon: 'class',
      accent: 'violet',
      badge: base.bridgeClass === 'auto' ? 'auto' : 'forcée',
      sub: base.class === 1 ? 'Lch ≥ 7,00 m' : base.class === 2 ? '5,50 ≤ Lch < 7,00 m' : 'Lch < 5,50 m',
    },
  ];

  $('kpiGrid').innerHTML = cards
    .map(
      (c) => `<article class="kpi" style="--accent:var(--${c.accent});--accent-soft:var(--${c.accent}-soft)">
        <div class="kpi-top">
          <span class="kpi-label">${c.label}</span>
          <span class="kpi-icon">${icon(c.icon)}</span>
        </div>
        <div class="kpi-value">${c.value}${c.unit ? `<small>${c.unit}</small>` : ''}</div>
        <div class="kpi-sub"><span class="kpi-badge">${c.badge}</span>${c.sub}</div>
      </article>`
    )
    .join('');
}

function renderCross() {
  const base = state.result.base;
  $('sectionSubtitle').textContent = `${state.result.beams.length} poutres · b₀ = ${nf(base.b0)} m · Ltr = ${nf(base.Ltr)} m · h = ${nf(base.hp)} m`;
  $('sectionPill').textContent = `${base.mode === 'tables' ? 'Tableaux' : 'Exact'} · T = ${nf(base.T, 2)}`;
  const beam = state.result.beams[state.beam] || state.result.beams[0];
  $('crossSection').innerHTML = `${crossSectionSVG(state.result, state.beam)}
    <div class="cross-foot">
      <span><i class="cross-dot"></i>Poutre étudiée <b>${beam.label}</b> · y = ${nf(beam.y)} m</span>
      <span>hd = ${nf(base.hd)} m</span>
      <span>ba = ${nf(base.ba)} m</span>
      <span>bf = ${nf(base.bf)} m</span>
    </div>`;
}

function renderHero() {
  const r = state.result;
  const base = r.base;
  const warnings = r.warnings || [];
  const env = r.envelope;
  const gov = env.Bc?.label || env.AL?.label || '—';
  const modeLabel = base.mode === 'tables' ? 'Tableaux de Massonnet' : 'Solution exacte';

  $('heroSummary').innerHTML = `
    <div class="hs-head">
      <div><h2>Synthèse du tablier</h2><p>${base.n} poutres · ${nf(base.b0)} m d’entraxe</p></div>
      <span class="hs-pill">${base.mode === 'tables' ? 'Interpolation' : 'Plaque exacte'}</span>
    </div>
    <div class="hs-stats">
      <div class="hs-stat"><span>Largeur active 2b</span><b>${nf(base.Lu)} m</b></div>
      <div class="hs-stat"><span>Largeur chargeable</span><b>${nf(base.Lch)} m</b></div>
      <div class="hs-stat"><span>Voies de circulation</span><b>${base.Nv} × ${nf(base.V)} m</b></div>
      <div class="hs-stat"><span>Poutre gouvernante</span><b>${gov}</b></div>
    </div>
    <ul class="hs-list">
      <li><span>Portée de calcul Lc</span><b>${nf(base.L)} m</b></li>
      <li><span>Section de poutre</span><b>${nf(base.hp)} × ${nf(base.bf)} m</b></li>
      <li><span>Up / Ue</span><b>${nf(base.Up * 1e3, 2)} / ${nf(base.Ue * 1e6, 1)} ·10⁻³</b></li>
      <li><span>Torsion d’âme Kp</span><b>${nf(base.props.Kp * 1e3, 2)} ·10⁻³ m⁴</b></li>
      <li><span>Mode de calcul</span><b>${modeLabel}</b></li>
    </ul>
    ${warnings.length
      ? `<div class="hs-note warn">${icon('warn')}<span>${warnings[0]}</span></div>`
      : `<div class="hs-note">${icon('check')}<span>Paramètres dans le domaine de validité de la méthode (0 ≤ D ≤ 1, T ≤ 2).</span></div>`}
  `;
}

/* ------------------------------------------------------------------ */
/* Vue courante                                                        */
/* ------------------------------------------------------------------ */

function renderView() {
  if (!state.result) return;
  const ctx = { result: state.result, state, validation: state.view === 'methode' ? getValidation() : null };
  const html = VIEW_FN[state.view](ctx);
  $('viewRoot').innerHTML = `<section class="view" id="view-${state.view}">${html}</section>`;
  if (state.view === 'influence') attachChartHover();
}

function getValidation() {
  if (validation) return validation;
  validation = {
    refs: [
      { beam: 0, label: 'P1', values: { AL: 1.38, qtr: 0.72, Bc: 0.55, Mc: 0.35 } },
      { beam: 2, label: 'P3', values: { AL: 2.14, qtr: 0.06, Bc: 0.83, Mc: 0.34 } },
    ],
    exact: computeProject({ ...DEFAULTS, mode: 'exact' }),
    tables: computeProject({ ...DEFAULTS, mode: 'tables' }),
  };
  return validation;
}

/* ------------------------------------------------------------------ */
/* Survol du graphique                                                 */
/* ------------------------------------------------------------------ */

function attachChartHover() {
  const svg = $('li-chart');
  const wrap = $('liWrap');
  const tip = $('chartTip');
  if (!svg || !wrap || !tip) return;

  const W = 960;
  const H = 460;
  const ml = 64;
  const mr = 30;
  const mt = 34;
  const mb = 66;
  const plotW = W - ml - mr;
  const plotH = H - mt - mb;
  const b = parseFloat(svg.dataset.b);
  const beam = state.result.beams[state.beam];
  const curve = beam.curve;
  const cursor = $('li-cursor');
  const line = $('li-cursor-line');
  const dot = $('li-cursor-dot');
  const series = state.series;

  const values = [];
  for (let i = 0; i <= curve.N; i++) values.push(curve.k[i]);
  if (series.k0) for (let i = 0; i <= curve.N; i++) values.push(curve.k0[i]);
  if (series.k1) for (let i = 0; i <= curve.N; i++) values.push(curve.k1[i]);
  const minV = Math.min(0, ...values);
  const maxV = Math.max(0.8, ...values);
  const pad = (maxV - minV) * 0.08 || 0.2;
  const lo = minV - (minV < 0 ? pad : 0);
  const hi = maxV + pad;
  const yOf = (v) => mt + ((hi - v) / (hi - lo)) * plotH;

  const move = (ev) => {
    const rect = svg.getBoundingClientRect();
    const vx = ((ev.clientX - rect.left) / rect.width) * W;
    const e = clamp(-b + ((vx - ml) / plotW) * 2 * b, -b, b);
    const idx = clamp(Math.round((e + b) / curve.step), 0, curve.N);
    const k = curve.k[idx];
    const k0 = curve.k0[idx];
    const k1 = curve.k1[idx];
    const xx = ml + ((e + b) / (2 * b)) * plotW;
    const yy = yOf(k);

    if (cursor) cursor.style.opacity = '1';
    if (line) {
      line.setAttribute('x1', xx);
      line.setAttribute('x2', xx);
    }
    if (dot) {
      dot.setAttribute('cx', xx);
      dot.setAttribute('cy', yy);
    }

    $('tipE').textContent = `${formatSigned(e)} m  ·  e/b = ${formatSigned(e / b)}`;
    $('tipK0').textContent = `K₀ = ${nf(k0, 3)}`;
    $('tipK1').textContent = `K₁ = ${nf(k1, 3)}`;
    $('tipK').textContent = `Kα = ${nf(k, 3)}`;

    const svgRect = rect;
    const wrapRect = wrap.getBoundingClientRect();
    const px = svgRect.left - wrapRect.left + (xx / W) * svg.clientWidth;
    const py = svgRect.top - wrapRect.top + (yy / H) * svg.clientHeight;
    const tipW = tip.offsetWidth || 120;
    const tipH = tip.offsetHeight || 86;
    tip.style.left = `${clamp(px, tipW / 2 + 8, wrap.clientWidth - tipW / 2 - 8)}px`;
    tip.style.top = `${Math.max(py, 4)}px`;
    tip.style.transform =
      py - tipH - 14 < 4 ? 'translate(-50%, 14px)' : 'translate(-50%, calc(-100% - 12px))';
    tip.classList.add('is-on');
  };

  const leave = () => {
    tip.classList.remove('is-on');
    if (cursor) cursor.style.opacity = '0';
  };

  svg.addEventListener('pointermove', move);
  svg.addEventListener('pointerleave', leave);
}

/* ------------------------------------------------------------------ */
/* Export CSV                                                          */
/* ------------------------------------------------------------------ */

function exportCsv(which, tRaw) {
  if (!state.result) return;
  const t = clamp(num(tRaw, state.result.base.T), T_GRID[0], T_GRID[T_GRID.length - 1]);
  const rows = standardTable(t, state.result.base.b, which === 'K1' ? 'K1' : 'K0');
  const sep = ';';
  const lines = [
    [`Table ${which} — Massonnet`.replace('.', ',')],
    [`T${sep}${nf(t, 2)}${sep}b (m)${sep}${nf(state.result.base.b, 3)}`],
    [],
    ['y/b', 'y (m)', ...E_GRID.map((er) => `e/b = ${formatSigned(er, 2)}`)].join(sep),
    ...rows.map((row, i) => [nf(i / 4, 2), nf((i / 4) * state.result.base.b, 3), ...row.map((v) => nf(v, 4))].join(sep)),
  ];
  const blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `CRT-${which}-T${nf(t, 2).replace(',', '.')}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast(`Table ${which} exportée en CSV`);
}

/* ------------------------------------------------------------------ */
/* Toast                                                               */
/* ------------------------------------------------------------------ */

function toast(message) {
  const el = $('toast');
  el.textContent = message;
  el.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-on'), 2600);
}

/* ------------------------------------------------------------------ */
/* Impression                                                          */
/* ------------------------------------------------------------------ */

function buildPrintDocument() {
  if (!state.result) return;
  const ctx = { result: state.result, state, validation: getValidation() };
  $('viewRoot').innerHTML = VIEWS.map(
    (view) => `<section class="view" id="view-${view}">${VIEW_FN[view](ctx)}</section>`
  ).join('');
}

function printNote() {
  if (!state.result) return toast('Aucun résultat valide à imprimer');
  printing = true;
  buildPrintDocument();
  window.print();
}

window.addEventListener('beforeprint', () => {
  if (state.result && !printing) {
    printing = true;
    buildPrintDocument();
  }
});

window.addEventListener('afterprint', () => {
  if (!printing) return;
  printing = false;
  renderView();
});

/* ------------------------------------------------------------------ */
/* Navigation mobile                                                   */
/* ------------------------------------------------------------------ */

function updateMobileJump() {
  const jump = document.querySelector('.mobile-jump');
  const kpis = $('kpiGrid');
  if (!jump || !kpis) return;
  if (!window.matchMedia('(max-width: 900px)').matches) {
    jump.classList.remove('is-visible');
    return;
  }
  const rect = kpis.getBoundingClientRect();
  const vh = window.innerHeight;
  const show = window.scrollY > 120 && (rect.top > vh * 0.72 || rect.bottom < 72);
  jump.classList.toggle('is-visible', show);
}

function refreshMobileJump() {
  cancelAnimationFrame(jumpRaf);
  jumpRaf = requestAnimationFrame(updateMobileJump);
}

/* ------------------------------------------------------------------ */
/* Interactions                                                        */
/* ------------------------------------------------------------------ */

function bindEvents() {
  const form = $('params');
  form.addEventListener('input', (ev) => {
    if (ev.target.id === 'mcType') return;
    scheduleRecompute();
  });
  form.addEventListener('change', (ev) => {
    if (ev.target.id === 'mcType') {
      handleMcPreset();
      scheduleRecompute();
      return;
    }
    scheduleRecompute();
  });
  form.addEventListener('submit', (ev) => ev.preventDefault());
  window.addEventListener('scroll', refreshMobileJump, { passive: true });
  window.addEventListener('resize', refreshMobileJump);
  refreshMobileJump();

  $('btnExample').addEventListener('click', () => {
    state.inputs = { ...DEFAULTS };
    state.beam = 0;
    state.chartLoad = 'AL';
    state.series = { k: false, k0: false, k1: false };
    state.view = 'synthese';
    fillForm(state.inputs);
    renderSidebar();
    recompute();
    toast('Exemple du cours chargé');
  });

  $('btnReset').addEventListener('click', () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    state.inputs = { ...DEFAULTS };
    state.beam = 0;
    state.chartLoad = 'AL';
    state.series = { k: false, k0: false, k1: false };
    state.view = 'synthese';
    state.gmWhich = 'K0';
    state.gmT = 'project';
    fillForm(state.inputs);
    renderSidebar();
    recompute();
    toast('Paramètres réinitialisés');
  });

  $('btnPrint').addEventListener('click', printNote);

  $('tabs').addEventListener('click', (ev) => {
    const tab = ev.target.closest('.tab');
    if (!tab) return;
    state.view = tab.dataset.view;
    updateTabs();
    renderView();
    saveState();
  });

  $('viewRoot').addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-action]');
    if (!el) return;
    const action = el.dataset.action;

    if (action === 'beam') {
      const idx = Number(el.dataset.beam);
      if (Number.isInteger(idx) && state.result?.beams[idx]) {
        state.beam = idx;
        renderCross();
        renderView();
        saveState();
      }
      return;
    }

    if (action === 'goto') {
      const view = el.dataset.view;
      if (!VIEWS.includes(view)) return;
      state.view = view;
      updateTabs();
      renderView();
      saveState();
      return;
    }

    if (action === 'load') {
      state.chartLoad = el.dataset.load;
      renderView();
      saveState();
      return;
    }

    if (action === 'series') {
      const key = el.dataset.series;
      if (key !== 'k0' && key !== 'k1') return;
      state.series[key] = !state.series[key];
      renderView();
      saveState();
      return;
    }

    if (action === 'gm-table') {
      state.gmWhich = el.dataset.which === 'K1' ? 'K1' : 'K0';
      renderView();
      saveState();
      return;
    }

    if (action === 'csv') {
      exportCsv(el.dataset.which || state.gmWhich, el.dataset.t || state.gmT);
    }
  });

  $('viewRoot').addEventListener('change', (ev) => {
    if (ev.target.id === 'gmT') {
      state.gmT = ev.target.value;
      renderView();
      saveState();
    }
  });

  // Raccourcis clavier : 1–5 pour changer de vue.
  window.addEventListener('keydown', (ev) => {
    if (ev.target.matches('input, select, textarea')) return;
    if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
    const idx = Number(ev.key);
    if (idx >= 1 && idx <= VIEWS.length) {
      state.view = VIEWS[idx - 1];
      updateTabs();
      renderView();
      saveState();
    }
  });
}

/* ------------------------------------------------------------------ */
/* Démarrage                                                           */
/* ------------------------------------------------------------------ */

function init() {
  restoreState();
  fillForm(state.inputs);
  bindEvents();
  renderSidebar();
  recompute();
  renderPrintDate();
  refreshMobileJump();
}

init();
