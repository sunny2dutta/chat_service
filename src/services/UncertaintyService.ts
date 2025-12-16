import { ChatMessage } from './ChatService';
import logger from '../utils/logger';
import { config } from '../config';
import { HttpClient } from '../utils/HttpClient';

interface FireworksResponse {
    choices: Array<{
        message: {
            content: string;
        };
    }>;
}

export class UncertaintyService {
    private apiUrl: string;
    private model: string;

    constructor() {
        this.apiUrl = config.FIREWORKS_API_URL;
        this.model = config.FIREWORKS_MODEL;
    }

    async calculateUncertainty(messages: ChatMessage[]): Promise<number> {
        const apiKey = config.FIREWORKS_API_KEY;

        const systemMessage: ChatMessage = {
            role: 'system',
            content: `You are a medical uncertainty calculator. Analyze the conversation history and determine the level of uncertainty regarding the user's condition.

            Output ONLY a single number between 0 and 100.
            
            SCORING GUIDE:
            - 80-100: Vague symptoms (e.g., "I feel bad"). No hypothesis. Complete mystery.
            - 60-80: Some symptoms, but multiple distinct possibilities (e.g., "Headache" could be stress, dehydration, etc.).
            - 40-60: Consistent pattern for a specific condition (e.g., "Fatigue + Pale" -> Anemia), even if unconfirmed.
            - 20-40: Strong hypothesis, needs confirmation (e.g., "Classic anemia symptoms, need CBC").
            - 0-20: Clear path identified (e.g., "Red flags present" or "Lab results confirmed").

            Do not provide any explanation, just the number.`
        };

        const analysisMessages = [systemMessage, ...messages];

        try {
            const response = await HttpClient.post(this.apiUrl, {
                model: this.model,
                max_tokens: 1000, // Allow enough tokens for thinking
                temperature: 0.0, // Deterministic
                messages: analysisMessages
            }, {
                'Authorization': `Bearer ${apiKey}`
            });

            const data = await response.json() as FireworksResponse;

            if (data.choices && data.choices.length > 0) {
                let content = data.choices[0].message.content;

                // Remove <think>...</think> tags (case insensitive, multiline)
                content = content.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '').trim();

                // Remove any non-digit characters just in case
                const match = content.match(/\d+/);
                if (match) {
                    const score = parseInt(match[0], 10);
                    // Clamp between 0 and 100
                    return Math.max(0, Math.min(100, score));
                }
            }

            return 100;

        } catch (error) {
            logger.error('Uncertainty service error:', error);
            return 100;
        }
    }
}
