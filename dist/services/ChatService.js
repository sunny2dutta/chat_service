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
exports.ChatService = void 0;
const GraphService_1 = require("./GraphService");
const logger_1 = __importDefault(require("../utils/logger"));
class ChatService {
    constructor() {
        this.apiUrl = 'https://api.fireworks.ai/inference/v1/chat/completions';
        this.model = 'accounts/fireworks/models/qwen3-30b-a3b';
        this.graphService = new GraphService_1.GraphService();
    }
    chat(messages_1) {
        return __awaiter(this, arguments, void 0, function* (messages, assessmentContext = null) {
            const apiKey = process.env.FIREWORKS_API_KEY;
            if (!apiKey) {
                throw new Error('Fireworks AI API key is not configured');
            }
            // Count user messages to determine if we should run the decision logic
            const userMessageCount = messages.filter(m => m.role === 'user').length;
            // Run decision logic via LangGraph if we have enough context (e.g., 3 or more user messages)
            if (userMessageCount >= 3) {
                logger_1.default.info('Running decision logic via LangGraph...');
                const graphResponse = yield this.graphService.run(messages);
                if (graphResponse) {
                    logger_1.default.info('Graph returned a final response (Action taken):', { graphResponse });
                    return graphResponse;
                }
                // If graph returns null, it means ASK_MORE_QUESTIONS was chosen, so we continue to normal chat
            }
            const systemMessage = {
                role: 'system',
                content: `You are Menvy, an AI-powered men's wellness companion.
            
            Your goal is to help men understand their health symptoms and guide them to the right care.
            
            RULES:
            1. Be empathetic, professional, and concise.
            2. CRITICAL: Ask EXACTLY ONE question at a time to gather more information. Do NOT ask multiple questions in a single response.
            3. Do NOT diagnose. Instead, suggest possibilities and next steps.
            4. If the user mentions "chest pain", "shortness of breath", or "severe pain", tell them to go to the ER immediately.
            
            CONTEXT:
            ${assessmentContext ? `User Assessment Context: ${assessmentContext}` : ''}`
            };
            const chatMessages = [systemMessage, ...messages];
            try {
                const response = yield fetch(this.apiUrl, {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: JSON.stringify({
                        model: this.model,
                        max_tokens: 1500, // Increased to ensure thinking completes
                        temperature: 0.7,
                        messages: chatMessages
                    })
                });
                if (!response.ok) {
                    const errorData = yield response.text();
                    logger_1.default.error('Fireworks AI API error:', errorData);
                    throw new Error(`AI service error: ${response.status}`);
                }
                const data = yield response.json();
                if (data.choices && data.choices.length > 0) {
                    let content = data.choices[0].message.content;
                    // Remove <think>...</think> tags (case insensitive, multiline)
                    // Also handles unclosed <think> tags at the end of the string
                    content = content.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '').trim();
                    return { message: content };
                }
                throw new Error('No response from AI service');
            }
            catch (error) {
                logger_1.default.error('Chat service error:', error);
                throw error;
            }
        });
    }
}
exports.ChatService = ChatService;
