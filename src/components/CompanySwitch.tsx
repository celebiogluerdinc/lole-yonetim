'use client';

import { useTransition } from 'react';
import { switchCompany } from '@/app/(app)/super/actions';
import { LogIn } from 'lucide-react';

export default function CompanySwitch({ companyId, isActive }: { companyId: string; isActive: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending || isActive}
      onClick={() => start(async () => { await switchCompany(companyId); })}
      className={isActive ? 'btn-outline w-full !text-brand-600 !border-brand-200' : 'btn-primary w-full'}
    >
      <LogIn size={15} />
      {isActive ? 'Aktif şirket' : 'Bu şirkete gir'}
    </button>
  );
}
