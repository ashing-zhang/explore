'use client';

import ReactECharts from 'echarts-for-react';

export function AreaLineChart({
  title,
  dates,
  series,
}: {
  title: string;
  dates: string[];
  series: { name: string; data: number[]; color: string }[];
}) {
  const option = {
    title: { text: title, left: 'left', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'axis' },
    legend: { top: 0, right: 0 },
    grid: { left: 44, right: 18, top: 50, bottom: 30 },
    xAxis: {
      type: 'category',
      data: dates.map((d) => d.slice(5)),
      axisLabel: { color: '#71717a' },
    },
    yAxis: { type: 'value', axisLabel: { color: '#71717a' } },
    series: series.map((s) => ({
      name: s.name,
      type: 'line',
      data: s.data,
      showSymbol: false,
      smooth: true,
      lineStyle: { width: 2, color: s.color },
      areaStyle: { opacity: 0.12, color: s.color },
    })),
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
      <ReactECharts option={option} style={{ height: 320, width: '100%' }} />
    </div>
  );
}

