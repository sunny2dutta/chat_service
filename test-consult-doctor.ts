import { DecisionService } from './src/services/DecisionService';
import { ChatMessage } from './src/services/ChatService';
import { config } from './src/config';

import dotenv from 'dotenv';
dotenv.config();

async function testConsultDoctorEndState() {
    const service = new DecisionService();

    const messages: ChatMessage[] = [
        { role: 'user', content: "I have severe chest pain." }
    ];

    console.log("Testing CONSULT_DOCTOR end state logic...");
    try {
        const result = await service.evaluateConversation(messages);
        console.log("Result:", JSON.stringify(result, null, 2));

        if (result.action === 'CONSULT_DOCTOR') {
            console.log("SUCCESS: Correctly identified CONSULT_DOCTOR.");
        } else {
            console.log("FAILURE: Did not choose CONSULT_DOCTOR.");
        }
    } catch (error) {
        console.error("Error:", error);
    }
}

testConsultDoctorEndState();
