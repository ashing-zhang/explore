'use client';

import Link from 'next/link';

const navItems = [
  { key: 'dashboard', label: '概览看板', href: '/' },
  { key: 'orders', label: '订单分析', href: '/orders' },
  { key: 'market', label: '市场监控', href: '/market' },
  { key: 'strategy', label: '策略建议', href: '/strategy' },
  { key: 'execution', label: '执行记录', href: '/execution' },
] as const;

export function Sidebar({ activeKey }: { activeKey: (typeof navItems)[number]['key'] }) {
  return (
    <aside className="flex h-dvh w-[240px] flex-col bg-gradient-to-b from-slate-950 via-blue-950 to-blue-900 text-white">
      <div className="px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-white/10">
            <span className="text-sm font-semibold">AI</span>
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold">包房智能决策系统</div>
            <div className="text-xs text-white/70">看板</div>
          </div>
        </div>
      </div>

      <nav className="mt-2 flex-1 px-3">
        <div className="space-y-1">
          {navItems.map((it) => {
            const active = it.key === activeKey;
            return (
              <Link
                key={it.key}
                href={it.href}
                aria-current={active ? 'page' : undefined}
                className={[
                  'flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition',
                  active
                    ? 'bg-blue-500/20 text-white'
                    : 'text-white/80 hover:bg-white/5 hover:text-white',
                ].join(' ')}
              >
                <div className={['h-2.5 w-2.5 rounded-full', active ? 'bg-blue-300' : 'bg-white/30'].join(' ')} />
                <div>{it.label}</div>
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="px-5 py-4">
        <div className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-3">
          <div className="h-9 w-9 rounded-full bg-white/10" />
          <div className="leading-tight">
            <div className="text-sm font-medium">运营人员</div>
            <div className="text-xs text-white/70">在线</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
