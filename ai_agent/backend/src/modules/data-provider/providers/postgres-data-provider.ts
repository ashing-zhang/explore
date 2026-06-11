import { Injectable } from '@nestjs/common';
import { Client } from 'pg';
import {
  HistoricalOrder,
  MarketSnapshot,
  PricePoint,
  RecommendationRequest,
} from '../types';

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class PostgresDataProvider {
  private createClient(): Client {
    const port = process.env.PGPORT ? Number(process.env.PGPORT) : undefined;
    return new Client({
      host: process.env.PGHOST,
      port,
      database: process.env.PGDATABASE,
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined,
    });
  }

  private targetDate(req: RecommendationRequest): string {
    const d = req.targetDate ? new Date(req.targetDate) : new Date();
    return toIsoDate(d);
  }

  async getMarketSnapshot(req: RecommendationRequest): Promise<MarketSnapshot> {
    const client = this.createClient();
    await client.connect();
    try {
      const snapshotDate = this.targetDate(req);
      const otaPrices = await client.query<PricePoint>(
        `
          select date::text as "date", price::float as "price"
          from market_prices
          where date <= $1
          order by date desc
          limit 30
        `,
        [snapshotDate],
      );
      const competitorPrices = await client.query<PricePoint>(
        `
          select date::text as "date", price::float as "price"
          from competitor_prices
          where date <= $1
          order by date desc
          limit 30
        `,
        [snapshotDate],
      );
      const inventory = await client.query<{
        package_total: number;
        package_sold: number;
        hotel_total: number;
        hotel_sold: number;
      }>(
        `
          select package_total, package_sold, hotel_total, hotel_sold
          from inventory_status
          where date = $1
          limit 1
        `,
        [snapshotDate],
      );

      if (inventory.rows.length === 0) {
        throw new Error('No inventory_status row for target date');
      }

      const row = inventory.rows[0];
      return {
        snapshotDate,
        otaPriceSeries: otaPrices.rows.reverse(),
        competitorPriceSeries: competitorPrices.rows.reverse(),
        inventoryStatus: {
          packageTotal: row.package_total,
          packageSold: row.package_sold,
          packageRemaining: row.package_total - row.package_sold,
          hotelTotal: row.hotel_total,
          hotelSold: row.hotel_sold,
          hotelRemaining: row.hotel_total - row.hotel_sold,
        },
      };
    } finally {
      await client.end();
    }
  }

  async getHistoricalOrders(req: RecommendationRequest): Promise<HistoricalOrder[]> {
    const client = this.createClient();
    await client.connect();
    try {
      const snapshotDate = this.targetDate(req);
      const res = await client.query<HistoricalOrder>(
        `
          select
            order_id::text as "orderId",
            created_at::text as "createdAt",
            check_in_date::text as "checkInDate",
            nights::int as "nights",
            paid_price::float as "paidPrice",
            channel::text as "channel"
          from orders
          where created_at::date <= $1
          order by created_at desc
          limit 200
        `,
        [snapshotDate],
      );
      return res.rows.map((r: HistoricalOrder) => ({
        ...r,
        channel: r.channel === 'DIRECT' ? 'DIRECT' : 'OTA',
      }));
    } finally {
      await client.end();
    }
  }

  async getHistoricalPrices(req: RecommendationRequest): Promise<PricePoint[]> {
    const client = this.createClient();
    await client.connect();
    try {
      const snapshotDate = this.targetDate(req);
      const res = await client.query<PricePoint>(
        `
          select date::text as "date", avg_price::float as "price"
          from historical_prices
          where date <= $1
          order by date desc
          limit 90
        `,
        [snapshotDate],
      );
      return res.rows.reverse();
    } finally {
      await client.end();
    }
  }

  async getCompetitorPrices(req: RecommendationRequest): Promise<PricePoint[]> {
    const client = this.createClient();
    await client.connect();
    try {
      const snapshotDate = this.targetDate(req);
      const res = await client.query<PricePoint>(
        `
          select date::text as "date", price::float as "price"
          from competitor_prices
          where date <= $1
          order by date desc
          limit 30
        `,
        [snapshotDate],
      );
      return res.rows.reverse();
    } finally {
      await client.end();
    }
  }
}
