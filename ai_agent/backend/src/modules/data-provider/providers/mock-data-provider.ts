import { Injectable } from '@nestjs/common';
import {
  HistoricalOrder,
  InventoryStatus,
  MarketSnapshot,
  PricePoint,
  RecommendationRequest,
} from '../types';

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

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function generateSeries(
  endDate: Date,
  days: number,
  base: number,
  volatility: number,
  slopePerDay: number,
): PricePoint[] {
  const points: PricePoint[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(endDate);
    d.setDate(d.getDate() - i);
    const t = days - 1 - i;
    const wave = Math.sin(t / 3) * volatility * 0.4 + Math.cos(t / 7) * volatility * 0.2;
    const noise = ((t * 17) % 13) / 13 - 0.5;
    const price = Math.round((base + slopePerDay * t + wave + noise * volatility) * 100) / 100;
    points.push({ date: toIsoDate(d), price: clamp(price, 50, 99999) });
  }
  return points;
}

@Injectable()
export class MockDataProvider {
  async getMarketSnapshot(req: RecommendationRequest): Promise<MarketSnapshot> {
    const snapshotDate = req.targetDate ? new Date(req.targetDate) : new Date();
    const priceSeries = generateSeries(snapshotDate, 30, 699, 55, 1.2);
    const competitorPriceSeries = generateSeries(snapshotDate, 30, 679, 45, 1.0);
    const startDate = req.startDate ? new Date(req.startDate) : addDays(snapshotDate, 7);
    const endDate = req.endDate ? new Date(req.endDate) : addDays(startDate, 14);
    const days = Math.max(1, daysBetween(startDate, endDate) + 1);
    const inventoryStatus: InventoryStatus = {
      packageRemaining: Array.from({ length: days }, (_, i) => ({
        date: toIsoDate(addDays(startDate, i)),
        remaining: Math.max(0, 4 + Math.round(Math.sin(i / 3) * 2) + ((i * 7) % 3)),
      })),
    };

    return {
      snapshotDate: toIsoDate(snapshotDate),
      priceSeries,
      competitorPriceSeries,
      inventoryStatus,
    };
  }

  async getHistoricalOrders(req: RecommendationRequest): Promise<HistoricalOrder[]> {
    const now = req.targetDate ? new Date(req.targetDate) : new Date();
    const checkInStart = req.startDate ? new Date(req.startDate) : null;
    const checkInEnd = req.endDate ? new Date(req.endDate) : null;
    const hasCheckInRange =
      !!checkInStart && !!checkInEnd && checkInStart.getTime() <= checkInEnd.getTime();
    const checkInRangeDays = hasCheckInRange
      ? Math.max(1, daysBetween(checkInStart, checkInEnd) + 1)
      : 0;
    const orders: HistoricalOrder[] = [];
    for (let i = 0; i < 40; i += 1) {
      const createdAt = new Date(now);
      createdAt.setDate(createdAt.getDate() - (i + 1));
      const checkInDate = hasCheckInRange
        ? addDays(checkInStart, i % checkInRangeDays)
        : addDays(createdAt, 7 + (i % 9));
      orders.push({
        orderId: `MOCK-${createdAt.getTime()}-${i}`,
        createdAt: createdAt.toISOString(),
        checkInDate: toIsoDate(checkInDate),
        nights: (i % 3) + 1,
      });
    }
    return orders;
  }

  async getHistoricalPrices(req: RecommendationRequest): Promise<PricePoint[]> {
    const snapshotDate = req.targetDate ? new Date(req.targetDate) : new Date();
    return generateSeries(snapshotDate, 90, 650, 35, 0.4);
  }

  async getCompetitorPrices(req: RecommendationRequest): Promise<PricePoint[]> {
    const snapshotDate = req.targetDate ? new Date(req.targetDate) : new Date();
    return generateSeries(snapshotDate, 30, 679, 45, 1.0);
  }
}
