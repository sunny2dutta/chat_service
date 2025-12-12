import { ChatMessage } from './ChatService';

export interface DecisionResult {
    action: 'CONSULT_DOCTOR' | 'GET_LAB_TEST' | 'ASK_MORE_QUESTIONS';
    reasoning: string;
    suggestion?: string;
}

interface FireworksResponse {
    choices: Array<{
        message: {
            content: string;
        };
    }>;
}

export class DecisionService {
    private apiUrl: string;
    private model: string;

    constructor() {
        this.apiUrl = 'https://api.fireworks.ai/inference/v1/chat/completions';
        this.model = 'accounts/fireworks/models/qwen3-30b-a3b';
    }

    async evaluateConversation(messages: ChatMessage[]): Promise<DecisionResult> {
        const apiKey = process.env.FIREWORKS_API_KEY;

        if (!apiKey) {
            console.warn('Fireworks API key not found, defaulting to ASK_MORE_QUESTIONS');
            return { action: 'ASK_MORE_QUESTIONS', reasoning: 'API key missing' };
        }

        const systemMessage: ChatMessage = {
            role: 'system',
            content: `You are a medical decision support system. Analyze the conversation history and decide the next best step.
            
            Your output must be a valid JSON object with the following structure:
            {
                "action": "CONSULT_DOCTOR" | "GET_LAB_TEST" | "ASK_MORE_QUESTIONS",
                "reasoning": "Brief explanation of why this decision was made",
                "suggestion": "Specific doctor type or lab test name (optional, only if action is not ASK_MORE_QUESTIONS)"
            }

            FRAMEWORK - COST vs. UNCERTAINTY:
            1. SAFETY FIRST (Highest Priority): If there are any "Red Flags" (severe pain, difficulty breathing, chest pain, sudden onset of severe symptoms), you MUST choose CONSULT_DOCTOR immediately. Safety overrides all costs.
            
            2. COST ANALYSIS:
               - ASK_MORE_QUESTIONS (Low Cost): Preferred when uncertainty is high and can be reduced by simple facts. Use this to gather missing info before suggesting expensive actions.
               - GET_LAB_TEST (High Cost): Use ONLY if:
                 a) You have asked enough questions to form a strong hypothesis, but further questioning cannot confirm it (you need objective biomarker data).
                 b) AND you know exactly which specific test will confirm or rule out this hypothesis.
                 c) Do NOT suggest tests for vague "check-ups" without a specific suspicion.
               - CONSULT_DOCTOR (Super High Cost): Use ONLY if:
                 a) Safety red flags are present (see above).
                 b) OR the situation is too complex for an AI/Lab test to handle.
                 c) OR you have reached a diagnostic dead-end.

            DECISION RULES:
            - If (Red Flags) -> CONSULT_DOCTOR
            - Else If (Uncertainty is High AND Can be reduced by questions) -> ASK_MORE_QUESTIONS
            - Else If (Specific Hypothesis exists AND Lab Test confirms/rules it out) -> GET_LAB_TEST
            - Else -> CONSULT_DOCTOR
            
            Do not include any markdown formatting or explanations outside the JSON.`
        };

        // We only need the last few messages to make a decision, but sending full context is safer for now.
        // To save tokens, we could limit this.
        const analysisMessages = [systemMessage, ...messages];

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
                    max_tokens: 1000,
                    temperature: 0.1, // Low temperature for deterministic JSON output
                    messages: analysisMessages,
                    response_format: { type: "json_object" } // Force JSON mode if supported, otherwise prompt handles it
                })
            });

            if (!response.ok) {
                console.error(`Decision service API error: ${response.status}`);
                return { action: 'ASK_MORE_QUESTIONS', reasoning: 'API error' };
            }

            const data = await response.json() as FireworksResponse;

            if (data.choices && data.choices.length > 0) {
                let content = data.choices[0].message.content;

                // Remove <think>...</think> tags (case insensitive, multiline)
                content = content.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '').trim();

                // Clean up potential markdown code blocks if the model adds them despite instructions
                content = content.replace(/```json/g, '').replace(/```/g, '').trim();

                try {
                    const result = JSON.parse(content) as DecisionResult;
                    // Validate action
                    if (!['CONSULT_DOCTOR', 'GET_LAB_TEST', 'ASK_MORE_QUESTIONS'].includes(result.action)) {
                        console.warn('Invalid action received:', result.action);
                        return { action: 'ASK_MORE_QUESTIONS', reasoning: 'Invalid action from LLM' };
                    }
                    return result;
                } catch (e) {
                    console.error('Failed to parse decision JSON:', e);
                    return { action: 'ASK_MORE_QUESTIONS', reasoning: 'JSON parse error' };
                }
            }

            return { action: 'ASK_MORE_QUESTIONS', reasoning: 'No response content' };

        } catch (error) {
            console.error('Decision service error:', error);
            return { action: 'ASK_MORE_QUESTIONS', reasoning: 'Exception occurred' };
        }
    }
}
