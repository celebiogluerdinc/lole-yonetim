/**
 * ÇIKTI ALMA — CSV ve pano
 *
 * Sunucuya gitmiyor: liste zaten ekranda, tarayıcıda dosyaya dönüyor.
 * Böylece "indir" bir ağ turu beklemiyor.
 *
 * Excel notu: Türkçe Windows Excel'de ayırıcı NOKTALI VİRGÜL bekleniyor,
 * virgülle kaydedilen dosya tek sütuna biniyor. Dosyanın başına
 * `sep=;` satırı ve BOM yazıyoruz — Excel ikisini de okuyup
 * Türkçe karakterleri doğru gösteriyor.
 */

export type CsvColumn<T> = { key: string; label: string; get: (row: T) => unknown };

function cell(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toLocaleDateString('tr-TR');
  if (typeof v === 'number') return String(v).replace('.', ',');   // tr ondalık
  if (typeof v === 'boolean') return v ? 'evet' : 'hayır';
  const s = String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv<T>(rows: T[], cols: CsvColumn<T>[]): string {
  const head = cols.map(c => cell(c.label)).join(';');
  const body = rows.map(r => cols.map(c => cell(c.get(r))).join(';'));
  return ['sep=;', head, ...body].join('\r\n');
}

/** Panoya yapıştırmak için: sekmeyle ayrılmış — WhatsApp ve Excel ikisi de okuyor. */
export function toClipboardText<T>(rows: T[], cols: CsvColumn<T>[]): string {
  const head = cols.map(c => c.label).join('\t');
  const body = rows.map(r => cols.map(c => {
    const v = c.get(r);
    return v === null || v === undefined ? '' : String(v).replace(/\s+/g, ' ');
  }).join('\t'));
  return [head, ...body].join('\n');
}

export function downloadCsv(filename: string, csv: string): void {
  // BOM: Excel dosyayı UTF-8 okusun, "Ş" ve "ğ" bozulmasın
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Hemen revoke edilirse Safari indirmeyi iptal ediyor
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/** Dosya adına tarih ekler: aynı listeyi iki gün indirince karışmasın. */
export function stampName(base: string): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${base}-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}
