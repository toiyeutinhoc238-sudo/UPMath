require('dotenv').config();
const key = process.env.GEMINI_API_KEY;

async function testGeminiJsonMode() {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${key}`;
    
    // Test 1: Với responseSchema (cái đang gây 503)
    console.log('=== Test 1: WITH responseSchema ===');
    const r1 = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                parts: [{ text: 'Đề bài: 1+1=? Bài làm học sinh: 1+1=2. Chấm điểm.' }]
            }],
            generationConfig: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: 'OBJECT',
                    properties: {
                        isCorrect: { type: 'BOOLEAN' },
                        feedback: { type: 'STRING' }
                    },
                    required: ['isCorrect', 'feedback']
                }
            }
        })
    });
    console.log('Status:', r1.status);
    const d1 = await r1.json();
    console.log('Response:', JSON.stringify(d1).substring(0, 300));
    
    console.log('\n=== Test 2: WITHOUT responseSchema (chỉ responseMimeType) ===');
    const r2 = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                parts: [{ text: 'Đề bài: 1+1=? Bài làm: 1+1=2. Trả về JSON: {"isCorrect": true/false, "feedback": "nhận xét"}' }]
            }],
            generationConfig: {
                responseMimeType: 'application/json'
            }
        })
    });
    console.log('Status:', r2.status);
    const d2 = await r2.json();
    console.log('Response:', JSON.stringify(d2).substring(0, 300));
}

testGeminiJsonMode().catch(console.error);
