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
    let messages = [...initialMessages];

    // Send initial messages one by one to simulate conversation history if needed, 
    // but here we send the full history at once as the API is stateless regarding history storage,
    // it expects the full array.

    console.log('Sending messages:', JSON.stringify(messages, null, 2));
    const result = await chat(messages);

    if (result && result.success) {
        console.log('Response:', result.message);
    } else {
        console.error('Failed:', result);
    }
}

async function main() {
    // Scenario 1: Severe symptoms (Should trigger CONSULT_DOCTOR)
    // We need at least 3 user messages to trigger the logic.
    const severeScenario = [
        { role: 'user', content: 'Hi, I have been having severe chest pain.' },
        { role: 'assistant', content: 'I am sorry to hear that. Is the pain radiating to your arm?' },
        { role: 'user', content: 'Yes, it goes down my left arm and I feel dizzy.' },
        { role: 'assistant', content: 'How long has this been happening?' },
        { role: 'user', content: 'About 30 minutes now. It is getting worse.' }
    ];

    // Scenario 2: Lab Test (Should trigger GET_LAB_TEST)
    const labTestScenario = [
        { role: 'user', content: 'I have been feeling very tired lately.' },
        { role: 'assistant', content: 'How is your sleep quality?' },
        { role: 'user', content: 'I sleep 8 hours but still wake up tired. I also look pale.' },
        { role: 'assistant', content: 'Do you have any dietary restrictions?' },
        { role: 'user', content: 'I am a vegetarian and I think I might be anemic.' }
    ];

    // Scenario 3: Vague (Should trigger ASK_MORE_QUESTIONS)
    const vagueScenario = [
        { role: 'user', content: 'I do not feel great.' },
        { role: 'assistant', content: 'Can you describe what you are feeling?' },
        { role: 'user', content: 'Just a bit off.' },
        { role: 'assistant', content: 'Do you have any specific symptoms?' },
        { role: 'user', content: 'Not really, just general malaise.' }
    ];

    // Scenario 4: Uncertainty Reduction (Should trigger GET_LAB_TEST)
    // Symptoms are ambiguous (could be thyroid, could be lifestyle), so a test reduces uncertainty.
    const uncertaintyScenario = [
        { role: 'user', content: 'I have been gaining weight even though I eat less.' },
        { role: 'assistant', content: 'Do you feel cold often?' },
        { role: 'user', content: 'Yes, I am always freezing and my skin is dry.' },
        { role: 'assistant', content: 'How are your energy levels?' },
        { role: 'user', content: 'Very low. I am sluggish.' }
    ];

    // Scenario 5: Low Cost Preference (Should trigger ASK_MORE_QUESTIONS)
    // User gives one symptom. System should ask more (cheap) before sending to doctor (expensive).
    const lowCostScenario = [
        { role: 'user', content: 'I have a headache.' },
        { role: 'assistant', content: 'Is it severe?' },
        { role: 'user', content: 'No, just annoying.' }
    ];

    await runScenario('Severe Symptoms (Expect Doctor - Safety)', severeScenario);
    await runScenario('Lab Test (Expect Lab Test - High Value)', labTestScenario);
    await runScenario('Vague Symptoms (Expect More Questions - Low Cost)', vagueScenario);
    await runScenario('Uncertainty Reduction (Expect Lab Test - High Value)', uncertaintyScenario);
    await runScenario('Low Cost Preference (Expect More Questions)', lowCostScenario);
}

main();
