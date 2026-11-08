/**
 * TEKLİF VE SİPARİŞ SÖZLÜĞÜ (F05 · F06)
 *
 * Durum etiketleri, renkler ve birim çevrimi burada — 'use client'
 * OLMAYAN bir dosyada. Sebebi teknik ve önemli: bir istemci modülünden
 * (`'use client'`) dışa verilen saf fonksiyon, sunucu bileşeninden
 * çağrıldığında Next.js istemci referansına dönüşür ve çalışma anında
 * hata verir — derleme bunu yakalamaz. Sipariş ve teklif detay
 * sayfaları sunucu bileşeni olduğu için tutar biçimlendirmesi ve
 * etiketler bu nötr dosyadan geliyor.
 */

/** 1 koli = 12 × 250 ml şişe. Saha koli ile düşünür, veritabanı şişe tutar. */
export const BOTTLES_PER_CASE = 12;

/** Şişe adedini koliye çevirir; kırık koli varsa ondalık gösterir. */
export function casesOf(bottles: number | null | undefined): string {
  const b = Number(bottles ?? 0);
  const c = b / BOTTLES_PER_CASE;
  return Number.isInteger(c) ? String(c) : c.toFixed(2);
}

/** Tutarı Türk Lirası biçiminde gösterir. */
export function tl(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return Number(n).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';
}

export type QuoteStatus =
  | 'taslak' | 'kontrolde' | 'onayli' | 'sunuldu' | 'kabul' | 'red' | 'suresi_doldu' | 'iptal';
export type OrderStatus =
  | 'taslak' | 'onay_bekliyor' | 'onayli' | 'sevk_edildi' | 'teslim' | 'iptal';

export const QUOTE_STATUS_LABEL: Record<QuoteStatus, string> = {
  taslak: 'Taslak',
  kontrolde: 'Kontrolde',
  onayli: 'Onaylı',
  sunuldu: 'Sunuldu',
  kabul: 'Kabul edildi',
  red: 'Reddedildi',
  suresi_doldu: 'Süresi doldu',
  iptal: 'İptal'
};

export const QUOTE_STATUS_COLOR: Record<QuoteStatus, string> = {
  taslak: 'bg-white/10 text-[#8E8E93]',
  kontrolde: 'bg-amber-500/20 text-amber-300',
  onayli: 'bg-blue-500/20 text-blue-300',
  sunuldu: 'bg-indigo-500/20 text-indigo-300',
  kabul: 'bg-emerald-500/20 text-emerald-300',
  red: 'bg-rose-500/20 text-rose-300',
  suresi_doldu: 'bg-white/10 text-[#AEAEB2]',
  iptal: 'bg-white/10 text-[#8E8E93]'
};

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  taslak: 'Taslak',
  onay_bekliyor: 'Onay bekliyor',
  onayli: 'Onaylı',
  sevk_edildi: 'Sevk edildi',
  teslim: 'Teslim edildi',
  iptal: 'İptal'
};

export const ORDER_STATUS_COLOR: Record<OrderStatus, string> = {
  taslak: 'bg-white/10 text-[#8E8E93]',
  onay_bekliyor: 'bg-amber-500/20 text-amber-300',
  onayli: 'bg-blue-500/20 text-blue-300',
  sevk_edildi: 'bg-indigo-500/20 text-indigo-300',
  teslim: 'bg-emerald-500/20 text-emerald-300',
  iptal: 'bg-white/10 text-[#8E8E93]'
};

/** Teklif ve siparişin "kapanmış" sayıldığı durumlar. */
export const QUOTE_CLOSED: QuoteStatus[] = ['kabul', 'red', 'suresi_doldu', 'iptal'];
export const ORDER_CLOSED: OrderStatus[] = ['teslim', 'iptal'];
