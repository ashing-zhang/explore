import { DataProviderService } from '../../data-provider/data-provider.service';
import { MarketSnapshot, RecommendationRequest } from '../../data-provider/types';
export declare class MarketDataService {
    private readonly dataProvider;
    constructor(dataProvider: DataProviderService);
    getMarketSnapshot(req: RecommendationRequest): Promise<MarketSnapshot>;
}
