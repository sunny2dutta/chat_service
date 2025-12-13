import { GraphService } from './src/services/GraphService';
import { ChatMessage } from './src/services/ChatService';
import { DecisionService } from './src/services/DecisionService';
import dotenv from 'dotenv';
dotenv.config();

// Mock DecisionService to return a known decision with reasoning
class MockDecisionService extends DecisionService {
    async evaluateConversation(messages: ChatMessage[]): Promise<any> {
        return {
            action: 'PROVIDE_ADVICE',
            reasoning: 'User is en route to ER and requests preparation help.',
            suggestion: 'Bring medical history, list of medications, insurance info.',
            uncertainty_score: 10
        };
    }
}

async function testMessageLeakage() {
    const mockDecisionService = new MockDecisionService();
    const graphService = new GraphService(mockDecisionService);

    const messages: ChatMessage[] = [
        { role: 'user', content: "I am going to the ER." }
    ];

    console.log("Testing message leakage...");
    try {
        const result = await graphService.run(messages);

        if (result) {
            console.log("Result Message:", result.message);
            if (result.message.includes("User is en route to ER")) {
                console.log("FAILURE: Internal reasoning leaked into message.");
            } else {
                console.log("SUCCESS: Message is clean.");
            }
        } else {
            console.log("FAILURE: No result returned.");
        }
    } catch (error) {
        console.error("Error:", error);
    }
}

testMessageLeakage();
