import { Injectable } from '@nestjs/common';
import {
  HistoricalOrder,
  MarketSnapshot,
  PricePoint,
  RecommendationRequest,
} from '../types';
import * as fs from 'node:fs';
import * as path from 'node:path';

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class OdpsDataProvider {
  private parseCsvLine(line: string): string[] {
    const out: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i += 1;
          continue;
        }
        inQuotes = !inQuotes;
        continue;
      }
      if (ch === ',' && !inQuotes) {
        out.push(cur);
        cur = '';
        continue;
      }
      cur += ch;
    }
    out.push(cur);
    return out;
  }

  private parseOdpsDateTimeToIsoDate(s: string): string | null {
    const text = s.trim();
    if (!text) return null;
    const datePart = text.split(' ')[0] ?? '';
    const parts = datePart.split('/');
    if (parts.length !== 3) return null;
    const y = parts[0]?.trim();
    const m = parts[1]?.trim();
    const d = parts[2]?.trim();
    if (!y || !m || !d) return null;
    const mm = m.padStart(2, '0');
    const dd = d.padStart(2, '0');
    return `${y}-${mm}-${dd}`;
  }

  private shiftIsoDateByYears(iso: string, deltaYears: number): string | null {
    const d = new Date(`${iso}T00:00:00.000Z`);
    if (!Number.isFinite(d.getTime())) return null;
    d.setUTCFullYear(d.getUTCFullYear() + deltaYears);
    return toIsoDate(d);
  }

  private loadBaofangCsv(): { header: string[]; rows: string[][] } {
    const csvPath =
      process.env.BAOFANG_ORDER_CSV_PATH ??
      path.resolve(process.cwd(), 'data_example', 'baofang_order.csv');
    const raw = fs.readFileSync(csvPath, 'utf8');
    const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) return { header: [], rows: [] };
    const header = this.parseCsvLine(lines[0]).map((s) => s.trim());
    const rows = lines.slice(1).map((l) => this.parseCsvLine(l));
    return { header, rows };
  }

  private odpsConfig(): {
    accessId?: string;
    secretAccessKey?: string;
    project?: string;
    endpoint?: string;
  } {
    const fromEnv = {
      accessId: process.env.ODPS_ACCESS_ID,
      secretAccessKey: process.env.ODPS_SECRET_ACCESS_KEY,
      project: process.env.ODPS_PROJECT,
      endpoint: process.env.ODPS_ENDPOINT,
    };
    if (fromEnv.accessId && fromEnv.secretAccessKey && fromEnv.project && fromEnv.endpoint) {
      return fromEnv;
    }

    const yamlPath =
      process.env.ODPS_CONFIG_PATH ??
      path.resolve(process.cwd(), 'sql', 'odps.yaml');

    if (!fs.existsSync(yamlPath)) {
      return fromEnv;
    }

    const text = fs.readFileSync(yamlPath, 'utf8');
    const pick = (key: string): string | undefined => {
      const m = text.match(new RegExp(`^\\s*${key}\\s*:\\s*"?([^"\\n]+)"?\\s*$`, 'm'));
      return m?.[1]?.trim();
    };

    return {
      accessId: fromEnv.accessId ?? pick('access_id'),
      secretAccessKey: fromEnv.secretAccessKey ?? pick('secret_access_key'),
      project: fromEnv.project ?? pick('project'),
      endpoint: fromEnv.endpoint ?? pick('endpoint'),
    };
  }

  private targetDate(req: RecommendationRequest): string {
    const d = req.targetDate ? new Date(req.targetDate) : new Date();
    return toIsoDate(d);
  }

  private seedBase(req: RecommendationRequest): string {
    const cfg = this.odpsConfig();
    return [
      cfg.project ?? 'unknown_project',
      cfg.endpoint ?? 'unknown_endpoint',
      this.targetDate(req),
    ].join('|');
  }

  private hash32(seed: string): number {
    let h = 2166136261;
    for (let i = 0; i < seed.length; i += 1) {
      h ^= seed.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  private pickInt(seed: string, min: number, max: number): number {
    const a = Math.min(min, max);
    const b = Math.max(min, max);
    const span = b - a + 1;
    return a + (this.hash32(seed) % span);
  }

  private addDays(d: Date, days: number): Date {
    const next = new Date(d);
    next.setDate(next.getDate() + days);
    return next;
  }

  private daysBetween(a: Date, b: Date): number {
    const msPerDay = 24 * 60 * 60 * 1000;
    const x = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
    const y = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
    return Math.round((y - x) / msPerDay);
  }

  private buildDateSeries(endIso: string, days: number): string[] {
    const end = new Date(endIso);
    const start = this.addDays(end, -Math.max(0, days - 1));
    const out: string[] = [];
    for (let i = 0; i < days; i += 1) {
      out.push(toIsoDate(this.addDays(start, i)));
    }
    return out;
  }

  async getMarketSnapshot(req: RecommendationRequest): Promise<MarketSnapshot> {
    const snapshotDate = this.targetDate(req);
    const baseSeed = this.seedBase(req);
    const dates = this.buildDateSeries(snapshotDate, 30);

    const base = this.pickInt(`${baseSeed}:basePrice`, 560, 820);
    const otaPriceSeries: PricePoint[] = dates.map((date, idx) => {
      const drift = idx * 1.9;
      const wave = Math.round(Math.sin(idx / 4) * 14);
      const noise = this.pickInt(`${baseSeed}:ota:${date}`, -10, 10);
      return { date, price: Math.round(base + drift + wave + noise) };
    });

    const competitorPriceSeries: PricePoint[] = dates.map((date, idx) => {
      const anchor = otaPriceSeries[idx]?.price ?? base;
      const noise = this.pickInt(`${baseSeed}:comp:${date}`, -18, 18);
      return { date, price: Math.max(1, Math.round(anchor * 0.95 + 22 + noise)) };
    });

    const packageTotal = this.pickInt(`${baseSeed}:inv:packageTotal`, 260, 520);
    const packageSold = this.pickInt(
      `${baseSeed}:inv:packageSold`,
      Math.round(packageTotal * 0.45),
      Math.round(packageTotal * 0.92),
    );

    const hotelTotal = this.pickInt(`${baseSeed}:inv:hotelTotal`, 480, 920);
    const hotelSold = this.pickInt(
      `${baseSeed}:inv:hotelSold`,
      Math.round(hotelTotal * 0.35),
      Math.round(hotelTotal * 0.88),
    );

    return {
      snapshotDate,
      otaPriceSeries,
      competitorPriceSeries,
      inventoryStatus: {
        packageTotal,
        packageSold,
        packageRemaining: packageTotal - packageSold,
        hotelTotal,
        hotelSold,
        hotelRemaining: hotelTotal - hotelSold,
      },
    };
  }

  async getHistoricalOrders(req: RecommendationRequest): Promise<HistoricalOrder[]> {
    const start = req.startDate ?? '';
    const end = req.endDate ?? '';
    if (!start || !end) return [];

    const lastYearStart = this.shiftIsoDateByYears(start, -1);
    const lastYearEnd = this.shiftIsoDateByYears(end, -1);
    if (!lastYearStart || !lastYearEnd) return [];

    const { header, rows } = this.loadBaofangCsv();
    if (header.length === 0) return [];
    const idx = new Map(header.map((name, i) => [name, i] as const));

    const get = (row: string[], col: string): string => row[idx.get(col) ?? -1] ?? '';
    const hid = (req.hid ?? '').trim();

    const roomNightsByCheckInDate = new Map<string, number>();
    for (const row of rows) {
      const isBaofang = get(row, 'is_baofang').trim();
      if (isBaofang !== '1') continue;

      const rowHid = get(row, 'hid').trim();
      if (hid && rowHid !== hid) continue;

      const checkInIso = this.parseOdpsDateTimeToIsoDate(get(row, 'checkin_date'));
      const checkOutIso = this.parseOdpsDateTimeToIsoDate(get(row, 'checkout_date'));
      if (!checkInIso || !checkOutIso) continue;

      const inThisYear = checkInIso >= start && checkInIso <= end;
      const inLastYear = checkInIso >= lastYearStart && checkInIso <= lastYearEnd;
      if (!inThisYear && !inLastYear) continue;

      const checkIn = new Date(`${checkInIso}T00:00:00.000Z`);
      const checkOut = new Date(`${checkOutIso}T00:00:00.000Z`);
      const span = Math.max(0, this.daysBetween(checkIn, checkOut));

      const num = Number(get(row, 'num')) || 0;
      const roomNights = num * span;
      if (roomNights <= 0) continue;

      roomNightsByCheckInDate.set(
        checkInIso,
        (roomNightsByCheckInDate.get(checkInIso) ?? 0) + roomNights,
      );
    }

    return Array.from(roomNightsByCheckInDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([checkInDate, roomNights]) => ({
        orderId: `ODPS-ROOM_NIGHTS-${hid || 'ALL'}-${checkInDate}`,
        createdAt: new Date(`${checkInDate}T00:00:00.000Z`).toISOString(),
        checkInDate,
        nights: roomNights,
        paidPrice: 0,
        channel: 'OTA',
      }));
  }

  async getHistoricalPrices(req: RecommendationRequest): Promise<PricePoint[]> {
    const snapshotDate = this.targetDate(req);
    const baseSeed = this.seedBase(req);
    const dates = this.buildDateSeries(snapshotDate, 90);
    const base = this.pickInt(`${baseSeed}:histPrice:base`, 520, 780);
    return dates.map((date, idx) => {
      const trend = idx * 0.85;
      const wave = Math.round(Math.sin(idx / 6) * 16);
      const noise = this.pickInt(`${baseSeed}:histPrice:${date}`, -12, 12);
      return { date, price: Math.max(1, Math.round(base + trend + wave + noise)) };
    });
  }

  async getCompetitorPrices(req: RecommendationRequest): Promise<PricePoint[]> {
    const snapshotDate = this.targetDate(req);
    const baseSeed = this.seedBase(req);
    const dates = this.buildDateSeries(snapshotDate, 30);
    const base = this.pickInt(`${baseSeed}:compPrice:base`, 540, 840);
    return dates.map((date, idx) => {
      const drift = idx * 1.4;
      const wave = Math.round(Math.sin(idx / 5) * 18);
      const noise = this.pickInt(`${baseSeed}:compPrice:${date}`, -18, 18);
      return { date, price: Math.max(1, Math.round(base + drift + wave + noise)) };
    });
  }
}
