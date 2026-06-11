'use client';

import type { DashboardOverviewResponse } from '@/lib/types';

function labelMd(iso: string): string {
  return iso.slice(5);
}

export function InventoryCalendar({
  calendar,
}: {
  calendar: DashboardOverviewResponse['inventoryCalendar'];
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-zinc-900">库存日历（间夜）</div>
        <div className="text-xs text-zinc-600">
          剩余库存（间夜）总和：<span className="font-medium text-zinc-900">{calendar.totalRemaining}</span>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-8 gap-2 text-center text-xs">
        {calendar.dailyRemaining.slice(0, 8).map((d) => (
          <div key={d.date} className="rounded-lg bg-zinc-50 px-2 py-2">
            <div className="text-zinc-500">{labelMd(d.date)}</div>
            <div className="mt-1 text-sm font-semibold text-zinc-900">{d.remaining}</div>
          </div>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-8 gap-2 text-center text-xs">
        {calendar.dailyRemaining.slice(8, 16).map((d) => (
          <div key={d.date} className="rounded-lg bg-zinc-50 px-2 py-2">
            <div className="text-zinc-500">{labelMd(d.date)}</div>
            <div className="mt-1 text-sm font-semibold text-zinc-900">{d.remaining}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

