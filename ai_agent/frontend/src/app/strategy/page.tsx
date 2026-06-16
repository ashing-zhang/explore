'use client';

import { useEffect, useState } from 'react';
import { DashboardShell } from '@/components/DashboardShell';
import { KpiCard } from '@/components/KpiCard';
import { MultiLineChart } from '@/components/MultiLineChart';
import { Pagination } from '@/components/Pagination';
import { fetchDashboardStrategy } from '@/lib/api';
import type { DashboardStrategyResponse } from '@/lib/types';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function levelBadge(level: DashboardStrategyResponse['cards'][number]['level']): string {
  if (level === '高优先级') return 'bg-red-50 text-red-700 ring-red-200';
  if (level === '中优先级') return 'bg-orange-50 text-orange-700 ring-orange-200';
  return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
}

export default function StrategyPage() {
  const dataDate = todayIso();
  const [page, setPage] = useState<number>(1);
  const [pageSize] = useState<number>(10);
  const [data, setData] = useState<DashboardStrategyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetchDashboardStrategy({ dataDate, page, pageSize })
      .then((res) => {
        if (!alive) return;
        setData(res);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [dataDate, page, pageSize]);

  return (
    <DashboardShell activeKey="strategy" title="策略建议" dataDate={data?.dataDate ?? dataDate}>
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {(data?.cards ?? []).map((c) => (
          <div key={c.id} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={['inline-flex items-center rounded-full px-2 py-1 text-xs ring-1', levelBadge(c.level)].join(' ')}>
                    {c.level}
                  </span>
                  <div className="truncate text-sm font-semibold text-zinc-900">{c.title}</div>
                </div>
                <div className="mt-2 text-sm text-zinc-700">{c.description}</div>
                <div className="mt-2 text-xs font-medium text-zinc-600">{c.impactText}</div>
              </div>
              <button type="button" className="shrink-0 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50">
                {c.ctaLabel}
              </button>
            </div>
          </div>
        ))}
        {loading && (data?.cards.length ?? 0) === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600 shadow-sm lg:col-span-3">加载中…</div>
        ) : null}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <MultiLineChart
            title="策略影响（GMV%）"
            dates={data?.effect.dates ?? []}
            series={[
              { name: '预期', data: data?.effect.expectedGmvPct ?? [], color: '#3b82f6' },
              { name: '实际', data: data?.effect.actualGmvPct ?? [], color: '#22c55e' },
            ]}
          />
        </div>
        <div className="grid grid-cols-1 gap-4">
          <KpiCard title="GMV 变化" value={data ? `${data.effect.kpis.gmvPct}%` : loading ? '加载中…' : '—'} deltaPct={data?.effect.kpis.gmvPct ?? 0} />
          <KpiCard title="订单量变化" value={data ? `${data.effect.kpis.ordersPct}%` : loading ? '加载中…' : '—'} deltaPct={data?.effect.kpis.ordersPct ?? 0} />
          <KpiCard title="取消率变化" value={data ? `${data.effect.kpis.cancelRatePct}%` : loading ? '加载中…' : '—'} deltaPct={data?.effect.kpis.cancelRatePct ?? 0} />
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-zinc-900">历史建议效果</div>
          <div className="text-xs text-zinc-600">{loading ? '加载中…' : data ? `共 ${data.history.total} 条` : '—'}</div>
        </div>
        <div className="mt-3 overflow-hidden rounded-xl ring-1 ring-zinc-100">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs text-zinc-600">
              <tr>
                <th className="px-3 py-2">日期</th>
                <th className="px-3 py-2">优先级</th>
                <th className="px-3 py-2">策略</th>
                <th className="px-3 py-2">触发原因</th>
                <th className="px-3 py-2">覆盖范围</th>
                <th className="px-3 py-2">预期收益</th>
                <th className="px-3 py-2">实际收益</th>
                <th className="px-3 py-2">状态</th>
              </tr>
            </thead>
            <tbody>
              {(data?.history.rows ?? []).map((r) => (
                <tr key={`${r.date}-${r.strategy}`} className="border-t border-zinc-100">
                  <td className="px-3 py-3 font-medium text-zinc-900">{r.date}</td>
                  <td className="px-3 py-3">
                    <span className={['inline-flex items-center rounded-full px-2 py-1 text-xs ring-1', levelBadge(r.level)].join(' ')}>
                      {r.level}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-zinc-700">{r.strategy}</td>
                  <td className="px-3 py-3 text-zinc-700">{r.trigger}</td>
                  <td className="px-3 py-3 text-zinc-700">{r.scope}</td>
                  <td className="px-3 py-3 text-zinc-700">{r.expectedBenefit}</td>
                  <td className="px-3 py-3 text-zinc-700">{r.actualBenefit}</td>
                  <td className="px-3 py-3 text-zinc-700">{r.status}</td>
                </tr>
              ))}
              {!loading && (data?.history.rows.length ?? 0) === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-center text-sm text-zinc-500" colSpan={8}>
                    暂无数据
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {data ? (
          <Pagination page={data.history.page} pageSize={data.history.pageSize} total={data.history.total} onChange={setPage} />
        ) : null}
      </div>
    </DashboardShell>
  );
}

