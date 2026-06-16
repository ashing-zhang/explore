'use client';

import { useEffect, useState } from 'react';
import { DashboardShell } from '@/components/DashboardShell';
import { Pagination } from '@/components/Pagination';
import { fetchDashboardExecution } from '@/lib/api';
import type { DashboardExecutionResponse } from '@/lib/types';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatInt(n: number): string {
  return new Intl.NumberFormat('zh-CN').format(n);
}

function statusBadge(status: DashboardExecutionResponse['table']['rows'][number]['status']): string {
  if (status === '成功') return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  if (status === '失败') return 'bg-red-50 text-red-700 ring-red-200';
  if (status === '人工处理') return 'bg-orange-50 text-orange-700 ring-orange-200';
  if (status === '执行中') return 'bg-blue-50 text-blue-700 ring-blue-200';
  return 'bg-zinc-50 text-zinc-700 ring-zinc-200';
}

function CountCard({
  title,
  value,
  tone,
}: {
  title: string;
  value: string;
  tone: 'blue' | 'green' | 'red' | 'orange' | 'zinc';
}) {
  const toneClass =
    tone === 'green'
      ? 'text-emerald-600'
      : tone === 'red'
        ? 'text-red-600'
        : tone === 'orange'
          ? 'text-orange-600'
          : tone === 'blue'
            ? 'text-blue-600'
            : 'text-zinc-600';
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="text-sm text-zinc-500">{title}</div>
      <div className={['mt-1 text-2xl font-semibold', toneClass].join(' ')}>{value}</div>
    </div>
  );
}

export default function ExecutionPage() {
  const dataDate = todayIso();
  const [page, setPage] = useState<number>(1);
  const [pageSize] = useState<number>(10);
  const [data, setData] = useState<DashboardExecutionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetchDashboardExecution({ dataDate, page, pageSize })
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
    <DashboardShell activeKey="execution" title="执行记录" dataDate={data?.dataDate ?? dataDate}>
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <CountCard title="待执行" value={data ? formatInt(data.kpis.pending) : loading ? '加载中…' : '—'} tone="blue" />
        <CountCard title="已成功" value={data ? formatInt(data.kpis.success) : loading ? '加载中…' : '—'} tone="green" />
        <CountCard title="已失败" value={data ? formatInt(data.kpis.failed) : loading ? '加载中…' : '—'} tone="red" />
        <CountCard title="人工处理" value={data ? formatInt(data.kpis.manual) : loading ? '加载中…' : '—'} tone="orange" />
        <CountCard title="执行成功率" value={data ? `${data.kpis.successRatePct}%` : loading ? '加载中…' : '—'} tone="zinc" />
      </div>

      <div className="mt-5 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-zinc-900">执行明细</div>
          <div className="text-xs text-zinc-600">{loading ? '加载中…' : data ? `共 ${data.table.total} 条` : '—'}</div>
        </div>
        <div className="mt-3 overflow-hidden rounded-xl ring-1 ring-zinc-100">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs text-zinc-600">
              <tr>
                <th className="px-3 py-2">记录ID</th>
                <th className="px-3 py-2">时间</th>
                <th className="px-3 py-2">动作</th>
                <th className="px-3 py-2">范围</th>
                <th className="px-3 py-2">执行人</th>
                <th className="px-3 py-2">效果</th>
                <th className="px-3 py-2">状态</th>
              </tr>
            </thead>
            <tbody>
              {(data?.table.rows ?? []).map((r) => (
                <tr key={r.id} className="border-t border-zinc-100">
                  <td className="px-3 py-3 font-medium text-zinc-900">{r.id}</td>
                  <td className="px-3 py-3 text-zinc-700">{r.createdAt}</td>
                  <td className="px-3 py-3 text-zinc-700">{r.action}</td>
                  <td className="px-3 py-3 text-zinc-700">{r.scope}</td>
                  <td className="px-3 py-3 text-zinc-700">{r.operator}</td>
                  <td className="px-3 py-3 text-zinc-700">{r.effectText}</td>
                  <td className="px-3 py-3">
                    <span className={['inline-flex items-center rounded-full px-2 py-1 text-xs ring-1', statusBadge(r.status)].join(' ')}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
              {!loading && (data?.table.rows.length ?? 0) === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-center text-sm text-zinc-500" colSpan={7}>
                    暂无数据
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {data ? <Pagination page={data.table.page} pageSize={data.table.pageSize} total={data.table.total} onChange={setPage} /> : null}
      </div>
    </DashboardShell>
  );
}

