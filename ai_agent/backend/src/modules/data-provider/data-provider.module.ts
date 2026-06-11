import { Module } from '@nestjs/common';
import { DataProviderService } from './data-provider.service';
import { MockDataProvider } from './providers/mock-data-provider';
import { PostgresDataProvider } from './providers/postgres-data-provider';

@Module({
  providers: [DataProviderService, MockDataProvider, PostgresDataProvider],
  exports: [DataProviderService],
})
export class DataProviderModule {}

