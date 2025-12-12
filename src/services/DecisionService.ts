import { ChatMessage } from './ChatService';

export interface DecisionResult {
    action: 'CONSULT_DOCTOR' | 'GET_LAB_TEST' | 'ASK_MORE_QUESTIONS';
    reasoning: string;
    suggestion?: string;
    uncertainty_score: number; // 0-100, where 100 is max uncertainty
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
            return { action: 'ASK_MORE_QUESTIONS', reasoning: 'API key missing', uncertainty_score: 100 };
        }

        const systemMessage: ChatMessage = {
            role: 'system',
            content: `You are a medical decision support system. Analyze the conversation history and decide the next best step.
            
            Your output must be a valid JSON object with the following structure:
            {
                "action": "CONSULT_DOCTOR" | "GET_LAB_TEST" | "ASK_MORE_QUESTIONS",
                "reasoning": "Brief explanation of why this decision was made",
                "suggestion": "Specific doctor type or lab test name (optional, only if action is not ASK_MORE_QUESTIONS)",
                "uncertainty_score": number // 0-100. 100 = Complete mystery. 0 = Clear, confirmed path.
            }

            FRAMEWORK - COST vs. UNCERTAINTY:
            1. SAFETY FIRST (Highest Priority): If there are any "Red Flags" (severe pain, difficulty breathing, chest pain, sudden onset of severe symptoms), you MUST choose CONSULT_DOCTOR immediately. Safety overrides all costs.
            
            2. COST ANALYSIS:
               - ASK_MORE_QUESTIONS (Low Cost): Preferred when uncertainty is high (>40) and can be reduced by simple facts.
               - GET_LAB_TEST (High Cost): Use ONLY if uncertainty is moderate (20-40) AND a specific test will drop it to near 0.
               - CONSULT_DOCTOR (Super High Cost): Use if safety red flags exist (Score irrelevant) OR if uncertainty is low (<20) but requires prescription/procedure.
            
            3. UNCERTAINTY SCORING GUIDE:
               - 80-100: Vague symptoms (e.g., "I feel bad"). No hypothesis.
               - 60-80: Some symptoms, broad differential (e.g., "Headache and fatigue").
               - 40-60: Stronger pattern, but key details missing (e.g., "Thyroid symptoms but need to rule out anemia").
               - 20-40: Strong hypothesis, needs confirmation (e.g., "Classic anemia symptoms, need CBC").
               - 0-20: Clear path identified (e.g., "Red flags present" or "Lab results confirmed").

            DECISION RULES:
            - If (Red Flags) -> CONSULT_DOCTOR
            - Else If (Uncertainty > 40) -> ASK_MORE_QUESTIONS
            - Else If (Uncertainty <= 40 AND Specific Hypothesis exists AND Lab Test confirms it) -> GET_LAB_TEST
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
                return { action: 'ASK_MORE_QUESTIONS', reasoning: 'API error', uncertainty_score: 100 };
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
                        return { action: 'ASK_MORE_QUESTIONS', reasoning: 'Invalid action from LLM', uncertainty_score: 100 };
                    }
                    return result;
                } catch (e) {
                    console.error('Failed to parse decision JSON:', e);
                    return { action: 'ASK_MORE_QUESTIONS', reasoning: 'JSON parse error', uncertainty_score: 100 };
                }
            }

            return { action: 'ASK_MORE_QUESTIONS', reasoning: 'No response content', uncertainty_score: 100 };

        } catch (error) {
            console.error('Decision service error:', error);
            return { action: 'ASK_MORE_QUESTIONS', reasoning: 'Exception occurred', uncertainty_score: 100 };
        }
    }
}
