import { PricingAgentService } from './pricing-agent.service';
import type { MarketSnapshot, RecommendationRequest } from '../data-provider/types';
export declare class PricingAgentController {
    private readonly agent;
    constructor(agent: PricingAgentService);
    marketSnapshot(targetDate?: string): Promise<MarketSnapshot>;
    recommendationGet(targetDate?: string): Promise<import("../data-provider/types").AgentOutputs>;
    recommendationPost(body: RecommendationRequest): Promise<import("../data-provider/types").AgentOutputs>;
}
