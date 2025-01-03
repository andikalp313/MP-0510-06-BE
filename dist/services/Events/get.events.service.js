"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEventsService = void 0;
const prisma_1 = require("../../lib/prisma");
const getEventsService = (query) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { page, sortBy, sortOrder, take, search, category, location } = query;
        const whereClause = {
            deletedAt: null,
        };
        if (search) {
            whereClause.OR = [
                { title: { contains: search, mode: "insensitive" } },
                { eventCategory: { contains: search, mode: "insensitive" } },
                { location: { contains: search, mode: "insensitive" } },
            ];
        }
        if (category) {
            whereClause.eventCategory = category;
        }
        if (location) {
            whereClause.location = { contains: location, mode: "insensitive" };
        }
        const events = yield prisma_1.prisma.event.findMany({
            where: whereClause,
            skip: (page - 1) * take, //offset
            take: take, //limit
            orderBy: { [sortBy]: sortOrder }, // sorting
        });
        const count = yield prisma_1.prisma.event.count({ where: whereClause });
        return {
            data: events,
            meta: { page, take, total: count },
        };
    }
    catch (error) {
        throw error;
    }
});
exports.getEventsService = getEventsService;
