import Link from 'next/link';
import { getCtx } from '@/lib/auth';
import { fmtDate } from '@/lib/utils';
import { OUTCOME_LABEL, OUTCOME_COLOR } from '@/lib/sales-types';
import { Plus, ChevronRight } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function VisitsPage() {
  const { supabase } = await getCtx();

  // RLS zaten kapsamı belirliyor: temsilci kendi ziyaretlerini,
  // müdür ekibininkini, admin hepsini görür. Burada ek filtre gereksiz.
  const { data: visits } = await supabase.from('visits')
    .select('id, visit_date, outcome, overall_score, status, outlets:outlet_id(name, city, district), profiles:user_id(full_name)')
    .order('visit_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(200);

  const rows = visits ?? [];
  const drafts = rows.filter((v: any) => v.status === 'taslak').length;

  return (
    <main className="max-w-4xl mx-auto p-4 md:p-8 space-y-5">
      <header className="px-1 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] leading-tight font-bold tracking-tight">Ziyaretler</h1>
          <p className="text-[14px] text-[#8E8E93]">
            {rows.length} kayıt{drafts > 0 ? ` · ${drafts} taslak` : ''}
          </p>
        </div>
        <Link href="/sales/visits/new" className="btn-primary shrink-0">
          <Plus size={16} /> Yeni Ziyaret
        </Link>
      </header>

      {drafts > 0 && (
        <p className="text-[13px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2">
          {drafts} ziyaret taslakta. Gün kapanmadan tamamlayın — sonradan hatırlanarak
          doldurulan form güvenilir değildir.
        </p>
      )}

      <div className="card divide-y divide-white/[0.08] overflow-hidden">
        {rows.length === 0 && (
          <div className="p-10 text-center">
            <p className="text-3xl mb-2">📋</p>
            <p className="text-[15px] text-[#8E8E93]">Henüz ziyaret kaydedilmedi.</p>
          </div>
        )}
        {rows.map((v: any) => (
          <Link key={v.id} href={`/sales/visits/${v.id}`}
            className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.04] transition-colors">
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-medium truncate">{v.outlets?.name ?? 'Nokta'}</p>
              <p className="text-[13px] text-[#8E8E93] truncate mt-0.5">
                {fmtDate(v.visit_date)}
                {v.outlets?.district ? ` · ${v.outlets.district}` : ''}
                {v.profiles?.full_name ? ` · ${v.profiles.full_name}` : ''}
              </p>
            </div>
            {v.overall_score !== null && (
              <span className="text-[13px] text-[#8E8E93] tabular-nums shrink-0">{v.overall_score}/5</span>
            )}
            <span className={`badge shrink-0 ${OUTCOME_COLOR[v.outcome as keyof typeof OUTCOME_COLOR]}`}>
              {OUTCOME_LABEL[v.outcome as keyof typeof OUTCOME_LABEL]}
            </span>
            {v.status === 'taslak' && (
              <span className="badge bg-white/10 text-[#8E8E93] shrink-0">taslak</span>
            )}
            <ChevronRight size={15} className="text-[#C7C7CC] shrink-0" />
          </Link>
        ))}
      </div>
    </main>
  );
}
