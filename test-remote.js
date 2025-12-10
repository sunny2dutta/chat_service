const fetch = require('node-fetch');

// REPLACE THIS WITH YOUR DEPLOYED GOOGLE CLOUD URL
// Example: https://chat-service-xyz-uc.a.run.app
const DEPLOYED_URL = process.argv[2];

if (!DEPLOYED_URL) {
    console.error('Please provide the deployed URL as an argument.');
    console.error('Usage: node test-remote.js <YOUR_DEPLOYED_URL>');
    process.exit(1);
}

const TEST_PAYLOAD = {
    messages: [
        { role: 'user', content: 'Hello, I have a headache.' }
    ]
};

async function testDeployment() {
    console.log(`Testing deployment at: ${DEPLOYED_URL}`);
    console.log('Sending payload:', JSON.stringify(TEST_PAYLOAD, null, 2));

    try {
        const response = await fetch(`${DEPLOYED_URL}/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(TEST_PAYLOAD)
        });

        console.log(`Status Code: ${response.status}`);

        if (response.ok) {
            const data = await response.json();
            console.log('Response Success:', JSON.stringify(data, null, 2));
        } else {
            const text = await response.text();
            console.error('Response Error:', text);
        }

    } catch (error) {
        console.error('Request Failed:', error.message);
    }
}

testDeployment();
