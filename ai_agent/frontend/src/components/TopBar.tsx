'use client';

export function TopBar({ dataDate }: { dataDate: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm text-zinc-600">
        <div className="text-zinc-900">
          <span className="font-medium">概览看板</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-sm text-zinc-600">
          数据日期：<span className="font-medium text-zinc-900">{dataDate}</span>
        </div>
        <div className="relative grid h-9 w-9 place-items-center rounded-full bg-white shadow-sm ring-1 ring-zinc-200">
          <span className="text-zinc-600">铃</span>
          <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-red-500 text-[11px] text-white">
            3
          </span>
        </div>
        <div className="grid h-9 w-9 place-items-center rounded-full bg-white shadow-sm ring-1 ring-zinc-200">
          <span className="text-zinc-600">我</span>
        </div>
      </div>
    </div>
  );
}

