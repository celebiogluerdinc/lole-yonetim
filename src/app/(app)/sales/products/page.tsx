import { getCtx } from '@/lib/auth';
import ProductTaste from '@/components/sales/ProductTaste';

export const dynamic = 'force-dynamic';

export default async function ProductsPage() {
  const { supabase, companyId } = await getCtx();

  const [{ data: products }, { data: tastings }, { data: summaries }, { data: usage }] =
    await Promise.all([
      companyId
        ? supabase.from('products').select('id, name, taste_reference, sort_order')
            .eq('company_id', companyId).eq('is_active', true).order('sort_order')
        : Promise.resolve({ data: [] } as any),
      // Tadım satırları + ziyaretin noktası (kanal kırılımı için)
      supabase.from('visit_tastings')
        .select(`product_id, taste_score, packaging_score, price_perception, verdict,
                 customer_verbatim, created_at,
                 visits:visit_id!inner(status, visit_date,
                   outlets:outlet_id(name, outlet_types:type_id(channel)))`)
        .not('taste_score', 'is', null)
        .order('created_at', { ascending: false })
        .limit(3000),
      supabase.from('visit_tasting_summary')
        .select('preferred_product_id').not('preferred_product_id', 'is', null).limit(3000),
      supabase.from('v_sample_usage')
        .select('product_id, product_name, period, bottles_opened, bottles_left, bottles_total, outlets_reached')
        .order('period', { ascending: false }).limit(500)
    ]);

  return (
    <ProductTaste
      products={(products ?? []) as any}
      tastings={(tastings ?? []) as any}
      summaries={(summaries ?? []) as any}
      usage={(usage ?? []) as any}
    />
  );
}
