'use client';

import { useEffect, useState } from 'react';

/** Live ticking clock + date (Istanbul time), hydration-safe. */
export default function LiveClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="text-right shrink-0">
      <p className="text-[30px] sm:text-[34px] font-bold leading-none tabular-nums tracking-tight">
        {now
          ? now.toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit', second: '2-digit' })
          : '--:--:--'}
      </p>
      <p className="text-[12px] text-[#8E8E93] mt-1 capitalize">
        {now
          ? now.toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul', weekday: 'long', day: 'numeric', month: 'long' })
          : ''}
      </p>
    </div>
  );
}
