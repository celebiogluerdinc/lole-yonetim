/**
 * SAHA SATIŞ MODÜLÜ — tipler ve etiketler
 *
 * Ayrı dosyada tutuluyor: types.ts'e eklenseydi o dosya üç katına çıkar
 * ve saha satışıyla ilgisi olmayan her değişiklikte çakışma riski doğardı.
 */

export type OutletStatus = 'aday' | 'aktif' | 'pasif' | 'kaybedildi';
export type OutletChannel =
  | 'horeca' | 'geleneksel' | 'modern' | 'yol' | 'kurumsal' | 'toptan' | 'diger';
export type ChainDecision = 'sube_karar' | 'merkez_karar' | 'karma';
export type SelectionMethod = 'sahip' | 'merkez' | 'menu_danismani' | 'sef' | 'diger';
export type ContactRole =
  | 'sahip' | 'isletme_muduru' | 'satin_alma' | 'muhasebe' | 'depo' | 'sef' | 'diger';
export type DecisionAuthority = 'karar_verir' | 'etkiler' | 'yok';

export type VisitOutcome =
  | 'tadim_planlandi' | 'teklif_istendi' | 'siparis' | 'takip' | 'olumsuz';
export type VisitStatus = 'taslak' | 'gonderildi' | 'onaylandi';
export type VisitType =
  | 'ilk_ziyaret' | 'rutin' | 'tanitim_tadim' | 'siparis' | 'tahsilat' | 'sikayet';
export type TastingVerdict = 'listeye_alir' | 'dusunur' | 'almaz';
export type Segment = 'A' | 'B' | 'C';

export interface Outlet {
  id: string;
  company_id: string;
  department_id: string | null;
  code: string | null;
  name: string;
  legal_name: string | null;
  parent_outlet_id: string | null;
  chain_decision: ChainDecision;
  type_id: string | null;
  city: string | null;
  district: string | null;
  address: string | null;
  tax_office: string | null;
  tax_number: string | null;
  phone: string | null;
  email: string | null;
  status: OutletStatus;
  current_supplier: string | null;
  top_selling_drink: string | null;
  selection_method: SelectionMethod | null;
  contract_end_date: string | null;
  preferred_contact_time: string | null;
  potential_monthly_volume: number | null;
  score: number | null;
  score_pct: number | null;
  segment: Segment | null;
  assigned_user_id: string | null;
  last_visit_at: string | null;
  is_active: boolean;
  created_at: string;
}

export interface OutletType {
  id: string;
  company_id: string;
  channel: OutletChannel;
  name: string;
  sort_order: number;
  is_quick_pick: boolean;
  is_active: boolean;
}

export interface OutletContact {
  id: string;
  outlet_id: string;
  role: ContactRole;
  full_name: string;
  phone: string | null;
  email: string | null;
  decision_authority: DecisionAuthority | null;
  preferred_contact_time: string | null;
  is_primary: boolean;
  note: string | null;
}

export interface Product {
  id: string;
  company_id: string;
  name: string;
  code: string | null;
  taste_reference: string | null;
  category: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface ScoreCriterion {
  id: string;
  company_id: string;
  grp: 'potansiyel' | 'gorusme' | 'icra' | 'genel' | 'aday';
  label: string;
  weight: number;
  applies_to: 'aday' | 'musteri' | 'hepsi';
  form_code: 'F02' | 'F03';
  scale_min: number;
  scale_max: number;
  sort_order: number;
  is_active: boolean;
}

export interface OutletAssessment {
  id: string;
  outlet_id: string;
  visit_id: string | null;
  assessed_by: string;
  assessed_at: string;
  contact_name: string | null;
  contact_role: string | null;
  contact_info: string | null;
  preferred_contact_time: string | null;
  customer_profile: string | null;
  raw_total: number;
  max_total: number;
  answered_count: number;
  criteria_count: number;
  score_pct: number | null;
  priority: Segment | null;
  note: string | null;
}

export interface Visit {
  id: string;
  company_id: string;
  outlet_id: string;
  user_id: string;
  visit_date: string;
  visit_type: VisitType;
  met_person_name: string | null;
  met_person_role: string | null;
  met_decision_authority: DecisionAuthority | null;
  main_need: string | null;
  offered_solution: string | null;
  outlet_comment: string | null;
  objection_stated_id: string | null;
  objection_real_id: string | null;
  objection_note: string | null;
  our_answer: string | null;
  outcome: VisitOutcome;
  order_requested: boolean;
  sales_order_id: string | null;
  customer_comment: string | null;
  private_note: string | null;
  overall_score: number | null;
  score_count: number;
  status: VisitStatus;
  created_at: string;
}

// ---------------------------------------------------------------
// Etiketler ve renkler — mevcut utils.ts desenine uygun
// ---------------------------------------------------------------

export const CHANNEL_LABEL: Record<OutletChannel, string> = {
  horeca: 'Ev Dışı Tüketim',
  geleneksel: 'Geleneksel Kanal',
  modern: 'Modern Kanal',
  yol: 'Yol Kanalı',
  kurumsal: 'Kurumsal',
  toptan: 'Toptan & Dağıtım',
  diger: 'Diğer'
};

export const OUTLET_STATUS_LABEL: Record<OutletStatus, string> = {
  aday: 'Aday',
  aktif: 'Aktif Müşteri',
  pasif: 'Pasif',
  kaybedildi: 'Kaybedildi'
};

export const OUTLET_STATUS_COLOR: Record<OutletStatus, string> = {
  aday: 'bg-amber-500/20 text-amber-300',
  aktif: 'bg-emerald-500/20 text-emerald-300',
  pasif: 'bg-white/10 text-[#8E8E93]',
  kaybedildi: 'bg-rose-500/20 text-rose-300'
};

export const SEGMENT_COLOR: Record<Segment, string> = {
  A: 'bg-emerald-500/20 text-emerald-300',
  B: 'bg-blue-500/20 text-blue-300',
  C: 'bg-white/10 text-[#AEAEB2]'
};

export const OUTCOME_LABEL: Record<VisitOutcome, string> = {
  tadim_planlandi: 'Tadım planlandı',
  teklif_istendi: 'Teklif istendi',
  siparis: 'Sipariş',
  takip: 'Takip',
  olumsuz: 'Olumsuz'
};

export const OUTCOME_COLOR: Record<VisitOutcome, string> = {
  tadim_planlandi: 'bg-indigo-500/20 text-indigo-300',
  teklif_istendi: 'bg-amber-500/20 text-amber-300',
  siparis: 'bg-emerald-500/20 text-emerald-300',
  takip: 'bg-blue-500/20 text-blue-300',
  olumsuz: 'bg-rose-500/20 text-rose-300'
};

export const VISIT_TYPE_LABEL: Record<VisitType, string> = {
  ilk_ziyaret: 'İlk ziyaret',
  rutin: 'Rutin',
  tanitim_tadim: 'Tanıtım / tadım',
  siparis: 'Sipariş',
  tahsilat: 'Tahsilat',
  sikayet: 'Şikâyet'
};

export const CONTACT_ROLE_LABEL: Record<ContactRole, string> = {
  sahip: 'İşletme sahibi',
  isletme_muduru: 'İşletme müdürü',
  satin_alma: 'Satın alma',
  muhasebe: 'Muhasebe',
  depo: 'Depo',
  sef: 'Şef',
  diger: 'Diğer'
};

export const AUTHORITY_LABEL: Record<DecisionAuthority, string> = {
  karar_verir: 'Karar verir',
  etkiler: 'Etkiler',
  yok: 'Yetkisi yok'
};

export const VERDICT_LABEL: Record<TastingVerdict, string> = {
  listeye_alir: 'Listeye alır',
  dusunur: 'Düşünür',
  almaz: 'Almaz'
};

export const SELECTION_METHOD_LABEL: Record<SelectionMethod, string> = {
  sahip: 'Sahibi karar verir',
  merkez: 'Merkez karar verir',
  menu_danismani: 'Menü danışmanı',
  sef: 'Şef',
  diger: 'Diğer'
};

/**
 * ORTAK PUANLAMA ÖLÇEĞİ — her yerde 1–5.
 * F02 aday değerlendirmesi de, F03 ziyaret puanlaması da aynı ölçeği kullanır;
 * iki farklı ölçek hem eğitimi hem raporu gereksiz yere zorlaştırıyordu.
 * Boş bırakmak "bilinmiyor" demektir ve puanı DÜŞÜRMEZ — paydaya girmez.
 */
export const SCALE_LABEL: Record<number, string> = {
  1: 'Çok zayıf',
  2: 'Zayıf',
  3: 'Orta',
  4: 'İyi',
  5: 'Çok iyi'
};

/** Yüzdeden segment — veritabanındaki kuralın birebir aynısı */
export function segmentFromPct(pct: number | null): Segment | null {
  if (pct === null || pct === undefined) return null;
  if (pct >= 80) return 'A';
  if (pct >= 50) return 'B';
  return 'C';
}


// ---------- HUNİ (v_outlet_funnel.stage) ----------
// Aşama okuma anında hesaplanır; outlets.status'tan bağımsızdır.
export type FunnelStage =
  | 'havuz' | 'temas' | 'tadim' | 'teklif' | 'ilk_siparis'
  | 'aktif' | 'donuk' | 'kaybedildi' | 'pasif';

/** Huni sırası — grafikte ve listelerde bu sırayla gösterilir. */
export const FUNNEL_ORDER: FunnelStage[] = [
  'havuz', 'temas', 'tadim', 'teklif', 'ilk_siparis', 'aktif', 'donuk', 'kaybedildi'
];

export const FUNNEL_LABEL: Record<FunnelStage, string> = {
  havuz: 'Havuz',
  temas: 'Temas',
  tadim: 'Tadım',
  teklif: 'Teklif',
  ilk_siparis: 'İlk sipariş',
  aktif: 'Aktif',
  donuk: 'Donuk',
  kaybedildi: 'Kaybedildi',
  pasif: 'Pasif'
};

export const FUNNEL_HINT: Record<FunnelStage, string> = {
  havuz: 'Kartotekte, henüz temas yok',
  temas: 'Ziyaret edildi',
  tadim: 'Tadım yapıldı',
  teklif: 'Yazılı teklif verildi',
  ilk_siparis: 'Tek sipariş — ikinci sipariş gerçek dönüşüm',
  aktif: 'İki ve üzeri sipariş, döngü içinde',
  donuk: 'Sipariş vermişti, döngüsünü aştı',
  kaybedildi: 'Kaybedildi olarak işaretlendi',
  pasif: 'Pasife alındı'
};

export const FUNNEL_COLOR: Record<FunnelStage, string> = {
  havuz: 'bg-white/10 text-[#AEAEB2]',
  temas: 'bg-sky-500/20 text-sky-300',
  tadim: 'bg-indigo-500/20 text-indigo-300',
  teklif: 'bg-blue-500/20 text-blue-300',
  ilk_siparis: 'bg-amber-500/20 text-amber-300',
  aktif: 'bg-emerald-500/20 text-emerald-300',
  donuk: 'bg-rose-500/20 text-rose-300',
  kaybedildi: 'bg-white/10 text-[#8E8E93]',
  pasif: 'bg-white/10 text-[#8E8E93]'
};

/** Takibin sonucu (follow_ups.result) */
export const FOLLOWUP_RESULT_LABEL: Record<'kazanildi' | 'kaybedildi' | 'devam', string> = {
  kazanildi: 'Kazanıldı',
  kaybedildi: 'Kaybedildi',
  devam: 'Devam ediyor'
};
