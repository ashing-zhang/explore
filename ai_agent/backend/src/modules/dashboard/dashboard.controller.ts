import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) { }

  @Get('overview')  // 监听 GET /dashboard/overview
  getOverview(
    @Query('dataDate') dataDate?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.dashboard.getOverview({ dataDate, startDate, endDate });
  }
}

