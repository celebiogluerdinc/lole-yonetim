import { getCtx } from '@/lib/auth';
import ComplaintsClient from '@/components/sales/ComplaintsClient';

export const dynamic = 'force-dynamic';

export default async function ComplaintsPage() {
  const { supabase, companyId } = await getCtx();

  const [
    { data: complaints }, { data: plans }, { data: outlets },
    { data: products }, { data: batches }
  ] = await Promise.all([
    supabase.from('outlet_complaints')
      .select(`id, reported_at, category, status, quarantined, quarantined_qty, quantity,
               event_description, investigation_result, resolution_doc_no, outlet_confirmed,
               expiry_date, shipment_doc_no, notified_person,
               outlets:outlet_id(id, name), products:product_id(name),
               product_batches:batch_id(batch_no, expiry_date),
               profiles:reported_by(full_name)`)
      .order('reported_at', { ascending: false }).limit(200),
    supabase.from('reorder_plans')
      .select(`id, created_at, checkpoint, next_check_days, slow_product_reason,
               single_improvement, collection_status,
               outlets:outlet_id(id, name),
               reorder_plan_items(product_id, current_stock, daily_sales, lead_days,
                                  safety_stock, suggested_bottles, suggested_cases,
                                  products:product_id(name))`)
      .order('created_at', { ascending: false }).limit(100),
    supabase.from('outlets').select('id, name, city, district, lead_days, safety_stock_days')
      .eq('is_active', true).order('name').limit(1000),
    companyId
      ? supabase.from('products').select('id, name').eq('company_id', companyId)
          .eq('is_active', true).order('sort_order')
      : Promise.resolve({ data: [] } as any),
    companyId
      ? supabase.from('product_batches').select('id, product_id, batch_no, expiry_date')
          .eq('company_id', companyId).eq('is_active', true).order('expiry_date')
      : Promise.resolve({ data: [] } as any)
  ]);

  return (
    <ComplaintsClient
      complaints={(complaints ?? []) as any}
      plans={(plans ?? []) as any}
      outlets={(outlets ?? []) as any}
      products={(products ?? []) as any}
      batches={(batches ?? []) as any}
    />
  );
}
