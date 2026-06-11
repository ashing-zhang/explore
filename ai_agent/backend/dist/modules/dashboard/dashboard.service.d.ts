import { PricingAgentService } from '../agent/pricing-agent.service';
import type { DashboardOverviewResponse } from './dashboard.types';
export declare class DashboardService {
    private readonly agent;
    constructor(agent: PricingAgentService);
    getOverview(params: {
        dataDate?: string;
        startDate?: string;
        endDate?: string;
    }): Promise<DashboardOverviewResponse>;
    private buildOrderTrend;
    private buildOtaPriceTrend;
    private buildInventoryCalendar;
    private buildAiSuggestions;
}
