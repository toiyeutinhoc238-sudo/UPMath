require('dotenv').config({ path: 'c:/Users/BRAVO 15/Downloads/web hoc toan/backend/.env' });

const apiKey = process.env.GEMINI_API_KEY;

async function run() {
    console.log("Using API Key (Bearer):", apiKey);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`;
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                contents: [{ parts: [{ text: "Hello, reply with 'test success'" }] }]
            })
        });
        console.log("Status:", res.status);
        const text = await res.text();
        console.log("Response:", text);
    } catch (err) {
        console.error("Error calling API:", err);
    }
}

run();
