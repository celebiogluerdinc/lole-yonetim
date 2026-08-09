'use client';

export default function AppError({
  reset
}: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="min-h-[60dvh] flex items-center justify-center p-6">
      <div className="card p-10 text-center max-w-sm w-full">
        <p className="text-4xl mb-3">😕</p>
        <h1 className="text-[18px] font-bold mb-1">Bir şeyler ters gitti</h1>
        <p className="text-[14px] text-[#8E8E93] mb-5">
          Beklenmedik bir hata oluştu. Tekrar denemek genellikle sorunu çözer.
        </p>
        <button onClick={() => reset()} className="btn-primary w-full">Tekrar Dene</button>
        <a href="/home" className="block text-[13px] text-ios-blue font-medium mt-3">Ana Sayfaya dön</a>
      </div>
    </main>
  );
}
