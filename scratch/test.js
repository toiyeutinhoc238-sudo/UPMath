const text = 'Ta có:\n\\[\n\\begin{cases}\nu = x\n\ndv = e^x \\, dx\n\\end{cases}\n\\]';

let t = text;

// 1. replace \\n
t = t.replace(/\\n(?![a-z])/g, "\n").replace(/\\r(?![a-z])/g, "\r");

// 2. convert double backslashes
t = t.replace(/\\+([a-zA-Z\[\]\(\)])/g, (m, p1) => "\\" + p1);

// 3. clean up
t = t.replace(/\\\[([\s\S]*?)\\\\]/g, (m, p1) => {
    const cleaned = p1.split('\n').filter(line => line.trim() !== '').join('\n');
    return `\\[${cleaned}\\]`;
});

console.log(JSON.stringify(t));
