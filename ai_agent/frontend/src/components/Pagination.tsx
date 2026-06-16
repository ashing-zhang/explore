'use client';

function pageRange(current: number, total: number): number[] {
  const pages = new Set<number>([1, total, current - 1, current, current + 1, current - 2, current + 2]);
  return Array.from(pages)
    .filter((p) => p >= 1 && p <= total)
    .sort((a, b) => a - b);
}

export function Pagination({
  page,
  pageSize,
  total,
  onChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onChange: (nextPage: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  const pages = pageRange(page, totalPages);

  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="text-xs text-zinc-500">
        共 <span className="font-medium text-zinc-900">{total}</span> 条，页码{' '}
        <span className="font-medium text-zinc-900">
          {page}/{totalPages}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 shadow-sm disabled:opacity-50"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          上一页
        </button>
        <div className="flex items-center gap-1">
          {pages.map((p) => (
            <button
              key={p}
              type="button"
              className={[
                'h-8 w-8 rounded-lg text-xs font-semibold',
                p === page ? 'bg-blue-600 text-white' : 'border border-zinc-200 bg-white text-zinc-700',
              ].join(' ')}
              onClick={() => onChange(p)}
            >
              {p}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 shadow-sm disabled:opacity-50"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
        >
          下一页
        </button>
      </div>
    </div>
  );
}

