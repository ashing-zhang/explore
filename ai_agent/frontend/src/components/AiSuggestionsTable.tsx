'use client';

import type { DashboardOverviewResponse } from '@/lib/types';

function priorityBadge(p: DashboardOverviewResponse['aiSuggestions'][number]['priority']) {
  if (p === '高优先级') return 'bg-red-50 text-red-700 ring-red-200';
  if (p === '中优先级') return 'bg-orange-50 text-orange-700 ring-orange-200';
  return 'bg-green-50 text-green-700 ring-green-200';
}

export function AiSuggestionsTable({
  rows,
}: {
  rows: DashboardOverviewResponse['aiSuggestions'];
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="text-sm font-medium text-zinc-900">AI 智能建议（今日）</div>
      <div className="mt-3 overflow-hidden rounded-xl ring-1 ring-zinc-100">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-xs text-zinc-600">
            <tr>
              <th className="px-3 py-2">策略等级</th>
              <th className="px-3 py-2">日期</th>
              <th className="px-3 py-2">星期</th>
              <th className="px-3 py-2">剩余库存（间夜）</th>
              <th className="px-3 py-2">建议动作</th>
              <th className="px-3 py-2">建议价格（CNY）</th>
              <th className="px-3 py-2">建议原因</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.date} className="border-t border-zinc-100">
                <td className="px-3 py-3">
                  <span className={['inline-flex items-center rounded-full px-2 py-1 text-xs ring-1', priorityBadge(r.priority)].join(' ')}>
                    {r.priority}
                  </span>
                </td>
                <td className="px-3 py-3 font-medium text-zinc-900">{r.date}</td>
                <td className="px-3 py-3 text-zinc-700">{r.weekday}</td>
                <td className="px-3 py-3 text-zinc-700">{r.remainingInventory}</td>
                <td className="px-3 py-3 text-zinc-700">{r.action}</td>
                <td className="px-3 py-3 text-zinc-700">
                  <div className="font-semibold text-zinc-900">{r.suggestedPrice}</div>
                  <div className="text-xs text-zinc-500">成本价：{r.costPrice}</div>
                  <div className="text-xs text-zinc-500">
                    价格区间：{r.minPrice} - {r.maxPrice}
                  </div>
                </td>
                <td className="px-3 py-3 text-zinc-600">{r.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

