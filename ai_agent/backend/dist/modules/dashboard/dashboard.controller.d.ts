import { DashboardService } from './dashboard.service';
export declare class DashboardController {
    private readonly dashboard;
    constructor(dashboard: DashboardService);
    getOverview(dataDate?: string, startDate?: string, endDate?: string): Promise<import("./dashboard.types").DashboardOverviewResponse>;
}
