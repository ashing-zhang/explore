import { Injectable } from '@nestjs/common';
import { DataProviderService } from '../../data-provider/data-provider.service';
import { MarketSnapshot, RecommendationRequest } from '../../data-provider/types';

@Injectable()
export class MarketDataService {
  constructor(private readonly dataProvider: DataProviderService) {}

  getMarketSnapshot(req: RecommendationRequest): Promise<MarketSnapshot> {
    return this.dataProvider.getMarketSnapshot(req);
  }
}

