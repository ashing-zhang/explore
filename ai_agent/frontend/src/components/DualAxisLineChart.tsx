'use client';

import ReactECharts from 'echarts-for-react';

export function DualAxisLineChart({
  title,
  dates,
  left,
  right,
}: {
  title: string;
  dates: string[];
  left: { name: string; data: number[]; color: string };
  right: { name: string; data: number[]; color: string };
}) {
  const option = {
    title: { text: title, left: 'left', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'axis' },
    legend: { top: 0, right: 0 },
    grid: { left: 44, right: 44, top: 50, bottom: 30 },
    xAxis: {
      type: 'category',
      data: dates.map((d) => d.slice(5)),
      axisLabel: { color: '#71717a' },
    },
    yAxis: [
      { type: 'value', axisLabel: { color: '#71717a' } },
      { type: 'value', axisLabel: { color: '#71717a' } },
    ],
    series: [
      {
        name: left.name,
        type: 'line',
        yAxisIndex: 0,
        data: left.data,
        showSymbol: false,
        smooth: true,
        lineStyle: { width: 2, color: left.color },
      },
      {
        name: right.name,
        type: 'line',
        yAxisIndex: 1,
        data: right.data,
        showSymbol: false,
        smooth: true,
        lineStyle: { width: 2, color: right.color },
      },
    ],
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
      <ReactECharts option={option} style={{ height: 320, width: '100%' }} />
    </div>
  );
}

