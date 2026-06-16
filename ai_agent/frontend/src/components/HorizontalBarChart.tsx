'use client';

import ReactECharts from 'echarts-for-react';

export function HorizontalBarChart({
  title,
  items,
  color = '#3b82f6',
}: {
  title: string;
  items: { name: string; value: number }[];
  color?: string;
}) {
  const option = {
    title: { text: title, left: 'left', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 90, right: 18, top: 50, bottom: 24 },
    xAxis: { type: 'value', axisLabel: { color: '#71717a' } },
    yAxis: {
      type: 'category',
      axisLabel: { color: '#71717a' },
      data: items.map((x) => x.name).reverse(),
    },
    series: [
      {
        type: 'bar',
        data: items
          .map((x) => x.value)
          .reverse(),
        barWidth: 12,
        itemStyle: { color, borderRadius: [6, 6, 6, 6] },
      },
    ],
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
      <ReactECharts option={option} style={{ height: 320, width: '100%' }} />
    </div>
  );
}

