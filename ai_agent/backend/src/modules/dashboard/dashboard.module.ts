import { Module } from '@nestjs/common';
import { AgentModule } from '../agent/agent.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [AgentModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}

