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

export class ChatService {
    private apiUrl: string;
    private model: string;

    constructor() {
        this.apiUrl = 'https://api.fireworks.ai/inference/v1/chat/completions';
        this.model = 'accounts/fireworks/models/qwen3-30b-a3b';
    }

    async chat(messages: ChatMessage[], assessmentContext: string | null = null): Promise<string> {
        const apiKey = process.env.FIREWORKS_API_KEY;

        if (!apiKey) {
            throw new Error('Fireworks AI API key is not configured');
        }

        const systemMessage: ChatMessage = {
            role: 'system',
            content: `You are Menvy, an AI-powered men's wellness companion.

CRITICAL INSTRUCTIONS:
1. BE CONCISE: Keep your main response short (1-2 sentences).
2. ONE QUESTION RULE: You MUST end every response with EXACTLY ONE short question to gather more information. Do not ask multiple questions.
3. SEMI-DIAGNOSTIC APPROACH: Do not give generic advice immediately. Ask questions to understand the user's specific situation first (e.g., "How long have you felt this way?" or "Do you have any pain?").
4. EVENTUAL ACTION: Only after gathering context, suggest specific actions (Lab Test, Doctor, Exercise).

Your goal is to have a continuous back-and-forth conversation where you peel back the layers of the user's issue one question at a time.

Important guidelines:
- Never diagnose medical conditions definitively.
- If the user asks about topics unrelated to health, wellness, or lifestyle, refuse to answer and respond with: "I can only answer health related questions. Do you have any health related questions?"

${assessmentContext ? `User's assessment context: ${assessmentContext}` : ''}`
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
                console.error('Fireworks AI API error:', errorData);
                throw new Error(`AI service error: ${response.status}`);
            }

            const data = await response.json() as FireworksResponse;

            if (data.choices && data.choices.length > 0) {
                let content = data.choices[0].message.content;

                // Remove <think>...</think> tags (case insensitive, multiline)
                // Also handles unclosed <think> tags at the end of the string
                content = content.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '').trim();

                return content;
            }

            throw new Error('No response from AI service');
        } catch (error) {
            console.error('Chat service error:', error);
            throw error;
        }
    }
}
