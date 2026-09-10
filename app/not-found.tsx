import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-dvh flex items-center justify-center p-6">
      <div className="card p-10 text-center max-w-sm w-full">
        <p className="text-4xl mb-3">🔍</p>
        <h1 className="text-[18px] font-bold mb-1">Sayfa bulunamadı</h1>
        <p className="text-[14px] text-[#8E8E93] mb-5">
          Aradığınız sayfa taşınmış ya da silinmiş olabilir.
        </p>
        <Link href="/home" className="btn-primary w-full">Ana Sayfaya Dön</Link>
      </div>
    </main>
  );
}
