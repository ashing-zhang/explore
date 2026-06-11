'use client';

import type { DashboardOverviewResponse } from '@/lib/types';

export function InsightCards({
  keyIndicators,
  actions,
  riskAlerts,
}: {
  keyIndicators: DashboardOverviewResponse['keyIndicators'];
  actions: DashboardOverviewResponse['actions'];
  riskAlerts: DashboardOverviewResponse['riskAlerts'];
}) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="text-sm font-medium text-zinc-900">关键指标摘要</div>
        <div className="mt-3 space-y-2 text-sm text-zinc-700">
          <div>
            <span className="font-medium text-zinc-900">Booking Window：</span>
            {keyIndicators.bookingWindow}
          </div>
          <div>
            <span className="font-medium text-zinc-900">市场状态：</span>
            {keyIndicators.marketStatus}
          </div>
          <div>
            <span className="font-medium text-zinc-900">区域库存：</span>
            {keyIndicators.regionInventory}
          </div>
          <div>
            <span className="font-medium text-zinc-900">客人价格可接受：</span>
            {keyIndicators.priceAcceptance}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="text-sm font-medium text-zinc-900">AI 行动建议</div>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-zinc-700">
          {actions.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ol>
      </div>

      <div className="rounded-xl border border-red-200 bg-red-50 p-4 shadow-sm">
        <div className="text-sm font-medium text-red-900">风险提示</div>
        <ul className="mt-3 space-y-2 text-sm text-red-800">
          {riskAlerts.map((a, i) => (
            <li key={i} className="flex gap-2">
              <span>▲</span>
              <span>{a}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

