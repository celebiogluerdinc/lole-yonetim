'use client';

import { useState } from 'react';
import { Download, ClipboardCopy, Check, Printer } from 'lucide-react';
import { toCsv, toClipboardText, downloadCsv, stampName, type CsvColumn } from '@/lib/csv';

/**
 * Liste çıktısı: Excel/CSV indir · panoya kopyala · yazdır.
 *
 * Satırlar zaten ekranda olduğu için çıktı tarayıcıda üretiliyor —
 * sunucuya ikinci bir sorgu gitmiyor, "indir" anında iniyor.
 * Ekranda hangi filtre varsa çıktıya o gidiyor: temsilci "ihmal edilen
 * noktalar"ı süzüp doğrudan onu gönderebiliyor.
 */
export default function ListExport<T>({
  rows, cols, name, count, print = false
}: {
  rows: T[];
  cols: CsvColumn<T>[];
  /** Dosya adının gövdesi: "noktalar" → noktalar-20260815.csv */
  name: string;
  /** Gösterilecek satır sayısı metni (verilmezse rows.length) */
  count?: number;
  print?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const n = count ?? rows.length;

  async function copy() {
    try {
      await navigator.clipboard.writeText(toClipboardText(rows, cols));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  if (!rows.length) return null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap" data-noprint>
      <button type="button" onClick={() => downloadCsv(stampName(name), toCsv(rows, cols))}
        className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.11]
          px-2.5 py-1.5 text-[12.5px] font-semibold text-[#D1D1D6] transition-colors"
        title={`${n} satırı Excel/CSV olarak indir`}>
        <Download size={13} /> Excel
      </button>

      <button type="button" onClick={copy}
        className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.11]
          px-2.5 py-1.5 text-[12.5px] font-semibold text-[#D1D1D6] transition-colors"
        title="Listeyi panoya kopyala">
        {copied ? <Check size={13} className="text-emerald-400" /> : <ClipboardCopy size={13} />}
        {copied ? 'Kopyalandı' : 'Kopyala'}
      </button>

      {print && (
        <button type="button" onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.11]
            px-2.5 py-1.5 text-[12.5px] font-semibold text-[#D1D1D6] transition-colors"
          title="Yazdır veya PDF olarak kaydet">
          <Printer size={13} /> Yazdır
        </button>
      )}

      <span className="text-[12px] text-[#6E6E73] tabular-nums">{n} satır</span>
    </div>
  );
}
