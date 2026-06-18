export type BookingWindowStatus = 'NOT_STARTED' | 'IN_WINDOW' | 'PASSED';
export type MarketStatus = 'COLD' | 'NORMAL' | 'HOT' | 'EXTREME_HOT';
export type InventoryRisk = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type InventoryStatus = {
    packageRemaining: Array<{
        date: string;
        remaining: number;
    }>;
};
export type PricePoint = {
    date: string;
    price: number;
};
export type MarketSnapshot = {
    snapshotDate: string;
    otaPriceSeries: PricePoint[];
    competitorPriceSeries: PricePoint[];
    inventoryStatus: InventoryStatus;
};
export type HistoricalOrder = {
    orderId: string;
    createdAt: string;
    checkInDate: string;
    nights: number;
};
export type AgentInputs = {
    market_snapshot: MarketSnapshot;
    historical_orders: HistoricalOrder[];
    historical_prices: PricePoint[];
    competitor_prices: PricePoint[];
    inventory_status: InventoryStatus;
};
export type AgentOutputs = {
    market_status: MarketStatus;
    booking_window_status: BookingWindowStatus;
    inventory_risk: InventoryRisk;
    recommended_price: number;
    recommended_strategy: 'HOLD' | 'PARTIAL_SELL' | 'AGGRESSIVE_SELL' | 'PRICE_UP' | 'PRICE_DOWN';
    confidence: number;
    reasoning: string[];
};
export type RecommendationRequest = {
    targetDate?: string;
    startDate?: string;
    endDate?: string;
    hid?: string;
};
