import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { ChatService } from './services/ChatService';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const chatService = new ChatService();

app.get('/', (req, res) => {
    res.status(200).json({
        status: 'online',
        service: 'Chat Service',
        version: '1.0.0'
    });
});


import logger from './utils/logger';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

// Security Middleware
app.use(helmet());

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import path from 'path';

// Load OpenAPI spec
// Load OpenAPI spec
const swaggerDocument = YAML.load(path.join(__dirname, '../openapi.yaml'));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

import fs from 'fs';
app.get('/logs', (req, res) => {
    const adminKey = req.query.key;
    if (adminKey !== (process.env.ADMIN_KEY || 'admin123')) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const logPath = path.join(__dirname, '../combined.log');
    if (fs.existsSync(logPath)) {
        const logs = fs.readFileSync(logPath, 'utf8');
        // Return as plain text for easy reading
        res.set('Content-Type', 'text/plain');
        return res.send(logs);
    } else {
        return res.status(404).json({ success: false, message: 'Log file not found' });
    }
});

import { validate } from './middleware/validate';
import { ChatRequestSchema } from './schemas/chat.schema';

app.post('/chat', validate(ChatRequestSchema), async (req, res) => {
    try {
        const { messages, assessmentContext } = req.body;

        const response = await chatService.chat(messages, assessmentContext);

        return res.status(200).json({
            success: true,
            message: response
        });
    } catch (error: any) {
        logger.error('Chat endpoint error:', error);
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
});

app.listen(port, () => {
    logger.info(`Chat service running on port ${port}`);
});
