"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentModule = void 0;
const common_1 = require("@nestjs/common");
const data_provider_module_1 = require("../data-provider/data-provider.module");
const analytics_service_1 = require("../tools/analytics/analytics.service");
const historical_data_service_1 = require("../tools/historical-data/historical-data.service");
const market_data_service_1 = require("../tools/market-data/market-data.service");
const pricing_agent_controller_1 = require("./pricing-agent.controller");
const pricing_agent_service_1 = require("./pricing-agent.service");
let AgentModule = class AgentModule {
};
exports.AgentModule = AgentModule;
exports.AgentModule = AgentModule = __decorate([
    (0, common_1.Module)({
        imports: [data_provider_module_1.DataProviderModule],
        controllers: [pricing_agent_controller_1.PricingAgentController],
        providers: [
            market_data_service_1.MarketDataService,
            historical_data_service_1.HistoricalDataService,
            analytics_service_1.AnalyticsService,
            pricing_agent_service_1.PricingAgentService,
        ],
        exports: [pricing_agent_service_1.PricingAgentService],
    })
], AgentModule);
//# sourceMappingURL=agent.module.js.map