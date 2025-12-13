import { ChatMessage } from './ChatService';
import { UncertaintyService } from './UncertaintyService';
import logger from '../utils/logger';
import { config } from '../config';
import { HttpClient } from '../utils/HttpClient';

export interface DecisionResult {
    action: 'CONSULT_DOCTOR' | 'GET_LAB_TEST' | 'ASK_MORE_QUESTIONS' | 'PROVIDE_ADVICE';
    reasoning: string;
    suggestion?: string;
    uncertainty_score: number; // 0-100, calculated by UncertaintyService
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
    private uncertaintyService: UncertaintyService;

    constructor(uncertaintyService?: UncertaintyService) {
        this.apiUrl = config.FIREWORKS_API_URL;
        this.model = config.FIREWORKS_MODEL;
        this.uncertaintyService = uncertaintyService || new UncertaintyService();
    }

    async evaluateConversation(messages: ChatMessage[]): Promise<DecisionResult> {
        const apiKey = config.FIREWORKS_API_KEY;

        // Step 1: Calculate Uncertainty
        const uncertaintyScore = await this.uncertaintyService.calculateUncertainty(messages);
        logger.info(`Calculated uncertainty score: ${uncertaintyScore}`);

        const systemMessage: ChatMessage = {
            role: 'system',
            content: `You are a medical decision support system. Analyze the conversation history and decide the next best step based on the provided UNCERTAINTY SCORE.

            CURRENT UNCERTAINTY SCORE: ${uncertaintyScore} (0-100)

            Your output must be a valid JSON object with the following structure:
            {
                "action": "CONSULT_DOCTOR" | "GET_LAB_TEST" | "ASK_MORE_QUESTIONS" | "PROVIDE_ADVICE",
                "reasoning": "Brief explanation of why this decision was made",
                "suggestion": "Specific doctor type, lab test name, or advice (optional, only if action is not ASK_MORE_QUESTIONS)",
                "uncertainty_score": ${uncertaintyScore} // Pass this back exactly as received
            }

            FRAMEWORK - COST vs. UNCERTAINTY:
            1. SAFETY FIRST (Highest Priority): If there are any "Red Flags" (severe pain, difficulty breathing, chest pain, sudden onset of severe symptoms), you MUST choose CONSULT_DOCTOR immediately. Safety overrides all costs.
            
            2. COST ANALYSIS:
               - ASK_MORE_QUESTIONS (Low Cost): Preferred when uncertainty is high (>40) and can be reduced by simple facts.
               - GET_LAB_TEST (High Cost): Use ONLY if uncertainty is moderate (20-40) AND a specific test will drop it to near 0.
               - CONSULT_DOCTOR (Super High Cost): Use if safety red flags exist OR if uncertainty is low (<20) but requires prescription/procedure. **NOTE: This is a TERMINAL STATE. Do not try to reduce uncertainty further if a doctor visit is warranted.**
               - PROVIDE_ADVICE (Low Cost): Use if uncertainty is low (<20) and no medical intervention is needed (e.g., "sleep more", "drink water", "quit smoking"). **NOTE: This is a TERMINAL STATE.**

            DECISION RULES:
            - If (User says "booked", "scheduled", "will do it", or similar confirmation of previous recommendation) -> ASK_MORE_QUESTIONS (Allow conversational LLM to acknowledge)
            - If (User says "skipped", "no", "later", "too expensive" to previous recommendation) -> ASK_MORE_QUESTIONS (Allow conversational LLM to discuss alternatives or reasons)
            - If (Red Flags) -> CONSULT_DOCTOR
            - Else If (Uncertainty > 40) -> ASK_MORE_QUESTIONS
            - Else If (Uncertainty <= 40 AND Specific Hypothesis exists AND Lab Test confirms it) -> GET_LAB_TEST
            - Else If (Uncertainty < 20 AND No Medical Intervention Needed) -> PROVIDE_ADVICE
            - Else -> CONSULT_DOCTOR
            
            Do not include any markdown formatting or explanations outside the JSON.`
        };

        // We only need the last few messages to make a decision, but sending full context is safer for now.
        // To save tokens, we could limit this.
        const analysisMessages = [systemMessage, ...messages];

        try {
            const response = await HttpClient.post(this.apiUrl, {
                model: this.model,
                max_tokens: 1000,
                temperature: 0.1, // Low temperature for deterministic JSON output
                messages: analysisMessages,
                response_format: { type: "json_object" } // Force JSON mode if supported, otherwise prompt handles it
            }, {
                'Authorization': `Bearer ${apiKey}`
            });

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
                    if (!['CONSULT_DOCTOR', 'GET_LAB_TEST', 'ASK_MORE_QUESTIONS', 'PROVIDE_ADVICE'].includes(result.action)) {
                        console.warn('Invalid action received:', result.action);
                        return { action: 'ASK_MORE_QUESTIONS', reasoning: 'Invalid action from LLM', uncertainty_score: uncertaintyScore };
                    }
                    // Ensure the score matches what we calculated
                    result.uncertainty_score = uncertaintyScore;
                    return result;
                } catch (e) {
                    console.error('Failed to parse decision JSON:', e);
                    return { action: 'ASK_MORE_QUESTIONS', reasoning: 'JSON parse error', uncertainty_score: uncertaintyScore };
                }
            }

            return { action: 'ASK_MORE_QUESTIONS', reasoning: 'No response content', uncertainty_score: uncertaintyScore };

        } catch (error) {
            console.error('Decision service error:', error);
            return { action: 'ASK_MORE_QUESTIONS', reasoning: 'Exception occurred', uncertainty_score: 100 };
        }
    }
}
