import { HistoricalOrder, MarketSnapshot, PricePoint, RecommendationRequest } from './types';
import { MockDataProvider } from './providers/mock-data-provider';
import { PostgresDataProvider } from './providers/postgres-data-provider';
export type DataProviderKind = 'mock' | 'postgres';
export interface DataProvider {
    getMarketSnapshot(req: RecommendationRequest): Promise<MarketSnapshot>;
    getHistoricalOrders(req: RecommendationRequest): Promise<HistoricalOrder[]>;
    getHistoricalPrices(req: RecommendationRequest): Promise<PricePoint[]>;
    getCompetitorPrices(req: RecommendationRequest): Promise<PricePoint[]>;
}
export declare class DataProviderService implements DataProvider {
    private readonly mockDataProvider;
    private readonly postgresDataProvider;
    private readonly provider;
    constructor(mockDataProvider: MockDataProvider, postgresDataProvider: PostgresDataProvider);
    getMarketSnapshot(req: RecommendationRequest): Promise<MarketSnapshot>;
    getHistoricalOrders(req: RecommendationRequest): Promise<HistoricalOrder[]>;
    getHistoricalPrices(req: RecommendationRequest): Promise<PricePoint[]>;
    getCompetitorPrices(req: RecommendationRequest): Promise<PricePoint[]>;
}
