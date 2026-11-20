// Documents imprimables du jeu QR ordonné. Fonctions pures : elles renvoient du HTML complet,
// ouvert dans un nouvel onglet (Ctrl+P → « Enregistrer au format PDF »).
//
// Les noms d'équipe sont saisis librement par les joueurs : tout est échappé, et chaque document
// embarque une CSP sans script (le document hérite de l'origine de l'admin via l'URL blob).

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

const ACCENT = '#e07840';
const LOGO = 'https://squirrellab.fr/logo.png';
const CSP =
  `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: https://squirrellab.fr; style-src 'unsafe-inline'">`;

function page(title, css, body) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  ${CSP}
  <title>${esc(title)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; background: #fff; color: #111; margin: 0; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    ${css}
  </style>
</head>
<body>${body}</body>
</html>`;
}

export function fmtDuration(sec) {
  if (sec === null || sec === undefined || Number.isNaN(sec)) return '—';
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  if (h > 0) return `${h} h ${pad(m)} min ${pad(r)} s`;
  if (m > 0) return `${m} min ${pad(r)} s`;
  return `${r} s`;
}

export function fmtDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'medium' });
}

export function fmtDateLong(iso) {
  return new Date(iso || Date.now()).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'long' });
}

const ordinal = (n) => (n === 1 ? '1re' : `${n}e`);

// ── Feuille de QR codes à découper ──────────────────────────────────────────
// cards : [{ n, title, qr (data URL) }]
export function qrSheetHtml(label, cards) {
  const body = `
  <h1>${esc(label)} — QR Codes à découper et cacher</h1>
  <div class="banner">Jeu généré par <strong>SquirrelLab</strong> — www.squirrellab.fr</div>
  <p class="order">À cacher dans le désordre : les équipes doivent les trouver <strong>dans l'ordre des numéros</strong>.</p>
  <div class="grid">${cards.map((c) => `
    <div class="card">
      <img src="${c.qr}" alt="QR ${c.n}" />
      <div class="num">N° ${c.n}</div>
      <div class="title">${esc(c.title)}</div>
      <div class="brand">www.squirrellab.fr</div>
    </div>`).join('')}
  </div>
  <div class="footer">Envie d'organiser le vôtre ? contact@squirrellab.fr</div>`;
  const css = `
    @page { size: A4; margin: 1cm; }
    h1 { text-align: center; font-size: 1rem; margin: 0.5rem 0 0.15rem; color: #444; }
    .banner { text-align: center; font-size: 0.7rem; margin: 0 0 0.4rem; }
    .banner strong { color: ${ACCENT}; }
    .order { text-align: center; font-size: 0.7rem; color: #666; margin: 0 0 1rem; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.6rem; }
    .card { border: 1px dashed #ccc; border-radius: 8px; padding: 0.5rem; text-align: center; break-inside: avoid; }
    .card img { display: block; margin: 0 auto; width: 130px; height: 130px; }
    .num { font-size: 1.05rem; font-weight: bold; margin: 0.3rem 0 0.1rem; }
    .title { font-size: 0.6rem; color: #555; line-height: 1.3; }
    .brand { font-size: 0.5rem; color: ${ACCENT}; font-weight: bold; margin-top: 0.25rem; }
    .footer { text-align: center; font-size: 0.7rem; color: #777; margin-top: 1.25rem; }`;
  return page(`QR Codes — ${label}`, css, body);
}

// ── Cheat sheet organisateur ────────────────────────────────────────────────
// steps : [{ n, title, text, hint, url }]
export function cheatSheetHtml(label, steps) {
  const rows = steps.map((s) => `
    <tr>
      <td class="num">${s.n}</td>
      <td class="title">${esc(s.title)}</td>
      <td class="text">${esc(s.text)}${s.hint ? `<div class="hint">Indice vers la suite : ${esc(s.hint)}</div>` : ''}</td>
      <td class="url">${esc(s.url)}</td>
    </tr>`).join('');
  const body = `
  <div class="top">SquirrelLab <span>— cheat sheet organisateur, ne pas diffuser aux participants</span></div>
  <h1>${esc(label)} — ${steps.length} étapes (ordre strict 1 → ${steps.length})</h1>
  <table>
    <thead><tr><th class="num">N°</th><th class="title">Titre</th><th class="text">Contenu</th><th class="url">URL du QR</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
  const css = `
    @page { size: A4 landscape; margin: 1cm; }
    body { font-size: 0.75rem; }
    .top { background: ${ACCENT}; color: #fff; padding: 0.5rem 0.75rem; margin: 0 0 0.75rem; font-weight: bold; }
    .top span { font-weight: normal; opacity: 0.9; }
    h1 { font-size: 1rem; margin: 0 0 0.5rem; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #1a1a2e; color: #fff; padding: 0.4rem 0.5rem; text-align: left; }
    td { padding: 0.35rem 0.5rem; border-bottom: 1px solid #ddd; vertical-align: top; }
    tr:nth-child(even) td { background: #f5f5f5; }
    .num { width: 2rem; text-align: center; font-weight: bold; }
    .title { width: 20%; font-weight: bold; }
    .url { width: 24%; font-size: 0.65rem; color: #555; word-break: break-all; }
    .hint { margin-top: 0.3rem; color: #8a4a1f; font-style: italic; }`;
  return page(`Cheat sheet — ${label}`, css, body);
}

// ── Rapport ─────────────────────────────────────────────────────────────────
function average(values) {
  const known = values.filter((v) => typeof v === 'number');
  return known.length ? known.reduce((a, b) => a + b, 0) / known.length : null;
}

// teams : réponse de /manage/games/{game}/teams (déjà classées). focusCode : rapport destiné à une
// équipe (son détail par étape) ; sans focusCode : rapport organisateur (statistiques d'ensemble).
export function reportHtml({ gameName, total, teams, steps = [], focusCode = null }) {
  const finished = teams.filter((t) => t.finished);
  const reliable = finished.filter((t) => t.durationSec !== null);
  const avg = average(reliable.map((t) => t.durationSec));
  const focus = focusCode ? teams.find((t) => t.code === focusCode) : null;

  const rankingRows = teams.map((t) => `
    <tr class="${focus && focus.code === t.code ? 'me' : ''}">
      <td class="c">${t.rank}</td>
      <td>${esc(t.name)}${t.restored ? ' <span class="tag">progression rétablie</span>' : ''}</td>
      <td class="c">${t.progress} / ${total}</td>
      <td class="c">${t.finished ? esc(fmtDuration(t.durationSec)) : 'non terminé'}</td>
    </tr>`).join('');

  let detail = '';
  if (focus) {
    const byStep = new Map(focus.steps.map((s) => [s.n, s]));
    const rows = Array.from({ length: total }, (_, i) => i + 1).map((n) => {
      const done = byStep.get(n);
      const stepInfo = steps.find((s) => s.n === n);
      return `<tr>
        <td class="c">${n}</td>
        <td>${esc(stepInfo ? stepInfo.title : '')}</td>
        <td class="c">${done ? esc(fmtDateTime(done.at)) : '—'}</td>
        <td class="c">${done && done.durSec !== null && done.durSec !== undefined ? esc(fmtDuration(done.durSec)) : '—'}</td>
      </tr>`;
    }).join('');
    detail = `
    <h2>Le détail de ${esc(focus.name)}</h2>
    <table><thead><tr><th class="c">Étape</th><th>Titre</th><th class="c">Trouvée à</th><th class="c">Temps depuis l'étape précédente</th></tr></thead>
    <tbody>${rows}</tbody></table>`;
  }

  let stats = '';
  if (!focus) {
    const perStep = Array.from({ length: total }, (_, i) => i + 1).map((n) => ({
      n,
      title: (steps.find((s) => s.n === n) || {}).title || '',
      avg: average(teams.map((t) => (t.steps.find((s) => s.n === n) || {}).durSec)),
      reached: teams.filter((t) => t.progress >= n).length,
    }));
    const slowest = perStep.filter((s) => s.avg !== null && s.n > 1).sort((a, b) => b.avg - a.avg)[0];
    stats = `
    <div class="kpis">
      <div><b>${teams.length}</b><span>équipes</span></div>
      <div><b>${finished.length}</b><span>ont terminé</span></div>
      <div><b>${esc(fmtDuration(avg === null ? null : avg))}</b><span>durée moyenne</span></div>
      <div><b>${slowest ? slowest.n : '—'}</b><span>étape la plus longue</span></div>
    </div>
    <h2>Par étape</h2>
    <table><thead><tr><th class="c">Étape</th><th>Titre</th><th class="c">Équipes arrivées</th><th class="c">Temps moyen depuis la précédente</th></tr></thead>
    <tbody>${perStep.map((s) => `<tr><td class="c">${s.n}</td><td>${esc(s.title)}</td><td class="c">${s.reached}</td><td class="c">${s.n === 1 ? '—' : esc(fmtDuration(s.avg))}</td></tr>`).join('')}</tbody></table>`;
  }

  const body = `
  <div class="top"><img src="${LOGO}" alt="" width="36" height="36" /><div><strong>SquirrelLab</strong> — ${focus ? 'rapport d\'équipe' : 'rapport organisateur'}</div></div>
  <h1>${esc(gameName)}</h1>
  <p class="sub">${esc(fmtDateLong())} · ${teams.length} équipe${teams.length > 1 ? 's' : ''} · ${total} étapes</p>
  ${stats}
  <h2>Classement</h2>
  <p class="note">Classement à la durée : du scan de l'étape 1 au scan de la dernière étape.</p>
  <table><thead><tr><th class="c">Rang</th><th>Équipe</th><th class="c">Étapes</th><th class="c">Durée</th></tr></thead>
  <tbody>${rankingRows}</tbody></table>
  ${detail}
  <div class="footer">Jeu organisé avec SquirrelLab — www.squirrellab.fr</div>`;
  const css = `
    @page { size: A4; margin: 1.5cm; }
    body { font-size: 0.85rem; }
    .top { display: flex; align-items: center; gap: 0.6rem; border-bottom: 3px solid ${ACCENT}; padding-bottom: 0.5rem; margin-bottom: 1rem; }
    h1 { margin: 0; font-size: 1.6rem; }
    h2 { font-size: 1.05rem; margin: 1.4rem 0 0.4rem; color: ${ACCENT}; }
    .sub, .note { color: #666; margin: 0.2rem 0 0.8rem; }
    .note { font-size: 0.75rem; margin: 0 0 0.4rem; }
    .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.6rem; margin: 0.6rem 0; }
    .kpis div { border: 1px solid #ddd; border-radius: 8px; padding: 0.6rem; text-align: center; }
    .kpis b { display: block; font-size: 1.2rem; }
    .kpis span { font-size: 0.7rem; color: #666; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #1a1a2e; color: #fff; padding: 0.35rem 0.5rem; text-align: left; font-size: 0.78rem; }
    td { padding: 0.3rem 0.5rem; border-bottom: 1px solid #e3e3e3; }
    .c { text-align: center; }
    tr.me td { background: #fdeee3; font-weight: bold; }
    .tag { font-size: 0.65rem; background: #eee; border-radius: 4px; padding: 0.05rem 0.3rem; font-weight: normal; }
    tr { break-inside: avoid; }
    .footer { text-align: center; font-size: 0.7rem; color: #777; margin-top: 1.5rem; }`;
  return page(`Rapport — ${gameName}`, css, body);
}

// ── Diplômes ────────────────────────────────────────────────────────────────
// items : [{ team, total }] — un diplôme par page A4 paysage. Podium = équipes terminées classées 1 à 3.
export function diplomasHtml({ gameName, items, dateIso = null }) {
  const date = fmtDateLong(dateIso);
  const pages = items.map(({ team, total }) => {
    const podium = team.finished && team.rank <= 3;
    const medal = podium ? ['🥇', '🥈', '🥉'][team.rank - 1] : '🐿️';
    const title = podium ? "Diplôme d'honneur" : 'Diplôme de participation';
    const reason = podium
      ? `pour avoir terminé le jeu <strong>« ${esc(gameName)} »</strong>${team.durationSec !== null ? ` en <strong>${esc(fmtDuration(team.durationSec))}</strong>` : ''}
         et décroché la <strong>${ordinal(team.rank)} place</strong>.`
      : team.finished
        ? `pour avoir terminé le jeu <strong>« ${esc(gameName)} »</strong>${team.durationSec !== null ? ` en <strong>${esc(fmtDuration(team.durationSec))}</strong>` : ''}.`
        : `pour sa participation au jeu <strong>« ${esc(gameName)} »</strong> :
           <strong>${team.progress} étape${team.progress > 1 ? 's' : ''} sur ${total}</strong> trouvée${team.progress > 1 ? 's' : ''}.`;
    return `
  <section class="diploma ${podium ? 'podium' : ''}">
    <div class="inner">
      <img class="logo" src="${LOGO}" alt="" width="70" height="70" />
      <div class="medal">${medal}</div>
      <div class="kind">${title}</div>
      <div class="given">décerné à l'équipe</div>
      <div class="team">${esc(team.name)}</div>
      <p class="reason">${reason}</p>
      <div class="foot">${esc(date)} · SquirrelLab — www.squirrellab.fr</div>
    </div>
  </section>`;
  }).join('');
  const css = `
    @page { size: A4 landscape; margin: 0; }
    .diploma { width: 297mm; height: 209mm; padding: 10mm; break-after: page; page-break-after: always; display: flex; }
    .diploma:last-child { break-after: auto; page-break-after: auto; }
    .inner { flex: 1; border: 4px double ${ACCENT}; border-radius: 6px; display: flex; flex-direction: column; align-items: center;
      justify-content: center; text-align: center; padding: 14mm; background: #fffaf5; }
    .podium .inner { border-width: 8px; }
    .logo { margin-bottom: 4mm; }
    .medal { font-size: 54px; line-height: 1; }
    .kind { font-size: 38px; font-weight: bold; color: ${ACCENT}; margin: 4mm 0 2mm; letter-spacing: 0.02em; }
    .given { font-size: 16px; color: #777; text-transform: uppercase; letter-spacing: 0.15em; }
    .team { font-size: 44px; font-weight: bold; margin: 5mm 0; overflow-wrap: anywhere; }
    .reason { font-size: 19px; line-height: 1.55; max-width: 190mm; margin: 0; }
    .foot { margin-top: 12mm; font-size: 13px; color: #888; }`;
  return page(`Diplômes — ${gameName}`, css, pages);
}
