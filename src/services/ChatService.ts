import { GraphService } from './GraphService';
import logger from '../utils/logger';

export interface ChatMessage {
    role: string;
    content: string;
}

interface FireworksResponse {
    choices: Array<{
        message: {
            content: string;
        };
    }>;
}

export interface ChatAction {
    type: 'CONSULT_DOCTOR' | 'GET_LAB_TEST';
    value: string;
    url?: string;
}

export interface ServiceResponse {
    message: string;
    action?: ChatAction;
}

export class ChatService {
    private apiUrl: string;
    private model: string;
    private graphService: GraphService;

    constructor() {
        this.apiUrl = 'https://api.fireworks.ai/inference/v1/chat/completions';
        this.model = 'accounts/fireworks/models/qwen3-30b-a3b';
        this.graphService = new GraphService();
    }

    async chat(messages: ChatMessage[], assessmentContext: string | null = null): Promise<ServiceResponse> {
        const apiKey = process.env.FIREWORKS_API_KEY;

        if (!apiKey) {
            throw new Error('Fireworks AI API key is not configured');
        }

        // Count user messages to determine if we should run the decision logic
        const userMessageCount = messages.filter(m => m.role === 'user').length;

        // Run decision logic via LangGraph if we have enough context (e.g., 3 or more user messages)
        if (userMessageCount >= 3) {
            // INTERCEPT: Check if the user is responding "Yes" or "No" to a recommendation
            const lastMessage = messages[messages.length - 1];
            const previousMessage = messages[messages.length - 2];

            if (lastMessage.role === 'user' && previousMessage && previousMessage.role === 'assistant') {
                const content = lastMessage.content.trim().toLowerCase();
                const prevContent = previousMessage.content.toLowerCase();

                // Check if previous message was a recommendation (Doctor or Lab)
                const isRecommendation = prevContent.includes('strongly recommend consulting') ||
                    prevContent.includes('would be very helpful');

                if (isRecommendation) {
                    if (content === 'yes') {
                        logger.info('Transforming "Yes" to booking confirmation');
                        lastMessage.content = "I have booked the appointment.";
                    } else if (content === 'no') {
                        logger.info('Transforming "No" to skip confirmation');
                        lastMessage.content = "I will not book the appointment right now.";
                    }
                }
            }

            logger.info('Running decision logic via LangGraph...');
            const graphResponse = await this.graphService.run(messages);

            if (graphResponse) {
                logger.info('Graph returned a final response (Action taken):', { graphResponse });
                return graphResponse;
            }
            // If graph returns null, it means ASK_MORE_QUESTIONS was chosen, so we continue to normal chat
        }

        const systemMessage: ChatMessage = {
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
            const response = await fetch(this.apiUrl, {
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
                const errorData = await response.text();
                logger.error('Fireworks AI API error:', errorData);
                throw new Error(`AI service error: ${response.status}`);
            }

            const data = await response.json() as FireworksResponse;

            if (data.choices && data.choices.length > 0) {
                let content = data.choices[0].message.content;

                // Remove <think>...</think> tags (case insensitive, multiline)
                // Also handles unclosed <think> tags at the end of the string
                content = content.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '').trim();

                return { message: content };
            }

            throw new Error('No response from AI service');
        } catch (error) {
            logger.error('Chat service error:', error);
            throw error;
        }
    }
}
