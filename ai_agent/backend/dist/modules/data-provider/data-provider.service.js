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
const config_1 = require("@nestjs/config");
const mock_data_provider_1 = require("./providers/mock-data-provider");
const odps_data_provider_1 = require("./providers/odps-data-provider");
let DataProviderService = class DataProviderService {
    config;
    mockDataProvider;
    odpsDataProvider;
    provider;
    constructor(config, mockDataProvider, odpsDataProvider) {
        this.config = config;
        this.mockDataProvider = mockDataProvider;
        this.odpsDataProvider = odpsDataProvider;
        const raw = this.config.get('DATA_PROVIDER');
        const kind = raw?.toLowerCase() ?? 'mock';
        this.provider = kind === 'odps' ? odpsDataProvider : mockDataProvider;
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
    __metadata("design:paramtypes", [config_1.ConfigService,
        mock_data_provider_1.MockDataProvider,
        odps_data_provider_1.OdpsDataProvider])
], DataProviderService);
//# sourceMappingURL=data-provider.service.js.map