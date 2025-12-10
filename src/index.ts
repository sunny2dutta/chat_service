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

app.post('/chat', async (req, res) => {
    try {
        const { messages, assessmentContext } = req.body;

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Messages array is required"
            });
        }

        const response = await chatService.chat(messages, assessmentContext);

        return res.status(200).json({
            success: true,
            message: response
        });
    } catch (error: any) {
        console.error('Chat endpoint error:', error);
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
    console.log(`Chat service running on port ${port}`);
});
