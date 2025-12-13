import { ChatService } from './src/services/ChatService';
import { ChatMessage } from './src/services/ChatService';
import dotenv from 'dotenv';
dotenv.config();

async function testThoughtSeparation() {
    const service = new ChatService();

    // Scenario: User mentions ED.
    // Expected: LLM might generate "<think>...</think> How long...?"
    // Service should return "How long...?"
    const messages: ChatMessage[] = [
        { role: 'user', content: "I have been having trouble getting an erection lately." }
    ];

    console.log("Testing thought separation...");
    try {
        const result = await service.chat(messages);
        console.log("Response:", result.message);

        if (result.message.includes("<think>")) {
            console.log("FAILURE: <think> tags leaked into response.");
        } else if (result.message.includes("To help me understand")) {
            console.log("FAILURE: Meta-commentary still present.");
        } else {
            console.log("SUCCESS: Response is clean.");
        }
    } catch (error) {
        console.error("Error:", error);
    }
}

testThoughtSeparation();
