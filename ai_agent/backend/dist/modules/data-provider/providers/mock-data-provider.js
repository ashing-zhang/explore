"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockDataProvider = void 0;
const common_1 = require("@nestjs/common");
function toIsoDate(d) {
    return d.toISOString().slice(0, 10);
}
function addDays(d, days) {
    const next = new Date(d);
    next.setDate(next.getDate() + days);
    return next;
}
function daysBetween(a, b) {
    const ms = b.getTime() - a.getTime();
    return Math.round(ms / (24 * 60 * 60 * 1000));
}
function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
}
function generateSeries(endDate, days, base, volatility, slopePerDay) {
    const points = [];
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
let MockDataProvider = class MockDataProvider {
    async getMarketSnapshot(req) {
        const snapshotDate = req.targetDate ? new Date(req.targetDate) : new Date();
        const otaPriceSeries = generateSeries(snapshotDate, 30, 699, 55, 1.2);
        const competitorPriceSeries = generateSeries(snapshotDate, 30, 679, 45, 1.0);
        const inventoryStatus = {
            packageTotal: 200,
            packageSold: 132,
            packageRemaining: 68,
            hotelTotal: 120,
            hotelSold: 84,
            hotelRemaining: 36,
        };
        return {
            snapshotDate: toIsoDate(snapshotDate),
            otaPriceSeries,
            competitorPriceSeries,
            inventoryStatus,
        };
    }
    async getHistoricalOrders(req) {
        const now = req.targetDate ? new Date(req.targetDate) : new Date();
        const checkInStart = req.startDate ? new Date(req.startDate) : null;
        const checkInEnd = req.endDate ? new Date(req.endDate) : null;
        const hasCheckInRange = !!checkInStart && !!checkInEnd && checkInStart.getTime() <= checkInEnd.getTime();
        const checkInRangeDays = hasCheckInRange
            ? Math.max(1, daysBetween(checkInStart, checkInEnd) + 1)
            : 0;
        const orders = [];
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
    async getHistoricalPrices(req) {
        const snapshotDate = req.targetDate ? new Date(req.targetDate) : new Date();
        return generateSeries(snapshotDate, 90, 650, 35, 0.4);
    }
    async getCompetitorPrices(req) {
        const snapshotDate = req.targetDate ? new Date(req.targetDate) : new Date();
        return generateSeries(snapshotDate, 30, 679, 45, 1.0);
    }
};
exports.MockDataProvider = MockDataProvider;
exports.MockDataProvider = MockDataProvider = __decorate([
    (0, common_1.Injectable)()
], MockDataProvider);
//# sourceMappingURL=mock-data-provider.js.map