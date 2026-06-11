import { BookingWindowStatus, HistoricalOrder, InventoryRisk, InventoryStatus, MarketSnapshot, MarketStatus, PricePoint } from '../../data-provider/types';
export declare class AnalyticsService {
    computeMarketStatus(market: MarketSnapshot, historicalPrices: PricePoint[]): MarketStatus;
    computeBookingWindowStatus(orders: HistoricalOrder[], inventory: InventoryStatus): BookingWindowStatus;
    computeInventoryRisk(marketStatus: MarketStatus, inventory: InventoryStatus): InventoryRisk;
    computeConfidence(marketStatus: MarketStatus, bookingWindow: BookingWindowStatus, risk: InventoryRisk): number;
}
