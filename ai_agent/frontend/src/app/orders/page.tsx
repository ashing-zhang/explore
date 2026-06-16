'use client';

import { useEffect, useMemo, useState } from 'react';
import { DashboardShell } from '@/components/DashboardShell';
import { DualAxisLineChart } from '@/components/DualAxisLineChart';
import { DonutChart } from '@/components/DonutChart';
import { HorizontalBarChart } from '@/components/HorizontalBarChart';
import { KpiCard } from '@/components/KpiCard';
import { Pagination } from '@/components/Pagination';
import { fetchDashboardOrders } from '@/lib/api';
import type { DashboardOrdersResponse } from '@/lib/types';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatInt(n: number): string {
  return new Intl.NumberFormat('zh-CN').format(n);
}

function formatCny(n: number): string {
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 }).format(n);
}

function statusBadge(status: DashboardOrdersResponse['table']['rows'][number]['status']): string {
  if (status === '已完成') return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  if (status === '已取消') return 'bg-red-50 text-red-700 ring-red-200';
  return 'bg-blue-50 text-blue-700 ring-blue-200';
}

export default function OrdersPage() {
  const dataDate = todayIso();
  const initialStart = useMemo(() => addDaysIso(dataDate, -10), [dataDate]);
  const initialEnd = useMemo(() => addDaysIso(dataDate, 5), [dataDate]);

  const [draftStart, setDraftStart] = useState<string>(initialStart);
  const [draftEnd, setDraftEnd] = useState<string>(initialEnd);
  const [startDate, setStartDate] = useState<string>(initialStart);
  const [endDate, setEndDate] = useState<string>(initialEnd);
  const [page, setPage] = useState<number>(1);
  const [pageSize] = useState<number>(10);

  const [data, setData] = useState<DashboardOrdersResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetchDashboardOrders({ dataDate, startDate, endDate, page, pageSize })
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
  }, [dataDate, startDate, endDate, page, pageSize]);

  return (
    <DashboardShell activeKey="orders" title="订单分析" dataDate={data?.dataDate ?? dataDate}>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-sm font-semibold text-zinc-900">日期范围</div>
          <input
            type="date"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            value={draftStart}
            onChange={(e) => setDraftStart(e.target.value)}
          />
          <div className="text-sm text-zinc-500">-</div>
          <input
            type="date"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            value={draftEnd}
            onChange={(e) => setDraftEnd(e.target.value)}
          />
          <select className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 shadow-sm outline-none">
            <option>全部渠道</option>
            <option>OTA</option>
            <option>直采</option>
            <option>企业</option>
            <option>团购</option>
          </select>
          <select className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 shadow-sm outline-none">
            <option>全部城市</option>
            <option>成都</option>
            <option>上海</option>
            <option>杭州</option>
            <option>南京</option>
          </select>
        </div>

        <button
          type="button"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          onClick={() => {
            setStartDate(draftStart);
            setEndDate(draftEnd);
            setPage(1);
          }}
        >
          查询
        </button>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>
      ) : null}

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard title="订单量" value={data ? formatInt(data.kpis.orderCount.value) : loading ? '加载中…' : '—'} deltaPct={data?.kpis.orderCount.deltaPct ?? 0} />
        <KpiCard title="GMV（CNY）" value={data ? formatCny(data.kpis.gmvCny.value) : loading ? '加载中…' : '—'} deltaPct={data?.kpis.gmvCny.deltaPct ?? 0} />
        <KpiCard title="客单价" value={data ? formatCny(data.kpis.aovCny.value) : loading ? '加载中…' : '—'} deltaPct={data?.kpis.aovCny.deltaPct ?? 0} />
        <KpiCard title="取消率" value={data ? `${data.kpis.cancelRatePct.value}%` : loading ? '加载中…' : '—'} deltaPct={data?.kpis.cancelRatePct.deltaPct ?? 0} />
        <KpiCard title="履约率" value={data ? `${data.kpis.fulfillRatePct.value}%` : loading ? '加载中…' : '—'} deltaPct={data?.kpis.fulfillRatePct.deltaPct ?? 0} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <DualAxisLineChart
          title="订单趋势（订单量 / GMV）"
          dates={data?.charts.orderTrend.dates ?? []}
          left={{ name: '订单量', data: data?.charts.orderTrend.orderCount ?? [], color: '#3b82f6' }}
          right={{ name: 'GMV（CNY）', data: data?.charts.orderTrend.gmvCny ?? [], color: '#22c55e' }}
        />
        <DonutChart
          title="订单渠道占比"
          items={(data?.charts.channelShare ?? []).map((x, idx) => ({
            ...x,
            color: ['#3b82f6', '#22c55e', '#f97316', '#a855f7', '#64748b'][idx % 5],
          }))}
        />
        <HorizontalBarChart title="国内TOP10（按订单量）" items={data?.charts.domesticTop10 ?? []} />
      </div>

      <div className="mt-5 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-zinc-900">订单明细</div>
          <div className="text-xs text-zinc-600">{loading ? '加载中…' : data ? `共 ${data.table.total} 条` : '—'}</div>
        </div>
        <div className="mt-3 overflow-hidden rounded-xl ring-1 ring-zinc-100">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs text-zinc-600">
              <tr>
                <th className="px-3 py-2">订单ID</th>
                <th className="px-3 py-2">下单日期</th>
                <th className="px-3 py-2">入住日期</th>
                <th className="px-3 py-2">城市</th>
                <th className="px-3 py-2">酒店</th>
                <th className="px-3 py-2">房型</th>
                <th className="px-3 py-2">渠道</th>
                <th className="px-3 py-2">间夜</th>
                <th className="px-3 py-2">金额（CNY）</th>
                <th className="px-3 py-2">状态</th>
              </tr>
            </thead>
            <tbody>
              {(data?.table.rows ?? []).map((r) => (
                <tr key={r.orderId} className="border-t border-zinc-100">
                  <td className="px-3 py-3 font-medium text-zinc-900">{r.orderId}</td>
                  <td className="px-3 py-3 text-zinc-700">{r.orderDate}</td>
                  <td className="px-3 py-3 text-zinc-700">{r.checkInDate}</td>
                  <td className="px-3 py-3 text-zinc-700">{r.city}</td>
                  <td className="px-3 py-3 text-zinc-700">{r.hotel}</td>
                  <td className="px-3 py-3 text-zinc-700">{r.roomType}</td>
                  <td className="px-3 py-3 text-zinc-700">{r.channel}</td>
                  <td className="px-3 py-3 text-zinc-700">{r.nights}</td>
                  <td className="px-3 py-3 text-zinc-700">{formatCny(r.amountCny)}</td>
                  <td className="px-3 py-3">
                    <span className={['inline-flex items-center rounded-full px-2 py-1 text-xs ring-1', statusBadge(r.status)].join(' ')}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
              {!loading && (data?.table.rows.length ?? 0) === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-center text-sm text-zinc-500" colSpan={10}>
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

