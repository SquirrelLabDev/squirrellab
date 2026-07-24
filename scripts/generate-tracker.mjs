import * as XLSX from 'xlsx';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const anecdotes = JSON.parse(
  readFileSync(join(__dirname, '../src/data/anecdotes.json'), 'utf-8')
);

const rows = [
  ['N°', 'Anecdote', 'Prénom', 'Nom'],
  ...anecdotes.map((a) => [a.num, a.title, '', '']),
];

const ws = XLSX.utils.aoa_to_sheet(rows);

ws['!cols'] = [
  { wch: 4 },
  { wch: 60 },
  { wch: 20 },
  { wch: 20 },
];

const headerStyle = { font: { bold: true }, fill: { fgColor: { rgb: 'E07840' } } };
['A1', 'B1', 'C1', 'D1'].forEach((cell) => {
  if (ws[cell]) ws[cell].s = headerStyle;
});

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Suivi QR Codes');

const outPath = join(__dirname, '../suivi-qrcodes.xlsx');
XLSX.writeFile(wb, outPath);
console.log('Fichier généré :', outPath);
