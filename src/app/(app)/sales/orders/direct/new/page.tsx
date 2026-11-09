import { getCtx } from '@/lib/auth';
import { TZ } from '@/lib/utils';
import DirectOrderForm from '@/components/sales/DirectOrderForm';

export const dynamic = 'force-dynamic';

/**
 * DOĞRUDAN SİPARİŞ — teklif belgesi beklemeden.
 *
 * Sahada fiyat sözlü veriliyor ve müşteri kabul ediyor. Teklif
 * düzenleyip onaylatmak için ofise dönmek akışı kırıyordu. Burada
 * arkada "sözlü teklif" kaydı açılıyor; fiyat ve KDV kayda geçtiği
 * için rapor ve denetim bozulmuyor.
 */
export default async function DirectOrderPage({
  searchParams
}: { searchParams: { outlet?: string; visit?: string } }) {
  const { supabase, companyId } = await getCtx();

  const [{ data: outlets }, { data: products }, { data: people }] = await Promise.all([
    supabase.from('outlets').select('id, name, city, district, tax_number')
      .eq('is_active', true).order('name').limit(1000),
    companyId
      ? supabase.from('products').select('id, name')
          .eq('company_id', companyId).eq('is_active', true).order('sort_order')
      : Promise.resolve({ data: [] } as any),
    companyId
      ? supabase.from('profiles').select('id, full_name')
          .eq('company_id', companyId).eq('is_active', true).order('full_name')
      : Promise.resolve({ data: [] } as any)
  ]);

  const today = new Date().toLocaleDateString('en-CA', { timeZone: TZ });

  return (
    <DirectOrderForm
      outlets={(outlets ?? []) as any}
      products={(products ?? []) as any}
      people={(people ?? []) as any}
      preselectedOutlet={searchParams.outlet}
      preselectedVisit={searchParams.visit}
      today={today}
    />
  );
}
