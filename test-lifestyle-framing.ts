import { ChatService } from './src/services/ChatService';
import { ChatMessage } from './src/services/ChatService';
import dotenv from 'dotenv';
dotenv.config();

async function testLifestyleFraming() {
    const service = new ChatService();

    // Scenario: User smokes.
    // Expected: "Reducing smoking can help. Would you consider quitting?"
    const messages: ChatMessage[] = [
        { role: 'user', content: "I smoke a pack a day." },
        { role: 'assistant', content: "How long have you been smoking?" },
        { role: 'user', content: "10 years." }
    ];

    console.log("Testing lifestyle framing...");
    try {
        const result = await service.chat(messages);
        console.log("Response:", result.message);

        if (result.message.toLowerCase().includes("consider") || result.message.toLowerCase().includes("help")) {
            console.log("SUCCESS: Response appears to use advice-first framing.");
        } else {
            console.log("WARNING: Response might be too direct. Check output.");
        }
    } catch (error) {
        console.error("Error:", error);
    }
}

testLifestyleFraming();
