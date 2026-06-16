import { Module } from '@nestjs/common';
import { DataProviderService } from './data-provider.service';
import { MockDataProvider } from './providers/mock-data-provider';
import { OdpsDataProvider } from './providers/odps-data-provider';

@Module({
  providers: [DataProviderService, MockDataProvider, OdpsDataProvider],
  exports: [DataProviderService],
})
export class DataProviderModule { }
