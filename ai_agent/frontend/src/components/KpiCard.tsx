'use client';

function deltaClass(deltaPct: number): string {
  if (deltaPct > 0) return 'text-emerald-600';
  if (deltaPct < 0) return 'text-red-600';
  return 'text-zinc-500';
}

function deltaText(deltaPct: number): string {
  const sign = deltaPct > 0 ? '+' : '';
  return `${sign}${deltaPct}%`;
}

export function KpiCard({
  title,
  value,
  deltaPct,
}: {
  title: string;
  value: string;
  deltaPct: number;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="text-sm text-zinc-500">{title}</div>
      <div className="mt-1 text-2xl font-semibold text-zinc-900">{value}</div>
      <div className={['mt-1 text-xs font-medium', deltaClass(deltaPct)].join(' ')}>
        较上期 {deltaText(deltaPct)}
      </div>
    </div>
  );
}

