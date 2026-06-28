'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

export default function ConditionalHeader({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === '/login' || pathname === '/setup') return null;
  return <>{children}</>;
}
