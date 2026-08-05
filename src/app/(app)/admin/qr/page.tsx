import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getCtx } from '@/lib/auth';
import QRCode from 'qrcode';

export const dynamic = 'force-dynamic';

export default async function QrPage() {
  const { supabase, profile, companyId } = await getCtx();
  if (!['super_admin', 'admin'].includes(profile.role)) redirect('/home');
  if (!companyId) redirect('/super/companies');

  const { data: company } = await supabase
    .from('companies').select('name').eq('id', companyId).maybeSingle();

  const h = headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? 'https';
  const url = `${proto}://${host}/clock?qr=1`;

  const dataUrl = await QRCode.toDataURL(url, { width: 480, margin: 2 });

  return (
    <main className="max-w-xl mx-auto p-4 md:p-8">
      <div className="card p-8 text-center print:shadow-none">
        <h1 className="text-[24px] font-bold tracking-tight">{company?.name ?? 'Lole Yönetim'}</h1>
        <p className="text-[15px] text-[#8E8E93] mt-1">Mesai Giriş / Çıkış</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={dataUrl} alt="Mesai QR kodu" className="mx-auto my-6 w-64 h-64 rounded-xl" />
        <p className="text-[14px] text-[#A8A8AD] leading-relaxed max-w-sm mx-auto">
          Telefonunuzun kamerasıyla bu kodu okutun, açılan sayfada
          <b> Giriş Yap</b> veya <b>Çıkış Yap</b>&apos;a dokunun.
        </p>
      </div>
      <p className="text-center text-[13px] text-[#8E8E93] mt-4 print:hidden">
        Bu sayfayı yazdırıp (Ctrl/Cmd+P) işyeri girişine asın.
      </p>
    </main>
  );
}
