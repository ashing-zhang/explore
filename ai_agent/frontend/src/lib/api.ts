import type {
  AgentOutputs,
  DashboardExecutionResponse,
  DashboardMarketResponse,
  DashboardOrdersResponse,
  DashboardOverviewResponse,
  DashboardStrategyResponse,
  MarketSnapshot,
} from './types';

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
  hid?: string;
}): Promise<DashboardOverviewResponse> {
  const url = new URL(`${apiBaseUrl()}/dashboard/overview`);
  if (params?.dataDate) url.searchParams.set('dataDate', params.dataDate);
  if (params?.startDate) url.searchParams.set('startDate', params.startDate);
  if (params?.endDate) url.searchParams.set('endDate', params.endDate);
  if (params?.hid) url.searchParams.set('hid', params.hid);
  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) throw new Error(`dashboard failed: ${res.status}`);
  return (await res.json()) as DashboardOverviewResponse;
}

export async function fetchDashboardOrders(params?: {
  dataDate?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}): Promise<DashboardOrdersResponse> {
  const url = new URL(`${apiBaseUrl()}/dashboard/orders`);
  if (params?.dataDate) url.searchParams.set('dataDate', params.dataDate);
  if (params?.startDate) url.searchParams.set('startDate', params.startDate);
  if (params?.endDate) url.searchParams.set('endDate', params.endDate);
  if (typeof params?.page === 'number') url.searchParams.set('page', String(params.page));
  if (typeof params?.pageSize === 'number') url.searchParams.set('pageSize', String(params.pageSize));
  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) throw new Error(`dashboard orders failed: ${res.status}`);
  return (await res.json()) as DashboardOrdersResponse;
}

export async function fetchDashboardMarket(params?: {
  dataDate?: string;
  startDate?: string;
  endDate?: string;
}): Promise<DashboardMarketResponse> {
  const url = new URL(`${apiBaseUrl()}/dashboard/market`);
  if (params?.dataDate) url.searchParams.set('dataDate', params.dataDate);
  if (params?.startDate) url.searchParams.set('startDate', params.startDate);
  if (params?.endDate) url.searchParams.set('endDate', params.endDate);
  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) throw new Error(`dashboard market failed: ${res.status}`);
  return (await res.json()) as DashboardMarketResponse;
}

export async function fetchDashboardStrategy(params?: {
  dataDate?: string;
  page?: number;
  pageSize?: number;
}): Promise<DashboardStrategyResponse> {
  const url = new URL(`${apiBaseUrl()}/dashboard/strategy`);
  if (params?.dataDate) url.searchParams.set('dataDate', params.dataDate);
  if (typeof params?.page === 'number') url.searchParams.set('page', String(params.page));
  if (typeof params?.pageSize === 'number') url.searchParams.set('pageSize', String(params.pageSize));
  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) throw new Error(`dashboard strategy failed: ${res.status}`);
  return (await res.json()) as DashboardStrategyResponse;
}

export async function fetchDashboardExecution(params?: {
  dataDate?: string;
  page?: number;
  pageSize?: number;
}): Promise<DashboardExecutionResponse> {
  const url = new URL(`${apiBaseUrl()}/dashboard/execution`);
  if (params?.dataDate) url.searchParams.set('dataDate', params.dataDate);
  if (typeof params?.page === 'number') url.searchParams.set('page', String(params.page));
  if (typeof params?.pageSize === 'number') url.searchParams.set('pageSize', String(params.pageSize));
  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) throw new Error(`dashboard execution failed: ${res.status}`);
  return (await res.json()) as DashboardExecutionResponse;
}
