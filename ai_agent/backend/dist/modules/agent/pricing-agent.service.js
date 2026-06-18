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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var PricingAgentService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PricingAgentService = void 0;
const common_1 = require("@nestjs/common");
const node_perf_hooks_1 = require("node:perf_hooks");
const openai_1 = __importDefault(require("openai"));
const zod_1 = require("zod");
const historical_data_service_1 = require("../tools/historical-data/historical-data.service");
const market_data_service_1 = require("../tools/market-data/market-data.service");
const analytics_service_1 = require("../tools/analytics/analytics.service");
function avg(xs) {
    if (xs.length === 0)
        return 0;
    return xs.reduce((a, b) => a + b, 0) / xs.length;
}
const AgentOutputsSchema = zod_1.z.object({
    market_status: zod_1.z.enum(['COLD', 'NORMAL', 'HOT', 'EXTREME_HOT']),
    booking_window_status: zod_1.z.enum(['NOT_STARTED', 'IN_WINDOW', 'PASSED']),
    inventory_risk: zod_1.z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
    recommended_price: zod_1.z.number(),
    recommended_strategy: zod_1.z.enum([
        'HOLD',
        'PARTIAL_SELL',
        'AGGRESSIVE_SELL',
        'PRICE_UP',
        'PRICE_DOWN',
    ]),
    confidence: zod_1.z.number().min(0).max(1),
    reasoning: zod_1.z.array(zod_1.z.string()),
});
function apiTimingEnabled() {
    return process.env.LOG_API_TIMING === '1';
}
let PricingAgentService = PricingAgentService_1 = class PricingAgentService {
    marketData;
    historicalData;
    analytics;
    client;
    logger = new common_1.Logger(PricingAgentService_1.name);
    constructor(marketData, historicalData, analytics) {
        this.marketData = marketData;
        this.historicalData = historicalData;
        this.analytics = analytics;
        const key = process.env.OPENAI_API_KEY;
        if (key) {
            this.client = new openai_1.default({ apiKey: key });
        }
    }
    async buildInputs(req) {
        const enabled = apiTimingEnabled();
        const tag = enabled
            ? ` hid=${String(req.hid ?? '')} start=${String(req.startDate ?? '')} end=${String(req.endDate ?? '')}`
            : '';
        const totalStart = enabled ? node_perf_hooks_1.performance.now() : 0;
        const marketStart = enabled ? node_perf_hooks_1.performance.now() : 0;
        const marketP = this.marketData.getMarketSnapshot(req).then((v) => {
            if (enabled)
                this.logger.log(`buildInputs marketSnapshot ${(node_perf_hooks_1.performance.now() - marketStart).toFixed(1)}ms${tag}`);
            return v;
        });
        const ordersStart = enabled ? node_perf_hooks_1.performance.now() : 0;
        const ordersP = this.historicalData.getHistoricalOrders(req).then((v) => {
            if (enabled)
                this.logger.log(`buildInputs historicalOrders ${(node_perf_hooks_1.performance.now() - ordersStart).toFixed(1)}ms${tag}`);
            return v;
        });
        const pricesStart = enabled ? node_perf_hooks_1.performance.now() : 0;
        const pricesP = this.historicalData.getHistoricalPrices(req).then((v) => {
            if (enabled)
                this.logger.log(`buildInputs historicalPrices ${(node_perf_hooks_1.performance.now() - pricesStart).toFixed(1)}ms${tag}`);
            return v;
        });
        const [market_snapshot, historical_orders, historical_prices] = await Promise.all([
            marketP,
            ordersP,
            pricesP,
        ]);
        const competitor_prices = market_snapshot.competitorPriceSeries;
        if (enabled)
            this.logger.log(`buildInputs total ${(node_perf_hooks_1.performance.now() - totalStart).toFixed(1)}ms${tag}`);
        return {
            market_snapshot,
            historical_orders,
            historical_prices,
            competitor_prices,
            inventory_status: market_snapshot.inventoryStatus,
        };
    }
    async recommend(req, options) {
        const inputs = await this.buildInputs(req);
        return this.recommendFromInputs(inputs, options);
    }
    async recommendFromInputs(inputs, options) {
        const allowLlm = options?.allowLlm ?? true;
        if (!allowLlm) {
            return this.heuristicRecommend(inputs);
        }
        const llm = await this.tryLlmRecommend(inputs);
        if (llm)
            return llm;
        return this.heuristicRecommend(inputs);
    }
    async tryLlmRecommend(inputs) {
        if (!this.client)
            return null;
        const model = process.env.OPENAI_MODEL ?? 'gpt-4.1-mini';
        const system = [
            'You are a pricing agent for hotel package inventory pricing.',
            'Return only valid JSON with the required keys and allowed enum values.',
            'confidence must be between 0 and 1.',
            'reasoning must be a string array. Keep each item short.',
        ].join('\n');
        try {
            const res = await this.client.chat.completions.create({
                model,
                temperature: 0.2,
                response_format: { type: 'json_object' },
                messages: [
                    { role: 'system', content: system },
                    {
                        role: 'user',
                        content: JSON.stringify({
                            task: 'Generate pricing and inventory strategy recommendation',
                            inputs,
                            required_output: {
                                market_status: 'COLD | NORMAL | HOT | EXTREME_HOT',
                                booking_window_status: 'NOT_STARTED | IN_WINDOW | PASSED',
                                inventory_risk: 'LOW | MEDIUM | HIGH | CRITICAL',
                                recommended_price: 'number',
                                recommended_strategy: 'HOLD | PARTIAL_SELL | AGGRESSIVE_SELL | PRICE_UP | PRICE_DOWN',
                                confidence: 'number between 0 and 1',
                                reasoning: 'string[]',
                            },
                        }),
                    },
                ],
            });
            const content = res.choices[0]?.message?.content ?? '';
            const parsed = AgentOutputsSchema.safeParse(JSON.parse(content));
            if (!parsed.success)
                return null;
            return parsed.data;
        }
        catch {
            return null;
        }
    }
    heuristicRecommend(inputs) {
        const market_status = this.analytics.computeMarketStatus(inputs.market_snapshot, inputs.historical_prices);
        const booking_window_status = this.analytics.computeBookingWindowStatus(inputs.historical_orders, inputs.inventory_status);
        const inventory_risk = this.analytics.computeInventoryRisk(market_status, inputs.inventory_status);
        const recentCompetitorAvg = avg(inputs.competitor_prices.slice(-7).map((p) => p.price));
        const base = recentCompetitorAvg || avg(inputs.market_snapshot.otaPriceSeries.slice(-7).map((p) => p.price)) || 0;
        const remaining = inputs.inventory_status.packageRemaining;
        const marketDelta = market_status === 'EXTREME_HOT'
            ? 80
            : market_status === 'HOT'
                ? 40
                : market_status === 'COLD'
                    ? -40
                    : 0;
        const inventoryDelta = remaining <= 20 ? 30 : remaining >= 120 ? -20 : 0;
        const price = Math.round(Math.max(50, base + marketDelta + inventoryDelta));
        const strategy = this.pickStrategy(market_status, remaining);
        const confidence = this.analytics.computeConfidence(market_status, booking_window_status, inventory_risk);
        const reasoning = [
            `market_status=${market_status} based on recent OTA vs historical prices`,
            `booking_window_status=${booking_window_status} based on recent pace and remaining inventory`,
            `inventory_risk=${inventory_risk} from remaining inventory and market status`,
            `recommended_price=${price} anchored to recent competitor pricing`,
            `recommended_strategy=${strategy}`,
        ];
        return {
            market_status,
            booking_window_status,
            inventory_risk,
            recommended_price: price,
            recommended_strategy: strategy,
            confidence,
            reasoning,
        };
    }
    pickStrategy(marketStatus, remaining) {
        if (remaining <= 20 && (marketStatus === 'HOT' || marketStatus === 'EXTREME_HOT')) {
            return 'PRICE_UP';
        }
        if (marketStatus === 'COLD') {
            return remaining >= 120 ? 'AGGRESSIVE_SELL' : 'PRICE_DOWN';
        }
        if (remaining >= 80)
            return 'PARTIAL_SELL';
        return 'HOLD';
    }
};
exports.PricingAgentService = PricingAgentService;
exports.PricingAgentService = PricingAgentService = PricingAgentService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [market_data_service_1.MarketDataService,
        historical_data_service_1.HistoricalDataService,
        analytics_service_1.AnalyticsService])
], PricingAgentService);
//# sourceMappingURL=pricing-agent.service.js.map