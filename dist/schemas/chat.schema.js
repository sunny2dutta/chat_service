"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatRequestSchema = void 0;
const zod_1 = require("zod");
exports.ChatRequestSchema = zod_1.z.object({
    messages: zod_1.z.array(zod_1.z.object({
        role: zod_1.z.enum(['user', 'assistant', 'system']),
        content: zod_1.z.string().min(1, "Message content cannot be empty")
    })).min(1, "Messages array cannot be empty"),
    assessmentContext: zod_1.z.string().optional().nullable()
});
