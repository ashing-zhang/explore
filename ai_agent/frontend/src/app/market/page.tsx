'use client';

import { useEffect, useMemo, useState } from 'react';
import { DashboardShell } from '@/components/DashboardShell';
import { AreaLineChart } from '@/components/AreaLineChart';
import { BubbleChart } from '@/components/BubbleChart';
import { KpiCard } from '@/components/KpiCard';
import { MultiLineChart } from '@/components/MultiLineChart';
import { fetchDashboardMarket } from '@/lib/api';
import type { DashboardMarketResponse } from '@/lib/types';

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

export default function MarketPage() {
  const dataDate = todayIso();
  const initialStart = useMemo(() => addDaysIso(dataDate, -10), [dataDate]);
  const initialEnd = useMemo(() => addDaysIso(dataDate, 5), [dataDate]);

  const [draftStart, setDraftStart] = useState<string>(initialStart);
  const [draftEnd, setDraftEnd] = useState<string>(initialEnd);
  const [startDate, setStartDate] = useState<string>(initialStart);
  const [endDate, setEndDate] = useState<string>(initialEnd);

  const [data, setData] = useState<DashboardMarketResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetchDashboardMarket({ dataDate, startDate, endDate })
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
  }, [dataDate, startDate, endDate]);

  return (
    <DashboardShell activeKey="market" title="市场监控" dataDate={data?.dataDate ?? dataDate}>
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
            <option>全部城市</option>
            <option>成都</option>
            <option>上海</option>
            <option>杭州</option>
            <option>南京</option>
          </select>
          <select className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 shadow-sm outline-none">
            <option>全部商圈</option>
            <option>市中心</option>
            <option>机场</option>
            <option>火车站</option>
            <option>景区</option>
          </select>
        </div>

        <button
          type="button"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          onClick={() => {
            setStartDate(draftStart);
            setEndDate(draftEnd);
          }}
        >
          查询
        </button>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>
      ) : null}

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard title="市场房量" value={data ? formatInt(data.kpis.supplyRooms.value) : loading ? '加载中…' : '—'} deltaPct={data?.kpis.supplyRooms.deltaPct ?? 0} />
        <KpiCard title="RevPAR（CNY）" value={data ? formatInt(data.kpis.revparCny.value) : loading ? '加载中…' : '—'} deltaPct={data?.kpis.revparCny.deltaPct ?? 0} />
        <KpiCard title="OCC" value={data ? `${data.kpis.occPct.value}%` : loading ? '加载中…' : '—'} deltaPct={data?.kpis.occPct.deltaPct ?? 0} />
        <KpiCard title="ADR（CNY）" value={data ? formatInt(data.kpis.adrCny.value) : loading ? '加载中…' : '—'} deltaPct={data?.kpis.adrCny.deltaPct ?? 0} />
        <KpiCard title="竞品数" value={data ? formatInt(data.kpis.competitorCount.value) : loading ? '加载中…' : '—'} deltaPct={data?.kpis.competitorCount.deltaPct ?? 0} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <MultiLineChart
          title="价格趋势（ADR CNY）"
          dates={data?.charts.priceTrend.dates ?? []}
          series={[
            { name: '本店', data: data?.charts.priceTrend.hotelAdrCny ?? [], color: '#3b82f6' },
            { name: '市场均值', data: data?.charts.priceTrend.marketAdrCny ?? [], color: '#22c55e' },
          ]}
        />
        <BubbleChart
          title="竞品分布（ADR / OCC）"
          xLabel="ADR(CNY)"
          yLabel="OCC"
          points={(data?.charts.competitorScatter.points ?? []).map((p) => ({
            name: p.name,
            x: p.adrCny,
            y: p.occPct,
            size: p.rooms,
            highlight: p.isSelf,
          }))}
        />
        <AreaLineChart
          title="市场趋势指数"
          dates={data?.charts.marketIndex.dates ?? []}
          series={[
            { name: '需求指数', data: data?.charts.marketIndex.demandIndex ?? [], color: '#3b82f6' },
            { name: '供给指数', data: data?.charts.marketIndex.supplyIndex ?? [], color: '#22c55e' },
          ]}
        />
      </div>

      <div className="mt-5 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="text-sm font-medium text-zinc-900">竞品酒店对比</div>
        <div className="mt-3 overflow-hidden rounded-xl ring-1 ring-zinc-100">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs text-zinc-600">
              <tr>
                <th className="px-3 py-2">酒店</th>
                <th className="px-3 py-2">ADR（CNY）</th>
                <th className="px-3 py-2">OCC</th>
                <th className="px-3 py-2">RevPAR（CNY）</th>
                <th className="px-3 py-2">价格指数</th>
              </tr>
            </thead>
            <tbody>
              {(data?.table.rows ?? []).map((r) => (
                <tr key={r.hotel} className="border-t border-zinc-100">
                  <td className="px-3 py-3 font-medium text-zinc-900">{r.hotel}</td>
                  <td className="px-3 py-3 text-zinc-700">{formatInt(r.adrCny)}</td>
                  <td className="px-3 py-3 text-zinc-700">{r.occPct}%</td>
                  <td className="px-3 py-3 text-zinc-700">{formatInt(r.revparCny)}</td>
                  <td className="px-3 py-3 text-zinc-700">{r.priceIndexPct}%</td>
                </tr>
              ))}
              {!loading && (data?.table.rows.length ?? 0) === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-center text-sm text-zinc-500" colSpan={5}>
                    暂无数据
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardShell>
  );
}

