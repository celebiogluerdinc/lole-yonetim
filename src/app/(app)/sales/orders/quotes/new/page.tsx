import { notFound } from 'next/navigation';
import { getCtx } from '@/lib/auth';
import { TZ } from '@/lib/utils';
import QuoteForm from '@/components/sales/QuoteForm';

export const dynamic = 'force-dynamic';

/**
 * Yeni teklif — ve `?edit=<id>` ile taslak teklifin düzenlenmesi.
 * İkisi aynı formu kullanıyor: alanlar birebir aynı olduğu için
 * ayrı bir düzenleme ekranı iki yerde bakım demekti.
 */
export default async function NewQuotePage({
  searchParams
}: { searchParams: { outlet?: string; edit?: string; visit?: string } }) {
  const { supabase, companyId } = await getCtx();

  const [{ data: outlets }, { data: products }] = await Promise.all([
    supabase.from('outlets').select('id, name, city, district')
      .eq('is_active', true).order('name').limit(1000),
    companyId
      ? supabase.from('products').select('id, name')
          .eq('company_id', companyId).eq('is_active', true).order('sort_order')
      : Promise.resolve({ data: [] } as any)
  ]);

  let quote: any = null;
  let items: any[] = [];
  if (searchParams.edit) {
    const { data: q } = await supabase.from('quotes').select('*').eq('id', searchParams.edit).maybeSingle();
    if (!q) notFound();
    if (!['taslak', 'kontrolde'].includes(q.status)) notFound();
    quote = q;
    const { data: qi } = await supabase.from('quote_items')
      .select('product_id, bottles, unit_price, discount').eq('quote_id', q.id).order('position');
    items = qi ?? [];
  }

  const today = new Date().toLocaleDateString('en-CA', { timeZone: TZ });

  return (
    <QuoteForm
      outlets={(outlets ?? []) as any}
      products={(products ?? []) as any}
      preselectedOutlet={searchParams.outlet}
      preselectedVisit={searchParams.visit}
      quote={quote ?? undefined}
      items={items}
      today={today}
    />
  );
}
