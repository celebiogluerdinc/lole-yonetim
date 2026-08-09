'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Upload, Building2, Type } from 'lucide-react';
import { setAppName, renameCompany, restoreBackup } from '@/app/(app)/admin/actions';
import { useConfirm } from '@/components/ConfirmProvider';

export default function SettingsForms({
  isSuper, appName, companies
}: { isSuper: boolean; appName: string; companies: { id: string; name: string }[] }) {
  const [msg, setMsg] = useState<{ ok?: string; err?: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const confirmS = useConfirm();

  const run = (fn: () => Promise<any>, okText: string) => start(async () => {
    setMsg(null);
    const r = await fn();
    if (r?.error) setMsg({ err: r.error });
    else { setMsg({ ok: okText }); router.refresh(); }
  });

  return (
    <div className="space-y-6">
      {msg?.err && <p className="text-[13px] text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-2">{msg.err}</p>}
      {msg?.ok && <p className="text-[13px] text-emerald-300 bg-emerald-500/10 rounded-xl px-3 py-2">✔ {msg.ok}</p>}

      {/* Uygulama adı — süper admin */}
      {isSuper && (
        <section>
          <h2 className="section-title flex items-center gap-1.5"><Type size={12} /> Uygulama Adı</h2>
          <form
            action={(fd) => run(() => setAppName(fd), 'Uygulama adı güncellendi — menüde ve giriş ekranında görünür.')}
            className="card p-4 flex gap-2"
          >
            <input name="app_name" defaultValue={appName} required minLength={2} className="input" />
            <button className="btn-primary shrink-0" disabled={pending}>Kaydet</button>
          </form>
        </section>
      )}

      {/* Şirket adları */}
      <section>
        <h2 className="section-title flex items-center gap-1.5"><Building2 size={12} /> Şirket Adları</h2>
        <div className="card divide-y divide-white/[0.08] overflow-hidden">
          {companies.map(c => (
            <form
              key={c.id}
              action={(fd) => run(() => renameCompany(fd), 'Şirket adı güncellendi.')}
              className="flex gap-2 items-center px-4 py-3"
            >
              <input type="hidden" name="company_id" value={c.id} />
              <input name="name" defaultValue={c.name} required minLength={2} className="input" />
              <button className="btn-outline shrink-0 !py-2" disabled={pending}>Kaydet</button>
            </form>
          ))}
        </div>
      </section>

      {/* Yedekleme */}
      <section>
        <h2 className="section-title">Veri Yedekleme</h2>
        <div className="card p-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <a href="/api/backup" download className="btn-primary sm:flex-1">
              <Download size={16} /> Yedeği İndir (JSON)
            </a>
            <p className="text-[12px] text-[#8E8E93] sm:flex-1">
              Aktif şirketin tüm operasyon verisi: görevler, checklistler, şablonlar, duyurular,
              vardiyalar, izinler, mesai kayıtları. Fotoğraf/dosya ekleri hariçtir.
              Düzenli olarak indirip saklamanız önerilir.
            </p>
          </div>

          <div className="border-t border-white/[0.08] pt-4">
            <form
              action={async (fd) => {
                const f = fd.get('file') as File | null;
                if (!f || f.size === 0) { setMsg({ err: 'Önce bir yedek dosyası seçin.' }); return; }
                if (!(await confirmS({ message: 'Yedek geri yüklenecek: dosyadaki kayıtlar mevcut verilerin ÜZERİNE yazılır. Devam edilsin mi?', danger: true }))) return;
                run(() => restoreBackup(fd), 'Yedek başarıyla geri yüklendi.');
              }}
              className="flex flex-col sm:flex-row gap-3 sm:items-center"
            >
              <input
                type="file" name="file" accept="application/json,.json" required
                className="text-[13px] text-[#8E8E93] file:mr-3 file:rounded-xl file:border-0 file:bg-[#2C2C2E] file:text-ios-blue file:px-4 file:py-2 file:text-[13px] file:font-semibold file:cursor-pointer"
              />
              <button className="btn-outline shrink-0 !text-amber-300" disabled={pending}>
                <Upload size={15} /> {pending ? 'Yükleniyor…' : 'Yedeği Geri Yükle'}
              </button>
            </form>
            <p className="text-[12px] text-[#8E8E93] mt-2">
              ⚠️ Geri yükleme, yedekteki kayıtları aynı kimlikle üzerine yazar; yalnızca bu şirkete ait
              yedekler kabul edilir. Kullanıcı hesapları yedekten geri yüklenmez (Kullanıcılar sayfasından yönetilir).
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
