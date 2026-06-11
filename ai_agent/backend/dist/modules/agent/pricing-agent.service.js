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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PricingAgentService = void 0;
const common_1 = require("@nestjs/common");
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
let PricingAgentService = class PricingAgentService {
    marketData;
    historicalData;
    analytics;
    client;
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
        const market_snapshot = await this.marketData.getMarketSnapshot(req);
        const [historical_orders, historical_prices, competitor_prices] = await Promise.all([
            this.historicalData.getHistoricalOrders(req),
            this.historicalData.getHistoricalPrices(req),
            Promise.resolve(market_snapshot.competitorPriceSeries),
        ]);
        return {
            market_snapshot,
            historical_orders,
            historical_prices,
            competitor_prices,
            inventory_status: market_snapshot.inventoryStatus,
        };
    }
    async recommend(req) {
        const inputs = await this.buildInputs(req);
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
        const soldRatio = inputs.inventory_status.packageTotal === 0
            ? 0
            : inputs.inventory_status.packageSold / inputs.inventory_status.packageTotal;
        const remainingRatio = inputs.inventory_status.packageTotal === 0
            ? 0
            : inputs.inventory_status.packageRemaining /
                inputs.inventory_status.packageTotal;
        const marketDelta = market_status === 'EXTREME_HOT'
            ? 80
            : market_status === 'HOT'
                ? 40
                : market_status === 'COLD'
                    ? -40
                    : 0;
        const inventoryDelta = remainingRatio <= 0.15 ? 30 : remainingRatio >= 0.5 ? -20 : 0;
        const price = Math.round(Math.max(50, base + marketDelta + inventoryDelta));
        const strategy = this.pickStrategy(market_status, soldRatio, remainingRatio);
        const confidence = this.analytics.computeConfidence(market_status, booking_window_status, inventory_risk);
        const reasoning = [
            `market_status=${market_status} based on recent OTA vs historical prices`,
            `booking_window_status=${booking_window_status} based on recent pace and remaining inventory`,
            `inventory_risk=${inventory_risk} from remaining ratio and market status`,
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
    pickStrategy(marketStatus, soldRatio, remainingRatio) {
        if (remainingRatio <= 0.12 && (marketStatus === 'HOT' || marketStatus === 'EXTREME_HOT')) {
            return 'PRICE_UP';
        }
        if (marketStatus === 'COLD') {
            return soldRatio < 0.5 ? 'AGGRESSIVE_SELL' : 'PRICE_DOWN';
        }
        if (soldRatio < 0.4)
            return 'PARTIAL_SELL';
        return 'HOLD';
    }
};
exports.PricingAgentService = PricingAgentService;
exports.PricingAgentService = PricingAgentService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [market_data_service_1.MarketDataService,
        historical_data_service_1.HistoricalDataService,
        analytics_service_1.AnalyticsService])
], PricingAgentService);
//# sourceMappingURL=pricing-agent.service.js.map