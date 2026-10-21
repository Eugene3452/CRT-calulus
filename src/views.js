/* Vues HTML de la note de calcul.
   Chaque fonction reçoit { result, state, validation } et retourne du HTML. */

import { nf, nf0, formatSigned, beamSectionSVG, chrSVG, placementBar } from './charts.js';
import { K0, K1, standardTable, influencePoints, interpolationDetail, T_GRID, E_GRID } from './engine.js';
import { icon } from './icons.js';

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const LOAD_LABELS = {
  AL: { name: 'Système AL', short: 'AL', symbol: 'δ AL', cls: 'al', icon: 'road' },
  qtr: { name: 'Charge trottoir', short: 'qtr', symbol: 'η tr', cls: 'qtr', icon: 'width' },
  Bc: { name: 'Système Bc', short: 'Bc', symbol: 'δ Bc', cls: 'bc', icon: 'truck' },
  Mc: { name: 'Convoi Mc', short: 'Mc', symbol: 'δ Mc', cls: 'mc', icon: 'tandem' },
};

export function loadValue(beam, key) {
  const c = beam?.loads?.[key]?.best;
  if (!c) return NaN;
  return key === 'AL' || key === 'Bc' ? c.cmp : c.eta;
}

export function loadDetail(beam, key, n) {
  const c = beam?.loads?.[key]?.best;
  if (!c) return [];
  if (key === 'AL') {
    return [
      ['LAl', `${nf(c.LAl)} m`],
      ['K̄', nf(c.Kbar, 3)],
      ['η = K̄/n', nf(c.eta, 3)],
      ['a₁', nf(c.a1, 2)],
      ['Position', `${formatSigned(c.start)} → ${formatSigned(c.end)} m`],
    ];
  }
  if (key === 'qtr') {
    return [
      ['Cas', c.label],
      ['Ktr', nf(c.ktr, 3)],
      ['η = Ktr/n', nf(c.eta, 3)],
      ['n', nf0(n)],
    ];
  }
  if (key === 'Bc') {
    return [
      ['Files', nf0(c.files)],
      ['bc', nf(c.bc, 2)],
      ['Kbc', nf(c.Kbc, 3)],
      ['η = Kbc/n', nf(c.eta, 3)],
      ['Position', `${formatSigned(c.start)} m`],
    ];
  }
  return [
    ['Chenilles', `${nf(c.Lmc)} m`],
    ['Écart', `${nf(c.gap)} m`],
    ['Kmc', nf(c.Kmc, 3)],
    ['η = Kmc/n', nf(c.eta, 3)],
    ['P total', `${nf0(c.P)} t`],
  ];
}

function beamBaseN(beam) {
  return beam._n ?? beam.loads?.qtr?.n ?? '';
}

/* ------------------------------------------------------------------ */
/* Fragments communs                                                   */
/* ------------------------------------------------------------------ */

export function beamPicker(result, selected) {
  const { beams } = result;
  const beam = beams[selected] || beams[0];
  return `<div class="beam-picker no-print">
    <span class="beam-picker-label">Poutre étudiée</span>
    <div class="beam-chips" role="group" aria-label="Choix de la poutre">
      ${beams
        .map(
          (b) => `<button type="button" class="chip ${b.index === selected ? 'is-active' : ''}" data-action="beam" data-beam="${b.index}" aria-pressed="${b.index === selected}">
            ${b.label}<small>y = ${nf(b.y)} m</small>
          </button>`
        )
        .join('')}
    </div>
    <span class="beam-meta">y/b = ${nf(beam.yb, 2)} · position x = ${formatSigned(beam.x)} m</span>
  </div>`;
}

export function beamStrip(result, selected) {
  return `<div class="card beam-picker-card no-print">
    ${beamPicker(result, selected)}
    <span class="beam-strip-note">${result.base.mode === 'tables' ? 'Interpolation des tableaux' : 'Solution exacte'} · ${result.base.T <= 2 ? 'T dans le domaine des tableaux' : 'T hors tableaux'}</span>
  </div>`;
}

function sectionTitle(title, sub, actions = '') {
  return `<div class="section-title">
    <div><h2>${title}</h2>${sub ? `<p>${sub}</p>` : ''}</div>
    ${actions ? `<div class="section-actions">${actions}</div>` : ''}
  </div>`;
}

function metrics(items) {
  return `<div class="load-result-row">${items
    .map(([label, value, accent]) => `<div class="metric ${accent ? 'accent' : ''}"><span>${label}</span><b>${value}</b></div>`)
    .join('')}</div>`;
}

/* ------------------------------------------------------------------ */
/* Synthèse                                                            */
/* ------------------------------------------------------------------ */

export function viewSynthese({ result, state }) {
  const base = result.base;
  const beams = result.beams;
  const selected = beams[state.beam] || beams[0];
  const env = result.envelope;

  const cards = ['AL', 'qtr', 'Bc', 'Mc'].map((key) => resultCard(result, selected, key)).join('');

  const maxima = {};
  for (const key of ['AL', 'qtr', 'Bc', 'Mc']) {
    maxima[key] = Math.max(...beams.map((b) => loadValue(b, key)).filter(Number.isFinite));
  }

  const rows = beams
    .map((b) => {
      const isSel = b.index === selected.index;
      const cells = ['AL', 'qtr', 'Bc', 'Mc']
        .map((key) => {
          const v = loadValue(b, key);
          const isMax = Math.abs(v - maxima[key]) < 1e-9;
          return `<td class="num ${isMax ? 'max-cell' : ''}">${nf(v, 3)}</td>`;
        })
        .join('');
      return `<tr class="${isSel ? 'is-selected' : ''}" data-action="beam" data-beam="${b.index}">
        <td><b>${b.label}</b><span class="sub">x = ${formatSigned(b.x)} m</span></td>
        <td class="num">${nf(b.y, 2)}</td>
        <td class="num">${nf(b.yb, 2)}</td>
        ${cells}
        <td class="center"><button type="button" class="row-btn" data-action="beam" data-beam="${b.index}">Étudier</button></td>
      </tr>`;
    })
    .join('');

  const crtRows = ['AL', 'qtr', 'Bc', 'Mc']
    .map((key) => {
      const c = selected.loads[key]?.best;
      if (!c) return '';
      const meta = LOAD_LABELS[key];
      const factor = key === 'AL' ? c.a1 : key === 'Bc' ? c.bc : 1;
      const factorLabel = key === 'AL' ? 'a₁' : key === 'Bc' ? 'bc' : '1,00';
      const extra =
        key === 'AL'
          ? `LAl = ${nf(c.LAl)} m`
          : key === 'qtr'
            ? `Ltr = ${nf(base.Ltr)} m`
            : key === 'Bc'
              ? `${nf0(c.files)} file${c.files > 1 ? 's' : ''}`
              : `Lmc = ${nf(c.Lmc)} m`;
      const relation =
        key === 'AL'
          ? 'a₁ · η · LAl'
          : key === 'Bc'
            ? 'bc · η'
            : `η = K̄<sub>${key === 'qtr' ? 'tr' : 'mc'}</sub>/n`;
      return `<tr>
        <td><span class="load-dot ${meta.cls}"></span><b>${meta.short}</b><span class="sub">${meta.name}</span></td>
        <td class="num strong">${nf(c.eta, 4)}</td>
        <td class="num">${nf(factor, 2)} <span class="sub">${factorLabel}</span></td>
        <td>${extra}</td>
        <td class="num strong">${nf(loadValue(selected, key), 4)}</td>
        <td class="mono small">${relation}</td>
      </tr>`;
    })
    .join('');

  const envRows = ['AL', 'qtr', 'Bc', 'Mc']
    .map((key) => {
      const e = env[key];
      if (!e) return '';
      return `<tr>
        <td><span class="load-dot ${LOAD_LABELS[key].cls}"></span>${LOAD_LABELS[key].short}</td>
        <td><b>${e.label}</b></td>
        <td class="num">${nf(e.value, 3)}</td>
        <td class="num">${nf(e.eta, 3)}</td>
        <td>${envCase(e.case, key)}</td>
      </tr>`;
    })
    .join('');

  const props = base.props;
  const sectionPills = [
    ['A', `${nf(props.A, 3)} m²`],
    ['v (G)', `${nf(props.ybar, 3)} m`],
    ['Ip', `${nf(props.Ip * 1e3, 1)} ·10⁻³ m⁴`],
    ['Kp', `${nf(props.Kp * 1e3, 2)} ·10⁻³ m⁴`],
    ['Up = Ip/b₀', `${nf(base.Up * 1e3, 2)} ·10⁻³ m³`],
    ['Ue = hd³/12', `${nf(base.Ue * 1e6, 1)} ·10⁻⁶ m³`],
    ['Jp = Kp/2b₀', `${nf(base.Jp * 1e3, 2)} ·10⁻³ m³`],
    ['Je', `${nf(base.Je * 1e6, 1)} ·10⁻⁶ m³`],
    ['Fléau', `${nf(props.flangeWidth)} m`],
  ]
    .map(([k, v]) => `<div class="value-pill"><span>${k}</span><b>${v}</b></div>`)
    .join('');

  return `
    ${beamStrip(result, selected.index)}
    ${sectionTitle('Coefficients de répartition', `Poutre ${selected.label} · y = ${nf(selected.y)} m (y/b = ${nf(selected.yb, 2)})`, `<button type="button" class="btn btn-outline btn-sm" data-action="goto" data-view="influence">${icon('chart')} Ligne d’influence</button>`)}
    <div class="result-grid">${cards}</div>

    ${sectionTitle('Coefficients CRT — forme η × aᵢ', `Poutre ${selected.label} · le CRT de base η = K̄/n est multiplié par les facteurs réglementaires du chargeur`)}
    <article class="card crt-card">
      <div class="table-scroll">
        <table class="data-table crt-table">
          <thead><tr><th>Charge</th><th class="num">η = K̄/n</th><th class="num">Facteur aᵢ</th><th>Grandeur</th><th class="num">Coefficient retenu</th><th>Relation</th></tr></thead>
          <tbody>${crtRows}</tbody>
        </table>
      </div>
      <div class="table-note">AL : δ = a₁ · LAl · η &nbsp;·&nbsp; qtr : η = K̄<sub>tr</sub>/n &nbsp;·&nbsp; Bc : δ = bc · η &nbsp;·&nbsp; Mc : η = K̄<sub>Mc</sub>/n. Les coefficients retenus sont ceux de la poutre sélectionnée.</div>
    </article>

    <div class="two-col mt-14">
      <div class="stack">
        ${sectionTitle('Toutes les poutres', 'Coefficients par poutre — la pastille signale le maximum de chaque colonne')}
        <article class="card matrix-card">
          <div class="table-scroll">
            <table class="data-table">
              <thead><tr>
                <th>Poutre</th><th class="num">y (m)</th><th class="num">y/b</th>
                <th class="num">AL</th><th class="num">qtr</th><th class="num">Bc</th><th class="num">Mc</th>
                <th class="center"></th>
              </tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
          <div class="table-note">AL : δ = a₁ · LAl · K̄/n &nbsp;·&nbsp; qtr : η = Ktr/n &nbsp;·&nbsp; Bc : δ = bc · Kbc/n &nbsp;·&nbsp; Mc : δ = Kmc/n. Cliquer une ligne pour changer de poutre.</div>
        </article>
      </div>

      <article class="card">
        <header class="card-head"><div><h2>Poutres gouvernantes</h2><p>Enveloppe sur l’ensemble du tablier</p></div><span class="pill">${beams.length} poutres</span></header>
        <div class="table-scroll">
          <table class="data-table">
            <thead><tr><th>Charge</th><th>Poutre</th><th class="num">Coeff.</th><th class="num">η</th><th>Cas</th></tr></thead>
            <tbody>${envRows}</tbody>
          </table>
        </div>
        <div class="table-note">Le cas dimensionnant retenu pour chaque chargeur est celui qui maximise le coefficient après application des pondérations réglementaires.</div>
      </article>
    </div>

    <div class="two-col mt-14">
      <article class="card">
        <header class="card-head"><div><h2>Section de poutre</h2><p>Caractéristiques géométriques équivalentes</p></div><span class="pill">${nf(base.hp)} × ${nf(base.bf)} m</span></header>
        <div class="section-split">
          <div class="section-drawing">${beamSectionSVG(result)}</div>
          <div class="value-list value-list-flat">${sectionPills}</div>
        </div>
        <div class="table-note">Rigidités calculées sans E (il s’élimine dans T et D). Table de compression prise sur toute sa largeur bf, âme de largeur ba.</div>
      </article>

      <article class="card">
        <header class="card-head"><div><h2>Lecture de la note</h2><p>Ce que représentent les coefficients</p></div></header>
        <div class="note-body">
          <p>Les coefficients traduisent la part de chaque charge transmise à la poutre étudiée. Ils s’appliquent aux efforts calculés dans la poutre chargée pour obtenir l’effort réel dans la poutre considérée.</p>
          <ul class="check-list">
            <li>${icon('check')}<span><b>AL</b> — bande répartie de largeur LAl, pondérée par a₁ selon la classe du pont.</span></li>
            <li>${icon('check')}<span><b>qtr</b> — charge de trottoir, appliquée sur une ou deux rives selon le cas le plus défavorable.</span></li>
            <li>${icon('check')}<span><b>Bc</b> — files de deux roues espacées de 2,00 m, avec coefficient bc fonction du nombre de files.</span></li>
            <li>${icon('check')}<span><b>Mc</b> — convoi à deux chenilles, dont l’écartement et la largeur suivent le type choisi.</span></li>
          </ul>
          <div class="hs-note light">Le calcul est mené pour les ${beams.length} poutres, avec optimisation transversale de la position de chaque chargeur.</div>
        </div>
      </article>
    </div>`;
}

function envCase(c, key) {
  if (!c) return '—';
  if (key === 'AL') return `${c.lanes} voie${c.lanes > 1 ? 's' : ''}`;
  if (key === 'qtr') return c.label;
  if (key === 'Bc') return `${c.files} file${c.files > 1 ? 's' : ''}`;
  return `${nf(c.Lmc)} m`;
}

function resultCard(result, beam, key) {
  const c = beam.loads[key]?.best;
  const meta = LOAD_LABELS[key];
  const value = loadValue(beam, key);
  const details = loadDetail(beam, key, result.base.n);
  const base = result.base;
  const desc = !c
    ? 'Aucun cas admissible.'
    : key === 'AL'
      ? `Bande de ${nf(c.LAl)} m glissée sur la largeur chargeable — ${c.lanes} voie${c.lanes > 1 ? 's' : ''} chargée${c.lanes > 1 ? 's' : ''}.`
      : key === 'qtr'
        ? `Charge de trottoir — ${c.label.toLowerCase()}.`
        : key === 'Bc'
          ? `${c.files} file${c.files > 1 ? 's' : ''} de deux roues — espacement 2,00 m, entraxe des files ${nf(base.bcGap)} m.`
          : `Convoi ${c.name} — chenilles de ${nf(c.Lmc)} m, écart ${nf(c.gap)} m.`;

  return `<article class="result-card ${key === 'AL' ? 'al' : meta.cls}">
    <div class="result-head">
      <div class="result-icon">${icon(meta.icon)}</div>
      <div><div class="result-title">${meta.name}</div><div class="result-sub">${c ? subTitle(c, key) : 'non applicable'}</div></div>
      <span class="result-badge">${base.mode === 'tables' ? 'TABLEAUX' : 'EXACT'}</span>
    </div>
    <div class="result-main"><span class="result-big">${nf(value, 3)}</span><span class="result-unit">${meta.symbol}</span></div>
    <p class="result-desc">${desc}</p>
    <dl class="result-dl">${details
      .slice(0, 4)
      .map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`)
      .join('')}</dl>
    <div class="result-foot">
      <span>${c ? `${beam.label} · y = ${nf(beam.y)} m` : '—'}</span>
      <button type="button" class="link-btn" data-action="goto" data-view="charges">Détail →</button>
    </div>
  </article>`;
}

function subTitle(c, key) {
  if (key === 'AL') return `${c.lanes} voie${c.lanes > 1 ? 's' : ''} · LAl = ${nf(c.LAl)} m`;
  if (key === 'qtr') return c.side === 'both' ? 'deux trottoirs' : c.side === 'right' ? 'trottoir droit' : 'trottoir gauche';
  if (key === 'Bc') return `${c.files} file${c.files > 1 ? 's' : ''} · bc = ${nf(c.bc, 2)}`;
  return `${nf(c.Lmc)} m · ${nf0(c.P)} t`;
}

/* ------------------------------------------------------------------ */
/* Ligne d'influence                                                   */
/* ------------------------------------------------------------------ */

export function viewInfluence({ result, state }) {
  const base = result.base;
  const beam = result.beams[state.beam] || result.beams[0];
  const series = state.series || { k: true, k0: false, k1: false };
  const activeLoad = state.chartLoad || 'AL';

  const segLoad = ['AL', 'qtr', 'Bc', 'Mc']
    .map(
      (key) => `<button type="button" class="${activeLoad === key ? 'is-active' : ''}" data-action="load" data-load="${key}" aria-pressed="${activeLoad === key}">${LOAD_LABELS[key].short}</button>`
    )
    .join('');

  const segSeries = ['k0', 'k1']
    .map(
      (key) => `<button type="button" class="${series[key] ? 'is-active' : ''}" data-action="series" data-series="${key}" aria-pressed="${series[key]}">
        <span class="swatch" style="background:${key === 'k0' ? '#94a3b8' : '#0d9488'}"></span>${key === 'k0' ? 'K₀' : 'K₁'}
      </button>`
    )
    .join('');

  const pts = influencePoints(base, beam.y);
  const tableRows = pts
    .map(
      (p) => `<tr class="${Math.abs(p.er) < 1e-9 ? 'is-selected' : ''}">
        <td class="num">${formatSigned(p.er, 2)}</td>
        <td class="num">${formatSigned(p.e, 2)}</td>
        <td class="num">${nf(p.k0, 4)}</td>
        <td class="num">${nf(p.k1, 4)}</td>
        <td class="num strong">${nf(p.k, 4)}</td>
      </tr>`
    )
    .join('');

  const placement = placementFor(beam, activeLoad, base);

  const loadInfo = loadPositionInfo(result, beam, activeLoad);

  const bracket =
    base.mode === 'tables' && base.tableBase
      ? `T encadré par ${nf(base.tableBase.t1, 2)} et ${nf(base.tableBase.t2, 2)} — poids d’interpolation ${nf(base.tableBase.w, 3)}.`
      : base.mode === 'tables'
        ? 'T hors du domaine tabulé : le calcul bascule sur la solution exacte.'
        : 'Solution exacte de la plaque orthotrope (pas d’interpolation).';

  return `
    ${beamStrip(result, beam.index)}
    ${sectionTitle('Ligne d’influence transversale', `K(e) pour la poutre ${beam.label} · y = ${nf(beam.y)} m · T = ${nf(base.T, 3)} · D = ${nf(base.D, 3)}`)}
    <article class="card chart-card">
      <div class="chart-toolbar">
        <span class="toolbar-label">Chargement superposé</span>
        <div class="seg" role="group" aria-label="Chargement">${segLoad}</div>
        <span class="toolbar-label">Courbes</span>
        <div class="seg" role="group" aria-label="Courbes">${segSeries}</div>
        <span class="toolbar-spacer"></span>
        <span class="chart-hint">Survoler le graphique pour lire K(e)</span>
      </div>
      <div class="chart-wrap" id="liWrap">
        ${chrSVG(result, beam, activeLoad, { k: true, k0: !!series.k0, k1: !!series.k1 })}
        <div class="chart-tip" id="chartTip">
          <span id="tipTitle">Excentricité e</span>
          <b id="tipE">0,00 m</b>
          <span id="tipK0">K₀ = —</span>
          <span id="tipK1">K₁ = —</span>
          <span id="tipK">Kα = —</span>
        </div>
      </div>
      <div class="legend">
        <span class="legend-item"><i></i>Kα = K₀ + (K₁ − K₀)·√D</span>
        <span class="legend-item"><i class="dash"></i>K₀ (sans torsion)</span>
        <span class="legend-item"><i class="dash teal"></i>K₁ (torsion maximale)</span>
        <span class="legend-item"><i class="band" style="background:var(--${activeLoad === 'qtr' ? 'amber' : activeLoad === 'Bc' ? 'violet' : activeLoad === 'Mc' ? 'rose' : 'blue'})"></i>Position ${LOAD_LABELS[activeLoad].short}</span>
      </div>
    </article>

    <div class="two-col mt-14">
      <article class="card">
        <header class="card-head"><div><h2>Valeurs remarquables</h2><p>K₀, K₁ et Kα aux neuf abscisses e/b du cours</p></div><span class="pill">y/b = ${nf(beam.yb, 2)}</span></header>
        <div class="table-scroll">
          <table class="data-table compact">
            <thead><tr><th class="num">e/b</th><th class="num">e (m)</th><th class="num">K₀</th><th class="num">K₁</th><th class="num">Kα</th></tr></thead>
            <tbody>${tableRows}</tbody>
          </table>
        </div>
        <div class="table-note">${bracket}</div>
      </article>

      <article class="card">
        <header class="card-head"><div><h2>Position du chargement</h2><p>${LOAD_LABELS[activeLoad].name} — cas dimensionnant pour ${beam.label}</p></div><span class="pill">${activeLoad}</span></header>
        <div class="load-body">
          <div class="load-position-head">
            <span class="load-symbol ${LOAD_LABELS[activeLoad].cls}">${nf(loadValue(beam, activeLoad), 3)}</span>
            <span class="muted small">${LOAD_LABELS[activeLoad].symbol}</span>
          </div>
          ${placement}
          ${loadInfo}
        </div>
      </article>
    </div>`;
}

function placementFor(beam, key, base) {
  const c = beam.loads[key]?.best;
  if (!c) return '<div class="empty-state small">Aucun cas de chargement admissible.</div>';
  const items = [];
  if (key === 'AL') {
    items.push({ type: 'band', from: c.start, to: c.end, color: 'var(--blue)' });
  } else if (key === 'qtr') {
    if (c.side === 'right' || c.side === 'both') items.push({ type: 'band', from: base.b - base.Ltr, to: base.b, color: 'var(--amber)' });
    if (c.side === 'left' || c.side === 'both') items.push({ type: 'band', from: -base.b, to: -base.b + base.Ltr, color: 'var(--amber)' });
  } else if (key === 'Bc') {
    c.positions.forEach((e) => items.push({ type: 'line', at: e, color: 'var(--violet)' }));
  } else if (key === 'Mc') {
    items.push({ type: 'band', from: c.edges[1], to: c.edges[0], color: 'var(--rose)' });
    items.push({ type: 'band', from: c.edges[3], to: c.edges[2], color: 'var(--rose)' });
  }
  return placementBar({ base }, items);
}

function loadPositionInfo(result, beam, key) {
  const c = beam.loads[key]?.best;
  const base = result.base;
  if (!c) return '';
  if (key === 'AL') {
    return `<div class="load-result-row">
      <div class="metric"><span>Début</span><b>${formatSigned(c.start)} m</b></div>
      <div class="metric"><span>Fin</span><b>${formatSigned(c.end)} m</b></div>
      <div class="metric accent"><span>K̄</span><b>${nf(c.Kbar, 3)}</b></div>
      <div class="metric accent"><span>η</span><b>${nf(c.eta, 3)}</b></div>
    </div>`;
  }
  if (key === 'qtr') {
    return `<div class="load-result-row">
      <div class="metric"><span>Cas</span><b>${c.label}</b></div>
      <div class="metric accent"><span>Ktr</span><b>${nf(c.ktr, 3)}</b></div>
      <div class="metric accent"><span>η</span><b>${nf(c.eta, 3)}</b></div>
    </div>`;
  }
  if (key === 'Bc') {
    return `<div class="load-result-row">
      <div class="metric"><span>Roues</span><b>${c.positions.map((e) => nf(e, 2)).join(' · ')}</b></div>
      <div class="metric accent"><span>Kbc</span><b>${nf(c.Kbc, 3)}</b></div>
      <div class="metric accent"><span>δ Bc</span><b>${nf(c.cmp, 3)}</b></div>
    </div>`;
  }
  return `<div class="load-result-row">
    <div class="metric"><span>Chenilles</span><b>${c.edges.map((e) => nf(e, 2)).join(' · ')}</b></div>
    <div class="metric accent"><span>Kmc</span><b>${nf(c.Kmc, 3)}</b></div>
    <div class="metric accent"><span>δ Mc</span><b>${nf(c.eta, 3)}</b></div>
  </div>`;
}

/* ------------------------------------------------------------------ */
/* Chargements                                                         */
/* ------------------------------------------------------------------ */

export function viewCharges({ result, state }) {
  const base = result.base;
  const beam = result.beams[state.beam] || result.beams[0];
  const loads = beam.loads;

  return `
    ${beamStrip(result, beam.index)}
    <div class="alert alert-info no-print">${icon('info')}<div><b>Optimisation transversale.</b> Pour chaque chargeur, toutes les positions admissibles sur la largeur chargeable sont balayées au pas de 1 cm. Le cas retenu maximise le coefficient de répartition de la poutre ${beam.label}. Les valeurs de K sont lues sur la ligne d’influence du mode ${base.mode === 'tables' ? '« tableaux »' : '« exact »'}.</div></div>
    <div class="load-grid mt-14">
      ${alCard(result, beam)}
      ${qtrCard(result, beam)}
      ${bcCard(result, beam)}
      ${mcCard(result, beam)}
    </div>

    ${sectionTitle('Enveloppe par chargeur', 'Toutes les poutres — cas dimensionnant et poutre associée')}
    <article class="card matrix-card">
      <div class="table-scroll">
        <table class="data-table">
          <thead><tr><th>Charge</th><th>Poutre</th><th class="num">Coefficient</th><th class="num">η</th><th>Cas dimensionnant</th><th class="num">Position</th></tr></thead>
          <tbody>${['AL', 'qtr', 'Bc', 'Mc']
            .map((key) => {
              const e = result.envelope[key];
              if (!e) return '';
              return `<tr>
                <td><span class="load-dot ${LOAD_LABELS[key].cls}"></span><b>${LOAD_LABELS[key].short}</b><span class="sub">${LOAD_LABELS[key].name}</span></td>
                <td>${e.label}</td>
                <td class="num strong">${nf(e.value, 3)}</td>
                <td class="num">${nf(e.eta, 3)}</td>
                <td>${envCase(e.case, key)}</td>
                <td class="num">${e.case?.start != null ? `${formatSigned(e.case.start)} m` : '—'}</td>
              </tr>`;
            })
            .join('')}</tbody>
        </table>
      </div>
      <div class="table-note">Les coefficients sont donnés avant application des combinaisons ELU/ELS. Les valeurs de K̄, Ktr, Kbc et Kmc sont les moyennes lues sur la ligne d’influence.</div>
    </article>`;
}

function loadCardHead(key, beam, base) {
  const meta = LOAD_LABELS[key];
  const v = loadValue(beam, key);
  return `<header class="load-head">
    <div class="load-icon">${icon(meta.icon)}</div>
    <div><h3>${meta.name}</h3><p>${loadSub(key, base)}</p></div>
    <div class="load-result"><span>${meta.symbol}</span><b>${nf(v, 3)}</b></div>
  </header>`;
}

function loadSub(key, base) {
  if (key === 'AL') return `Charge répartie · ${base.Nv} voies disponibles de ${nf(base.V)} m`;
  if (key === 'qtr') return `Charge de trottoir · Ltr = ${nf(base.Ltr)} m`;
  if (key === 'Bc') return `Files de roues · classe ${base.class}`;
  return `Convoi à chenilles · ${base.mcType}`;
}

function alCard(result, beam) {
  const base = result.base;
  const { cases, best } = beam.loads.AL;
  return `<article class="load-card al">
    ${loadCardHead('AL', beam, base)}
    <div class="load-body">
      <p>La bande AL de largeur <b>LAl = nvoies × V</b> glisse sur la largeur chargeable. Le coefficient réglementaire a₁ dépend de la classe du pont et du nombre de voies chargées.</p>
      ${placementFor(beam, 'AL', base)}
      ${metrics([
        ['LAl', `${nf(best?.LAl ?? 0)} m`],
        ['K̄', nf(best?.Kbar, 3)],
        ['η = K̄/n', nf(best?.eta, 3)],
        ['a₁', nf(best?.a1, 2), true],
        ['δ AL', nf(best?.cmp, 3), true],
      ])}
      <div class="formula">δ<sub>AL</sub> = a₁ · <span class="hl">LAl · K̄ / n</span> = ${nf(best?.a1, 2)} × ${nf(best?.LAl, 2)} × ${nf(best?.Kbar, 3)} / ${base.n} = <b>${nf(best?.cmp, 3)}</b></div>
      <div class="table-scroll mt-14">
        <table class="data-table compact">
          <thead><tr><th class="num">Voies</th><th class="num">LAl (m)</th><th class="num">Début (m)</th><th class="num">K̄</th><th class="num">η</th><th class="num">a₁</th><th class="num">δ AL</th></tr></thead>
          <tbody>${cases
            .map(
              (c) => `<tr class="${c.selected ? 'is-selected' : ''}">
                <td class="num">${c.lanes}</td>
                <td class="num">${nf(c.LAl)}</td>
                <td class="num">${formatSigned(c.start)}</td>
                <td class="num">${nf(c.Kbar, 3)}</td>
                <td class="num">${nf(c.eta, 3)}</td>
                <td class="num">${nf(c.a1, 2)}</td>
                <td class="num strong">${nf(c.cmp, 3)}</td>
              </tr>`
            )
            .join('')}</tbody>
        </table>
      </div>
    </div>
  </article>`;
}

function qtrCard(result, beam) {
  const base = result.base;
  const { cases, best } = beam.loads.qtr;
  if (!best) return `<article class="load-card qtr">${loadCardHead('qtr', beam, base)}<div class="load-body"><p>Aucun trottoir défini (Ltr = 0) : la charge qtr n’est pas applicable.</p></div></article>`;
  return `<article class="load-card qtr">
    ${loadCardHead('qtr', beam, base)}
    <div class="load-body">
      <p>La charge de trottoir est appliquée sur une ou deux rives. On compare les trois configurations et on retient celle qui produit le plus grand Ktr moyen.</p>
      ${placementFor(beam, 'qtr', base)}
      ${metrics([
        ['Ktr', nf(best.ktr, 3)],
        ['η = Ktr/n', nf(best.eta, 3), true],
        ['Ltr', `${nf(base.Ltr)} m`],
        ['Cas', best.label, true],
      ])}
      <div class="formula">η<sub>qtr</sub> = <span class="hl">K̄<sub>tr</sub> / n</span> = ${nf(best.ktr, 3)} / ${base.n} = <b>${nf(best.eta, 3)}</b></div>
      <div class="table-scroll mt-14">
        <table class="data-table compact">
          <thead><tr><th>Configuration</th><th class="num">Ktr</th><th class="num">η</th><th class="num">K aux bords</th></tr></thead>
          <tbody>${cases
            .map(
              (c) => `<tr class="${c.selected ? 'is-selected' : ''}">
                <td>${c.label}</td>
                <td class="num">${nf(c.ktr, 3)}</td>
                <td class="num strong">${nf(c.eta, 3)}</td>
                <td class="num">${c.values.map((v) => nf(v, 2)).join(' · ')}</td>
              </tr>`
            )
            .join('')}</tbody>
        </table>
      </div>
    </div>
  </article>`;
}

function bcCard(result, beam) {
  const base = result.base;
  const { cases, best } = beam.loads.Bc;
  if (!best) return `<article class="load-card bc">${loadCardHead('Bc', beam, base)}<div class="load-body"><p>La largeur chargeable est insuffisante pour placer une file Bc complète.</p></div></article>`;
  return `<article class="load-card bc">
    ${loadCardHead('Bc', beam, base)}
    <div class="load-body">
      <p>Chaque file comporte deux roues espacées de 2,00 m ; les files sont distantes de ${nf(base.bcGap)} m avec un garde de ${nf(base.edgeClear)} m au bord. Le coefficient bc dépend du nombre de files.</p>
      ${placementFor(beam, 'Bc', base)}
      ${metrics([
        ['Files', nf0(best.files)],
        ['bc', nf(best.bc, 2)],
        ['Kbc', nf(best.Kbc, 3)],
        ['η = Kbc/n', nf(best.eta, 3)],
        ['δ Bc', nf(best.cmp, 3), true],
      ])}
      <div class="formula">δ<sub>Bc</sub> = <span class="hl">bc · K̄<sub>Bc</sub> / n</span> = ${nf(best.bc, 2)} × ${nf(best.Kbc, 3)} / ${base.n} = <b>${nf(best.cmp, 3)}</b><br><small>K̄<sub>Bc</sub> = ½ · Σ K(e<sub>i</sub>) sur les quatre roues.</small></div>
      <div class="table-scroll mt-14">
        <table class="data-table compact">
          <thead><tr><th class="num">Files</th><th class="num">bc</th><th class="num">Kbc</th><th class="num">η</th><th class="num">δ Bc</th><th>Abscisses des roues (m)</th></tr></thead>
          <tbody>${cases
            .map(
              (c) => `<tr class="${c.selected ? 'is-selected' : ''}">
                <td class="num">${c.files}</td>
                <td class="num">${nf(c.bc, 2)}</td>
                <td class="num">${nf(c.Kbc, 3)}</td>
                <td class="num">${nf(c.eta, 3)}</td>
                <td class="num strong">${nf(c.cmp, 3)}</td>
                <td class="mono small">${c.positions.map((e) => nf(e, 2)).join(' · ')}</td>
              </tr>`
            )
            .join('')}</tbody>
        </table>
      </div>
    </div>
  </article>`;
}

function mcCard(result, beam) {
  const base = result.base;
  const { best } = beam.loads.Mc;
  if (!best)
    return `<article class="load-card mc">${loadCardHead('Mc', beam, base)}<div class="load-body"><p>Le convoi ${base.mcType} (largeur ${nf(2 * base.mcTrack + base.mcGap)} m) ne tient pas dans la largeur chargeable de ${nf(base.Lch)} m.</p></div></article>`;
  return `<article class="load-card mc">
    ${loadCardHead('Mc', beam, base)}
    <div class="load-body">
      <p>Le convoi ${best.name} comporte deux chenilles de ${nf(best.Lmc)} m espacées de ${nf(best.gap)} m. Sa position transversale est optimisée ; Kmc est la moyenne des K aux quatre bords de chenilles.</p>
      ${placementFor(beam, 'Mc', base)}
      ${metrics([
        ['Chenille', `${nf(best.Lmc)} m`],
        ['Écart', `${nf(best.gap)} m`],
        ['Kmc', nf(best.Kmc, 3)],
        ['η = Kmc/n', nf(best.eta, 3)],
        ['Charge', `${nf0(best.P)} t`, true],
      ])}
      <div class="formula">δ<sub>Mc</sub> = <span class="hl">K̄<sub>Mc</sub> / n</span> = ¼ · Σ K(e<sub>i</sub>) / n = ${nf(best.Kmc, 3)} / ${base.n} = <b>${nf(best.eta, 3)}</b></div>
      <div class="table-scroll mt-14">
        <table class="data-table compact">
          <thead><tr><th>Convoi</th><th class="num">Chenille (m)</th><th class="num">Écart (m)</th><th class="num">Kmc</th><th class="num">δ Mc</th><th class="num">Bords (m)</th></tr></thead>
          <tbody><tr class="is-selected">
            <td><b>${best.name}</b><span class="sub">${nf0(best.P)} t</span></td>
            <td class="num">${nf(best.Lmc)}</td>
            <td class="num">${nf(best.gap)}</td>
            <td class="num">${nf(best.Kmc, 3)}</td>
            <td class="num strong">${nf(best.eta, 3)}</td>
            <td class="num small">${best.edges.map((e) => nf(e, 2)).join(' · ')}</td>
          </tr></tbody>
        </table>
      </div>
    </div>
  </article>`;
}

/* ------------------------------------------------------------------ */
/* Tables de Massonnet                                                 */
/* ------------------------------------------------------------------ */

function interpCard(base, beam, tSel) {
  const d = interpolationDetail(base, beam.y, tSel, base.D);
  const t1 = nf(d.t1, 2);
  const t2 = nf(d.t2, 2);
  const thetaLabel =
    d.t1 === d.t2
      ? `θ = ${t1}`
      : `θ = ${nf(d.tSel, 3)} entre θ₁ = ${t1} et θ₂ = ${t2}`;
  const tWeight = d.t1 === d.t2 ? 'table unique' : `poids θ₁ = ${nf(1 - d.w, 3)} · θ₂ = ${nf(d.w, 3)}`;
  const y1 = nf(d.y1, 2);
  const y2 = nf(d.y2, 2);
  const yWeight = `poids y₁ = ${nf(1 - d.wy, 3)} · y₂ = ${nf(d.wy, 3)}`;

  const head = E_GRID.map(
    (er) => `<th class="num">${formatSigned(er, 2)}<small>${formatSigned(er * base.b, 2)} m</small></th>`
  ).join('');
  const row = (label, values, cls = '') =>
    `<tr class="${cls}"><th>${label}</th>${values.map((v) => `<td class="num">${nf(v, 4)}</td>`).join('')}</tr>`;

  const rows = [
    row(`K₀ — θ₁ = ${t1}`, d.s1.k0y, 'interp-source'),
    d.t1 !== d.t2 ? row(`K₀ — θ₂ = ${t2}`, d.sources[1].k0y, 'interp-source') : '',
    row('K₀ — après y et θ', d.k0, 'interp-soft'),
    row(`K₁ — θ₁ = ${t1}`, d.s1.k1y, 'interp-source'),
    d.t1 !== d.t2 ? row(`K₁ — θ₂ = ${t2}`, d.sources[1].k1y, 'interp-source') : '',
    row('K₁ — après y et θ', d.k1, 'interp-soft'),
    row(`Kα — θ₁ = ${t1}`, d.s1.kalpha, 'interp-source'),
    d.t1 !== d.t2 ? row(`Kα — θ₂ = ${t2}`, d.sources[1].kalpha, 'interp-source') : '',
    row(`Kθ = Kα final — ${thetaLabel}`, d.kalpha, 'interp-key'),
    row('ηθ = Kθ / n', d.eta, 'interp-eta'),
  ].join('');

  const sourceRows = d.sources
    .flatMap((s, i) => [
      [`θ${i ? '₂' : '₁'} = ${nf(s.t, 2)} · K₀(y/b = ${y1})`, s.k0Table[d.yi]],
      [`θ${i ? '₂' : '₁'} = ${nf(s.t, 2)} · K₀(y/b = ${y2})`, s.k0Table[d.yi + 1]],
      [`θ${i ? '₂' : '₁'} = ${nf(s.t, 2)} · K₁(y/b = ${y1})`, s.k1Table[d.yi]],
      [`θ${i ? '₂' : '₁'} = ${nf(s.t, 2)} · K₁(y/b = ${y2})`, s.k1Table[d.yi + 1]],
    ])
    .map(([label, values]) => row(label, values, 'interp-source-row'))
    .join('');

  return `<article class="card interp-card">
    <header class="card-head">
      <div><h2>Tableau final interpolé — ${thetaLabel}</h2><p>Poutre ${beam.label} · y/b = ${nf(beam.yb, 2)} · ${base.mode === 'tables' ? 'méthode des tableaux' : 'contrôle du mode exact'}</p></div>
      <span class="pill">3 interpolations</span>
    </header>
    <div class="interp-body">
      <div class="interp-flow">
        <div class="interp-step"><span>1 · y</span><b>y/b = ${nf(beam.yb, 2)}</b><small>${y1} → ${y2} · ${yWeight}</small></div>
        <div class="interp-arrow">→</div>
        <div class="interp-step"><span>2 · α = D</span><b>√D = ${nf(d.sqrtD, 3)}</b><small>Kα = K₀ + (K₁ − K₀)·√D</small></div>
        <div class="interp-arrow">→</div>
        <div class="interp-step"><span>3 · θ = T</span><b>${t1} → ${t2}</b><small>${tWeight}</small></div>
      </div>
      <div class="formula interp-formula">
        K<sub>θ</sub>(e) = (1 − w<sub>θ</sub>)·K<sub>θ₁</sub>(e) + w<sub>θ</sub>·K<sub>θ₂</sub>(e)
        ${d.t1 === d.t2 ? '' : ` = ${nf(1 - d.w, 3)}·K<sub>${t1}</sub> + ${nf(d.w, 3)}·K<sub>${t2}</sub>`}
      </div>
      <div class="table-scroll">
        <table class="data-table interp-table">
          <thead><tr><th>Grandeur</th>${head}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <details class="interp-details">
        <summary>Détail des lignes sources utilisées pour l’interpolation sur y</summary>
        <p>Les valeurs ci-dessous sont les lignes brutes des tables de Massonnet aux deux ordonnées encadrant y/b = ${nf(beam.yb, 2)}. L’interpolation sur y est linéaire : K(y) = (1 − w<sub>y</sub>)·K(y₁) + w<sub>y</sub>·K(y₂).</p>
        <div class="table-scroll">
          <table class="data-table compact interp-source-table">
            <thead><tr><th>Table / ligne</th>${head}</tr></thead>
            <tbody>${sourceRows}</tbody>
          </table>
        </div>
      </details>
      <div class="table-note">ηθ = Kθ/n est le CRT de base de la poutre pour l’excentricité e. Le tableau est calculé dans l’ordre du cours : y → √D → θ. La colonne θ finale est la seule à utiliser pour tracer la ligne d’influence en mode « tableaux ».</div>
    </div>
  </article>`;
}

export function viewTables({ result, state }) {
  const base = result.base;
  const beam = result.beams[state.beam] || result.beams[0];
  const which = state.gmWhich === 'K1' ? 'K1' : 'K0';
  const tProj = clamp(base.T, T_GRID[0], T_GRID[T_GRID.length - 1]);
  const tSel =
    state.gmT && state.gmT !== 'project'
      ? clamp(parseFloat(state.gmT) || tProj, T_GRID[0], T_GRID[T_GRID.length - 1])
      : tProj;
  const rows = standardTable(tSel, base.b, which);
  const flat = rows.flat();
  const lo = Math.min(...flat);
  const hi = Math.max(...flat);

  const headCols = E_GRID.map(
    (er) => `<th>${formatSigned(er, 2)}<small>${formatSigned(er * base.b, 2)} m</small></th>`
  ).join('');

  const body = rows
    .map((row, i) => {
      const yr = i / 4;
      return `<tr>
        <th class="row-head">${nf(yr, 2)}<small>y = ${nf(yr * base.b, 2)} m</small></th>
        ${row
          .map((v, j) => {
            const { bg, fg } = heatColor(v, lo, hi);
            return `<td style="background:${bg};color:${fg}" title="K${which === 'K1' ? '₁' : '₀'} = ${nf(v, 4)} · y/b = ${nf(yr, 2)} · e/b = ${formatSigned(E_GRID[j], 2)}">${nf(v, 3)}</td>`;
          })
          .join('')}
      </tr>`;
    })
    .join('');

  const tGridOptions = T_GRID.map((t) => `<option value="${t}"></option>`).join('');
  const interpolated = influencePoints(base, beam.y);
  const tInterp = interpolationDetail(base, beam.y, tSel, base.D);

  return `
    ${beamStrip(result, beam.index)}
    ${sectionTitle(
      'Tables de Massonnet',
      'Coefficients K₀ et K₁ de la plaque orthotrope — grille du cours',
      `<button type="button" class="btn btn-outline btn-sm" data-action="csv" data-which="${which}" data-t="${tSel}">${icon('download')} Export CSV</button>`
    )}

    <article class="card matrix-card">
      <div class="table-controls">
        <div class="control">
          <label>Table</label>
          <div class="seg" role="group" aria-label="Choix de la table">
            <button type="button" class="${which === 'K0' ? 'is-active' : ''}" data-action="gm-table" data-which="K0">K₀ — sans torsion</button>
            <button type="button" class="${which === 'K1' ? 'is-active' : ''}" data-action="gm-table" data-which="K1">K₁ — torsion max.</button>
          </div>
        </div>
        <div class="control">
          <label for="gmT">θ = T voulu</label>
          <div class="theta-control">
            <input id="gmT" type="number" min="${T_GRID[0]}" max="${T_GRID[T_GRID.length - 1]}" step="0.001" value="${String(+tSel.toFixed(4))}" list="gmTGrid" aria-label="Valeur de θ (T) à interpoler">
            <datalist id="gmTGrid">${tGridOptions}</datalist>
            <button type="button" class="btn btn-outline btn-sm" data-action="gm-project">Projet ${nf(base.T, 2)}</button>
          </div>
        </div>
        <div class="spacer"></div>
        <div class="table-meta">${which === 'K0' ? 'K₀(y, e)' : 'K₁(y, e)'} · b = ${nf(base.b, 3)} m</div>
      </div>
      <div class="heat-wrap">
        <table class="heatmap">
          <thead><tr><th class="row-head">y/b <small>ordonnée poutre</small></th>${headCols}</tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>
      <div class="heat-legend">
        <span>faible</span><span class="heat-scale"></span><span>élevé</span>
        <span class="muted" style="margin-left:auto">Les valeurs négatives apparaissent en rouge.</span>
      </div>
      <div class="table-note">Table exacte calculée à θ = ${nf(tSel, 3)} (solution de plaque reproduisant les tableaux de Massonnet). Abscisse e/b en tête, e en mètres en sous-titre. Le tableau final interpolé ci-dessous montre la construction effective du cours.</div>
    </article>

    ${interpCard(base, beam, tSel)}

    <div class="two-col mt-14">
      <article class="card">
        <header class="card-head"><div><h2>Sensibilité au paramètre T</h2><p>K au droit de la poutre ${beam.label}, charge centrée e = 0</p></div><span class="pill">T = ${nf(base.T, 2)}</span></header>
        <div class="chart-wrap">${tSensitivitySVG(base, beam)}</div>
        <div class="legend">
          <span class="legend-item"><i class="dash"></i>K₀</span>
          <span class="legend-item"><i class="dash teal"></i>K₁</span>
          <span class="legend-item"><i></i>Kα (D = ${nf(base.D, 2)})</span>
        </div>
      </article>

      <article class="card">
        <header class="card-head"><div><h2>Chaîne d’interpolation</h2><p>Poutre ${beam.label} · y/b = ${nf(beam.yb, 2)}</p></div><span class="pill">${base.mode === 'tables' ? 'Tableaux' : 'Exact'}</span></header>
        <div class="load-body">
          <div class="chain">
            <div class="chain-step"><span>1 · y</span><b>y/b = ${nf(beam.yb, 2)}</b><small>entre ${nf(Math.floor(beam.yb * 4) / 4, 2)} et ${nf(Math.ceil(beam.yb * 4) / 4, 2)}</small></div>
            <div class="chain-arrow">→</div>
            <div class="chain-step"><span>2 · √D</span><b>√D = ${nf(Math.sqrt(base.D), 3)}</b><small>D = ${nf(base.D, 3)}</small></div>
            <div class="chain-arrow">→</div>
            <div class="chain-step"><span>3 · θ</span><b>${tInterp.t1 === tInterp.t2 ? nf(tInterp.t1, 2) : `${nf(tInterp.t1, 2)} → ${nf(tInterp.t2, 2)}`}</b><small>${tInterp.t1 === tInterp.t2 ? 'table unique' : `poids ${nf(tInterp.w, 3)}`}</small></div>
          </div>
          <div class="formula">Kα = K₀ + (K₁ − K₀) · √D</div>
          <div class="value-list value-list-flat">
            <div class="value-pill"><span>K₀ (e = 0)</span><b>${nf(interpolated[4].k0, 3)}</b></div>
            <div class="value-pill"><span>K₁ (e = 0)</span><b>${nf(interpolated[4].k1, 3)}</b></div>
            <div class="value-pill"><span>Kα (e = 0)</span><b>${nf(interpolated[4].k, 3)}</b></div>
            <div class="value-pill"><span>K max sur la fibre</span><b>${nf(Math.max(...interpolated.map((p) => p.k)), 3)}</b></div>
            <div class="value-pill"><span>K au bord e = b</span><b>${nf(interpolated[8].k, 3)}</b></div>
            <div class="value-pill"><span>K au bord e = −b</span><b>${nf(interpolated[0].k, 3)}</b></div>
          </div>
          <p class="small muted mt-14">La table est d’abord interpolée sur y, puis sur D via √D, enfin sur θ = T entre les deux tables encadrantes. Le détail complet et le tableau final sont donnés ci-dessus.</p>
        </div>
      </article>
    </div>`;
}

function heatColor(v, lo, hi) {
  if (v < 0) {
    const span = Math.max(1e-9, -Math.min(0, lo));
    const t = clamp(-v / span, 0, 1);
    const rgb = mix([255, 241, 242], [190, 18, 60], 0.1 + 0.9 * t);
    return { bg: `rgb(${rgb.join(',')})`, fg: t > 0.55 ? '#fff' : '#881337' };
  }
  const span = Math.max(1e-9, hi - Math.min(0, lo));
  const t = clamp((v - Math.min(0, lo)) / span, 0, 1);
  const rgb = mix([241, 247, 255], [29, 78, 216], 0.06 + 0.94 * t);
  return { bg: `rgb(${rgb.join(',')})`, fg: t > 0.58 ? '#fff' : '#0f172a' };
}

function mix(a, b, t) {
  return a.map((v, i) => Math.round(v + (b[i] - v) * t));
}

function tSensitivitySVG(base, beam) {
  const W = 720;
  const H = 262;
  const ml = 54;
  const mr = 22;
  const mt = 18;
  const mb = 40;
  const plotW = W - ml - mr;
  const plotH = H - mt - mb;
  const tMin = T_GRID[0];
  const tMax = T_GRID[T_GRID.length - 1];
  const N = 90;
  const e = 0;
  const data = [];
  for (let i = 0; i <= N; i++) {
    const T = tMin + ((tMax - tMin) * i) / N;
    const k0 = K0(T, beam.y, e, base.b);
    const k1 = K1(T, beam.y, e, base.b);
    data.push({ T, k0, k1, k: k0 + (k1 - k0) * Math.sqrt(base.D) });
  }
  const vals = data.flatMap((d) => [d.k0, d.k1, d.k]).filter(Number.isFinite);
  let lo = Math.min(0, ...vals);
  let hi = Math.max(0.2, ...vals);
  const pad = (hi - lo) * 0.08;
  lo -= pad;
  hi += pad;
  const x = (t) => ml + ((t - tMin) / (tMax - tMin)) * plotW;
  const y = (v) => mt + ((hi - v) / (hi - lo)) * plotH;
  const path = (key) =>
    data.map((d, i) => `${i ? 'L' : 'M'} ${x(d.T).toFixed(1)} ${y(d[key]).toFixed(1)}`).join(' ');

  const parts = [];
  for (const t of [0.1, 0.5, 1, 1.5, 2]) {
    parts.push(`<line x1="${x(t)}" y1="${mt}" x2="${x(t)}" y2="${mt + plotH}" class="svg-grid"/>`);
    parts.push(`<text x="${x(t)}" y="${mt + plotH + 16}" class="svg-tick" text-anchor="middle">${nf(t, 1)}</text>`);
  }
  for (let i = 0; i <= 4; i++) {
    const v = lo + ((hi - lo) * i) / 4;
    parts.push(`<line x1="${ml}" y1="${y(v)}" x2="${ml + plotW}" y2="${y(v)}" class="svg-grid"/>`);
    parts.push(`<text x="${ml - 8}" y="${y(v) + 4}" class="svg-tick" text-anchor="end">${nf(v, 2)}</text>`);
  }
  parts.push(`<line x1="${ml}" y1="${y(0)}" x2="${ml + plotW}" y2="${y(0)}" class="svg-zero"/>`);
  parts.push(`<path d="${path('k0')}" class="svg-curve-k0"/>`);
  parts.push(`<path d="${path('k1')}" class="svg-curve-k1"/>`);
  parts.push(`<path d="${path('k')}" class="svg-curve-main"/>`);

  const tp = clamp(base.T, tMin, tMax);
  parts.push(`<line x1="${x(tp)}" y1="${mt}" x2="${x(tp)}" y2="${mt + plotH}" class="svg-project-line"/>`);
  const nearest = data.reduce((a, d) => (Math.abs(d.T - tp) < Math.abs(a.T - tp) ? d : a), data[0]);
  parts.push(`<circle cx="${x(tp)}" cy="${y(nearest.k)}" r="5" class="svg-project-dot"/>`);
  parts.push(`<text x="${x(tp) + 7}" y="${mt + 12}" class="svg-project-label">T = ${nf(base.T, 2)}</text>`);

  parts.push(`<text x="${ml}" y="${H - 6}" class="svg-axis-title">T</text>`);
  parts.push(`<text x="15" y="${mt + plotH / 2}" class="svg-axis-title" transform="rotate(-90 15 ${mt + plotH / 2})" text-anchor="middle">K</text>`);
  return `<svg viewBox="0 0 ${W} ${H}" class="li-svg" role="img" aria-label="Sensibilité de K au paramètre T">${parts.join('')}</svg>`;
}

/* ------------------------------------------------------------------ */
/* Méthode                                                             */
/* ------------------------------------------------------------------ */

export function viewMethode({ result, validation }) {
  const base = result.base;
  const beam = result.beams[0];
  const exact = validation?.exact;
  const refs = validation?.refs || [];

  const checkRows = refs
    .map((ref) => {
      const b = exact?.beams?.[ref.beam];
      if (!b) return '';
      return ['AL', 'qtr', 'Bc', 'Mc']
        .map((key) => {
          const got = loadValue(b, key);
          const expected = ref.values[key];
          const gap = ((got - expected) / expected) * 100;
          const good = Math.abs(gap) <= 5;
          return `<tr>
            <td><b>${ref.label}</b><span class="sub">${LOAD_LABELS[key].short}</span></td>
            <td class="num">${nf(expected, 2)}</td>
            <td class="num strong">${nf(got, 3)}</td>
            <td class="num ${good ? 'good' : 'gap'}">${formatSigned(gap, 1)} %</td>
            <td>${good ? 'conforme' : 'optimisation plus défavorable'}</td>
          </tr>`;
        })
        .join('');
    })
    .join('');

  const steps = [
    {
      n: '01',
      title: 'Rigidités de la section',
      body: 'La section en T est ramenée à ses rigidités de flexion et de torsion par unité de largeur. Le module E s’élimine dans les paramètres adimensionnels.',
      formula: 'Up = Ip / b₀ &nbsp;·&nbsp; Ue = hd³ / 12 &nbsp;·&nbsp; Jp = Kp / 2b₀ &nbsp;·&nbsp; Je = Ue',
      values: [`Ip = ${nf(base.props.Ip * 1e3, 1)}·10⁻³ m⁴`, `Kp = ${nf(base.props.Kp * 1e3, 2)}·10⁻³ m⁴`, `Up = ${nf(base.Up * 1e3, 2)}·10⁻³ m³`, `Ue = ${nf(base.Ue * 1e6, 1)}·10⁻⁶ m³`],
    },
    {
      n: '02',
      title: 'Paramètres adimensionnels T et D',
      body: 'T traduit l’élancement relatif de la dalle par rapport à la portée ; D traduit l’effet de la torsion propre de la poutre. Ils positionnent le projet dans les tableaux de Massonnet.',
      formula: 'T = (b / Lc) · (Up / Ue)<sup>1/4</sup> &nbsp;·&nbsp; D = (Jp + Je) / (2·√(Up·Ue))',
      values: [`T = ${nf(base.T, 3)}`, `D = ${nf(base.D, 3)}`, `b = ${nf(base.b, 2)} m`, `Lc = ${nf(base.L, 2)} m`],
    },
    {
      n: '03',
      title: 'Trois interpolations : y, √D puis θ',
      body: 'K₀ correspond à une poutre sans torsion, K₁ à une poutre infiniment raide en torsion. Pour une poutre d’ordonnée y et un θ = T voulu, on interpole d’abord chaque ligne du tableau sur y, puis on passe de K₀ à K₁ en √D, et enfin on interpole entre les deux tables de θ encadrantes. Exemple : θ = 1,07 entre 1,00 et 1,10 donne wθ = 0,70, soit Kθ = 0,30·K1,00 + 0,70·K1,10.',
      formula: 'K<sub>θ</sub>(y) = (1−w<sub>y</sub>)·K<sub>θ</sub>(y₁) + w<sub>y</sub>·K<sub>θ</sub>(y₂) &nbsp;·&nbsp; K<sub>α,θ</sub> = K<sub>0,θ</sub> + (K<sub>1,θ</sub> − K<sub>0,θ</sub>)·√D &nbsp;·&nbsp; K<sub>θ</sub> = (1−w<sub>θ</sub>)·K<sub>θ1</sub> + w<sub>θ</sub>·K<sub>θ2</sub>',
      values: base.tableBase
        ? [`θ₁ = ${nf(base.tableBase.t1, 2)}`, `θ₂ = ${nf(base.tableBase.t2, 2)}`, `wθ = ${nf(base.tableBase.w, 3)}`, `√D = ${nf(Math.sqrt(base.D), 3)}`]
        : [`mode exact`, `θ = T = ${nf(base.T, 3)}`, `√D = ${nf(Math.sqrt(base.D), 3)}`],
    },
    {
      n: '04',
      title: 'Charges et coefficients de répartition',
      body: 'Pour chaque chargeur, la position transversale la plus défavorable est recherchée. Les K lus sur la ligne d’influence sont moyennés sur la largeur chargée, puis divisés par le nombre de poutres.',
      formula:
        'η = K̄/n &nbsp;·&nbsp; AL : δ = a₁·LAl·η &nbsp;·&nbsp; qtr : η = K̄<sub>tr</sub>/n &nbsp;·&nbsp; Bc : δ = bc·η &nbsp;·&nbsp; Mc : η = K̄<sub>Mc</sub>/n',
      values: ['AL = ' + nf(loadValue(beam, 'AL'), 3), 'qtr = ' + nf(loadValue(beam, 'qtr'), 3), 'Bc = ' + nf(loadValue(beam, 'Bc'), 3), 'Mc = ' + nf(loadValue(beam, 'Mc'), 3)],
    },
    {
      n: '05',
      title: 'Enveloppe et lecture',
      body: 'Le calcul est répété pour toutes les poutres. L’enveloppe identifie la poutre gouvernante pour chaque chargeur ; les coefficients obtenus s’appliquent ensuite aux sollicitations de la poutre chargée dans les combinaisons ELU / ELS.',
      formula: 'δ<sub>i,ELU</sub> = γ<sub>Q</sub> · δ<sub>i</sub> · M<sub>chargée</sub>',
      values: [`${base.n} poutres`, `b₀ = ${nf(base.b0, 2)} m`, `Lch = ${nf(base.Lch, 2)} m`, `classe ${base.class}`],
    },
  ];

  return `
    <div class="alert alert-info">${icon('info')}<div><b>Méthode de Guyon-Massonnet.</b> La dalle-poutres est assimilée à une plaque orthotrope équivalente, appuyée sur ses deux extrémités et libre sur ses rives longitudinales. K₀ et K₁ sont les tables limites de torsion. Le CRT est obtenu par trois interpolations successives : y, puis √D, puis θ = T. Le tableau final correspondant au θ voulu est visible dans l’onglet « Tables GM ».</div></div>

    ${sectionTitle('Démarche de calcul', 'Les cinq étapes appliquées par le moteur')}
    <div class="steps">
      ${steps
        .map(
          (s) => `<article class="step-item">
            <div class="step-num">${s.n}</div>
            <div class="step-body">
              <h3>${s.title}</h3>
              <p>${s.body}</p>
              <div class="formula">${s.formula}</div>
              <div class="step-values">${s.values.map((v) => `<span>${v}</span>`).join('')}</div>
            </div>
          </article>`
        )
        .join('')}
    </div>

    <div class="two-col mt-14">
      <article class="card">
        <header class="card-head"><div><h2>Validation sur l’exemple du cours</h2><p>Pont à 5 poutres — Lc = 15,36 m, b₀ = 2,50 m</p></div><span class="pill">mode exact</span></header>
        <div class="table-scroll">
          <table class="data-table compare-table">
            <thead><tr><th>Poutre / charge</th><th class="num">Réf. PDF</th><th class="num">Moteur</th><th class="num">Écart</th><th>Lecture</th></tr></thead>
            <tbody>${checkRows}</tbody>
          </table>
        </div>
        <div class="table-note">Les 72 valeurs de K₀ et K₁ des tables T = 1,10 et T = 1,20 sont reproduites à 10⁻⁴ près. Les écarts sur Bc proviennent de l’optimisation transversale, qui explore des positions plus défavorables que l’exemple manuel.</div>
      </article>

      <article class="card">
        <header class="card-head"><div><h2>Hypothèses et limites</h2><p>Domaine de validité</p></div></header>
        <div class="note-body">
          <ul class="check-list">
            <li>${icon('check')}<span>Comportement élastique linéaire, tablier de largeur constante.</span></li>
            <li>${icon('check')}<span>Poutres parallèles, entretoises supposées suffisantes pour assurer la répartition.</span></li>
            <li>${icon('check')}<span>Charge appliquée en tête de poutre ; effet local de la dalle non traité.</span></li>
            <li>${icon('warn')}<span>D doit rester dans [0 ; 1] et T dans [0,05 ; 2,00]. Hors domaine, le mode exact prolonge la solution mais les résultats sont à considérer avec prudence.</span></li>
            <li>${icon('warn')}<span>Outil de prédimensionnement : les combinaisons, coefficients partiels et vérifications réglementaires restent à la charge de l’ingénieur.</span></li>
          </ul>
        </div>
      </article>
    </div>

    <article class="card mt-14">
      <header class="card-head"><div><h2>Références</h2><p>Sources de la méthode et des charges</p></div></header>
      <div class="note-body">
        <ul class="refs">
          <li><b>Guyon Y. (1946)</b> — Calcul des ponts larges à poutres multiples solidarisées par des entretoises. <i>Annales des Ponts et Chaussées</i>.</li>
          <li><b>Massonnet C. (1950)</b> — Méthode de calcul des ponts à poutres multiples. <i>IABSE Publications</i>.</li>
          <li><b>Massonnet C., Bareš R. (1966)</b> — <i>Calcul des ponts à poutres multiples</i>. Dunod, Paris.</li>
          <li><b>NF EN 1991-2</b> — Actions sur les structures : charges de circulation sur les ponts.</li>
          <li><b>Exercice CRT — Guyon-Massonnet</b> — support de cours utilisé pour la validation numérique.</li>
        </ul>
      </div>
    </article>`;
}



