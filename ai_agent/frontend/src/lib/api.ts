import type { AgentOutputs, DashboardOverviewResponse, MarketSnapshot } from './types';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api';
}

export async function fetchMarketSnapshot(targetDate?: string): Promise<MarketSnapshot> {
  const url = new URL(`${apiBaseUrl()}/agent/market-snapshot`);
  if (targetDate) url.searchParams.set('targetDate', targetDate);
  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) throw new Error(`market-snapshot failed: ${res.status}`);
  return (await res.json()) as MarketSnapshot;
}

export async function fetchRecommendation(targetDate?: string): Promise<AgentOutputs> {
  const url = new URL(`${apiBaseUrl()}/agent/recommendation`);
  if (targetDate) url.searchParams.set('targetDate', targetDate);
  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) throw new Error(`recommendation failed: ${res.status}`);
  return (await res.json()) as AgentOutputs;
}

export async function fetchDashboardOverview(params?: {
  dataDate?: string;
  startDate?: string;
  endDate?: string;
}): Promise<DashboardOverviewResponse> {
  const url = new URL(`${apiBaseUrl()}/dashboard/overview`);
  if (params?.dataDate) url.searchParams.set('dataDate', params.dataDate);
  if (params?.startDate) url.searchParams.set('startDate', params.startDate);
  if (params?.endDate) url.searchParams.set('endDate', params.endDate);
  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) throw new Error(`dashboard failed: ${res.status}`);
  return (await res.json()) as DashboardOverviewResponse;
}
