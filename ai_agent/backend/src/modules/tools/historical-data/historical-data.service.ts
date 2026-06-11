import { Injectable } from '@nestjs/common';
import { DataProviderService } from '../../data-provider/data-provider.service';
import {
  HistoricalOrder,
  PricePoint,
  RecommendationRequest,
} from '../../data-provider/types';

@Injectable()
export class HistoricalDataService {
  constructor(private readonly dataProvider: DataProviderService) {}

  getHistoricalOrders(req: RecommendationRequest): Promise<HistoricalOrder[]> {
    return this.dataProvider.getHistoricalOrders(req);
  }

  getHistoricalPrices(req: RecommendationRequest): Promise<PricePoint[]> {
    return this.dataProvider.getHistoricalPrices(req);
  }
}

