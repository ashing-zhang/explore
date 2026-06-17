'use client';

import { useEffect, useState } from 'react';
import { fetchDashboardOverview } from '@/lib/api';
import type { DashboardOverviewResponse } from '@/lib/types';
import { DashboardShell } from '@/components/DashboardShell';
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
  const dataDate = todayIso();
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [hid, setHid] = useState<string>('');
  const [query, setQuery] = useState<{ startDate: string; endDate: string; hid: string } | null>(
    null,
  );
  const [overview, setOverview] = useState<DashboardOverviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const hasFilledForm = Boolean(startDate) && Boolean(endDate) && Boolean(hid.trim());
  const canConfirm = hasFilledForm && startDate <= endDate;
  const hasSelectedQuery = Boolean(query);

  useEffect(() => {
    let alive = true; // 状态隔离标记（竞态锁），防止组件卸载或连续快速切换日期导致的数据错乱
    if (!hasSelectedQuery) {
      setLoading(false);
      setError(null);
      setOverview(null);
      return () => {
        alive = false;
      };
    }

    setLoading(true);
    setError(null);
    if (query && query.startDate && query.endDate && query.startDate > query.endDate) {
      setLoading(false);
      setError('开始日期不能晚于结束日期');
      return () => {
        alive = false;
      };
    }

    fetchDashboardOverview({
      dataDate,
      startDate: query?.startDate || undefined,
      endDate: query?.endDate || undefined,
      hid: query?.hid || undefined,
    })
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
  }, [query, hasSelectedQuery]);

  return (
    <DashboardShell activeKey="dashboard" title="概览看板" dataDate={overview?.dataDate ?? dataDate}>
      <div className="flex flex-wrap items-center justify-end gap-3 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
        <div className="text-sm font-semibold text-zinc-900">HID</div>
        <input
          inputMode="numeric"
          className={`w-[170px] rounded-lg border px-3 py-2 text-base font-semibold text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500 ${hid.trim()
            ? 'border-blue-400 bg-blue-50/60'
            : 'border-zinc-300 bg-white'
            }`}
          value={hid}
          onChange={(e) => setHid(e.target.value)}
          placeholder="例如 2732704"
        />
        <div className="text-sm font-semibold text-zinc-900">入住开始日期</div>
        <input
          type="date"
          className={`rounded-lg border px-3 py-2 text-base font-semibold text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500 ${startDate
            ? 'border-blue-400 bg-blue-50/60'
            : 'border-zinc-300 bg-white'
            }`}
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
        <div className="text-sm font-semibold text-zinc-900">入住结束日期</div>
        <input
          type="date"
          className={`rounded-lg border px-3 py-2 text-base font-semibold text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500 ${endDate
            ? 'border-blue-400 bg-blue-50/60'
            : 'border-zinc-300 bg-white'
            }`}
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
        />
        <button
          type="button"
          disabled={!canConfirm || loading}
          onClick={() => {
            const trimmed = hid.trim();
            if (!trimmed || !startDate || !endDate) return;
            setOverview(null);
            setError(null);
            setQuery({ hid: trimmed, startDate, endDate });
          }}
          className={`rounded-lg px-4 py-2 text-base font-semibold shadow-sm transition focus:outline-none focus:ring-2 focus:ring-blue-500 ${canConfirm && !loading
            ? 'bg-blue-600 text-white hover:bg-blue-700'
            : 'cursor-not-allowed bg-zinc-200 text-zinc-500'
            }`}
        >
          {loading ? '查询中...' : '确认'}
        </button>
      </div>

      {!hasSelectedQuery ? (
        <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600 shadow-sm">
          请先输入 HID、入住开始日期、入住结束日期，并点击“确认”后查看概览看板。
        </div>
      ) : (
        <>
          {error ? (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              {error}
            </div>
          ) : null}

          {loading && !overview ? (
            <div className="mt-5 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="text-base font-semibold text-zinc-900">概览看板加载中</div>
              <div className="mt-2 text-sm text-zinc-600">
                正在获取库存、历史订单和价格趋势数据，请稍候...
              </div>
            </div>
          ) : overview ? (
            <>
              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
                <MetricTile
                  title="包房日期范围"
                  value={rangeText(overview.packageDateRange)}
                  sub={`共 ${overview.packageDateRange.days} 天`}
                  accent="blue"
                />
                <MetricTile
                  title="总库存（间夜）"
                  value={`${overview.summary.totalInventory}`}
                  sub={`参考天数：${overview.packageDateRange.days} 天`}
                  accent="teal"
                />
                <MetricTile
                  title="已售（间夜）"
                  value={`${overview.summary.soldInventory}`}
                  sub={`${Math.round(
                    (overview.summary.soldInventory / Math.max(1, overview.summary.totalInventory)) *
                    100,
                  )}%`}
                  accent="green"
                />
                <MetricTile
                  title="剩余库存（间夜）"
                  value={`${overview.summary.remainingInventory}`}
                  sub={`${Math.round(
                    (overview.summary.remainingInventory /
                      Math.max(1, overview.summary.totalInventory)) *
                    100,
                  )}%`}
                  accent="purple"
                />
                <MetricTile
                  title="距离入住"
                  value={`${overview.packageDateRange.daysToCheckIn} 天`}
                  accent="orange"
                />
                <MetricTile
                  title="市场热度"
                  value={overview.summary.marketHeatText}
                  sub={overview.summary.marketHeatDeltaText}
                  accent="blue"
                />
              </div>

              <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="lg:col-span-1">
                  <MultiLineChart
                    title="订单趋势（间夜）"
                    dates={overview.charts.orderTrend.dates}
                    series={[
                      {
                        name: '今年累计销量',
                        data: overview.charts.orderTrend.thisYear,
                        color: '#3b82f6',
                      },
                      {
                        name: '去年同期销量',
                        data: overview.charts.orderTrend.lastYear,
                        color: '#22c55e',
                      },
                    ]}
                  />
                </div>
                <div className="lg:col-span-1">
                  <MultiLineChart
                    title="OTA 价格趋势（平均价 CNY）"
                    dates={overview.charts.otaPriceTrend.dates}
                    series={[
                      {
                        name: '本酒店',
                        data: overview.charts.otaPriceTrend.hotel,
                        color: '#3b82f6',
                      },
                      {
                        name: '区域平均',
                        data: overview.charts.otaPriceTrend.regionAvg,
                        color: '#f97316',
                      },
                    ]}
                  />
                </div>
                <div className="lg:col-span-1">
                  <InventoryCalendar calendar={overview.inventoryCalendar} />
                </div>
              </div>

              <div className="mt-5">
                <AiSuggestionsTable rows={overview.aiSuggestions} />
              </div>

              <div className="mt-4">
                <InsightCards
                  keyIndicators={overview.keyIndicators}
                  actions={overview.actions}
                  riskAlerts={overview.riskAlerts}
                />
              </div>
            </>
          ) : (
            <div className="mt-5 rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600 shadow-sm">
              当前条件下暂无可展示的概览数据。
            </div>
          )}
        </>
      )}
    </DashboardShell>
  );
}
