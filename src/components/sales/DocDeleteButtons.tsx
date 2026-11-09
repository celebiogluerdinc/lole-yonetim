'use client';

import { deleteOrder, deleteQuote } from '@/app/(app)/sales/orders/actions';
import { deleteVisit } from '@/app/(app)/sales/actions';
import DeleteButton from '@/components/sales/DeleteButton';

/**
 * Teklif ve sipariş detayındaki sil düğmeleri.
 *
 * Sunucu bileşeni istemciye kapanış fonksiyonu geçiremediği için
 * belge kimliği veri olarak geliyor, action çağrısı burada kuruluyor.
 */

export function OrderDeleteButton({
  orderId, orderNo
}: { orderId: string; orderNo: number | null }) {
  return (
    <DeleteButton
      label="Siparişi sil"
      title="Sipariş silinsin mi?"
      message={`Sipariş${orderNo ? ` #${orderNo}` : ''} ve kalemleri silinecek. Sevk edilmiş veya teslim edilmiş sipariş silinmez — durumunu "iptal" yapın.`}
      action={r => deleteOrder(orderId, r)}
      redirectTo="/sales/orders"
      size="md"
      askReason
    />
  );
}

export function VisitDeleteButton({
  visitId, label, draft
}: { visitId: string; label: string; draft: boolean }) {
  return (
    <DeleteButton
      label="Ziyareti sil"
      title="Ziyaret silinsin mi?"
      message={`${label} ziyaret kaydı silinecek. Puanlar, tadım ve fotoğraflar da gider.`}
      action={r => deleteVisit(visitId, r)}
      redirectTo="/sales/visits"
      size="md"
      askReason={!draft}
    />
  );
}

export function QuoteDeleteButton({
  quoteId, quoteNo
}: { quoteId: string; quoteNo: number | null }) {
  return (
    <DeleteButton
      label="Teklifi sil"
      title="Teklif silinsin mi?"
      message={`Teklif${quoteNo ? ` #${quoteNo}` : ''} ve kalemleri silinecek. Bu tekliften sipariş oluşturulmuşsa silinmez.`}
      action={r => deleteQuote(quoteId, r)}
      redirectTo="/sales/orders"
      size="md"
      askReason
    />
  );
}
