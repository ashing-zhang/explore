import type { DashboardExecutionResponse, DashboardMarketResponse, DashboardOrdersResponse, DashboardStrategyResponse } from './dashboard.types';
export declare class DashboardPagesService {
    getOrders(params: {
        dataDate?: string;
        startDate?: string;
        endDate?: string;
        page?: number;
        pageSize?: number;
    }): Promise<DashboardOrdersResponse>;
    getMarket(params: {
        dataDate?: string;
        startDate?: string;
        endDate?: string;
    }): Promise<DashboardMarketResponse>;
    getStrategy(params: {
        dataDate?: string;
        page?: number;
        pageSize?: number;
    }): Promise<DashboardStrategyResponse>;
    getExecution(params: {
        dataDate?: string;
        page?: number;
        pageSize?: number;
    }): Promise<DashboardExecutionResponse>;
}
