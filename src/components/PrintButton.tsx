'use client';

import { Printer } from 'lucide-react';

export interface PrintTable {
  title: string;
  subtitle?: string;
  headers: string[];
  rows: string[][];
  landscape?: boolean;
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Opens a clean, white, print-friendly page and triggers the browser's
 *  print dialog — where the user can pick "PDF olarak kaydet". */
export default function PrintButton({ table, label = 'Yazdır / PDF' }: { table: PrintTable; label?: string }) {
  function print() {
    const now = new Date().toLocaleString('tr-TR', {
      day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    const html = `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8" />
<title>${esc(table.title)}</title>
<style>
  @page { size: A4 ${table.landscape ? 'landscape' : 'portrait'}; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, 'Segoe UI', Arial, sans-serif; color: #111; margin: 0; padding: 24px; background: #fff; }
  h1 { font-size: 20px; margin: 0 0 2px; }
  .sub { color: #555; font-size: 12px; margin: 0 0 4px; }
  .meta { color: #999; font-size: 11px; margin: 0 0 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { background: #f2f2f4; text-align: left; padding: 7px 8px; border: 1px solid #d7d7dc; font-size: 11px; text-transform: uppercase; letter-spacing: .03em; color: #333; }
  td { padding: 7px 8px; border: 1px solid #e2e2e6; vertical-align: top; }
  tr:nth-child(even) td { background: #fafafb; }
  .empty { text-align: center; color: #999; padding: 30px; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
<h1>${esc(table.title)}</h1>
${table.subtitle ? `<p class="sub">${esc(table.subtitle)}</p>` : ''}
<p class="meta">Yazdırma tarihi: ${esc(now)}</p>
${table.rows.length === 0
  ? '<p class="empty">Kayıt bulunamadı.</p>'
  : `<table>
<thead><tr>${table.headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
<tbody>${table.rows.map(r => `<tr>${r.map(c => `<td>${esc(c).replace(/\n/g, '<br/>')}</td>`).join('')}</tr>`).join('')}</tbody>
</table>`}
<script>window.onload = function () { setTimeout(function () { window.print(); }, 150); };</script>
</body>
</html>`;
    const w = window.open('', '_blank');
    if (!w) { alert('Tarayıcı açılır pencereyi engelledi. Lütfen izin verin.'); return; }
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  return (
    <button type="button" onClick={print} className="btn-ghost shrink-0" title="Yazdır veya PDF olarak kaydet">
      <Printer size={16} /> {label}
    </button>
  );
}
