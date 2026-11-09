'use client';

import { Printer } from 'lucide-react';

/**
 * YAZDIR / PDF
 *
 * Belgeyi müşteriye vermek için ayrı bir PDF üreticisi kurmak yerine
 * tarayıcının yazdırma penceresi kullanılıyor: "PDF olarak kaydet"
 * her tarayıcıda var ve çıktı her zaman ekrandaki belgeyle aynı.
 *
 * CSS yöntemi: `visibility` ile her şey gizleniyor, yalnızca
 * `#print-area` görünür kalıyor. `display:none` yerine `visibility`
 * seçildi çünkü display, yazdırmada iç içe kutuların sayfa akışını
 * bozup boş sayfalar üretiyor.
 *
 * Sayfada `<div id="print-area">` bulunmalı; `data-noprint` taşıyan
 * her öğe (düğmeler, uyarı kutuları) çıktıda görünmüyor.
 */
export default function PrintButton({ label = 'Yazdır' }: { label?: string }) {
  return (
    <>
      <style>{`
        @media print {
          /* renkleri kâğıda uygun hale getir: koyu tema mürekkep yakıyor */
          html, body { background: #fff !important; color: #000 !important; }
          body * { visibility: hidden !important; }
          #print-area, #print-area * { visibility: visible !important; }
          #print-area {
            position: absolute !important;
            left: 0 !important; top: 0 !important;
            width: 100% !important; max-width: none !important;
            padding: 0 !important; margin: 0 !important;
            color: #000 !important;
          }
          #print-area * {
            color: #000 !important;
            background: transparent !important;
            box-shadow: none !important;
            text-shadow: none !important;
          }
          #print-area .card,
          #print-area [class*="rounded"] {
            border: 1px solid #ddd !important;
            border-radius: 6px !important;
            break-inside: avoid;
          }
          #print-area .badge {
            border: 1px solid #999 !important;
            padding: 1px 6px !important;
          }
          [data-noprint], [data-noprint] * { display: none !important; }
          @page { margin: 14mm; }
        }
      `}</style>
      <button type="button" onClick={() => window.print()}
        className="btn-ghost text-sm" data-noprint
        title="Yazdır veya PDF olarak kaydet">
        <Printer size={15} /> {label}
      </button>
    </>
  );
}
