import { DataProviderService } from '../../data-provider/data-provider.service';
import { HistoricalOrder, PricePoint, RecommendationRequest } from '../../data-provider/types';
export declare class HistoricalDataService {
    private readonly dataProvider;
    constructor(dataProvider: DataProviderService);
    getHistoricalOrders(req: RecommendationRequest): Promise<HistoricalOrder[]>;
    getHistoricalPrices(req: RecommendationRequest): Promise<PricePoint[]>;
}
