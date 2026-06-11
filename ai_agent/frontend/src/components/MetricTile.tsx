export function MetricTile({
  title,
  value,
  sub,
  accent = 'blue',
}: {
  title: string;
  value: string;
  sub?: string;
  accent?: 'blue' | 'green' | 'purple' | 'orange' | 'teal';
}) {
  const accentClass =
    accent === 'green'
      ? 'bg-green-50 text-green-700'
      : accent === 'purple'
        ? 'bg-purple-50 text-purple-700'
        : accent === 'orange'
          ? 'bg-orange-50 text-orange-700'
          : accent === 'teal'
            ? 'bg-teal-50 text-teal-700'
            : 'bg-blue-50 text-blue-700';

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm text-zinc-500">{title}</div>
          <div className="mt-1 text-2xl font-semibold text-zinc-900">{value}</div>
          {sub ? <div className="mt-1 text-xs text-zinc-500">{sub}</div> : null}
        </div>
        <div className={['grid h-10 w-10 place-items-center rounded-xl text-sm font-semibold', accentClass].join(' ')}>
          {title.slice(0, 1)}
        </div>
      </div>
    </div>
  );
}

