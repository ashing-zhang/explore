import { DashboardService } from './dashboard.service';
import { DashboardPagesService } from './dashboard-pages.service';
export declare class DashboardController {
    private readonly dashboard;
    private readonly pages;
    constructor(dashboard: DashboardService, pages: DashboardPagesService);
    getOverview(dataDate?: string, startDate?: string, endDate?: string, hid?: string): Promise<import("./dashboard.types").DashboardOverviewResponse>;
    getOrders(dataDate?: string, startDate?: string, endDate?: string, page?: string, pageSize?: string): Promise<import("./dashboard.types").DashboardOrdersResponse>;
    getMarket(dataDate?: string, startDate?: string, endDate?: string): Promise<import("./dashboard.types").DashboardMarketResponse>;
    getStrategy(dataDate?: string, page?: string, pageSize?: string): Promise<import("./dashboard.types").DashboardStrategyResponse>;
    getExecution(dataDate?: string, page?: string, pageSize?: string): Promise<import("./dashboard.types").DashboardExecutionResponse>;
}
