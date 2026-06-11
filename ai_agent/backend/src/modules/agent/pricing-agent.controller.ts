import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { PricingAgentService } from './pricing-agent.service';
import type { MarketSnapshot, RecommendationRequest } from '../data-provider/types';

@Controller('agent')
export class PricingAgentController {
  constructor(private readonly agent: PricingAgentService) { }

  @Get('market-snapshot')
  async marketSnapshot(
    @Query('targetDate') targetDate?: string,
  ): Promise<MarketSnapshot> {
    const inputs = await this.agent.buildInputs({ targetDate });
    return inputs.market_snapshot;
  }

  @Get('recommendation')
  async recommendationGet(
    @Query('targetDate') targetDate?: string,
  ) {
    return this.agent.recommend({ targetDate });
  }

  @Post('recommendation')
  async recommendationPost(@Body() body: RecommendationRequest) {
    return this.agent.recommend(body ?? {});
  }
}
