'use client';

export function TopBar({ dataDate }: { dataDate: string }) {
  return (
    <div className="flex items-center justify-end">
      <div className="text-[15px] font-semibold tracking-wide text-zinc-700">
        数据日期：
        <span className="ml-1 tabular-nums text-base font-semibold text-zinc-950">
          {dataDate}
        </span>
      </div>
    </div>
  );
}
