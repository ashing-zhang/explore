'use client';

import ReactECharts from 'echarts-for-react';

export function BubbleChart({
  title,
  xLabel,
  yLabel,
  points,
}: {
  title: string;
  xLabel: string;
  yLabel: string;
  points: { name: string; x: number; y: number; size: number; highlight?: boolean }[];
}) {
  const option = {
    title: { text: title, left: 'left', textStyle: { fontSize: 14 } },
    tooltip: {
      trigger: 'item',
      formatter: (p: { data: { name: string; value: number[] } }) => {
        const [x, y, s] = p.data.value;
        return `${p.data.name}<br/>${xLabel}：${x}<br/>${yLabel}：${y}%<br/>规模：${s}`;
      },
    },
    grid: { left: 44, right: 18, top: 50, bottom: 40 },
    xAxis: {
      type: 'value',
      name: xLabel,
      nameGap: 18,
      axisLabel: { color: '#71717a' },
    },
    yAxis: {
      type: 'value',
      name: yLabel,
      nameGap: 18,
      axisLabel: { color: '#71717a' },
    },
    series: [
      {
        type: 'scatter',
        data: points.map((p) => ({
          name: p.name,
          value: [p.x, p.y, p.size],
          itemStyle: { color: p.highlight ? '#f97316' : '#60a5fa', opacity: p.highlight ? 0.95 : 0.45 },
        })),
        symbolSize: (v: number[]) => Math.max(10, Math.min(42, Math.sqrt(Math.max(1, v[2])) * 2.2)),
      },
    ],
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
      <ReactECharts option={option} style={{ height: 320, width: '100%' }} />
    </div>
  );
}

