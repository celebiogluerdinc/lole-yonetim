/**
 * SAHA SATIŞ ÖLÇÜLERİ — tek hesap yeri
 *
 * Rapor ekranının bütün sayıları buradan çıkar. 'use client' OLMAYAN
 * saf bir dosya: hem sunucu hem istemci bileşeni çağırabilir, test
 * edilebilir, ve aynı ölçü iki ekranda iki farklı sonuç vermez.
 *
 * Denetimde bulunan üç hata bu dosyanın var olma sebebi:
 *  1. "Satış" rakamına taslak ve onay bekleyen siparişler de giriyordu.
 *     Artık GERÇEKLEŞEN (onaylı · sevk · teslim) ile BEKLEYEN ayrı.
 *  2. Temsilci filtresi ziyaretlere uygulanıp siparişlere uygulanmıyordu.
 *     Artık her ölçü aynı kapsamdan (dönem + temsilci) hesaplanıyor.
 *  3. Gün anahtarı bir yerde UTC, bir yerde İstanbul'du; gece yarısına
 *     yakın siparişler yanlış güne düşüyordu. Artık her tarih İstanbul
 *     günü (sipariş için görünümdeki order_date, ziyaret için visit_date).
 *
 * Tutarlar KDV HARİÇ net satır toplamıdır (line_total).
 */

export const REALIZED = ['onayli', 'sevk_edildi', 'teslim'];
export const PIPELINE = ['taslak', 'onay_bekliyor'];
/** Numune kuralı: ziyaret başına en fazla 4 kapalı şişe bırakılır. */
export const SEALED_LIMIT = 4;

// ---------- ham satır tipleri (sayfanın çektiği sütunlar) ----------
export interface LineRow {
  order_id: string; order_no: number | null; status: string; order_date: string;
  created_by: string | null; outlet_id: string; outlet_name: string | null;
  channel: string | null; product_id: string; product_name: string | null;
  paid_cases: number | null; free_cases: number | null;
  case_price: number | null; list_case_price: number | null;
  line_total: number | null; free_value: number | null; is_verbal: boolean | null;
}
export interface VisitRow {
  id: string; visit_date: string; outcome: string; status: string; user_id: string;
  outlet_id: string; visit_type: string | null; met_decision_authority: string | null;
  objection_stated_id: string | null; objection_real_id: string | null;
  outlets: { name: string | null; potential_monthly_volume: number | null } | null;
  visit_tastings: { product_id: string; bottles_opened: number | null; bottles_left_sealed: number | null }[] | null;
}
export interface FunnelRow {
  outlet_id: string; name: string | null; stage: string; assigned_user_id: string | null;
  order_count: number | null; order_total: number | null; first_order_at: string | null;
  last_order_at: string | null; days_since_order: number | null; cycle_days: number | null;
  district: string | null; city: string | null;
}
export interface FollowUpRow {
  id: string; status: string; due_date: string; owner_user_id: string | null;
  result: string | null; lost_reason_id: string | null; outlet_id: string | null;
  created_at: string;
  outlets: { name: string | null; potential_monthly_volume: number | null } | null;
}
export interface RoutePlanRow { plan_date: string; user_id: string; target_visits: number | null }

export interface Scope { from: string; to: string; rep: string }

// ---------- tarih yardımcıları (YYYY-AA-GG metin, saat dilimi yok) ----------
export function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000);
}
/** Haftanın pazartesisi — haftalık kovaların anahtarı. */
export function weekStart(iso: string): string {
  const d = new Date(iso + 'T12:00:00Z');
  const dow = (d.getUTCDay() + 6) % 7;            // pazartesi = 0
  return addDays(iso, -dow);
}
const num = (v: unknown) => { const n = Number(v ?? 0); return Number.isFinite(n) ? n : 0; };
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);
const inRange = (d: string, s: Scope) => d >= s.from && d <= s.to;

/** Dönemin hemen öncesindeki eşit uzunluktaki pencere — karşılaştırma için. */
export function previousScope(s: Scope): Scope {
  const len = daysBetween(s.from, s.to) + 1;
  return { from: addDays(s.from, -len), to: addDays(s.from, -1), rep: s.rep };
}

// ---------- satış ----------
export function scopedLines(lines: LineRow[], s: Scope): LineRow[] {
  return lines.filter(l => inRange(l.order_date, s) && (!s.rep || l.created_by === s.rep));
}

export interface SalesTotals {
  net: number; cases: number; orders: number; outlets: number;
  pipelineNet: number; pipelineOrders: number;
  freeCases: number; freeValue: number; avgCasePrice: number | null;
  directOrders: number;
}

export function salesTotals(lines: LineRow[], s: Scope): SalesTotals {
  const rows = scopedLines(lines, s);
  const real = rows.filter(l => REALIZED.includes(l.status));
  const pipe = rows.filter(l => PIPELINE.includes(l.status));
  const net = real.reduce((a, l) => a + num(l.line_total), 0);
  const cases = real.reduce((a, l) => a + num(l.paid_cases), 0);
  const realOrders = new Set(real.map(l => l.order_id));
  return {
    net, cases,
    orders: realOrders.size,
    outlets: new Set(real.map(l => l.outlet_id)).size,
    pipelineNet: pipe.reduce((a, l) => a + num(l.line_total), 0),
    pipelineOrders: new Set(pipe.map(l => l.order_id)).size,
    freeCases: real.reduce((a, l) => a + num(l.free_cases), 0),
    freeValue: real.reduce((a, l) => a + num(l.free_value), 0),
    avgCasePrice: cases > 0 ? net / cases : null,
    directOrders: new Set(real.filter(l => l.is_verbal).map(l => l.order_id)).size
  };
}

/** Yüzde değişim; önceki dönem sıfırsa karşılaştırma anlamsız → null. */
export function delta(cur: number, prev: number): number | null {
  if (!(prev > 0)) return null;
  return Math.round(((cur - prev) / prev) * 1000) / 10;
}

export interface Bucket { key: string; label: string; net: number; cases: number; visits: number }

/**
 * Zaman serisi: 14 güne kadar günlük, üstünde haftalık kova.
 * Boş kovalar da üretilir — satış olmayan hafta çizgide sıfır olarak
 * görünmeli, yok sayılmamalı.
 */
export function trend(lines: LineRow[], visits: VisitRow[], s: Scope): { weekly: boolean; buckets: Bucket[] } {
  const len = daysBetween(s.from, s.to) + 1;
  const weekly = len > 14;
  const keyOf = (d: string) => (weekly ? weekStart(d) : d);
  const map = new Map<string, Bucket>();
  const fmt = (iso: string) =>
    new Date(iso + 'T12:00:00Z').toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', timeZone: 'UTC' });

  for (let d = keyOf(s.from); d <= s.to; d = addDays(d, weekly ? 7 : 1)) {
    map.set(d, { key: d, label: fmt(d), net: 0, cases: 0, visits: 0 });
  }
  for (const l of scopedLines(lines, s)) {
    if (!REALIZED.includes(l.status)) continue;
    const b = map.get(keyOf(l.order_date));
    if (b) { b.net += num(l.line_total); b.cases += num(l.paid_cases); }
  }
  for (const v of scopedVisits(visits, s)) {
    const b = map.get(keyOf(v.visit_date));
    if (b) b.visits += 1;
  }
  return { weekly, buckets: Array.from(map.values()) };
}

// ---------- ziyaret ----------
/** Taslak ziyaret sayılmaz: gönderilmemiş kayıt henüz yapılmış iş değildir. */
export function scopedVisits(visits: VisitRow[], s: Scope): VisitRow[] {
  return visits.filter(v =>
    v.status !== 'taslak' && inRange(v.visit_date, s) && (!s.rep || v.user_id === s.rep));
}

/**
 * Ağırlıklı ziyaret birimi. Her ziyaret aynı değerde değil:
 *   karar vericiyle tadım = 2 · ilk temas = 2 · diğer = 1 · yetkili yoktu = 0
 * Sayıyı şişirmek için kapıdan dönülen ziyaretler hedefe sayılmasın diye.
 */
export function visitWeight(v: VisitRow): number {
  if (v.met_decision_authority === 'yok') return 0;
  const tasted = (v.visit_tastings ?? []).length > 0;
  if (tasted && v.met_decision_authority === 'karar_verir') return 2;
  if (v.visit_type === 'ilk_ziyaret') return 2;
  return 1;
}

export interface VisitTotals {
  count: number; weighted: number; outlets: number;
  decisionMaker: number; noAuthority: number; tasting: number;
  target: number | null; attainment: number | null;
}

export function visitTotals(visits: VisitRow[], plans: RoutePlanRow[], s: Scope): VisitTotals {
  const rows = scopedVisits(visits, s);
  // Hedef rota planından gelir: temsilcinin o gün için kendi koyduğu sayı.
  const target = plans
    .filter(p => inRange(p.plan_date, s) && (!s.rep || p.user_id === s.rep))
    .reduce((a, p) => a + num(p.target_visits), 0);
  const weighted = rows.reduce((a, v) => a + visitWeight(v), 0);
  return {
    count: rows.length,
    weighted,
    outlets: new Set(rows.map(v => v.outlet_id)).size,
    decisionMaker: rows.filter(v => v.met_decision_authority === 'karar_verir').length,
    noAuthority: rows.filter(v => v.met_decision_authority === 'yok').length,
    tasting: rows.filter(v => (v.visit_tastings ?? []).length > 0).length,
    target: target > 0 ? target : null,
    attainment: target > 0 ? pct(rows.length, target) : null
  };
}

// ---------- temsilci karnesi ----------
export interface RepCard {
  id: string; name: string;
  visits: number; weighted: number; target: number | null; attainment: number | null;
  decisionRate: number | null; tastings: number;
  orders: number; cases: number; net: number; newCustomers: number;
  openFollowUps: number; overdueFollowUps: number;
}

/**
 * Karne. Ziyaret puanı ortalaması BİLEREK yok: karnede gösterilirse
 * temsilci kendi verdiği puanı şişirir, nokta segmenti bozulur. Puan
 * planlama girdisidir, performans notu değil.
 */
export function repCards(
  people: { id: string; full_name: string | null }[],
  lines: LineRow[], visits: VisitRow[], plans: RoutePlanRow[],
  funnel: FunnelRow[], followUps: FollowUpRow[], s: Scope, today: string
): RepCard[] {
  const all: Scope = { ...s, rep: '' };
  const real = scopedLines(lines, all).filter(l => REALIZED.includes(l.status));
  const vis = scopedVisits(visits, all);
  const ids = new Set<string>();
  real.forEach(l => l.created_by && ids.add(l.created_by));
  vis.forEach(v => ids.add(v.user_id));
  if (s.rep) { ids.clear(); ids.add(s.rep); }

  const out: RepCard[] = [];
  for (const id of Array.from(ids)) {
    const rl = real.filter(l => l.created_by === id);
    const rv = vis.filter(v => v.user_id === id);
    const target = plans.filter(p => p.user_id === id && inRange(p.plan_date, s))
      .reduce((a, p) => a + num(p.target_visits), 0);
    const known = rv.filter(v => !!v.met_decision_authority);
    const fu = followUps.filter(f => f.owner_user_id === id && f.status === 'acik');
    out.push({
      id,
      name: people.find(p => p.id === id)?.full_name ?? '—',
      visits: rv.length,
      weighted: rv.reduce((a, v) => a + visitWeight(v), 0),
      target: target > 0 ? target : null,
      attainment: target > 0 ? pct(rv.length, target) : null,
      decisionRate: pct(known.filter(v => v.met_decision_authority === 'karar_verir').length, known.length),
      tastings: rv.filter(v => (v.visit_tastings ?? []).length > 0).length,
      orders: new Set(rl.map(l => l.order_id)).size,
      cases: rl.reduce((a, l) => a + num(l.paid_cases), 0),
      net: rl.reduce((a, l) => a + num(l.line_total), 0),
      newCustomers: funnel.filter(f => f.assigned_user_id === id && f.first_order_at
        && inRange(f.first_order_at.slice(0, 10), s)).length,
      openFollowUps: fu.length,
      overdueFollowUps: fu.filter(f => f.due_date < today).length
    });
  }
  return out.sort((a, b) => b.net - a.net || b.weighted - a.weighted);
}

// ---------- huni ----------
export const STAGES = ['havuz', 'temas', 'tadim', 'teklif', 'ilk_siparis', 'aktif', 'donuk', 'kaybedildi'] as const;

/** Huni ANLIK durumdur (dönemden bağımsız); yalnız temsilci kapsamı uygulanır. */
export function funnelCounts(funnel: FunnelRow[], rep: string) {
  const rows = funnel.filter(f => !rep || f.assigned_user_id === rep);
  return {
    rows,
    stages: STAGES.map(st => ({ stage: st, n: rows.filter(f => f.stage === st).length })),
    frozen: rows.filter(f => f.stage === 'donuk')
      .sort((a, b) => num(b.order_total) - num(a.order_total)),
    firstOrder: rows.filter(f => f.stage === 'ilk_siparis')
      .sort((a, b) => num(b.days_since_order) - num(a.days_since_order))
  };
}

// ---------- itirazlar ----------
export interface ObjectionRow {
  id: string; label: string; stated: number; real: number; lost: number;
  /** Bu nedenle takılan noktaların aylık potansiyeli (TL) — her nokta bir kez */
  monthlyTl: number;
}

/**
 * İtiraz dağılımı, TL ağırlığıyla.
 *
 * Sayım tek başına yanıltıcı: on bakkalın "pahalı" demesi ile bir otelin
 * "tedarikçim var" demesi aynı kayıp değil. Her nedenin yanında o nedene
 * takılan noktaların aylık potansiyeli (koli × koli liste fiyatı) duruyor.
 * Ziyaretten haftalar sonra takipte "kaybedildi" diye kapanan noktalar da
 * dahil — eskiden hiçbir nedene bağlanmıyorlardı.
 */
export function objections(
  visits: VisitRow[], followUps: FollowUpRow[],
  reasons: { id: string; label: string }[], s: Scope, caseListPrice: number
): ObjectionRow[] {
  const m = new Map<string, ObjectionRow & { seen: Set<string> }>();
  const get = (id: string) => {
    let r = m.get(id);
    if (!r) {
      r = {
        id, label: reasons.find(x => x.id === id)?.label ?? 'Diğer',
        stated: 0, real: 0, lost: 0, monthlyTl: 0, seen: new Set<string>()
      };
      m.set(id, r);
    }
    return r;
  };
  const weigh = (r: ObjectionRow & { seen: Set<string> }, outletId: string | null, pot: number | null | undefined) => {
    if (!outletId || r.seen.has(outletId)) return;
    r.seen.add(outletId);
    r.monthlyTl += num(pot) * caseListPrice;
  };

  for (const v of scopedVisits(visits, s)) {
    // Gerçek neden biliniyorsa ağırlık ona yazılır; beyan çoğu zaman bahanedir.
    const main = v.objection_real_id ?? v.objection_stated_id;
    if (v.objection_stated_id) get(v.objection_stated_id).stated++;
    if (v.objection_real_id) get(v.objection_real_id).real++;
    if (main) weigh(get(main), v.outlet_id, v.outlets?.potential_monthly_volume);
  }
  for (const f of followUps) {
    if (f.result !== 'kaybedildi' || !f.lost_reason_id) continue;
    const day = f.created_at.slice(0, 10);
    if (!inRange(day, s) || (s.rep && f.owner_user_id !== s.rep)) continue;
    const r = get(f.lost_reason_id);
    r.lost++;
    weigh(r, f.outlet_id, f.outlets?.potential_monthly_volume);
  }
  return Array.from(m.values())
    .map(({ seen: _seen, ...r }) => r)
    .sort((a, b) => b.monthlyTl - a.monthlyTl || (b.stated + b.real + b.lost) - (a.stated + a.real + a.lost));
}

// ---------- ürün × kanal ----------
export interface Matrix {
  rows: { id: string; label: string; total: number }[];
  cols: { id: string; label: string; total: number }[];
  cell: (rowId: string, colId: string) => { cases: number; net: number };
  max: number;
}

export function productChannel(
  lines: LineRow[], s: Scope, channelLabel: Record<string, string>
): Matrix {
  const real = scopedLines(lines, s).filter(l => REALIZED.includes(l.status));
  const cells = new Map<string, { cases: number; net: number }>();
  const rows = new Map<string, { id: string; label: string; total: number }>();
  const cols = new Map<string, { id: string; label: string; total: number }>();
  for (const l of real) {
    const ch = l.channel ?? 'diger';
    const c = num(l.paid_cases);
    const k = l.product_id + '|' + ch;
    const cur = cells.get(k) ?? { cases: 0, net: 0 };
    cur.cases += c; cur.net += num(l.line_total);
    cells.set(k, cur);
    const r = rows.get(l.product_id) ?? { id: l.product_id, label: l.product_name ?? 'Ürün', total: 0 };
    r.total += c; rows.set(l.product_id, r);
    const co = cols.get(ch) ?? { id: ch, label: channelLabel[ch] ?? ch, total: 0 };
    co.total += c; cols.set(ch, co);
  }
  const max = Math.max(0, ...Array.from(cells.values()).map(c => c.cases));
  return {
    rows: Array.from(rows.values()).sort((a, b) => b.total - a.total),
    cols: Array.from(cols.values()).sort((a, b) => b.total - a.total),
    cell: (r, c) => cells.get(r + '|' + c) ?? { cases: 0, net: 0 },
    max
  };
}

// ---------- fiyat erozyonu ----------
export interface ErosionRow {
  id: string; label: string; cases: number;
  listCase: number | null; avgCase: number | null;
  /** Liste altı satılan kolilerin toplam farkı (TL) */
  lostTl: number; discountPct: number | null; belowCases: number;
}

/**
 * Liste fiyatı ile gerçekleşen koli fiyatı arasındaki fark.
 * "Kaç TL'yi masada bıraktık" sorusu: yalnız LİSTE ALTI satılan koliler
 * sayılır; liste üstü satış erozyonu örtmez.
 */
export function priceErosion(lines: LineRow[], s: Scope): ErosionRow[] {
  const real = scopedLines(lines, s).filter(l => REALIZED.includes(l.status) && num(l.paid_cases) > 0);
  const m = new Map<string, ErosionRow & { net: number; listSum: number; listN: number }>();
  for (const l of real) {
    const r = m.get(l.product_id) ?? {
      id: l.product_id, label: l.product_name ?? 'Ürün', cases: 0, listCase: null, avgCase: null,
      lostTl: 0, discountPct: null, belowCases: 0, net: 0, listSum: 0, listN: 0
    };
    const c = num(l.paid_cases), cp = num(l.case_price), lp = num(l.list_case_price);
    r.cases += c; r.net += num(l.line_total);
    if (lp > 0) {
      r.listSum += lp * c; r.listN += c;
      if (cp < lp - 0.005) { r.lostTl += (lp - cp) * c; r.belowCases += c; }
    }
    m.set(l.product_id, r);
  }
  return Array.from(m.values()).map(({ net, listSum, listN, ...r }) => {
    const listCase = listN > 0 ? listSum / listN : null;
    const avgCase = r.cases > 0 ? net / r.cases : null;
    return {
      ...r, listCase, avgCase,
      discountPct: listCase && avgCase !== null ? Math.round(((listCase - avgCase) / listCase) * 1000) / 10 : null
    };
  }).sort((a, b) => b.lostTl - a.lostTl || b.cases - a.cases);
}

// ---------- tadım ve numune ----------
export interface TastingStats {
  visits: number; opened: number; sealed: number; overLimit: number;
  outletsTasted: number; outletsConverted: number; conversion: number | null;
  /** 30 günü henüz dolmamış tadımlar — dönüşüm oranı bunları saymaz */
  immature: number;
  sampleCost: number;
}

/**
 * Tadım → 30 gün içinde sipariş. NOKTA bazında: aynı noktaya üç tadım
 * yapılıp bir sipariş alındıysa dönüşüm üçte bir değil, birde birdir.
 * 30 günü dolmamış tadımlar paydaya girmez (henüz karar verilemez).
 */
export function tastingStats(
  visits: VisitRow[], lines: LineRow[], s: Scope, today: string, bottleListPrice: number
): TastingStats {
  const tasted = scopedVisits(visits, s).filter(v => (v.visit_tastings ?? []).length > 0);
  let opened = 0, sealed = 0, overLimit = 0;
  const firstByOutlet = new Map<string, string>();
  for (const v of tasted) {
    const o = (v.visit_tastings ?? []).reduce((a, t) => a + num(t.bottles_opened), 0);
    const c = (v.visit_tastings ?? []).reduce((a, t) => a + num(t.bottles_left_sealed), 0);
    opened += o; sealed += c;
    if (c > SEALED_LIMIT) overLimit++;
    const cur = firstByOutlet.get(v.outlet_id);
    if (!cur || v.visit_date < cur) firstByOutlet.set(v.outlet_id, v.visit_date);
  }
  const orderDays = new Map<string, string[]>();
  for (const l of lines) {
    if (l.status === 'iptal') continue;
    const a = orderDays.get(l.outlet_id) ?? [];
    a.push(l.order_date); orderDays.set(l.outlet_id, a);
  }
  let mature = 0, converted = 0, immature = 0;
  for (const [outlet, day] of Array.from(firstByOutlet.entries())) {
    const end = addDays(day, 30);
    const hit = (orderDays.get(outlet) ?? []).some(d => d >= day && d <= end);
    if (hit) { converted++; mature++; }
    else if (end <= today) mature++;
    else immature++;
  }
  return {
    visits: tasted.length, opened, sealed, overLimit,
    outletsTasted: firstByOutlet.size, outletsConverted: converted,
    conversion: pct(converted, mature), immature,
    sampleCost: (opened + sealed) * bottleListPrice
  };
}

// ---------- biçim ----------
/** Kısa TL: 12.900 ₺ · 1,2 Mn ₺. Kuruş raporda gürültüdür. */
export function tlShort(n: number | null | undefined): string {
  const v = num(n);
  if (Math.abs(v) >= 1_000_000) {
    return (v / 1_000_000).toLocaleString('tr-TR', { maximumFractionDigits: 1 }) + ' Mn ₺';
  }
  return Math.round(v).toLocaleString('tr-TR') + ' ₺';
}
export function nf(n: number | null | undefined, digits = 0): string {
  return num(n).toLocaleString('tr-TR', { maximumFractionDigits: digits });
}
/** Eksen için temiz üst sınır: 1, 2, 2.5, 5 × 10^k. */
export function niceMax(v: number): number {
  if (!(v > 0)) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (v <= m * p) return m * p;
  return 10 * p;
}
