import { redirect } from 'next/navigation';
import { getCtx } from '@/lib/auth';
import { TZ } from '@/lib/utils';
import { chunkedIn, selectAll } from '@/lib/db';
import MerkezClient from '@/components/MerkezClient';

export const dynamic = 'force-dynamic';

/**
 * ŞİRKET YÖNETİM MERKEZİ
 *
 * Admin ve süper yönetici için TEK ekran: bütün şirketler ve sipariş hattı
 * bir arada. Şirket değiştirmeden onay verilir, görev kapatılır, hareketler
 * izlenir.
 *
 * Güvenlik: bu sayfa yeni bir yetki AÇMAZ. Adminler zaten veritabanı
 * kuralları gereği (is_super_admin) tüm şirketleri okuyup güncelleyebiliyor;
 * burada yapılan yalnızca o veriyi tek yerde toplamaktır. Sayfaya admin
 * olmayan biri girerse hem burada hem de veritabanında engellenir.
 */

const FEED_LIMIT = 40;

export default async function MerkezPage({
  searchParams
}: { searchParams: { s?: string; t?: string } }) {
  const { supabase, profile } = await getCtx();

  const isAdmin = ['super_admin', 'admin'].includes(profile.role);
  if (!isAdmin || (profile as any).is_customer) redirect('/home');

  const seciliSirket = searchParams.s ?? 'all';   // şirket kimliği ya da 'all'
  const seciliTur = searchParams.t ?? 'all';      // 'onay' | 'all'

  // ---- TEK TURDA TÜM VERİ ----
  // Şirket filtresi YOK: admin tüm şirketleri görür (RLS zaten sınırı çiziyor).
  const [
    companiesRes,
    purchasePendingRes, paymentPendingRes, leavePendingRes,
    incidentPendingRes, reviewPendingRes,
    feedPurchaseRes, feedPaymentRes, feedIncidentRes,
    feedMeetingRes, feedTaskRes, feedAnnRes
  ] = await Promise.all([
    supabase.from('companies').select('id, name, kind, is_active').order('name'),

    // ---- ONAY BEKLEYENLER ----
    // Bekleyenler SAYFA SAYFA okunur: sabit bir sınır konsaydı kenar çubuğundaki
    // rozet ile listedeki sayı birbirini tutmazdı.
    selectAll<any>(() => supabase.from('purchase_requests')
      .select('id, title, order_no, company_id, requester_id, created_at, needed_at')
      .eq('status', 'pending').order('created_at', { ascending: true })).then(data => ({ data })),
    selectAll<any>(() => supabase.from('payment_requests')
      .select('id, work_title, firm_name, amount, company_id, requester_id, created_at')
      .eq('status', 'pending').order('created_at', { ascending: true })).then(data => ({ data })),
    selectAll<any>(() => supabase.from('leave_requests')
      .select('id, user_id, company_id, start_date, end_date, reason, created_at')
      .eq('status', 'pending').order('created_at', { ascending: true })).then(data => ({ data })),
    selectAll<any>(() => supabase.from('incidents')
      .select('id, title, severity, company_id, reporter_id, created_at')
      .eq('status', 'pending').order('created_at', { ascending: true })).then(data => ({ data })),
    selectAll<any>(() => supabase.from('tasks')
      .select('id, title, company_id, due_at, completed_at')
      .eq('status', 'pending_review').order('completed_at', { ascending: true })).then(data => ({ data })),

    // ---- SON HAREKETLER ----
    supabase.from('purchase_requests')
      .select('id, title, order_no, status, company_id, requester_id, created_at')
      .order('created_at', { ascending: false }).limit(FEED_LIMIT),
    supabase.from('payment_requests')
      .select('id, work_title, firm_name, status, company_id, requester_id, created_at')
      .order('created_at', { ascending: false }).limit(FEED_LIMIT),
    supabase.from('incidents')
      .select('id, title, severity, status, company_id, reporter_id, created_at')
      .order('created_at', { ascending: false }).limit(FEED_LIMIT),
    supabase.from('meetings')
      .select('id, title, status, company_id, created_by, created_at, meeting_at')
      .order('created_at', { ascending: false }).limit(FEED_LIMIT),
    supabase.from('tasks')
      .select('id, title, status, company_id, completed_at')
      .in('status', ['completed', 'cancelled'])
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false }).limit(FEED_LIMIT),
    supabase.from('announcements')
      .select('id, title, company_id, author_id, created_at')
      .order('created_at', { ascending: false }).limit(FEED_LIMIT)
  ]);

  // Sessiz hata olmasın: bir sorgu düşerse listeden eksik çıkar ama kimse fark
  // etmez. Sunucu günlüğüne yazılır ki eksik veri sessizce kaybolmasın.
  for (const [ad_, res] of Object.entries({
    companies: companiesRes, purchasePending: purchasePendingRes,
    paymentPending: paymentPendingRes, leavePending: leavePendingRes,
    incidentPending: incidentPendingRes, reviewPending: reviewPendingRes,
    feedPurchase: feedPurchaseRes, feedPayment: feedPaymentRes,
    feedIncident: feedIncidentRes, feedMeeting: feedMeetingRes,
    feedTask: feedTaskRes, feedAnn: feedAnnRes
  })) {
    const e = (res as any)?.error;
    if (e) console.error(`[merkez] ${ad_} sorgusu başarısız:`, e.message);
  }

  const companies = (companiesRes.data ?? []) as any[];
  const companyById: Record<string, { name: string; orderLine: boolean }> = {};
  for (const c of companies) {
    companyById[c.id] = { name: c.name, orderLine: c.kind === 'order_line' };
  }

  // ---- KİŞİ ADLARI ----
  // Gömülü sorgu yerine tek seferde toplanır: satır sayısı arttığında
  // istek uzunluğu sınırına takılmasın diye parçalı okunur.
  const kisiIds = new Set<string>();
  const topla = (rows: any[] | null | undefined, alan: string) => {
    for (const r of rows ?? []) if (r[alan]) kisiIds.add(r[alan]);
  };
  topla(purchasePendingRes.data, 'requester_id');
  topla(paymentPendingRes.data, 'requester_id');
  topla(leavePendingRes.data, 'user_id');
  topla(incidentPendingRes.data, 'reporter_id');
  topla(feedPurchaseRes.data, 'requester_id');
  topla(feedPaymentRes.data, 'requester_id');
  topla(feedIncidentRes.data, 'reporter_id');
  topla(feedMeetingRes.data, 'created_by');
  topla(feedAnnRes.data, 'author_id');

  const kisiler = kisiIds.size
    ? await chunkedIn<any>(
        chunk => supabase.from('profiles')
          .select('id, full_name, customer_name, is_customer').in('id', chunk),
        Array.from(kisiIds))
    : [];
  const adById: Record<string, string> = {};
  for (const p of kisiler) {
    adById[p.id] = p.is_customer && p.customer_name
      ? `${p.customer_name} (${p.full_name})`
      : (p.full_name ?? '—');
  }
  const ad = (id: string | null) => (id && adById[id]) || '—';
  const sirket = (id: string | null) => (id && companyById[id]?.name) || 'Bilinmeyen şirket';
  const hatMi = (id: string | null) => !!(id && companyById[id]?.orderLine);

  // ---- ONAY BEKLEYENLER LİSTESİ ----
  type Bekleyen = {
    key: string; kind: 'purchase' | 'payment' | 'leave' | 'incident' | 'review';
    id: string; companyId: string; company: string; orderLine: boolean;
    title: string; sub: string; who: string; at: string; href: string;
  };

  const bekleyenler: Bekleyen[] = [];
  // Kimse kendi talebini onaylayamaz (süper yönetici hariç) — o satırları
  // listeye hiç koymuyoruz ki tıklayıp hata almasınlar.
  const benimDegil = (sahip: string | null) =>
    profile.role === 'super_admin' || sahip !== profile.id;

  for (const r of (purchasePendingRes.data ?? []) as any[]) {
    if (!benimDegil(r.requester_id)) continue;
    const ol = hatMi(r.company_id);
    bekleyenler.push({
      key: `pur-${r.id}`, kind: 'purchase', id: r.id,
      companyId: r.company_id, company: sirket(r.company_id), orderLine: ol,
      title: r.title,
      sub: ol ? `Sipariş${r.order_no ? ` · ${r.order_no}` : ''}` : 'Satın alma talebi',
      who: ad(r.requester_id), at: r.created_at, href: '/purchasing'
    });
  }
  for (const r of (paymentPendingRes.data ?? []) as any[]) {
    if (!benimDegil(r.requester_id)) continue;
    bekleyenler.push({
      key: `pay-${r.id}`, kind: 'payment', id: r.id,
      companyId: r.company_id, company: sirket(r.company_id), orderLine: false,
      title: r.work_title,
      sub: `Ödeme · ${r.firm_name}${r.amount ? ` · ${Number(r.amount).toLocaleString('tr-TR')} ₺` : ''}`,
      who: ad(r.requester_id), at: r.created_at, href: '/payments'
    });
  }
  for (const r of (leavePendingRes.data ?? []) as any[]) {
    if (!benimDegil(r.user_id)) continue;
    bekleyenler.push({
      key: `lea-${r.id}`, kind: 'leave', id: r.id,
      companyId: r.company_id, company: sirket(r.company_id), orderLine: false,
      title: `${ad(r.user_id)} — izin talebi`,
      sub: `${r.start_date} → ${r.end_date}${r.reason ? ` · ${r.reason}` : ''}`,
      who: ad(r.user_id), at: r.created_at, href: '/leave'
    });
  }
  for (const r of (incidentPendingRes.data ?? []) as any[]) {
    const sev: Record<string, string> = {
      low: 'Düşük', medium: 'Orta', high: 'Yüksek', critical: 'Kritik'
    };
    bekleyenler.push({
      key: `inc-${r.id}`, kind: 'incident', id: r.id,
      companyId: r.company_id, company: sirket(r.company_id), orderLine: false,
      title: r.title, sub: `Olay kaydı · ${sev[r.severity] ?? r.severity} önem`,
      who: ad(r.reporter_id), at: r.created_at, href: '/incidents'
    });
  }
  for (const r of (reviewPendingRes.data ?? []) as any[]) {
    bekleyenler.push({
      key: `rev-${r.id}`, kind: 'review', id: r.id,
      companyId: r.company_id, company: sirket(r.company_id), orderLine: false,
      title: r.title, sub: 'Tamamlanan görev — onayınızı bekliyor',
      who: '—', at: r.completed_at ?? r.due_at ?? new Date().toISOString(),
      href: `/tasks/${r.id}`
    });
  }
  bekleyenler.sort((a, b) => (a.at ?? '').localeCompare(b.at ?? ''));   // en eski önce

  // ---- HAREKET AKIŞI ----
  type Hareket = {
    key: string; companyId: string; company: string;
    icon: string; color: string; title: string; sub: string; at: string; href: string;
  };
  const hareketler: Hareket[] = [];
  const DURUM: Record<string, string> = {
    pending: 'bekliyor', approved: 'onaylandı', rejected: 'reddedildi',
    cancelled: 'iptal edildi', completed: 'tamamlandı', closed: 'kapatıldı',
    scheduled: 'planlandı', done: 'yapıldı'
  };

  for (const r of (feedPurchaseRes.data ?? []) as any[]) {
    const ol = hatMi(r.company_id);
    hareketler.push({
      key: `fp-${r.id}`, companyId: r.company_id, company: sirket(r.company_id),
      icon: ol ? 'package' : 'cart', color: '#E8930C',
      title: r.title,
      sub: `${ol ? 'Sipariş' : 'Satın alma'} · ${ad(r.requester_id)} · ${DURUM[r.status] ?? r.status}`,
      at: r.created_at, href: '/purchasing'
    });
  }
  for (const r of (feedPaymentRes.data ?? []) as any[]) {
    hareketler.push({
      key: `fy-${r.id}`, companyId: r.company_id, company: sirket(r.company_id),
      icon: 'wallet', color: '#12A150',
      title: r.work_title,
      sub: `Ödeme · ${r.firm_name} · ${ad(r.requester_id)} · ${DURUM[r.status] ?? r.status}`,
      at: r.created_at, href: '/payments'
    });
  }
  for (const r of (feedIncidentRes.data ?? []) as any[]) {
    hareketler.push({
      key: `fi-${r.id}`, companyId: r.company_id, company: sirket(r.company_id),
      icon: 'incident', color: '#E5484D',
      title: r.title,
      sub: `Olay kaydı · ${ad(r.reporter_id)} · ${DURUM[r.status] ?? r.status}`,
      at: r.created_at, href: '/incidents'
    });
  }
  for (const r of (feedMeetingRes.data ?? []) as any[]) {
    hareketler.push({
      key: `fm-${r.id}`, companyId: r.company_id, company: sirket(r.company_id),
      icon: 'meeting', color: '#7C5CFC',
      title: r.title,
      sub: `Toplantı · ${ad(r.created_by)} · ${DURUM[r.status] ?? r.status}`,
      at: r.created_at, href: '/meetings'
    });
  }
  for (const r of (feedTaskRes.data ?? []) as any[]) {
    hareketler.push({
      key: `ft-${r.id}`, companyId: r.company_id, company: sirket(r.company_id),
      icon: 'task', color: r.status === 'cancelled' ? '#667085' : '#0A6CFF',
      title: r.title,
      sub: `Görev ${DURUM[r.status] ?? r.status}`,
      at: r.completed_at, href: `/tasks/${r.id}`
    });
  }
  for (const r of (feedAnnRes.data ?? []) as any[]) {
    hareketler.push({
      key: `fa-${r.id}`, companyId: r.company_id, company: sirket(r.company_id),
      icon: 'megaphone', color: '#0E9F9F',
      title: r.title, sub: `Duyuru · ${ad(r.author_id)}`,
      at: r.created_at, href: '/announcements'
    });
  }
  hareketler.sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''));

  // ---- ŞİRKET KARTLARI ----
  const sirketler = companies
    // Pasif şirket normalde gösterilmez; ama hâlâ bekleyen işi varsa
    // süzgeçte yer almalı, yoksa o kayıtlara hiç ulaşılamaz.
    .filter(c => c.is_active !== false || bekleyenler.some(b => b.companyId === c.id))
    .map(c => ({
      id: c.id,
      name: c.name,
      orderLine: c.kind === 'order_line',
      bekleyen: bekleyenler.filter(b => b.companyId === c.id).length,
    }));

  const fmt = (iso: string | null) => iso
    ? new Date(iso).toLocaleString('tr-TR', {
        timeZone: TZ, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
      })
    : '—';

  return (
    <MerkezClient
      companies={sirketler}
      waiting={bekleyenler.map(b => ({ ...b, atText: fmt(b.at) }))}
      feed={hareketler.slice(0, 60).map(h => ({ ...h, atText: fmt(h.at) }))}
      selectedCompany={seciliSirket}
      selectedTab={seciliTur}
    />
  );
}
