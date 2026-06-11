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

