import { Injectable, Logger } from '@nestjs/common';
import { performance } from 'node:perf_hooks';
import { PricingAgentService } from '../agent/pricing-agent.service';
import type { DashboardOverviewResponse } from './dashboard.types';

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

function daysBetween(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

function weekdayCn(d: Date): string {
  const map = ['日', '一', '二', '三', '四', '五', '六'] as const;
  return map[d.getDay()];
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function mapMarketHeatText(marketStatus: string): string {
  if (marketStatus === 'COLD') return '一般偏冷';
  if (marketStatus === 'HOT') return '偏热';
  if (marketStatus === 'EXTREME_HOT') return '极热';
  return '正常';
}

function formatDeltaText(delta: number): string {
  if (delta === 0) return '较上周持平';
  if (delta > 0) return `较上周 ↑ ${delta}`;
  return `较上周 ↓ ${Math.abs(delta)}`;
}

function bookingWindowText(params: {
  thisTotal: number;
  lastTotal: number;
}): string {
  const thisTotal = params.thisTotal;
  const lastTotal = params.lastTotal;
  if (lastTotal <= 0) {
    if (thisTotal <= 0) return '出现情况与去年相似';
    return '提前出现（去年同期基线为 0）';
  }

  const deltaPct = (thisTotal - lastTotal) / lastTotal;
  const pctText = `${Math.round(deltaPct * 100)}%`;
  if (deltaPct >= 0.2) return `提前出现（窗口期内销量今年较去年提升 ${pctText}）`;
  if (deltaPct <= -0.2) return `滞后出现（窗口期内销量今年较去年下降 ${pctText}）`;
  return `销售情况与去年相似`;
}

function apiTimingEnabled(): boolean {
  return process.env.LOG_API_TIMING === '1';
}

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private readonly agent: PricingAgentService) { }

  async getOverview(params: {
    dataDate?: string;
    startDate?: string;
    endDate?: string;
    hid?: string;
  }): Promise<DashboardOverviewResponse> {
    const enabled = apiTimingEnabled();
    const totalStart = enabled ? performance.now() : 0;
    const dataDate = params.dataDate ? new Date(params.dataDate) : new Date();
    const start =
      params.startDate ? new Date(params.startDate) : addDays(dataDate, 30);
    const end =
      params.endDate
        ? new Date(params.endDate)
        : addDays(start, 15);

    const rangeDays = Math.max(1, daysBetween(start, end) + 1);
    const daysToCheckIn = Math.max(0, daysBetween(dataDate, start));
    const tag = enabled
      ? ` hid=${params.hid ?? ''} start=${toIsoDate(start)} end=${toIsoDate(end)}`
      : '';

    const inputsStart = enabled ? performance.now() : 0;
    const inputs = await this.agent.buildInputs({
      targetDate: toIsoDate(dataDate),
      startDate: toIsoDate(start),
      endDate: toIsoDate(end),
      hid: params.hid,
    });
    if (enabled) this.logger.log(`overview buildInputs ${(performance.now() - inputsStart).toFixed(1)}ms${tag}`);

    const recStart = enabled ? performance.now() : 0;
    const rec = await this.agent.recommendFromInputs(inputs, { allowLlm: false });
    if (enabled) this.logger.log(`overview recommend ${(performance.now() - recStart).toFixed(1)}ms${tag}`);

    const remainingInventory = inputs.inventory_status.packageRemaining.reduce(
      (sum, item) => sum + Math.max(0, item.remaining),
      0,
    );
    const totalInventory = remainingInventory;
    const soldInventory = 0;

    const marketHeatText = mapMarketHeatText(rec.market_status);
    const marketHeatDelta = clamp(Math.round((rec.confidence - 0.6) * 10), -3, 3);

    const orderTrend = this.buildOrderTrend({
      startDate: start,
      endDate: end,
      orders: inputs.historical_orders,
    });

    const startYear = start.getUTCFullYear();
    let thisYearTotal = 0;
    let lastYearTotal = 0;
    for (const o of inputs.historical_orders) {
      const y = Number(o.checkInDate.slice(0, 4));
      if (!Number.isFinite(y)) continue;
      if (y === startYear) thisYearTotal += o.nights;
      else if (y === startYear - 1) lastYearTotal += o.nights;
    }
    const bookingWindow = bookingWindowText({ thisTotal: thisYearTotal, lastTotal: lastYearTotal });

    const otaPriceTrend = this.buildOtaPriceTrend({
      startDate: start,
      endDate: end,
      platformSeries: inputs.market_snapshot.otaPriceSeries,
      otaCompetitorSeries: inputs.market_snapshot.competitorPriceSeries,
    });

    const inventoryCalendar = this.buildInventoryCalendar({
      startDate: start,
      endDate: end,
      dailyRemaining: inputs.inventory_status.packageRemaining,
    });

    const aiSuggestions = this.buildAiSuggestions({
      dataDate,
      startDate: start,
      endDate: end,
      baseRemaining: Math.max(1, Math.round(remainingInventory / rangeDays)),
      recommendedPrice: rec.recommended_price,
    });

    if (enabled) this.logger.log(`overview total ${(performance.now() - totalStart).toFixed(1)}ms${tag}`);
    return {
      dataDate: toIsoDate(dataDate),
      packageDateRange: {
        startDate: toIsoDate(start),
        endDate: toIsoDate(end),
        days: rangeDays,
        daysToCheckIn,
      },
      summary: {
        totalInventory,
        soldInventory,
        remainingInventory,
        marketHeatText,
        marketHeatDeltaText: formatDeltaText(marketHeatDelta),
      },
      charts: {
        orderTrend,
        otaPriceTrend,
      },
      inventoryCalendar,
      aiSuggestions,
      keyIndicators: {
        bookingWindow,
        marketStatus: `${marketHeatText}（较上周 ${marketHeatDelta >= 0 ? '升温' : '降温'}）`,
        regionInventory: '充足（剩余率 18%）',
        priceAcceptance: '180% ~ 220%（历史 90 分位）',
      },
      actions: [
        '近期建议以工作日库存消化为主，建议价格控制在成本价的 80%~90%。',
        '周末库存待观察，关注区域热度变化，适当提价。',
        '密切关注 Booking Window 开始信号，预计在 6 月下旬开启。',
        '每日复盘市场与库存变化，动态调整策略。',
      ],
      riskAlerts: [
        '工作日库存存在滞销风险较高，建议尽快出清部分库存',
        '若 6 月 20 日前窗口仍未开启，考虑采取促销策略',
        '关注 OTA 降价趋势，避免错过最佳出清时机',
      ],
    };
  }

  private buildOrderTrend(params: {
    startDate: Date;
    endDate: Date;
    orders: { checkInDate: string; nights: number }[];
  }): DashboardOverviewResponse['charts']['orderTrend'] {
    const start = params.startDate;
    const days = Math.max(1, daysBetween(params.startDate, params.endDate) + 1);
    const roomNightsByCheckInDate = new Map<string, number>();
    for (const o of params.orders) {
      const key = o.checkInDate;
      roomNightsByCheckInDate.set(key, (roomNightsByCheckInDate.get(key) ?? 0) + o.nights);
    }

    const shiftByYears = (isoDate: string, deltaYears: number): string => {
      const d = new Date(`${isoDate}T00:00:00.000Z`);
      if (!Number.isFinite(d.getTime())) return isoDate;
      d.setUTCFullYear(d.getUTCFullYear() + deltaYears);
      return toIsoDate(d);
    };

    const dates: string[] = [];
    const thisYear: number[] = [];
    const lastYear: number[] = [];
    for (let i = 0; i < days; i += 1) {
      const d = addDays(start, i);
      const key = toIsoDate(d);
      dates.push(key);
      const v = roomNightsByCheckInDate.get(key) ?? 0;
      const lyKey = shiftByYears(key, -1);
      const ly = roomNightsByCheckInDate.get(lyKey) ?? 0;
      thisYear.push(v);
      lastYear.push(ly);
    }

    return { dates, thisYear, lastYear };
  }

  private buildOtaPriceTrend(params: {
    startDate: Date;
    endDate: Date;
    platformSeries: { date: string; price: number }[];
    otaCompetitorSeries: { date: string; price: number }[];
  }): DashboardOverviewResponse['charts']['otaPriceTrend'] {
    const start = params.startDate;
    const days = Math.max(1, daysBetween(params.startDate, params.endDate) + 1);
    const platformMap = new Map(params.platformSeries.map((p) => [p.date, p.price] as const));
    const competitorMap = new Map(
      params.otaCompetitorSeries.map((p) => [p.date, p.price] as const),
    );

    const dates: string[] = [];
    const platform: number[] = [];
    const otaCompetitor: number[] = [];
    const randInt = (min: number, max: number): number =>
      min + Math.floor(Math.random() * (max - min + 1));
    for (let i = 0; i < days; i += 1) {
      const d = addDays(start, i);
      const key = toIsoDate(d);
      dates.push(key);
      const p = platformMap.get(key) ?? randInt(560, 820);
      const c = competitorMap.get(key) ?? randInt(560, 820);
      platform.push(round2(p));
      otaCompetitor.push(round2(c));
    }

    return { dates, platform, otaCompetitor };
  }

  private buildInventoryCalendar(params: {
    startDate: Date;
    endDate: Date;
    dailyRemaining: Array<{ date: string; remaining: number }>;
  }): DashboardOverviewResponse['inventoryCalendar'] {
    const days = Math.max(1, daysBetween(params.startDate, params.endDate) + 1);
    const remainingMap = new Map(
      params.dailyRemaining.map((item) => [item.date, Math.max(0, item.remaining)] as const),
    );
    const dailyRemaining = Array.from({ length: days }, (_, i) => {
      const date = toIsoDate(addDays(params.startDate, i));
      return {
        date,
        remaining: remainingMap.get(date) ?? 0,
      };
    });
    const totalRemaining = dailyRemaining.reduce((sum, item) => sum + item.remaining, 0);

    return {
      startDate: toIsoDate(params.startDate),
      endDate: toIsoDate(params.endDate),
      dailyRemaining,
      totalRemaining,
    };
  }

  private buildAiSuggestions(params: {
    dataDate: Date;
    startDate: Date;
    endDate: Date;
    baseRemaining: number;
    recommendedPrice: number;
  }): DashboardOverviewResponse['aiSuggestions'] {
    const days = Math.max(1, daysBetween(params.startDate, params.endDate) + 1);
    const picks = [0, 4, 11].filter((i) => i < days);
    const costPrice = Math.max(1, Math.round(params.recommendedPrice * 1.18));
    const minPrice = Math.max(1, Math.round(costPrice * 0.8));
    const maxPrice = Math.max(1, Math.round(costPrice * 1.2));

    return picks.map((offset, idx) => {
      const d = addDays(params.startDate, offset);
      const weekday = weekdayCn(d);
      const priority =
        idx === 0 ? '高优先级' : idx === 1 ? '中优先级' : '低优先级';
      const remaining = clamp(params.baseRemaining + (idx - 1), 1, 99);
      const action =
        idx === 0 ? '即刻出清（工作日）' : idx === 1 ? '持有观望' : '高价销售';
      const suggestedPrice =
        idx === 0
          ? Math.round(costPrice * 0.85)
          : idx === 1
            ? Math.round(costPrice * 0.95)
            : Math.round(costPrice * 1.12);
      const reason =
        idx === 0
          ? '市场偏冷，工作日需求弱，建议优先出清降低风险'
          : idx === 1
            ? '周末需求有回暖迹象，建议观察竞品与区域趋势再调整'
            : '区域周末热度上升，可尝试高价销售提升收益';

      return {
        date: toIsoDate(d),
        weekday,
        priority,
        remainingInventory: remaining,
        action,
        suggestedPrice,
        costPrice,
        minPrice,
        maxPrice,
        reason,
      };
    });
  }
}
