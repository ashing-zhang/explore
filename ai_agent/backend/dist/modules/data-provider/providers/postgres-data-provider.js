"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostgresDataProvider = void 0;
const common_1 = require("@nestjs/common");
const pg_1 = require("pg");
function toIsoDate(d) {
    return d.toISOString().slice(0, 10);
}
let PostgresDataProvider = class PostgresDataProvider {
    createClient() {
        const port = process.env.PGPORT ? Number(process.env.PGPORT) : undefined;
        return new pg_1.Client({
            host: process.env.PGHOST,
            port,
            database: process.env.PGDATABASE,
            user: process.env.PGUSER,
            password: process.env.PGPASSWORD,
            ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined,
        });
    }
    targetDate(req) {
        const d = req.targetDate ? new Date(req.targetDate) : new Date();
        return toIsoDate(d);
    }
    async getMarketSnapshot(req) {
        const client = this.createClient();
        await client.connect();
        try {
            const snapshotDate = this.targetDate(req);
            const otaPrices = await client.query(`
          select date::text as "date", price::float as "price"
          from market_prices
          where date <= $1
          order by date desc
          limit 30
        `, [snapshotDate]);
            const competitorPrices = await client.query(`
          select date::text as "date", price::float as "price"
          from competitor_prices
          where date <= $1
          order by date desc
          limit 30
        `, [snapshotDate]);
            const inventory = await client.query(`
          select package_total, package_sold, hotel_total, hotel_sold
          from inventory_status
          where date = $1
          limit 1
        `, [snapshotDate]);
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
        }
        finally {
            await client.end();
        }
    }
    async getHistoricalOrders(req) {
        const client = this.createClient();
        await client.connect();
        try {
            const snapshotDate = this.targetDate(req);
            const res = await client.query(`
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
        `, [snapshotDate]);
            return res.rows.map((r) => ({
                ...r,
                channel: r.channel === 'DIRECT' ? 'DIRECT' : 'OTA',
            }));
        }
        finally {
            await client.end();
        }
    }
    async getHistoricalPrices(req) {
        const client = this.createClient();
        await client.connect();
        try {
            const snapshotDate = this.targetDate(req);
            const res = await client.query(`
          select date::text as "date", avg_price::float as "price"
          from historical_prices
          where date <= $1
          order by date desc
          limit 90
        `, [snapshotDate]);
            return res.rows.reverse();
        }
        finally {
            await client.end();
        }
    }
    async getCompetitorPrices(req) {
        const client = this.createClient();
        await client.connect();
        try {
            const snapshotDate = this.targetDate(req);
            const res = await client.query(`
          select date::text as "date", price::float as "price"
          from competitor_prices
          where date <= $1
          order by date desc
          limit 30
        `, [snapshotDate]);
            return res.rows.reverse();
        }
        finally {
            await client.end();
        }
    }
};
exports.PostgresDataProvider = PostgresDataProvider;
exports.PostgresDataProvider = PostgresDataProvider = __decorate([
    (0, common_1.Injectable)()
], PostgresDataProvider);
//# sourceMappingURL=postgres-data-provider.js.map