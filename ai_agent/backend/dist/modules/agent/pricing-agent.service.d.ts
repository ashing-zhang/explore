import { HistoricalDataService } from '../tools/historical-data/historical-data.service';
import { MarketDataService } from '../tools/market-data/market-data.service';
import { AnalyticsService } from '../tools/analytics/analytics.service';
import { AgentInputs, AgentOutputs, RecommendationRequest } from '../data-provider/types';
export declare class PricingAgentService {
    private readonly marketData;
    private readonly historicalData;
    private readonly analytics;
    private readonly client?;
    private readonly logger;
    constructor(marketData: MarketDataService, historicalData: HistoricalDataService, analytics: AnalyticsService);
    buildInputs(req: RecommendationRequest): Promise<AgentInputs>;
    recommend(req: RecommendationRequest, options?: {
        allowLlm?: boolean;
    }): Promise<AgentOutputs>;
    recommendFromInputs(inputs: AgentInputs, options?: {
        allowLlm?: boolean;
    }): Promise<AgentOutputs>;
    private tryLlmRecommend;
    private heuristicRecommend;
    private pickStrategy;
}
