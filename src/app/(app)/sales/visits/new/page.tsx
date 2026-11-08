import { getCtx } from '@/lib/auth';
import { TZ } from '@/lib/utils';
import VisitForm from '@/components/sales/VisitForm';

export const dynamic = 'force-dynamic';

export default async function NewVisitPage({
  searchParams
}: { searchParams: { outlet?: string } }) {
  const { supabase, companyId } = await getCtx();

  const [
    { data: outlets }, { data: products }, { data: batches },
    { data: criteria }, { data: reasons }, { data: people }, { data: orders }
  ] = await Promise.all([
    supabase.from('outlets').select('id, name, city, district, status')
      .eq('is_active', true).order('name').limit(1000),
    companyId
      ? supabase.from('products').select('id, name, taste_reference')
          .eq('company_id', companyId).eq('is_active', true).order('sort_order')
      : Promise.resolve({ data: [] } as any),
    companyId
      ? supabase.from('product_batches').select('id, product_id, batch_no, expiry_date')
          .eq('company_id', companyId).eq('is_active', true).order('expiry_date')
      : Promise.resolve({ data: [] } as any),
    companyId
      ? supabase.from('score_criteria').select('id, label, grp, applies_to')
          .eq('company_id', companyId).eq('form_code', 'F03').eq('is_active', true).order('sort_order')
      : Promise.resolve({ data: [] } as any),
    companyId
      ? supabase.from('no_order_reasons').select('id, label, requires_note')
          .eq('company_id', companyId).eq('is_active', true).order('sort_order')
      : Promise.resolve({ data: [] } as any),
    companyId
      ? supabase.from('profiles').select('id, full_name')
          .eq('company_id', companyId).eq('is_active', true).order('full_name')
      : Promise.resolve({ data: [] } as any),
    // ziyarete bağlanabilecek siparişler (henüz başka ziyarete bağlanmamış olanlar da dâhil)
    companyId
      ? supabase.from('sales_orders')
          .select('id, order_no, total_amount, outlet_id')
          .eq('company_id', companyId)
          .in('status', ['taslak', 'onay_bekliyor', 'onayli', 'sevk_edildi', 'teslim'])
          .order('created_at', { ascending: false }).limit(300)
      : Promise.resolve({ data: [] } as any)
  ]);

  // İstanbul takvimine göre bugün — tarayıcı saat dilimine güvenilmez
  const today = new Date().toLocaleDateString('en-CA', { timeZone: TZ });

  return (
    <VisitForm
      outlets={(outlets ?? []) as any}
      products={(products ?? []) as any}
      batches={(batches ?? []) as any}
      criteria={(criteria ?? []) as any}
      reasons={(reasons ?? []) as any}
      people={(people ?? []) as any}
      preselectedOutlet={searchParams.outlet}
      today={today}
      orders={(orders ?? []) as any}
    />
  );
}
