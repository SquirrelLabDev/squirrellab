import QRCode from 'qrcode';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const anecdotes = JSON.parse(
  readFileSync(join(__dirname, '../src/data/anecdotes.json'), 'utf-8')
);

const BASE_URL = 'https://squirrellab.fr/s/';

async function main() {
  const entries = await Promise.all(
    anecdotes.map(async (a) => ({
      ...a,
      url: BASE_URL + a.slug,
      qr: await QRCode.toDataURL(BASE_URL + a.slug, {
        width: 220,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      }),
    }))
  );

  // ── QR codes print sheet ──────────────────────────────────────────────────
  const qrCards = entries
    .map(
      (e) => `
    <div class="card">
      <img src="${e.qr}" alt="QR ${e.num}" width="180" height="180" />
      <div class="num">#${e.num}</div>
      <div class="title">${e.title}</div>
    </div>`
    )
    .join('');

  const qrHtml = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>QR Codes — Anecdotes Microsoft</title>
  <style>
    @page { size: A4; margin: 1cm; }
    body { font-family: Arial, sans-serif; background: #fff; color: #000; margin: 0; padding: 0; }
    h1 { text-align: center; font-size: 1rem; margin: 0.5rem 0 1rem; color: #444; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.6rem; }
    .card {
      border: 1px dashed #ccc;
      border-radius: 8px;
      padding: 0.5rem;
      text-align: center;
      page-break-inside: avoid;
    }
    .card img { display: block; margin: 0 auto; width: 130px; height: 130px; }
    .num { font-size: 1rem; font-weight: bold; margin: 0.3rem 0 0.1rem; }
    .title { font-size: 0.6rem; color: #555; line-height: 1.3; }
    @media print { body { -webkit-print-color-adjust: exact; } }
  </style>
</head>
<body>
  <h1>Anecdotes Microsoft — QR Codes à découper et cacher</h1>
  <div class="grid">${qrCards}</div>
</body>
</html>`;

  writeFileSync(join(__dirname, '../qrcodes-print.html'), qrHtml, 'utf-8');
  console.log('✓ qrcodes-print.html généré');

  // ── Cheat sheet ───────────────────────────────────────────────────────────
  const rows = entries
    .map(
      (e) => `
    <tr>
      <td class="num">${e.num}</td>
      <td class="title">${e.title}</td>
      <td class="text">${e.text}</td>
      <td class="url"><a href="${e.url}">${e.slug}</a></td>
    </tr>`
    )
    .join('');

  const cheatHtml = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Cheat Sheet — Anecdotes Microsoft</title>
  <style>
    @page { size: A4 landscape; margin: 1cm; }
    body { font-family: Arial, sans-serif; font-size: 0.75rem; background: #fff; color: #000; margin: 0; }
    h1 { font-size: 1rem; margin: 0 0 0.5rem; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #1a1a2e; color: #fff; padding: 0.4rem 0.5rem; text-align: left; }
    td { padding: 0.35rem 0.5rem; border-bottom: 1px solid #ddd; vertical-align: top; }
    tr:nth-child(even) td { background: #f5f5f5; }
    .num { width: 2rem; text-align: center; font-weight: bold; }
    .title { width: 22%; font-weight: bold; }
    .text { width: 55%; }
    .url { width: 15%; font-size: 0.65rem; color: #555; word-break: break-all; }
    a { color: #0066cc; text-decoration: none; }
    @media print { body { -webkit-print-color-adjust: exact; } }
  </style>
</head>
<body>
  <h1>Cheat Sheet — Anecdotes Microsoft (${entries.length} anecdotes)</h1>
  <table>
    <thead>
      <tr>
        <th class="num">N°</th>
        <th class="title">Titre</th>
        <th class="text">Anecdote</th>
        <th class="url">Slug URL</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;

  writeFileSync(join(__dirname, '../cheatsheet-print.html'), cheatHtml, 'utf-8');
  console.log('✓ cheatsheet-print.html généré');
  console.log(`\n20 pages live sur :\n${entries.map((e) => `  ${e.url}`).join('\n')}`);
}

main().catch(console.error);
