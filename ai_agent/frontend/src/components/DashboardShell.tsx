'use client';

import type { ReactNode } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';

export function DashboardShell({
  activeKey,
  title,
  dataDate,
  children,
}: {
  activeKey: Parameters<typeof Sidebar>[0]['activeKey'];
  title: string;
  dataDate: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh bg-zinc-50">
      <Sidebar activeKey={activeKey} />
      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-[1200px] px-6 py-6">
          <div className="flex items-center justify-between gap-6">
            <div className="min-w-0 text-lg font-semibold text-zinc-900">{title}</div>
            <TopBar dataDate={dataDate} />
          </div>
          <div className="mt-4">{children}</div>
        </div>
      </main>
    </div>
  );
}

