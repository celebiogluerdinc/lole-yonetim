export default function Loading() {
  return (
    <main className="max-w-3xl mx-auto p-4 md:p-8 space-y-5 animate-pulse">
      <div className="h-7 w-48 rounded-lg bg-white/[0.07]" />
      <div className="h-3 w-32 rounded bg-white/[0.07]" />
      <div className="card p-4 space-y-3">
        <div className="h-4 w-2/3 rounded bg-white/[0.07]" />
        <div className="h-3 w-1/2 rounded bg-white/[0.07]" />
      </div>
      <div className="flex gap-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-8 w-20 rounded-full bg-white/[0.07]" />
        ))}
      </div>
      <div className="card divide-y divide-white/[0.08]">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-4">
            <div className="w-6 h-6 rounded-full bg-white/[0.07] shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-1/2 rounded bg-white/[0.07]" />
              <div className="h-2.5 w-1/3 rounded bg-white/[0.07]" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
