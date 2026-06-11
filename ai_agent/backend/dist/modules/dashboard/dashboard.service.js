"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardService = void 0;
const common_1 = require("@nestjs/common");
const pricing_agent_service_1 = require("../agent/pricing-agent.service");
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
function weekdayCn(d) {
    const map = ['日', '一', '二', '三', '四', '五', '六'];
    return map[d.getDay()];
}
function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
}
function round2(n) {
    return Math.round(n * 100) / 100;
}
function avg(xs) {
    if (xs.length === 0)
        return 0;
    return xs.reduce((a, b) => a + b, 0) / xs.length;
}
function mapMarketHeatText(marketStatus) {
    if (marketStatus === 'COLD')
        return '一般偏冷';
    if (marketStatus === 'HOT')
        return '偏热';
    if (marketStatus === 'EXTREME_HOT')
        return '极热';
    return '正常';
}
function formatDeltaText(delta) {
    if (delta === 0)
        return '较上周持平';
    if (delta > 0)
        return `较上周 ↑ ${delta}`;
    return `较上周 ↓ ${Math.abs(delta)}`;
}
let DashboardService = class DashboardService {
    agent;
    constructor(agent) {
        this.agent = agent;
    }
    async getOverview(params) {
        const dataDate = params.dataDate ? new Date(params.dataDate) : new Date();
        const start = params.startDate ? new Date(params.startDate) : addDays(dataDate, 30);
        const end = params.endDate
            ? new Date(params.endDate)
            : addDays(start, 15);
        const rangeDays = Math.max(1, daysBetween(start, end) + 1);
        const daysToCheckIn = Math.max(0, daysBetween(dataDate, start));
        const inputs = await this.agent.buildInputs({ targetDate: toIsoDate(dataDate) });
        const rec = await this.agent.recommend({ targetDate: toIsoDate(dataDate) });
        const totalInventory = inputs.inventory_status.packageTotal;
        const soldInventory = inputs.inventory_status.packageSold;
        const remainingInventory = inputs.inventory_status.packageRemaining;
        const marketHeatText = mapMarketHeatText(rec.market_status);
        const marketHeatDelta = clamp(Math.round((rec.confidence - 0.6) * 10), -3, 3);
        const orderTrend = this.buildOrderTrend({
            dataDate,
            ordersCreatedAt: inputs.historical_orders.map((o) => o.createdAt),
            days: 15,
        });
        const otaPriceTrend = this.buildOtaPriceTrend({
            dataDate,
            days: 15,
            hotelSeries: inputs.market_snapshot.otaPriceSeries,
        });
        const inventoryCalendar = this.buildInventoryCalendar({
            startDate: start,
            endDate: end,
            totalRemaining: remainingInventory,
        });
        const aiSuggestions = this.buildAiSuggestions({
            dataDate,
            startDate: start,
            endDate: end,
            baseRemaining: Math.max(1, Math.round(remainingInventory / rangeDays)),
            recommendedPrice: rec.recommended_price,
        });
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
                bookingWindow: '可销售开始（较去年同期提前 3 天）',
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
    buildOrderTrend(params) {
        const end = params.dataDate;
        const start = addDays(end, -(params.days - 1));
        const countsByDate = new Map();
        for (const ts of params.ordersCreatedAt) {
            const d = new Date(ts);
            const key = toIsoDate(d);
            countsByDate.set(key, (countsByDate.get(key) ?? 0) + 1);
        }
        const pickMockInt24 = (seed) => {
            let h = 0;
            for (let i = 0; i < seed.length; i += 1) {
                h = (h * 31 + seed.charCodeAt(i)) >>> 0;
            }
            return 2 + (h % 3);
        };
        const dates = [];
        const thisYear = [];
        const lastYear = [];
        for (let i = 0; i < params.days; i += 1) {
            const d = addDays(start, i);
            const key = toIsoDate(d);
            dates.push(key);
            const actual = countsByDate.get(key);
            const v = actual !== undefined && actual >= 2 ? actual : pickMockInt24(`orderTrend:thisYear:${key}:${i}`);
            const ly = actual !== undefined && actual >= 2
                ? Math.max(0, Math.round(v * (0.7 + ((i % 5) / 20))))
                : pickMockInt24(`orderTrend:lastYear:${key}:${i}`);
            thisYear.push(v);
            lastYear.push(ly);
        }
        return { dates, thisYear, lastYear };
    }
    buildOtaPriceTrend(params) {
        const end = params.dataDate;
        const start = addDays(end, -(params.days - 1));
        const hotelMap = new Map(params.hotelSeries.map((p) => [p.date, p.price]));
        const dates = [];
        const hotel = [];
        const regionAvg = [];
        const lastYear = [];
        const base = avg(params.hotelSeries.slice(-7).map((p) => p.price)) || 650;
        for (let i = 0; i < params.days; i += 1) {
            const d = addDays(start, i);
            const key = toIsoDate(d);
            dates.push(key);
            const h = hotelMap.get(key) ?? round2(base + i * 2.2);
            hotel.push(round2(h));
            regionAvg.push(round2(h * 0.92 + 18));
            lastYear.push(round2(h * 0.86 + 25));
        }
        return { dates, hotel, regionAvg, lastYear };
    }
    buildInventoryCalendar(params) {
        const days = Math.max(1, daysBetween(params.startDate, params.endDate) + 1);
        const base = Math.max(1, Math.floor(params.totalRemaining / days));
        const daily = Array.from({ length: days }, (_, i) => {
            const wave = Math.sin(i / 3) * 1.2;
            return clamp(Math.round(base + wave), 1, Math.max(1, base + 2));
        });
        let sum = daily.reduce((a, b) => a + b, 0);
        let idx = 0;
        while (sum !== params.totalRemaining && idx < days * 20) {
            const i = idx % days;
            if (sum < params.totalRemaining) {
                daily[i] += 1;
                sum += 1;
            }
            else if (sum > params.totalRemaining && daily[i] > 1) {
                daily[i] -= 1;
                sum -= 1;
            }
            idx += 1;
        }
        const dailyRemaining = daily.map((remaining, i) => ({
            date: toIsoDate(addDays(params.startDate, i)),
            remaining,
        }));
        return {
            startDate: toIsoDate(params.startDate),
            endDate: toIsoDate(params.endDate),
            dailyRemaining,
            totalRemaining: params.totalRemaining,
        };
    }
    buildAiSuggestions(params) {
        const days = Math.max(1, daysBetween(params.startDate, params.endDate) + 1);
        const picks = [0, 4, 11].filter((i) => i < days);
        const costPrice = Math.max(1, Math.round(params.recommendedPrice * 1.18));
        const minPrice = Math.max(1, Math.round(costPrice * 0.8));
        const maxPrice = Math.max(1, Math.round(costPrice * 1.2));
        return picks.map((offset, idx) => {
            const d = addDays(params.startDate, offset);
            const weekday = weekdayCn(d);
            const priority = idx === 0 ? '高优先级' : idx === 1 ? '中优先级' : '低优先级';
            const remaining = clamp(params.baseRemaining + (idx - 1), 1, 99);
            const action = idx === 0 ? '即刻出清（工作日）' : idx === 1 ? '持有观望' : '高价销售';
            const suggestedPrice = idx === 0
                ? Math.round(costPrice * 0.85)
                : idx === 1
                    ? Math.round(costPrice * 0.95)
                    : Math.round(costPrice * 1.12);
            const reason = idx === 0
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
};
exports.DashboardService = DashboardService;
exports.DashboardService = DashboardService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [pricing_agent_service_1.PricingAgentService])
], DashboardService);
//# sourceMappingURL=dashboard.service.js.map