'use client';

import { useEffect, useState } from 'react';
import { fetchDashboardOverview } from '@/lib/api';
import type { DashboardOverviewResponse } from '@/lib/types';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { MetricTile } from '@/components/MetricTile';
import { MultiLineChart } from '@/components/MultiLineChart';
import { InventoryCalendar } from '@/components/InventoryCalendar';
import { AiSuggestionsTable } from '@/components/AiSuggestionsTable';
import { InsightCards } from '@/components/InsightCards';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function rangeText(range: DashboardOverviewResponse['packageDateRange']): string {
  return `${range.startDate} - ${range.endDate}`;
}

export default function Home() {
  const [dataDate, setDataDate] = useState<string>(todayIso());
  const [overview, setOverview] = useState<DashboardOverviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true; // 状态隔离标记（竞态锁），防止组件卸载或连续快速切换日期导致的数据错乱
    setLoading(true);
    setError(null);
    fetchDashboardOverview({ dataDate })
      .then((res) => {
        if (!alive) return; // 如果在请求完成前，用户又切换了日期或者离开了页面，则丢弃该次结果
        setOverview(res);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : String(e)); // 规范化错误信息
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;  // 清理函数：当 dataDate 改变重新触发 effect，或者组件销毁时，将上一次的 alive 设为 false
    };
  }, [dataDate]);

  return (
    <div className="flex min-h-dvh bg-zinc-50">
      <Sidebar activeKey="dashboard" />
      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-[1200px] px-6 py-6">
          <div className="flex items-center justify-between">
            <TopBar dataDate={overview?.dataDate ?? dataDate} />
          </div>

          <div className="mt-4 flex items-center justify-end gap-3">
            <div className="text-sm text-zinc-600">数据日期</div>
            <input
              type="date"
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
              value={dataDate}
              onChange={(e) => setDataDate(e.target.value)} // 用户修改日期时，更新 dataDate 状态，触发重新请求
            />
          </div>

          {error ? (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              {error}
            </div>
          ) : null}

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
            <MetricTile
              title="包房日期范围"
              value={
                overview?.packageDateRange
                  ? rangeText(overview.packageDateRange)
                  : loading
                    ? '加载中…'
                    : '—'
              }
              sub={
                overview?.packageDateRange
                  ? `共 ${overview.packageDateRange.days} 天`
                  : undefined
              }
              accent="blue"
            />
            <MetricTile
              title="总库存（间夜）"
              value={
                overview ? `${overview.summary.totalInventory}` : loading ? '加载中…' : '—'
              }
              sub={
                overview?.packageDateRange
                  ? `参考天数：${overview.packageDateRange.days} 天`
                  : undefined
              }
              accent="teal"
            />
            <MetricTile
              title="已售（间夜）"
              value={
                overview ? `${overview.summary.soldInventory}` : loading ? '加载中…' : '—'
              }
              sub={
                overview
                  ? `${Math.round(
                    (overview.summary.soldInventory / Math.max(1, overview.summary.totalInventory)) * 100,
                  )}%`
                  : undefined
              }
              accent="green"
            />
            <MetricTile
              title="剩余库存（间夜）"
              value={
                overview ? `${overview.summary.remainingInventory}` : loading ? '加载中…' : '—'
              }
              sub={
                overview
                  ? `${Math.round(
                    (overview.summary.remainingInventory / Math.max(1, overview.summary.totalInventory)) * 100,
                  )}%`
                  : undefined
              }
              accent="purple"
            />
            <MetricTile
              title="距离入住"
              value={
                overview?.packageDateRange
                  ? `${overview.packageDateRange.daysToCheckIn} 天`
                  : loading
                    ? '加载中…'
                    : '—'
              }
              accent="orange"
            />
            <MetricTile
              title="市场热度"
              value={overview ? overview.summary.marketHeatText : loading ? '加载中…' : '—'}
              sub={overview ? overview.summary.marketHeatDeltaText : undefined}
              accent="blue"
            />
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <MultiLineChart
                title="订单趋势（间夜）"
                dates={overview?.charts.orderTrend.dates ?? []}
                series={[
                  {
                    name: '今年累计销量',
                    data: overview?.charts.orderTrend.thisYear ?? [],
                    color: '#3b82f6',
                  },
                  {
                    name: '去年同期销量',
                    data: overview?.charts.orderTrend.lastYear ?? [],
                    color: '#22c55e',
                  },
                ]}
              />
            </div>
            <div className="lg:col-span-1">
              <MultiLineChart
                title="OTA 价格趋势（平均价 CNY）"
                dates={overview?.charts.otaPriceTrend.dates ?? []}
                series={[
                  {
                    name: '本酒店',
                    data: overview?.charts.otaPriceTrend.hotel ?? [],
                    color: '#3b82f6',
                  },
                  {
                    name: '区域平均',
                    data: overview?.charts.otaPriceTrend.regionAvg ?? [],
                    color: '#f97316',
                  },
                  {
                    name: '去年同期',
                    data: overview?.charts.otaPriceTrend.lastYear ?? [],
                    color: '#22c55e',
                  },
                ]}
              />
            </div>
            <div className="lg:col-span-1">
              {overview?.inventoryCalendar ? (
                <InventoryCalendar calendar={overview.inventoryCalendar} />
              ) : (
                <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
                  <div className="text-sm text-zinc-600">{loading ? '加载中…' : '—'}</div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-5">
            <AiSuggestionsTable rows={overview?.aiSuggestions ?? []} />
          </div>

          <div className="mt-4">
            {overview ? (
              <InsightCards
                keyIndicators={overview.keyIndicators}
                actions={overview.actions}
                riskAlerts={overview.riskAlerts}
              />
            ) : (
              <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
                <div className="text-sm text-zinc-600">{loading ? '加载中…' : '—'}</div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
