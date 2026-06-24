"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsService = void 0;
const common_1 = require("@nestjs/common");
function avg(xs) {
    if (xs.length === 0)
        return 0;
    return xs.reduce((a, b) => a + b, 0) / xs.length;
}
function safeRatio(n, d) {
    if (d === 0)
        return 0;
    return n / d;
}
function lastN(points, n) {
    return points.slice(Math.max(points.length - n, 0));
}
function clamp01(x) {
    return Math.max(0, Math.min(1, x));
}
function totalRemaining(inventory) {
    return inventory.packageRemaining.reduce((sum, item) => sum + Math.max(0, item.remaining), 0);
}
let AnalyticsService = class AnalyticsService {
    computeMarketStatus(market, historicalPrices) {
        const recentOta = avg(lastN(market.priceSeries, 7).map((p) => p.price));
        const baseHist = avg(lastN(historicalPrices, 60).map((p) => p.price));
        const ratio = safeRatio(recentOta, baseHist || recentOta || 1);
        if (ratio >= 1.18)
            return 'EXTREME_HOT';
        if (ratio >= 1.08)
            return 'HOT';
        if (ratio <= 0.93)
            return 'COLD';
        return 'NORMAL';
    }
    computeBookingWindowStatus(orders, inventory) {
        const remaining = totalRemaining(inventory);
        if (remaining <= 5)
            return 'PASSED';
        const last7 = orders.slice(0, 7);
        const last28 = orders.slice(0, 28);
        const pace7 = last7.length;
        const pace28 = last28.length / 4;
        const paceRatio = safeRatio(pace7, pace28 || pace7 || 1);
        if (paceRatio >= 1.2)
            return 'IN_WINDOW';
        return 'NOT_STARTED';
    }
    computeInventoryRisk(marketStatus, inventory) {
        const remaining = totalRemaining(inventory);
        if (remaining <= 5)
            return 'CRITICAL';
        if (marketStatus === 'HOT' || marketStatus === 'EXTREME_HOT') {
            if (remaining <= 20)
                return 'HIGH';
            if (remaining <= 40)
                return 'MEDIUM';
            return 'LOW';
        }
        if (remaining >= 120)
            return 'HIGH';
        if (remaining >= 80)
            return 'MEDIUM';
        return 'LOW';
    }
    computeConfidence(marketStatus, bookingWindow, risk) {
        const marketWeight = marketStatus === 'NORMAL' ? 0.6 : marketStatus === 'COLD' ? 0.55 : 0.7;
        const windowWeight = bookingWindow === 'IN_WINDOW' ? 0.7 : bookingWindow === 'PASSED' ? 0.65 : 0.55;
        const riskWeight = risk === 'LOW' ? 0.6 : risk === 'MEDIUM' ? 0.65 : risk === 'HIGH' ? 0.7 : 0.75;
        return clamp01((marketWeight + windowWeight + riskWeight) / 3);
    }
};
exports.AnalyticsService = AnalyticsService;
exports.AnalyticsService = AnalyticsService = __decorate([
    (0, common_1.Injectable)()
], AnalyticsService);
//# sourceMappingURL=analytics.service.js.map