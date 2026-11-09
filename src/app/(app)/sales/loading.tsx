/**
 * Alt sekme geçişlerinde iskelet ekran.
 *
 * Bu dosya olmadığında Next.js en yakın üst sınıra düşüyordu: alt sekme
 * çubuğu dahil tüm ekran boşalıyor, sekmeye basan kişi "takıldı" sanıyordu.
 * Burada sınır /sales içinde olduğu için çubuk yerinde kalıyor, yalnızca
 * içerik alanı iskelete dönüyor — geçiş anında ekran.
 */
export default function Loading() {
  return (
    <main className="py-5 space-y-5 animate-pulse" aria-busy="true">
      <div className="px-1 space-y-2">
        <div className="h-7 w-44 rounded-lg bg-white/[0.07]" />
        <div className="h-3 w-56 rounded bg-white/[0.05]" />
      </div>

      <div className="card p-5 space-y-3">
        <div className="h-3 w-24 rounded bg-white/[0.05]" />
        <div className="h-5 w-2/3 rounded bg-white/[0.07]" />
        <div className="h-3 w-1/2 rounded bg-white/[0.05]" />
        <div className="flex gap-2 pt-1">
          <div className="h-9 w-32 rounded-xl bg-white/[0.07]" />
          <div className="h-9 w-24 rounded-xl bg-white/[0.04]" />
        </div>
      </div>

      <div className="flex gap-1.5">
        {[64, 52, 72, 58].map((w, i) => (
          <div key={i} className="h-7 rounded-full bg-white/[0.05]" style={{ width: w }} />
        ))}
      </div>

      <div className="card divide-y divide-white/[0.08]">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3.5">
            <div className="flex-1 space-y-2">
              <div className="h-3.5 rounded bg-white/[0.07]" style={{ width: `${40 + (i % 3) * 14}%` }} />
              <div className="h-2.5 w-1/3 rounded bg-white/[0.04]" />
            </div>
            <div className="h-5 w-14 rounded-full bg-white/[0.05] shrink-0" />
          </div>
        ))}
      </div>
    </main>
  );
}
