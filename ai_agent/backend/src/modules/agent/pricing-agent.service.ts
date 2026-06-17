import { Injectable, Logger } from '@nestjs/common';
import { performance } from 'node:perf_hooks';
import OpenAI from 'openai';
import { z } from 'zod';
import { HistoricalDataService } from '../tools/historical-data/historical-data.service';
import { MarketDataService } from '../tools/market-data/market-data.service';
import { AnalyticsService } from '../tools/analytics/analytics.service';
import {
  AgentInputs,
  AgentOutputs,
  MarketStatus,
  RecommendationRequest,
} from '../data-provider/types';

function avg(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

const AgentOutputsSchema = z.object({
  market_status: z.enum(['COLD', 'NORMAL', 'HOT', 'EXTREME_HOT']),
  booking_window_status: z.enum(['NOT_STARTED', 'IN_WINDOW', 'PASSED']),
  inventory_risk: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  recommended_price: z.number(),
  recommended_strategy: z.enum([
    'HOLD',
    'PARTIAL_SELL',
    'AGGRESSIVE_SELL',
    'PRICE_UP',
    'PRICE_DOWN',
  ]),
  confidence: z.number().min(0).max(1),
  reasoning: z.array(z.string()),
});

function apiTimingEnabled(): boolean {
  return process.env.LOG_API_TIMING === '1';
}

@Injectable()
export class PricingAgentService {
  private readonly client?: OpenAI;
  private readonly logger = new Logger(PricingAgentService.name);

  constructor(
    private readonly marketData: MarketDataService,
    private readonly historicalData: HistoricalDataService,
    private readonly analytics: AnalyticsService,
  ) {
    const key = process.env.OPENAI_API_KEY;
    if (key) {
      this.client = new OpenAI({ apiKey: key });
    }
  }

  async buildInputs(req: RecommendationRequest): Promise<AgentInputs> {
    const enabled = apiTimingEnabled();
    const tag = enabled
      ? ` hid=${String((req as { hid?: string }).hid ?? '')} start=${String((req as { startDate?: string }).startDate ?? '')} end=${String((req as { endDate?: string }).endDate ?? '')}`
      : '';
    const totalStart = enabled ? performance.now() : 0;

    const marketStart = enabled ? performance.now() : 0;
    const marketP = this.marketData.getMarketSnapshot(req).then((v) => {
      if (enabled) this.logger.log(`buildInputs marketSnapshot ${(performance.now() - marketStart).toFixed(1)}ms${tag}`);
      return v;
    });

    const ordersStart = enabled ? performance.now() : 0;
    const ordersP = this.historicalData.getHistoricalOrders(req).then((v) => {
      if (enabled) this.logger.log(`buildInputs historicalOrders ${(performance.now() - ordersStart).toFixed(1)}ms${tag}`);
      return v;
    });

    const pricesStart = enabled ? performance.now() : 0;
    const pricesP = this.historicalData.getHistoricalPrices(req).then((v) => {
      if (enabled) this.logger.log(`buildInputs historicalPrices ${(performance.now() - pricesStart).toFixed(1)}ms${tag}`);
      return v;
    });

    const [market_snapshot, historical_orders, historical_prices] = await Promise.all([
      marketP,
      ordersP,
      pricesP,
    ]);
    const competitor_prices = market_snapshot.competitorPriceSeries;

    if (enabled) this.logger.log(`buildInputs total ${(performance.now() - totalStart).toFixed(1)}ms${tag}`);

    return {
      market_snapshot,
      historical_orders,
      historical_prices,
      competitor_prices,
      inventory_status: market_snapshot.inventoryStatus,
    };
  }

  async recommend(
    req: RecommendationRequest,
    options?: { allowLlm?: boolean },
  ): Promise<AgentOutputs> {
    const inputs = await this.buildInputs(req);
    return this.recommendFromInputs(inputs, options);
  }

  async recommendFromInputs(
    inputs: AgentInputs,
    options?: { allowLlm?: boolean },
  ): Promise<AgentOutputs> {
    const allowLlm = options?.allowLlm ?? true;
    if (!allowLlm) {
      return this.heuristicRecommend(inputs);
    }

    const llm = await this.tryLlmRecommend(inputs);
    if (llm) return llm;
    return this.heuristicRecommend(inputs);
  }

  private async tryLlmRecommend(inputs: AgentInputs): Promise<AgentOutputs | null> {
    if (!this.client) return null;

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
                recommended_strategy:
                  'HOLD | PARTIAL_SELL | AGGRESSIVE_SELL | PRICE_UP | PRICE_DOWN',
                confidence: 'number between 0 and 1',
                reasoning: 'string[]',
              },
            }),
          },
        ],
      });

      const content = res.choices[0]?.message?.content ?? '';
      const parsed = AgentOutputsSchema.safeParse(JSON.parse(content));
      if (!parsed.success) return null;
      return parsed.data;
    } catch {
      return null;
    }
  }

  private heuristicRecommend(inputs: AgentInputs): AgentOutputs {
    const market_status = this.analytics.computeMarketStatus(
      inputs.market_snapshot,
      inputs.historical_prices,
    );
    const booking_window_status = this.analytics.computeBookingWindowStatus(
      inputs.historical_orders,
      inputs.inventory_status,
    );
    const inventory_risk = this.analytics.computeInventoryRisk(
      market_status,
      inputs.inventory_status,
    );

    const recentCompetitorAvg = avg(
      inputs.competitor_prices.slice(-7).map((p) => p.price),
    );
    const base = recentCompetitorAvg || avg(inputs.market_snapshot.otaPriceSeries.slice(-7).map((p) => p.price)) || 0;

    const soldRatio =
      inputs.inventory_status.packageTotal === 0
        ? 0
        : inputs.inventory_status.packageSold / inputs.inventory_status.packageTotal;
    const remainingRatio =
      inputs.inventory_status.packageTotal === 0
        ? 0
        : inputs.inventory_status.packageRemaining /
        inputs.inventory_status.packageTotal;

    const marketDelta =
      market_status === 'EXTREME_HOT'
        ? 80
        : market_status === 'HOT'
          ? 40
          : market_status === 'COLD'
            ? -40
            : 0;
    const inventoryDelta = remainingRatio <= 0.15 ? 30 : remainingRatio >= 0.5 ? -20 : 0;
    const price = Math.round(Math.max(50, base + marketDelta + inventoryDelta));

    const strategy = this.pickStrategy(market_status, soldRatio, remainingRatio);

    const confidence = this.analytics.computeConfidence(
      market_status,
      booking_window_status,
      inventory_risk,
    );

    const reasoning: string[] = [
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

  private pickStrategy(
    marketStatus: MarketStatus,
    soldRatio: number,
    remainingRatio: number,
  ): AgentOutputs['recommended_strategy'] {
    if (remainingRatio <= 0.12 && (marketStatus === 'HOT' || marketStatus === 'EXTREME_HOT')) {
      return 'PRICE_UP';
    }
    if (marketStatus === 'COLD') {
      return soldRatio < 0.5 ? 'AGGRESSIVE_SELL' : 'PRICE_DOWN';
    }
    if (soldRatio < 0.4) return 'PARTIAL_SELL';
    return 'HOLD';
  }
}
