import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  HistoricalOrder,
  MarketSnapshot,
  PricePoint,
  RecommendationRequest,
} from './types';
import { MockDataProvider } from './providers/mock-data-provider';
import { OdpsDataProvider } from './providers/odps-data-provider';

export type DataProviderKind = 'mock' | 'odps';

export interface DataProvider {
  getMarketSnapshot(req: RecommendationRequest): Promise<MarketSnapshot>;
  getHistoricalOrders(req: RecommendationRequest): Promise<HistoricalOrder[]>;
  getHistoricalPrices(req: RecommendationRequest): Promise<PricePoint[]>;
  getCompetitorPrices(req: RecommendationRequest): Promise<PricePoint[]>;
}

@Injectable()
export class DataProviderService implements DataProvider {
  private readonly provider: DataProvider;

  constructor(
    private readonly config: ConfigService,
    private readonly mockDataProvider: MockDataProvider,
    private readonly odpsDataProvider: OdpsDataProvider,
  ) {
    const raw = this.config.get<string>('DATA_PROVIDER');
    const kind = (raw?.toLowerCase() as DataProviderKind) ?? 'mock';
    this.provider = kind === 'odps' ? odpsDataProvider : mockDataProvider;
  }

  getMarketSnapshot(req: RecommendationRequest): Promise<MarketSnapshot> {
    return this.provider.getMarketSnapshot(req);
  }

  getHistoricalOrders(req: RecommendationRequest): Promise<HistoricalOrder[]> {
    return this.provider.getHistoricalOrders(req);
  }

  getHistoricalPrices(req: RecommendationRequest): Promise<PricePoint[]> {
    return this.provider.getHistoricalPrices(req);
  }

  getCompetitorPrices(req: RecommendationRequest): Promise<PricePoint[]> {
    return this.provider.getCompetitorPrices(req);
  }
}
