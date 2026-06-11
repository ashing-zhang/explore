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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PricingAgentController = void 0;
const common_1 = require("@nestjs/common");
const pricing_agent_service_1 = require("./pricing-agent.service");
let PricingAgentController = class PricingAgentController {
    agent;
    constructor(agent) {
        this.agent = agent;
    }
    async marketSnapshot(targetDate) {
        const inputs = await this.agent.buildInputs({ targetDate });
        return inputs.market_snapshot;
    }
    async recommendationGet(targetDate) {
        return this.agent.recommend({ targetDate });
    }
    async recommendationPost(body) {
        return this.agent.recommend(body ?? {});
    }
};
exports.PricingAgentController = PricingAgentController;
__decorate([
    (0, common_1.Get)('market-snapshot'),
    __param(0, (0, common_1.Query)('targetDate')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PricingAgentController.prototype, "marketSnapshot", null);
__decorate([
    (0, common_1.Get)('recommendation'),
    __param(0, (0, common_1.Query)('targetDate')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PricingAgentController.prototype, "recommendationGet", null);
__decorate([
    (0, common_1.Post)('recommendation'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PricingAgentController.prototype, "recommendationPost", null);
exports.PricingAgentController = PricingAgentController = __decorate([
    (0, common_1.Controller)('agent'),
    __metadata("design:paramtypes", [pricing_agent_service_1.PricingAgentService])
], PricingAgentController);
//# sourceMappingURL=pricing-agent.controller.js.map