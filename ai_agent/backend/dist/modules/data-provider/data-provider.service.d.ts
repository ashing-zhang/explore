import { ConfigService } from '@nestjs/config';
import { HistoricalOrder, MarketSnapshot, PricePoint, RecommendationRequest } from './types';
import { MockDataProvider } from './providers/mock-data-provider';
import { OdpsDataProvider } from './providers/odps-data-provider';
export type DataProviderKind = 'mock' | 'odps';
export interface DataProvider {
    getMarketSnapshot(req: RecommendationRequest): Promise<MarketSnapshot>;
    getHistoricalOrders(req: RecommendationRequest): Promise<HistoricalOrder[]>;
    getHistoricalPrices(req: RecommendationRequest): Promise<PricePoint[]>;
    getCompetitorPrices(req: RecommendationRequest): Promise<PricePoint[]>;
}
export declare class DataProviderService implements DataProvider {
    private readonly config;
    private readonly mockDataProvider;
    private readonly odpsDataProvider;
    private readonly provider;
    constructor(config: ConfigService, mockDataProvider: MockDataProvider, odpsDataProvider: OdpsDataProvider);
    getMarketSnapshot(req: RecommendationRequest): Promise<MarketSnapshot>;
    getHistoricalOrders(req: RecommendationRequest): Promise<HistoricalOrder[]>;
    getHistoricalPrices(req: RecommendationRequest): Promise<PricePoint[]>;
    getCompetitorPrices(req: RecommendationRequest): Promise<PricePoint[]>;
}
