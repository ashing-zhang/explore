import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AgentModule } from './modules/agent/agent.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';

@Module({
  imports: [AgentModule, DashboardModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
