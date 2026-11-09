import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getCtx } from '@/lib/auth';
import { fmtDate } from '@/lib/utils';
import {
  OUTCOME_LABEL, OUTCOME_COLOR, VISIT_TYPE_LABEL, AUTHORITY_LABEL, VERDICT_LABEL
} from '@/lib/sales-types';
import PrintButton from '@/components/sales/PrintButton';
import { VisitDeleteButton } from '@/components/sales/DocDeleteButtons';

export const dynamic = 'force-dynamic';

export default async function VisitDetail({ params }: { params: { id: string } }) {
  const { supabase } = await getCtx();

  const { data: visit } = await supabase.from('visits')
    .select('*, outlets:outlet_id(id, name, city, district), profiles:user_id(full_name)')
    .eq('id', params.id).maybeSingle();
  if (!visit) notFound();

  const [{ data: scores }, { data: tastings }, { data: summary }, { data: fups }, { data: reasons }] =
    await Promise.all([
      supabase.from('visit_scores')
        .select('score, evidence, score_criteria:criterion_id(label, grp)')
        .eq('visit_id', visit.id),
      supabase.from('visit_tastings')
        .select('*, products:product_id(name, taste_reference)')
        .eq('visit_id', visit.id),
      supabase.from('visit_tasting_summary')
        .select('*, products:preferred_product_id(name)').eq('visit_id', visit.id).maybeSingle(),
      supabase.from('follow_ups')
        .select('id, action, due_date, status, closure_evidence, profiles:owner_user_id(full_name)')
        .eq('source_type', 'visit').eq('source_id', visit.id),
      supabase.from('no_order_reasons').select('id, label')
    ]);

  const reasonLabel = (id: string | null) =>
    id ? (reasons ?? []).find((r: any) => r.id === id)?.label ?? '—' : null;

  return (
    <main id="print-area" className="py-5 space-y-5">
      {/* Ziyaret kartı çıktısı: müdür görüşmesine kâğıtla girilebiliyor */}
      <div className="flex flex-wrap gap-2 px-1" data-noprint>
        <PrintButton label="Ziyareti yazdır" />
        <Link href={`/sales/outlets/${visit.outlets?.id}`} className="btn-ghost text-sm">
          Nokta kartı
        </Link>
        <VisitDeleteButton
          visitId={visit.id}
          label={`${visit.outlets?.name ?? 'Nokta'} · ${fmtDate(visit.visit_date)}`}
          draft={visit.status === 'taslak'}
        />
      </div>

      <header className="card p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href={`/sales/outlets/${visit.outlets?.id}`}
              className="text-xl font-bold tracking-tight hover:underline">
              {visit.outlets?.name}
            </Link>
            <p className="text-sm text-[#8E8E93] mt-1">
              {fmtDate(visit.visit_date)}
              {' · '}{VISIT_TYPE_LABEL[visit.visit_type as keyof typeof VISIT_TYPE_LABEL]}
              {visit.profiles?.full_name ? ` · ${visit.profiles.full_name}` : ''}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <span className={`badge ${OUTCOME_COLOR[visit.outcome as keyof typeof OUTCOME_COLOR]}`}>
              {OUTCOME_LABEL[visit.outcome as keyof typeof OUTCOME_LABEL]}
            </span>
            {visit.overall_score !== null && (
              <span className="badge bg-ios-blue/20 text-ios-blue tabular-nums">
                {visit.overall_score}/5
              </span>
            )}
            {visit.status === 'taslak' && <span className="badge bg-white/10 text-[#8E8E93]">taslak</span>}
          </div>
        </div>

        {visit.met_person_name && (
          <p className="text-sm text-[#AEAEB2] mt-3">
            Görüşülen: {visit.met_person_name}
            {visit.met_person_role ? ` (${visit.met_person_role})` : ''}
            {visit.met_decision_authority
              ? ` · ${AUTHORITY_LABEL[visit.met_decision_authority as keyof typeof AUTHORITY_LABEL]}`
              : ''}
          </p>
        )}
      </header>

      {(visit.main_need || visit.offered_solution || visit.outlet_comment) && (
        <section className="card p-5 space-y-3">
          <p className="section-title">İhtiyaç ve çözüm</p>
          <Block label="Asıl ihtiyaç" value={visit.main_need} />
          <Block label="Sunulan çözüm" value={visit.offered_solution} />
          <Block label="İşletmenin yorumu" value={visit.outlet_comment} />
        </section>
      )}

      {(visit.objection_stated_id || visit.objection_real_id) && (
        <section className="card p-5 space-y-3">
          <p className="section-title">İtiraz</p>
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-white/[0.03] p-3">
              <p className="text-[12px] text-[#8E8E93]">Beyan edilen</p>
              <p className="font-medium">{reasonLabel(visit.objection_stated_id) ?? '—'}</p>
            </div>
            <div className="rounded-xl bg-white/[0.03] p-3">
              <p className="text-[12px] text-[#8E8E93]">Gerçek neden</p>
              <p className="font-medium">{reasonLabel(visit.objection_real_id) ?? '—'}</p>
            </div>
          </div>
          <Block label="Açıklama" value={visit.objection_note} />
          <Block label="Verdiğimiz yanıt" value={visit.our_answer} />
        </section>
      )}

      {(tastings ?? []).length > 0 && (
        <section className="card p-5 space-y-3">
          <p className="section-title">Tadım</p>
          {(tastings ?? []).map((t: any) => (
            <div key={t.product_id} className="rounded-xl bg-white/[0.03] p-3 space-y-1.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-[15px] font-medium">{t.products?.name}</p>
                <div className="flex gap-1.5">
                  {t.taste_score && <span className="badge bg-ios-blue/20 text-ios-blue">Lezzet {t.taste_score}/5</span>}
                  {t.verdict && (
                    <span className="badge bg-white/10 text-[#D1D1D6]">
                      {VERDICT_LABEL[t.verdict as keyof typeof VERDICT_LABEL]}
                    </span>
                  )}
                </div>
              </div>
              <p className="text-[12px] text-[#8E8E93]">
                {t.bottles_opened} açılan, {t.bottles_left_sealed} kapalı
              </p>
              {t.customer_verbatim && (
                <p className="text-sm italic text-[#D1D1D6] border-l-2 border-white/20 pl-3">
                  “{t.customer_verbatim}”
                </p>
              )}
            </div>
          ))}
          {summary?.products?.name && (
            <p className="text-sm text-[#AEAEB2]">
              En çok tercih edilen: <strong>{summary.products.name}</strong>
              {summary.preference_reason ? ` — ${summary.preference_reason}` : ''}
            </p>
          )}
        </section>
      )}

      {(scores ?? []).length > 0 && (
        <section className="card p-5 space-y-2">
          <p className="section-title">Puanlama</p>
          {(scores ?? []).map((s: any, idx: number) => (
            <div key={idx} className="flex items-center justify-between gap-3 text-sm py-1">
              <span className="text-[#D1D1D6]">{s.score_criteria?.label}</span>
              <span className="tabular-nums font-medium">{s.score}/5</span>
            </div>
          ))}
        </section>
      )}

      {(visit.customer_comment || visit.private_note) && (
        <section className="card p-5 space-y-3">
          <Block label="Müşteri görüşü" value={visit.customer_comment} />
          <Block label="Özel not" value={visit.private_note} />
        </section>
      )}

      {(fups ?? []).length > 0 && (
        <section className="card p-5 space-y-2">
          <p className="section-title">Sonraki adım</p>
          {(fups ?? []).map((f: any) => (
            <div key={f.id} className="flex items-center justify-between gap-3 text-sm">
              <div className="min-w-0">
                <p className="truncate">{f.action}</p>
                <p className="text-[12px] text-[#8E8E93]">
                  {f.profiles?.full_name ?? '—'} · {fmtDate(f.due_date)}
                </p>
              </div>
              <span className={`badge shrink-0 ${
                f.status === 'kapandi' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
                {f.status === 'kapandi' ? 'Kapandı' : 'Açık'}
              </span>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}

function Block({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[12px] text-[#8E8E93]">{label}</p>
      <p className="text-sm whitespace-pre-wrap">{value}</p>
    </div>
  );
}
