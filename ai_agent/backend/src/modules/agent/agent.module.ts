import { Module } from '@nestjs/common';
import { DataProviderModule } from '../data-provider/data-provider.module';
import { AnalyticsService } from '../tools/analytics/analytics.service';
import { HistoricalDataService } from '../tools/historical-data/historical-data.service';
import { MarketDataService } from '../tools/market-data/market-data.service';
import { PricingAgentController } from './pricing-agent.controller';
import { PricingAgentService } from './pricing-agent.service';

@Module({
  imports: [DataProviderModule],
  controllers: [PricingAgentController],
  providers: [
    MarketDataService,
    HistoricalDataService,
    AnalyticsService,
    PricingAgentService,
  ],
  exports: [PricingAgentService],
})
export class AgentModule { }
