import {
  CallHandler,
  Controller,
  ExecutionContext,
  Get,
  Injectable,
  Logger,
  NestInterceptor,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { performance } from 'node:perf_hooks';
import { finalize } from 'rxjs/operators';
import { DashboardService } from './dashboard.service';
import { DashboardPagesService } from './dashboard-pages.service';

function apiTimingEnabled(): boolean {
  return process.env.LOG_API_TIMING === '1';
}

@Injectable()
class ApiTimingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('ApiTiming');

  intercept(context: ExecutionContext, next: CallHandler) {
    if (!apiTimingEnabled()) return next.handle();
    const req = context.switchToHttp().getRequest<{
      method?: string;
      originalUrl?: string;
      url?: string;
      query?: unknown;
    }>();
    const start = performance.now();
    const method = req?.method ?? 'GET';
    const path = req?.originalUrl ?? req?.url ?? '';
    const query =
      req?.query && typeof req.query === 'object' && Object.keys(req.query as object).length > 0
        ? ` query=${JSON.stringify(req.query)}`
        : '';

    return next.handle().pipe(
      finalize(() => {
        const ms = performance.now() - start;
        this.logger.log(`${method} ${path} ${ms.toFixed(1)}ms${query}`);
      }),
    );
  }
}

@Controller('dashboard')
@UseInterceptors(ApiTimingInterceptor)
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
