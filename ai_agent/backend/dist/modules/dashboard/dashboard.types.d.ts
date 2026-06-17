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
        };
    };
    inventoryCalendar: {
        startDate: string;
        endDate: string;
        dailyRemaining: {
            date: string;
            remaining: number;
        }[];
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
export type DashboardOrdersResponse = {
    dataDate: string;
    kpis: {
        orderCount: {
            value: number;
            deltaPct: number;
        };
        gmvCny: {
            value: number;
            deltaPct: number;
        };
        aovCny: {
            value: number;
            deltaPct: number;
        };
        cancelRatePct: {
            value: number;
            deltaPct: number;
        };
        fulfillRatePct: {
            value: number;
            deltaPct: number;
        };
    };
    charts: {
        orderTrend: {
            dates: string[];
            orderCount: number[];
            gmvCny: number[];
        };
        channelShare: {
            name: string;
            value: number;
        }[];
        domesticTop10: {
            name: string;
            value: number;
        }[];
    };
    table: {
        page: number;
        pageSize: number;
        total: number;
        rows: {
            orderId: string;
            orderDate: string;
            checkInDate: string;
            city: string;
            hotel: string;
            roomType: string;
            channel: string;
            nights: number;
            amountCny: number;
            status: '已确认' | '已取消' | '已完成';
        }[];
    };
};
export type DashboardMarketResponse = {
    dataDate: string;
    kpis: {
        supplyRooms: {
            value: number;
            deltaPct: number;
        };
        revparCny: {
            value: number;
            deltaPct: number;
        };
        occPct: {
            value: number;
            deltaPct: number;
        };
        adrCny: {
            value: number;
            deltaPct: number;
        };
        competitorCount: {
            value: number;
            deltaPct: number;
        };
    };
    charts: {
        priceTrend: {
            dates: string[];
            hotelAdrCny: number[];
            marketAdrCny: number[];
        };
        competitorScatter: {
            points: {
                name: string;
                adrCny: number;
                occPct: number;
                rooms: number;
                isSelf?: boolean;
            }[];
        };
        marketIndex: {
            dates: string[];
            demandIndex: number[];
            supplyIndex: number[];
        };
    };
    table: {
        rows: {
            hotel: string;
            adrCny: number;
            occPct: number;
            revparCny: number;
            priceIndexPct: number;
        }[];
    };
};
export type DashboardStrategyResponse = {
    dataDate: string;
    cards: {
        id: string;
        level: '高优先级' | '中优先级' | '低优先级';
        title: string;
        description: string;
        impactText: string;
        ctaLabel: string;
    }[];
    effect: {
        dates: string[];
        expectedGmvPct: number[];
        actualGmvPct: number[];
        kpis: {
            gmvPct: number;
            ordersPct: number;
            cancelRatePct: number;
        };
    };
    history: {
        page: number;
        pageSize: number;
        total: number;
        rows: {
            date: string;
            level: '高优先级' | '中优先级' | '低优先级';
            strategy: string;
            trigger: string;
            scope: string;
            expectedBenefit: string;
            actualBenefit: string;
            status: '已执行' | '评估中' | '未执行';
        }[];
    };
};
export type DashboardExecutionResponse = {
    dataDate: string;
    kpis: {
        pending: number;
        success: number;
        failed: number;
        manual: number;
        successRatePct: number;
    };
    table: {
        page: number;
        pageSize: number;
        total: number;
        rows: {
            id: string;
            createdAt: string;
            action: string;
            scope: string;
            operator: string;
            status: '待执行' | '执行中' | '成功' | '失败' | '人工处理';
            effectText: string;
        }[];
    };
};
