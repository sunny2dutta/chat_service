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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const ChatService_1 = require("./services/ChatService");
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = process.env.PORT || 3001;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
const chatService = new ChatService_1.ChatService();
app.get('/', (req, res) => {
    res.status(200).json({
        status: 'online',
        service: 'Chat Service',
        version: '1.0.0'
    });
});
const logger_1 = __importDefault(require("./utils/logger"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
// Security Middleware
app.use((0, helmet_1.default)());
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const yamljs_1 = __importDefault(require("yamljs"));
const path_1 = __importDefault(require("path"));
// Load OpenAPI spec
// Load OpenAPI spec
const swaggerDocument = yamljs_1.default.load(path_1.default.join(__dirname, '../openapi.yaml'));
app.use('/api-docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swaggerDocument));
const fs_1 = __importDefault(require("fs"));
app.get('/logs', (req, res) => {
    const adminKey = req.query.key;
    if (adminKey !== (process.env.ADMIN_KEY || 'admin123')) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const logPath = path_1.default.join(__dirname, '../combined.log');
    if (fs_1.default.existsSync(logPath)) {
        const logs = fs_1.default.readFileSync(logPath, 'utf8');
        // Return as plain text for easy reading
        res.set('Content-Type', 'text/plain');
        return res.send(logs);
    }
    else {
        return res.status(404).json({ success: false, message: 'Log file not found' });
    }
});
const validate_1 = require("./middleware/validate");
const chat_schema_1 = require("./schemas/chat.schema");
app.post('/chat', (0, validate_1.validate)(chat_schema_1.ChatRequestSchema), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { messages, assessmentContext } = req.body;
        const response = yield chatService.chat(messages, assessmentContext);
        return res.status(200).json({
            success: true,
            message: response.message,
            action: response.action
        });
    }
    catch (error) {
        logger_1.default.error('Chat endpoint error:', error);
        const errorMessage = error.message || 'Unknown error';
        if (errorMessage === 'Fireworks AI API key is not configured') {
            return res.status(503).json({
                success: false,
                message: "Chat service is temporarily unavailable. Please try again later."
            });
        }
        if (errorMessage.includes('AI service error: 401') || errorMessage.includes('AI service error: 403')) {
            return res.status(503).json({
                success: false,
                message: "Chat service is experiencing authentication issues. Please contact support."
            });
        }
        if (errorMessage.includes('AI service error')) {
            return res.status(503).json({
                success: false,
                message: "Chat service is temporarily unavailable. Please try again in a moment."
            });
        }
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
}));
app.listen(port, () => {
    logger_1.default.info(`Chat service running on port ${port}`);
});
