'use client';

import ReactECharts from 'echarts-for-react';

export function DonutChart({
  title,
  items,
}: {
  title: string;
  items: { name: string; value: number; color?: string }[];
}) {
  const option = {
    title: { text: title, left: 'left', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'item' },
    legend: { bottom: 6, left: 'center' },
    series: [
      {
        name: title,
        type: 'pie',
        radius: ['55%', '78%'],
        center: ['50%', '46%'],
        avoidLabelOverlap: true,
        itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
        label: { show: false },
        emphasis: { scale: true, scaleSize: 6 },
        data: items.map((it) => ({
          name: it.name,
          value: it.value,
          itemStyle: it.color ? { color: it.color } : undefined,
        })),
      },
    ],
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
      <ReactECharts option={option} style={{ height: 320, width: '100%' }} />
    </div>
  );
}

