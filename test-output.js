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
        console.log('Response Message:', result.message);
        if (result.action) {
            console.log('Response Action:', JSON.stringify(result.action, null, 2));
        } else {
            console.log('Response Action: None');
        }
    } else {
        console.error('Failed:', result);
    }
}

async function main() {
    // Scenario 1: Severe symptoms (Should trigger CONSULT_DOCTOR)
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

    // Scenario 3: User Booked (Should trigger ASK_MORE_QUESTIONS)
    const bookedScenario = [
        { role: 'user', content: 'I have been feeling very tired lately.' },
        { role: 'assistant', content: 'I recommend getting a CBC test.' },
        { role: 'user', content: 'Okay, I booked the test.' }
    ];

    await runScenario('Severe Symptoms (Expect Doctor Action)', severeScenario);
    await runScenario('Lab Test (Expect Lab Test Action)', labTestScenario);
    await runScenario('User Booked (Expect No Action, just chat)', bookedScenario);
}

main();
