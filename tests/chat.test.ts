import request from 'supertest';
import express from 'express';
import { ChatService } from '../src/services/ChatService';
import { validate } from '../src/middleware/validate';
import { ChatRequestSchema } from '../src/schemas/chat.schema';

// Mock ChatService
jest.mock('../src/services/ChatService');

const app = express();
app.use(express.json());

// Setup route for testing
const chatService = new ChatService();
app.post('/chat', validate(ChatRequestSchema), async (req, res) => {
    try {
        const { messages, assessmentContext } = req.body;
        const response = await chatService.chat(messages, assessmentContext);
        res.status(200).json({ success: true, message: response });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
});

describe('POST /chat', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should return 400 if messages array is missing', async () => {
        const res = await request(app).post('/chat').send({});
        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toBe('Validation failed');
    });

    it('should return 400 if messages array is empty', async () => {
        const res = await request(app).post('/chat').send({ messages: [] });
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Validation failed');
    });

    it('should return 200 and response on valid input', async () => {
        (chatService.chat as jest.Mock).mockResolvedValue('Hello there!');

        const res = await request(app).post('/chat').send({
            messages: [{ role: 'user', content: 'Hi' }]
        });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toBe('Hello there!');
    });
});
