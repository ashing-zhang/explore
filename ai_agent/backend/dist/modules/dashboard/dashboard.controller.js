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
exports.DashboardController = void 0;
const common_1 = require("@nestjs/common");
const dashboard_service_1 = require("./dashboard.service");
const dashboard_pages_service_1 = require("./dashboard-pages.service");
let DashboardController = class DashboardController {
    dashboard;
    pages;
    constructor(dashboard, pages) {
        this.dashboard = dashboard;
        this.pages = pages;
    }
    getOverview(dataDate, startDate, endDate, hid) {
        return this.dashboard.getOverview({ dataDate, startDate, endDate, hid });
    }
    getOrders(dataDate, startDate, endDate, page, pageSize) {
        const p = page ? Number(page) : undefined;
        const ps = pageSize ? Number(pageSize) : undefined;
        return this.pages.getOrders({
            dataDate,
            startDate,
            endDate,
            page: Number.isFinite(p) ? p : undefined,
            pageSize: Number.isFinite(ps) ? ps : undefined,
        });
    }
    getMarket(dataDate, startDate, endDate) {
        return this.pages.getMarket({ dataDate, startDate, endDate });
    }
    getStrategy(dataDate, page, pageSize) {
        const p = page ? Number(page) : undefined;
        const ps = pageSize ? Number(pageSize) : undefined;
        return this.pages.getStrategy({
            dataDate,
            page: Number.isFinite(p) ? p : undefined,
            pageSize: Number.isFinite(ps) ? ps : undefined,
        });
    }
    getExecution(dataDate, page, pageSize) {
        const p = page ? Number(page) : undefined;
        const ps = pageSize ? Number(pageSize) : undefined;
        return this.pages.getExecution({
            dataDate,
            page: Number.isFinite(p) ? p : undefined,
            pageSize: Number.isFinite(ps) ? ps : undefined,
        });
    }
};
exports.DashboardController = DashboardController;
__decorate([
    (0, common_1.Get)('overview'),
    __param(0, (0, common_1.Query)('dataDate')),
    __param(1, (0, common_1.Query)('startDate')),
    __param(2, (0, common_1.Query)('endDate')),
    __param(3, (0, common_1.Query)('hid')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", void 0)
], DashboardController.prototype, "getOverview", null);
__decorate([
    (0, common_1.Get)('orders'),
    __param(0, (0, common_1.Query)('dataDate')),
    __param(1, (0, common_1.Query)('startDate')),
    __param(2, (0, common_1.Query)('endDate')),
    __param(3, (0, common_1.Query)('page')),
    __param(4, (0, common_1.Query)('pageSize')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String]),
    __metadata("design:returntype", void 0)
], DashboardController.prototype, "getOrders", null);
__decorate([
    (0, common_1.Get)('market'),
    __param(0, (0, common_1.Query)('dataDate')),
    __param(1, (0, common_1.Query)('startDate')),
    __param(2, (0, common_1.Query)('endDate')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], DashboardController.prototype, "getMarket", null);
__decorate([
    (0, common_1.Get)('strategy'),
    __param(0, (0, common_1.Query)('dataDate')),
    __param(1, (0, common_1.Query)('page')),
    __param(2, (0, common_1.Query)('pageSize')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], DashboardController.prototype, "getStrategy", null);
__decorate([
    (0, common_1.Get)('execution'),
    __param(0, (0, common_1.Query)('dataDate')),
    __param(1, (0, common_1.Query)('page')),
    __param(2, (0, common_1.Query)('pageSize')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], DashboardController.prototype, "getExecution", null);
exports.DashboardController = DashboardController = __decorate([
    (0, common_1.Controller)('dashboard'),
    __metadata("design:paramtypes", [dashboard_service_1.DashboardService,
        dashboard_pages_service_1.DashboardPagesService])
], DashboardController);
//# sourceMappingURL=dashboard.controller.js.map