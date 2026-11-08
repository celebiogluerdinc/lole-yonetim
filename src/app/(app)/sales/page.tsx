import Link from 'next/link';
import { getCtx } from '@/lib/auth';
import { TZ, fmtDate } from '@/lib/utils';
import { OUTCOME_LABEL, OUTCOME_COLOR, SEGMENT_COLOR } from '@/lib/sales-types';
import { Plus, MapPin, AlertTriangle, ClipboardCheck, ChevronRight } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function SalesPanel() {
  const { supabase, profile, companyId } = await getCtx();

  const today = new Date().toLocaleDateString('en-CA', { timeZone: TZ });
  const since14 = new Date(Date.now() - 14 * 86400000).toISOString();

  const [
    { data: todayVisits }, { count: outletCount }, { data: neglected },
    { data: openFollowUps }, { count: draftCount }
  ] = await Promise.all([
    supabase.from('visits')
      .select('id, outcome, overall_score, status, outlets:outlet_id(name)')
      .eq('visit_date', today).eq('user_id', profile.id).order('created_at'),
    companyId
      ? supabase.from('outlets').select('id', { count: 'exact', head: true })
          .eq('company_id', companyId).eq('is_active', true)
      : Promise.resolve({ count: 0 } as any),
    supabase.from('outlets')
      .select('id, name, segment, last_visit_at, district')
      .eq('is_active', true).in('segment', ['A', 'B'])
      .or(`last_visit_at.is.null,last_visit_at.lt.${since14}`)
      .limit(8),
    supabase.from('follow_ups')
      .select('id, action, due_date, outlet_id, outlets:outlet_id(name)')
      .eq('status', 'acik').eq('owner_user_id', profile.id)
      .order('due_date').limit(8),
    supabase.from('visits').select('id', { count: 'exact', head: true })
      .eq('user_id', profile.id).eq('status', 'taslak')
  ]);

  const visits = todayVisits ?? [];
  const done = visits.filter((v: any) => v.status !== 'taslak').length;
  const orders = visits.filter((v: any) => v.outcome === 'siparis').length;
  const overdue = (openFollowUps ?? []).filter((f: any) => f.due_date < today).length;

  return (
    <main className="max-w-4xl mx-auto p-4 md:p-8 space-y-5">
      <header className="px-1 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] leading-tight font-bold tracking-tight">Saha Satış</h1>
          <p className="text-[14px] text-[#8E8E93]">{fmtDate(today)}</p>
        </div>
        <Link href="/sales/visits/new" className="btn-primary shrink-0">
          <Plus size={16} /> Ziyaret
        </Link>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Tile label="Bugünkü ziyaret" value={String(done)} />
        <Tile label="Sipariş" value={String(orders)} tone={orders > 0 ? 'good' : undefined} />
        <Tile label="Açık takip" value={String((openFollowUps ?? []).length)}
          tone={overdue > 0 ? 'bad' : undefined}
          hint={overdue > 0 ? `${overdue} gecikmiş` : undefined} />
        <Tile label="Nokta" value={String(outletCount ?? 0)} />
      </div>

      {/* Yan menüde yer almayan bölümlere hızlı erişim.
          Onbir sekme bir kenar çubuğuna sığmaz; günlük kullanılanlar menüde,
          gerisi buradan tek tıkla açılıyor. */}
      <nav className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { href: '/sales/follow-ups', label: 'Takipler' },
          { href: '/sales/execution', label: 'Saha İcra' },
          { href: '/sales/complaints', label: 'Şikâyetler' },
          { href: '/sales/products', label: 'Ürünler & Tadım' }
        ].map(l => (
          <Link key={l.href} href={l.href}
            className="card px-3 py-2.5 text-[13px] font-medium flex items-center justify-between gap-1 hover:bg-white/[0.06] transition-colors">
            {l.label}
            <ChevronRight size={14} className="text-[#48484A] shrink-0" />
          </Link>
        ))}
      </nav>

      {(draftCount ?? 0) > 0 && (
        <Link href="/sales/visits"
          className="block text-[13px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2">
          {draftCount} ziyaretiniz taslakta — gün kapanmadan tamamlayın.
        </Link>
      )}

      <section className="card overflow-hidden">
        <p className="section-title px-5 pt-5 pb-3">Bugün</p>
        {visits.length === 0 && (
          <p className="px-5 pb-5 text-[14px] text-[#8E8E93]">Bugün henüz ziyaret kaydetmediniz.</p>
        )}
        <div className="divide-y divide-white/[0.08]">
          {visits.map((v: any) => (
            <Link key={v.id} href={`/sales/visits/${v.id}`}
              className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.04] transition-colors">
              <span className="text-sm flex-1 truncate">{v.outlets?.name ?? 'Nokta'}</span>
              {v.overall_score !== null && (
                <span className="text-[13px] text-[#8E8E93] tabular-nums">{v.overall_score}/5</span>
              )}
              <span className={`badge ${OUTCOME_COLOR[v.outcome as keyof typeof OUTCOME_COLOR]}`}>
                {OUTCOME_LABEL[v.outcome as keyof typeof OUTCOME_LABEL]}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {(openFollowUps ?? []).length > 0 && (
        <section className="card overflow-hidden">
          <p className="section-title px-5 pt-5 pb-3 flex items-center gap-2">
            <ClipboardCheck size={15} /> Takipleriniz
          </p>
          <div className="divide-y divide-white/[0.08]">
            {(openFollowUps ?? []).map((f: any) => (
              <div key={f.id} className="flex items-center gap-3 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{f.action}</p>
                  <p className="text-[13px] text-[#8E8E93]">{f.outlets?.name ?? ''}</p>
                </div>
                <span className={`badge shrink-0 ${
                  f.due_date < today ? 'bg-rose-500/20 text-rose-300' : 'bg-white/10 text-[#AEAEB2]'}`}>
                  {fmtDate(f.due_date)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {(neglected ?? []).length > 0 && (
        <section className="card overflow-hidden">
          <p className="section-title px-5 pt-5 pb-3 flex items-center gap-2 text-amber-300">
            <AlertTriangle size={15} /> İhmal edilen noktalar
          </p>
          <p className="px-5 pb-2 text-[13px] text-[#8E8E93]">
            A ve B segmentinde, 14 günden uzun süredir ziyaret edilmeyenler.
          </p>
          <div className="divide-y divide-white/[0.08]">
            {(neglected ?? []).map((o: any) => (
              <Link key={o.id} href={`/sales/outlets/${o.id}`}
                className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.04] transition-colors">
                <span className="text-sm flex-1 truncate">{o.name}</span>
                {o.district && (
                  <span className="text-[13px] text-[#8E8E93] flex items-center gap-1">
                    <MapPin size={12} />{o.district}
                  </span>
                )}
                {o.segment && <span className={`badge ${SEGMENT_COLOR[o.segment as 'A'|'B'|'C']}`}>{o.segment}</span>}
                <span className="text-[13px] text-[#8E8E93]">
                  {o.last_visit_at ? fmtDate(o.last_visit_at) : 'hiç'}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function Tile({ label, value, tone, hint }: {
  label: string; value: string; tone?: 'good' | 'bad'; hint?: string;
}) {
  const color = tone === 'good' ? 'text-emerald-300' : tone === 'bad' ? 'text-rose-300' : '';
  return (
    <div className="card p-4">
      <p className="text-[12px] text-[#8E8E93]">{label}</p>
      <p className={`text-2xl font-bold tabular-nums mt-0.5 ${color}`}>{value}</p>
      {hint && <p className="text-[12px] text-rose-300">{hint}</p>}
    </div>
  );
}
