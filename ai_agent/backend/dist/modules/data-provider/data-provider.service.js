"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataProviderService = void 0;
const common_1 = require("@nestjs/common");
const mock_data_provider_1 = require("./providers/mock-data-provider");
const postgres_data_provider_1 = require("./providers/postgres-data-provider");
let DataProviderService = class DataProviderService {
    mockDataProvider;
    postgresDataProvider;
    provider;
    constructor(mockDataProvider, postgresDataProvider) {
        this.mockDataProvider = mockDataProvider;
        this.postgresDataProvider = postgresDataProvider;
        const kind = process.env.DATA_PROVIDER?.toLowerCase() ??
            'mock';
        this.provider = kind === 'postgres' ? postgresDataProvider : mockDataProvider;
    }
    getMarketSnapshot(req) {
        return this.provider.getMarketSnapshot(req);
    }
    getHistoricalOrders(req) {
        return this.provider.getHistoricalOrders(req);
    }
    getHistoricalPrices(req) {
        return this.provider.getHistoricalPrices(req);
    }
    getCompetitorPrices(req) {
        return this.provider.getCompetitorPrices(req);
    }
};
exports.DataProviderService = DataProviderService;
exports.DataProviderService = DataProviderService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [mock_data_provider_1.MockDataProvider,
        postgres_data_provider_1.PostgresDataProvider])
], DataProviderService);
//# sourceMappingURL=data-provider.service.js.map