"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = require("../lib/multer");
const event_validator_1 = require("../validators/event.validator");
const event_controller_1 = require("../controller/event.controller");
const fileFilter_1 = require("../lib/fileFilter");
const router = (0, express_1.Router)();
router.get("/", event_controller_1.getEventsController);
router.get("/:id", event_controller_1.getEventController);
router.post("/", 
// verifyToken,
(0, multer_1.uploader)().fields([{ name: "thumbnail", maxCount: 1 }]), fileFilter_1.fileFilter, event_validator_1.validateCreateEvent, event_controller_1.createEventController);
exports.default = router;
