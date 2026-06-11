'use client';

import ReactECharts from 'echarts-for-react';
import type { PricePoint } from '@/lib/types';

export function PriceChart({
  title,
  series,
  color,
}: {
  title: string;
  series: PricePoint[];
  color: string;
}) {
  const option = {
    title: { text: title, left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'axis' },
    grid: { left: 40, right: 20, top: 60, bottom: 30 },
    xAxis: {
      type: 'category',
      data: series.map((p) => p.date),
      axisLabel: { formatter: (v: string) => v.slice(5) },
    },
    yAxis: { type: 'value' },
    series: [
      {
        type: 'line',
        data: series.map((p) => p.price),
        showSymbol: false,
        smooth: true,
        lineStyle: { width: 2, color },
        areaStyle: { opacity: 0.06, color },
      },
    ],
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
      <ReactECharts option={option} style={{ height: 320, width: '100%' }} />
    </div>
  );
}

