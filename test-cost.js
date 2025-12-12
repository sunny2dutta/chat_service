const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3001';

async function chat(messages) {
    try {
        const response = await fetch(`${BASE_URL}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages })
        });
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error:', error);
        return null;
    }
}

async function runScenario(name, initialMessages) {
    console.log(`\n--- Running Scenario: ${name} ---`);
    console.log('Sending messages:', JSON.stringify(initialMessages, null, 2));
    const result = await chat(initialMessages);

    if (result && result.success) {
        console.log('Response:', result.message);
    } else {
        console.error('Failed:', result);
    }
}

async function main() {
    // Scenario 5: Low Cost Preference (Should trigger ASK_MORE_QUESTIONS)
    // User gives one symptom. System should ask more (cheap) before sending to doctor (expensive).
    const lowCostScenario = [
        { role: 'user', content: 'I have a headache.' },
        { role: 'assistant', content: 'Is it severe?' },
        { role: 'user', content: 'No, just annoying.' }
    ];

    await runScenario('Low Cost Preference (Expect More Questions)', lowCostScenario);
}

main();
