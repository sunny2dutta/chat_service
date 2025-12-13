import { DecisionService } from './src/services/DecisionService';
import { ChatMessage } from './src/services/ChatService';
import dotenv from 'dotenv';
dotenv.config();

async function testProvideAdviceEndState() {
    const service = new DecisionService();

    // Scenario: User has a cold, doctor confirmed, just wants home remedies.
    // This should result in PROVIDE_ADVICE.
    const messages: ChatMessage[] = [
        { role: 'user', content: "I have a common cold. My doctor already confirmed it." },
        { role: 'assistant', content: "I see. Do you have any severe symptoms like high fever or trouble breathing?" },
        { role: 'user', content: "No, just a runny nose and mild cough. I just want some home remedies." }
    ];

    console.log("Testing PROVIDE_ADVICE end state logic...");
    try {
        const result = await service.evaluateConversation(messages);
        console.log("Result:", JSON.stringify(result, null, 2));

        if (result.action === 'PROVIDE_ADVICE') {
            console.log("SUCCESS: Correctly identified PROVIDE_ADVICE.");
        } else {
            console.log("FAILURE: Did not choose PROVIDE_ADVICE.");
        }
    } catch (error) {
        console.error("Error:", error);
    }
}

testProvideAdviceEndState();
