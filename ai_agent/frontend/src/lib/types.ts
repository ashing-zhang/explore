export type BookingWindowStatus = 'NOT_STARTED' | 'IN_WINDOW' | 'PASSED';
export type MarketStatus = 'COLD' | 'NORMAL' | 'HOT' | 'EXTREME_HOT';
export type InventoryRisk = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type InventoryStatus = {
  packageTotal: number;
  packageSold: number;
  packageRemaining: number;
  hotelTotal: number;
  hotelSold: number;
  hotelRemaining: number;
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

export type AgentOutputs = {
  market_status: MarketStatus;
  booking_window_status: BookingWindowStatus;
  inventory_risk: InventoryRisk;
  recommended_price: number;
  recommended_strategy:
  | 'HOLD'
  | 'PARTIAL_SELL'
  | 'AGGRESSIVE_SELL'
  | 'PRICE_UP'
  | 'PRICE_DOWN';
  confidence: number;
  reasoning: string[];
};

export type DashboardOverviewResponse = {
  dataDate: string;
  packageDateRange: {
    startDate: string;
    endDate: string;
    days: number;
    daysToCheckIn: number;
  };
  summary: {
    totalInventory: number;
    soldInventory: number;
    remainingInventory: number;
    marketHeatText: string;
    marketHeatDeltaText: string;
  };
  charts: {
    orderTrend: {
      dates: string[];
      thisYear: number[];
      lastYear: number[];
    };
    otaPriceTrend: {
      dates: string[];
      hotel: number[];
      regionAvg: number[];
      lastYear: number[];
    };
  };
  inventoryCalendar: {
    startDate: string;
    endDate: string;
    dailyRemaining: { date: string; remaining: number }[];
    totalRemaining: number;
  };
  aiSuggestions: {
    date: string;
    weekday: string;
    priority: '高优先级' | '中优先级' | '低优先级';
    remainingInventory: number;
    action: string;
    suggestedPrice: number;
    costPrice: number;
    minPrice: number;
    maxPrice: number;
    reason: string;
  }[];
  keyIndicators: {
    bookingWindow: string;
    marketStatus: string;
    regionInventory: string;
    priceAcceptance: string;
  };
  actions: string[];
  riskAlerts: string[];
};
