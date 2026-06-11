import { HistoricalOrder, MarketSnapshot, PricePoint, RecommendationRequest } from '../types';
export declare class MockDataProvider {
    getMarketSnapshot(req: RecommendationRequest): Promise<MarketSnapshot>;
    getHistoricalOrders(req: RecommendationRequest): Promise<HistoricalOrder[]>;
    getHistoricalPrices(req: RecommendationRequest): Promise<PricePoint[]>;
    getCompetitorPrices(req: RecommendationRequest): Promise<PricePoint[]>;
}
