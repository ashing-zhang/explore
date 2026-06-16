import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardPagesService } from './dashboard-pages.service';

@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly dashboard: DashboardService,
    private readonly pages: DashboardPagesService,
  ) { }

  @Get('overview')  // 监听 GET /dashboard/overview
  getOverview(
    @Query('dataDate') dataDate?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('hid') hid?: string,
  ) {
    return this.dashboard.getOverview({ dataDate, startDate, endDate, hid });
  }

  @Get('orders')
  getOrders(
    @Query('dataDate') dataDate?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const p = page ? Number(page) : undefined;
    const ps = pageSize ? Number(pageSize) : undefined;
    return this.pages.getOrders({
      dataDate,
      startDate,
      endDate,
      page: Number.isFinite(p) ? (p as number) : undefined,
      pageSize: Number.isFinite(ps) ? (ps as number) : undefined,
    });
  }

  @Get('market')
  getMarket(
    @Query('dataDate') dataDate?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.pages.getMarket({ dataDate, startDate, endDate });
  }

  @Get('strategy')
  getStrategy(
    @Query('dataDate') dataDate?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const p = page ? Number(page) : undefined;
    const ps = pageSize ? Number(pageSize) : undefined;
    return this.pages.getStrategy({
      dataDate,
      page: Number.isFinite(p) ? (p as number) : undefined,
      pageSize: Number.isFinite(ps) ? (ps as number) : undefined,
    });
  }

  @Get('execution')
  getExecution(
    @Query('dataDate') dataDate?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const p = page ? Number(page) : undefined;
    const ps = pageSize ? Number(pageSize) : undefined;
    return this.pages.getExecution({
      dataDate,
      page: Number.isFinite(p) ? (p as number) : undefined,
      pageSize: Number.isFinite(ps) ? (ps as number) : undefined,
    });
  }
}
