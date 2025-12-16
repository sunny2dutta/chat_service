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
                "suggestion": "Specific doctor type (e.g. Urologist), SPECIFIC Lab Test Name (e.g. Lipid Panel) - REQUIRED if action is NOT ASK_MORE_QUESTIONS.",
                "uncertainty_score": ${uncertaintyScore} // Pass this back exactly as received
            }

            FRAMEWORK - COST vs. UNCERTAINTY:
            1. SAFETY FIRST (Highest Priority): If there are any "Red Flags" (severe pain, difficulty breathing, chest pain, sudden onset of severe symptoms), you MUST choose CONSULT_DOCTOR immediately. Safety overrides all costs.
            
            2. COST ANALYSIS:
               - ASK_MORE_QUESTIONS (Low Cost): Preferred when uncertainty is high (>60) and can be reduced by simple facts.
               - GET_LAB_TEST (Moderate Cost - Data Gathering): Preferred when uncertainty is moderate (20-60) and a lab test would provide valuable data for a future doctor visit.
               - CONSULT_DOCTOR (High Cost): Use if safety red flags exist OR if uncertainty is low (<20) but requires prescription/procedure. **NOTE: This is a TERMINAL STATE.**
               - PROVIDE_ADVICE (Low Cost): Use if uncertainty is low (<20) and no medical intervention is needed. **NOTE: This is a TERMINAL STATE.**

            DECISION RULES:
            - If (User says "booked", "scheduled", "will do it", or similar confirmation of previous recommendation) -> ASK_MORE_QUESTIONS (Allow conversational LLM to acknowledge)
            - If (User says "skipped", "no", "later", "too expensive" to previous recommendation) -> ASK_MORE_QUESTIONS (Allow conversational LLM to discuss alternatives or reasons)
            - CRITICAL: If (Red Flags / Emergency) -> CONSULT_DOCTOR (suggestion MUST be 'Emergency Room' or specific specialist like 'Cardiologist').
            - Else If (Uncertainty > 60) -> ASK_MORE_QUESTIONS
            - Else If (Uncertainty <= 60 AND Lab Test helps diagnosis) -> GET_LAB_TEST (suggestion MUST be specific test name e.g. 'Complete Blood Count', 'Testosterone Panel'. NEVER just 'Lab Test').
            - Else If (Uncertainty < 20 AND No Medical Intervention Needed) -> PROVIDE_ADVICE
            - Else -> CONSULT_DOCTOR (suggestion MUST be a specific specialist. NEVER just 'Doctor'.)
            
            FORMAT:
            <think>
            Analyze the situation here...
            </think>
            {
                "action": "...",
                ...
            }
            `
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
                // response_format: { type: "json_object" } // REMOVED: Let prompt handle format to allow <think> tags
            }, {
                'Authorization': `Bearer ${apiKey}`
            });

            const data = await response.json() as FireworksResponse;

            if (data.choices && data.choices.length > 0) {
                let content = data.choices[0].message.content;

                // Remove <think>...</think> tags (case insensitive, multiline)
                content = content.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '');

                // Handle stray closing tags
                content = content.replace(/^[\s\S]*?<\/think>/gi, '');

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
