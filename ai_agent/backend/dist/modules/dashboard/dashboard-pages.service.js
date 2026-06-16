"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardPagesService = void 0;
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
function round2(n) {
    return Math.round(n * 100) / 100;
}
function parseIsoDate(iso, fallback) {
    if (!iso)
        return fallback;
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime()))
        return fallback;
    return d;
}
function stableHash(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}
function mulberry32(seed) {
    let t = seed >>> 0;
    return () => {
        t += 0x6d2b79f5;
        let x = t;
        x = Math.imul(x ^ (x >>> 15), x | 1);
        x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
        return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
}
function randInt(r, min, max) {
    return Math.floor(r() * (max - min + 1)) + min;
}
function randFloat(r, min, max) {
    return r() * (max - min) + min;
}
function dateRange(start, end) {
    const days = Math.max(1, daysBetween(start, end) + 1);
    return Array.from({ length: days }, (_, i) => toIsoDate(addDays(start, i)));
}
function paginate(rows, page, pageSize) {
    const safePageSize = clamp(pageSize, 5, 50);
    const total = rows.length;
    const maxPage = Math.max(1, Math.ceil(total / safePageSize));
    const safePage = clamp(page, 1, maxPage);
    const start = (safePage - 1) * safePageSize;
    const end = start + safePageSize;
    return {
        page: safePage,
        pageSize: safePageSize,
        total,
        rows: rows.slice(start, end),
    };
}
let DashboardPagesService = class DashboardPagesService {
    async getOrders(params) {
        const today = new Date();
        const dataDate = parseIsoDate(params.dataDate, today);
        const defaultEnd = addDays(dataDate, 5);
        const start = parseIsoDate(params.startDate, addDays(dataDate, -10));
        const end = parseIsoDate(params.endDate, defaultEnd);
        const s = start <= end ? start : end;
        const e = start <= end ? end : start;
        const seed = stableHash(['orders', toIsoDate(dataDate), toIsoDate(s), toIsoDate(e)].join('|'));
        const r = mulberry32(seed);
        const kpiOrder = randInt(r, 2200, 3200);
        const avgPrice = randFloat(r, 260, 360);
        const kpiGmv = Math.round(kpiOrder * avgPrice * randFloat(r, 1.05, 1.18));
        const kpiAov = round2(kpiGmv / Math.max(1, kpiOrder));
        const cancelRate = round2(randFloat(r, 2.2, 4.2));
        const fulfillRate = round2(100 - cancelRate - randFloat(r, 0.5, 2.2));
        const dates = dateRange(s, e);
        const base = Math.max(1, Math.round(kpiOrder / Math.max(1, dates.length)));
        const orderCount = dates.map((_, i) => clamp(Math.round(base + Math.sin(i / 2.2) * base * 0.25 + randFloat(r, -6, 6)), 0, base * 2));
        const gmvCny = orderCount.map((c, i) => Math.max(0, Math.round(c * (avgPrice + Math.sin(i / 3) * 18 + randFloat(r, -10, 10)))));
        const channelShare = [
            { name: 'OTA', value: 48 },
            { name: '直采', value: 21 },
            { name: '团购', value: 13 },
            { name: '企业', value: 10 },
            { name: '其它', value: 8 },
        ].map((x) => ({ ...x, value: Math.max(1, Math.round(x.value + randFloat(r, -2.5, 2.5))) }));
        const topNames = ['成都', '上海', '杭州', '南京', '广州', '深圳', '北京', '武汉', '西安', '重庆'];
        const domesticTop10 = topNames.map((name, i) => ({
            name,
            value: clamp(Math.round(base * (1.6 - i * 0.08) + randFloat(r, -12, 12)), 30, 9999),
        }));
        const cities = ['成都', '上海', '杭州', '南京', '广州', '深圳'];
        const hotels = ['云栖酒店', '洲际酒店', '城景酒店', '海湾酒店', '中心酒店', '云端酒店'];
        const roomTypes = ['大床房', '双床房', '家庭房', '套房'];
        const channels = ['OTA', '直采', '企业', '团购'];
        const statuses = ['已确认', '已完成', '已取消'];
        const totalRows = 52 + randInt(r, -6, 10);
        const allRows = Array.from({ length: totalRows }, (_, idx) => {
            const orderDate = addDays(s, randInt(r, 0, Math.max(0, dates.length - 1)));
            const checkInDate = addDays(orderDate, randInt(r, 1, 12));
            const city = cities[randInt(r, 0, cities.length - 1)];
            const hotel = `${city}${hotels[randInt(r, 0, hotels.length - 1)]}`;
            const roomType = roomTypes[randInt(r, 0, roomTypes.length - 1)];
            const channel = channels[randInt(r, 0, channels.length - 1)];
            const nights = randInt(r, 1, 4);
            const amountCny = Math.round(nights * randFloat(r, 520, 1150));
            const status = statuses[randInt(r, 0, statuses.length - 1)];
            return {
                orderId: `OD${toIsoDate(orderDate).replaceAll('-', '')}${String(idx + 1).padStart(4, '0')}`,
                orderDate: toIsoDate(orderDate),
                checkInDate: toIsoDate(checkInDate),
                city,
                hotel,
                roomType,
                channel,
                nights,
                amountCny,
                status,
            };
        }).sort((a, b) => (a.orderDate < b.orderDate ? 1 : -1));
        const table = paginate(allRows, params.page ?? 1, params.pageSize ?? 10);
        return {
            dataDate: toIsoDate(dataDate),
            kpis: {
                orderCount: { value: kpiOrder, deltaPct: round2(randFloat(r, -3.5, 5.5)) },
                gmvCny: { value: kpiGmv, deltaPct: round2(randFloat(r, -4.5, 6.5)) },
                aovCny: { value: kpiAov, deltaPct: round2(randFloat(r, -2.2, 3.2)) },
                cancelRatePct: { value: cancelRate, deltaPct: round2(randFloat(r, -1.2, 1.2)) },
                fulfillRatePct: { value: fulfillRate, deltaPct: round2(randFloat(r, -1.2, 1.2)) },
            },
            charts: {
                orderTrend: { dates, orderCount, gmvCny },
                channelShare,
                domesticTop10,
            },
            table,
        };
    }
    async getMarket(params) {
        const today = new Date();
        const dataDate = parseIsoDate(params.dataDate, today);
        const start = parseIsoDate(params.startDate, addDays(dataDate, -10));
        const end = parseIsoDate(params.endDate, addDays(dataDate, 5));
        const s = start <= end ? start : end;
        const e = start <= end ? end : start;
        const seed = stableHash(['market', toIsoDate(dataDate), toIsoDate(s), toIsoDate(e)].join('|'));
        const r = mulberry32(seed);
        const supplyRooms = randInt(r, 560, 720);
        const adr = randInt(r, 590, 740);
        const occ = round2(randFloat(r, 56, 72));
        const revpar = Math.round((adr * occ) / 100);
        const competitorCount = randInt(r, 120, 180);
        const dates = dateRange(s, e);
        const hotelAdrCny = dates.map((_, i) => Math.round(adr * (0.96 + Math.sin(i / 3) * 0.03) + randFloat(r, -8, 8)));
        const marketAdrCny = dates.map((_, i) => Math.round(adr * (0.92 + Math.cos(i / 3.4) * 0.04) + randFloat(r, -10, 10)));
        const points = Array.from({ length: 18 }, (_, i) => {
            const adrCny = Math.round(randFloat(r, adr * 0.78, adr * 1.18));
            const occPct = round2(randFloat(r, 48, 82));
            const rooms = randInt(r, 60, 420);
            const name = i === 0 ? '本店' : `竞品${String(i).padStart(2, '0')}`;
            return { name, adrCny, occPct, rooms, isSelf: i === 0 };
        });
        const demandIndex = dates.map((_, i) => round2(62 + Math.sin(i / 2.8) * 8 + randFloat(r, -2, 2)));
        const supplyIndex = dates.map((_, i) => round2(58 + Math.cos(i / 2.6) * 7 + randFloat(r, -2, 2)));
        const tableRows = points
            .filter((p) => !p.isSelf)
            .slice(0, 6)
            .map((p) => {
            const revparCny = Math.round((p.adrCny * p.occPct) / 100);
            const priceIndexPct = round2((p.adrCny / Math.max(1, adr)) * 100);
            return {
                hotel: p.name,
                adrCny: p.adrCny,
                occPct: p.occPct,
                revparCny,
                priceIndexPct,
            };
        })
            .sort((a, b) => b.adrCny - a.adrCny);
        return {
            dataDate: toIsoDate(dataDate),
            kpis: {
                supplyRooms: { value: supplyRooms, deltaPct: round2(randFloat(r, -4, 6)) },
                revparCny: { value: revpar, deltaPct: round2(randFloat(r, -3.5, 5.5)) },
                occPct: { value: occ, deltaPct: round2(randFloat(r, -2.6, 3.2)) },
                adrCny: { value: adr, deltaPct: round2(randFloat(r, -3.2, 4.2)) },
                competitorCount: { value: competitorCount, deltaPct: round2(randFloat(r, -2.2, 2.8)) },
            },
            charts: {
                priceTrend: { dates, hotelAdrCny, marketAdrCny },
                competitorScatter: { points },
                marketIndex: { dates, demandIndex, supplyIndex },
            },
            table: { rows: tableRows },
        };
    }
    async getStrategy(params) {
        const today = new Date();
        const dataDate = parseIsoDate(params.dataDate, today);
        const seed = stableHash(['strategy', toIsoDate(dataDate)].join('|'));
        const r = mulberry32(seed);
        const cards = [
            {
                id: 'S1',
                level: '高优先级',
                title: '工作日出清建议',
                description: '工作日需求偏弱，建议对低动销日期做分层降价，优先降低滞销风险。',
                impactText: '预计影响：GMV +4% ~ +6%',
                ctaLabel: '查看详情',
            },
            {
                id: 'S2',
                level: '中优先级',
                title: '周末持有观望',
                description: '周末需求回暖，建议观察竞品与区域趋势，再小幅调整价格。',
                impactText: '预计影响：GMV +2% ~ +3%',
                ctaLabel: '查看详情',
            },
            {
                id: 'S3',
                level: '低优先级',
                title: '高价测试策略',
                description: '对热度上升日期尝试高价销售，验证价格弹性，提升收益上限。',
                impactText: '预计影响：GMV +1% ~ +2%',
                ctaLabel: '查看详情',
            },
        ];
        const dates = dateRange(addDays(dataDate, -6), dataDate);
        const expectedGmvPct = dates.map((_, i) => round2(2.0 + i * 0.55 + randFloat(r, -0.15, 0.15)));
        const actualGmvPct = dates.map((_, i) => round2(expectedGmvPct[i] - 0.4 + randFloat(r, -0.25, 0.25)));
        const effect = {
            dates,
            expectedGmvPct,
            actualGmvPct,
            kpis: {
                gmvPct: round2(actualGmvPct.at(-1) ?? 0),
                ordersPct: round2(randFloat(r, 6.0, 12.8)),
                cancelRatePct: round2(randFloat(r, -1.8, 1.2)),
            },
        };
        const historyTotal = 24;
        const levels = ['高优先级', '中优先级', '低优先级'];
        const statuses = ['已执行', '评估中', '未执行'];
        const strategies = ['价格下调', '价格上调', '库存出清', '渠道倾斜', '促销拉新'];
        const triggers = ['竞品降价', '库存高压', '热度升温', '窗口开启', '取消率上升'];
        const scopes = ['工作日', '周末', '全量', '特定房型', '特定渠道'];
        const historyRows = Array.from({ length: historyTotal }, (_, idx) => {
            const d = addDays(dataDate, -idx - 1);
            const level = levels[randInt(r, 0, levels.length - 1)];
            const status = statuses[randInt(r, 0, statuses.length - 1)];
            const strategy = strategies[randInt(r, 0, strategies.length - 1)];
            const trigger = triggers[randInt(r, 0, triggers.length - 1)];
            const scope = scopes[randInt(r, 0, scopes.length - 1)];
            const expectedBenefit = `${round2(randFloat(r, 2.0, 6.5))}%`;
            const actualBenefit = status === '已执行' ? `${round2(randFloat(r, 1.2, 6.0))}%` : '—';
            return {
                date: toIsoDate(d),
                level,
                strategy,
                trigger,
                scope,
                expectedBenefit,
                actualBenefit,
                status,
            };
        });
        const history = paginate(historyRows, params.page ?? 1, params.pageSize ?? 10);
        return {
            dataDate: toIsoDate(dataDate),
            cards,
            effect,
            history,
        };
    }
    async getExecution(params) {
        const today = new Date();
        const dataDate = parseIsoDate(params.dataDate, today);
        const seed = stableHash(['execution', toIsoDate(dataDate)].join('|'));
        const r = mulberry32(seed);
        const pending = randInt(r, 16, 28);
        const success = randInt(r, 10, 22);
        const failed = randInt(r, 0, 4);
        const manual = randInt(r, 0, 3);
        const total = pending + success + failed + manual;
        const successRatePct = round2((success / Math.max(1, total)) * 100);
        const statuses = ['待执行', '执行中', '成功', '失败', '人工处理'];
        const actions = ['价格下调', '价格上调', '库存出清', '限售', '渠道倾斜'];
        const scopes = ['工作日', '周末', '全量', '特定房型', '特定渠道'];
        const operators = ['系统', '运营A', '运营B'];
        const tableTotal = 31;
        const allRows = Array.from({ length: tableTotal }, (_, idx) => {
            const createdAt = addDays(dataDate, -randInt(r, 0, 12));
            const status = statuses[randInt(r, 0, statuses.length - 1)];
            return {
                id: `EX${toIsoDate(createdAt).replaceAll('-', '')}${String(idx + 1).padStart(3, '0')}`,
                createdAt: `${toIsoDate(createdAt)} ${String(randInt(r, 9, 21)).padStart(2, '0')}:${String(randInt(r, 0, 59)).padStart(2, '0')}`,
                action: actions[randInt(r, 0, actions.length - 1)],
                scope: scopes[randInt(r, 0, scopes.length - 1)],
                operator: operators[randInt(r, 0, operators.length - 1)],
                status,
                effectText: status === '成功'
                    ? `GMV ${round2(randFloat(r, 1.0, 6.8))}%`
                    : status === '失败'
                        ? '已回滚'
                        : '—',
            };
        }).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
        const table = paginate(allRows, params.page ?? 1, params.pageSize ?? 10);
        return {
            dataDate: toIsoDate(dataDate),
            kpis: { pending, success, failed, manual, successRatePct },
            table,
        };
    }
};
exports.DashboardPagesService = DashboardPagesService;
exports.DashboardPagesService = DashboardPagesService = __decorate([
    (0, common_1.Injectable)()
], DashboardPagesService);
//# sourceMappingURL=dashboard-pages.service.js.map