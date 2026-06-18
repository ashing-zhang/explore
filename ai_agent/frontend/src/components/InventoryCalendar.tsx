'use client';

import type { DashboardOverviewResponse } from '@/lib/types';

function labelMd(iso: string): string {
  return iso.slice(5);
}

function chunkByWeek<T>(items: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += 7) {
    out.push(items.slice(i, i + 7));
  }
  return out;
}

export function InventoryCalendar({
  calendar,
}: {
  calendar: DashboardOverviewResponse['inventoryCalendar'];
}) {
  const weeks = chunkByWeek(calendar.dailyRemaining);

  return (
    <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-white to-blue-50 p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="text-base font-extrabold tracking-wide text-blue-700">
          库存日历（间夜）
        </div>
        <div className="text-sm font-medium text-blue-600">
          剩余库存（间夜）总和：
          <span className="ml-1 text-lg font-extrabold text-blue-700">
            {calendar.totalRemaining}
          </span>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {weeks.map((week, idx) => (
          <div key={`week-${idx}`} className="grid grid-cols-7 gap-2 text-center text-xs">
            {week.map((d) => (
              <div
                key={d.date}
                className="rounded-lg border border-blue-100 bg-white px-2 py-2 shadow-sm"
              >
                <div className="font-medium text-blue-500">{labelMd(d.date)}</div>
                <div className="mt-1 text-base font-extrabold text-blue-700">{d.remaining}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
