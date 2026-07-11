const fs = require('fs');
const appJsPath = 'c:/Users/BRAVO 15/Downloads/web hoc toan/app.js';
let content = fs.readFileSync(appJsPath, 'utf8');

// 1. Toast offline
content = content.replace(
    'showToast(`Chào mừng! (Chế độ offline)`, "info");',
    'showToast(`Chào mừng! (Ngoại tuyến)`, "info");'
);

// 2. Button Word in solution form
content = content.replace(
    '<button type="button" class="btn btn-secondary mode-btn" data-mode="word"><i class="fa-solid fa-file-word"></i> Văn bản (Word)</button>',
    '<button type="button" class="btn btn-secondary mode-btn" data-mode="word"><i class="fa-solid fa-file-word"></i> Văn bản</button>'
);

// 3. Label LaTeX & Text in solution form
content = content.replace(
    '<label class="form-label">Nội dung lời giải (LaTeX & Text):</label>',
    '<label class="form-label">Nội dung lời giải (LaTeX và Văn bản):</label>'
);

// 4. Tagline of AI tutor
content = content.replace(
    '<div class="ai-tutor-tagline">Hướng dẫn từng bước (Socratic Method)</div>',
    '<div class="ai-tutor-tagline">Hướng dẫn từng bước gợi mở</div>'
);

// 5. Welcome message of tutor (make it human: Thầy - em)
const oldWelcome = 'content: `Chào **${user ? user.username.split(\' \')[0] : \'bạn\'}**! Mình là Trợ lý Học tập AI. Nếu bạn chưa biết hướng giải bài tập này, hoặc muốn tìm hiểu các lý thuyết, công thức liên quan, hãy chat với mình nhé. Mình sẽ hướng dẫn từng bước (Socratic Method) để bạn tự giải được bài toán này! 😉`';
const newWelcome = 'content: `Chào em! Thầy là người hướng dẫn học tập của em. Nếu em chưa biết hướng giải bài tập này, hoặc muốn tìm hiểu các lý thuyết, công thức liên quan, hãy cứ hỏi thầy nhé. Thầy sẽ hướng dẫn từng bước gợi mở để em tự tìm ra lời giải cho bài toán này! 😉`';

if (content.includes(oldWelcome)) {
    content = content.replace(oldWelcome, newWelcome);
} else {
    // Attempt fallback with double quotes or slight variance
    const oldWelcomeClean = 'Mình là Trợ lý Học tập AI. Nếu bạn chưa biết hướng giải bài tập này, hoặc muốn tìm hiểu các lý thuyết, công thức liên quan, hãy chat với mình nhé. Mình sẽ hướng dẫn từng bước (Socratic Method) để bạn tự giải được bài toán này!';
    const newWelcomeClean = 'Thầy là người hướng dẫn học tập của em. Nếu em chưa biết hướng giải bài tập này, hoặc muốn tìm hiểu các lý thuyết, công thức liên quan, hãy cứ hỏi thầy nhé. Thầy sẽ hướng dẫn từng bước gợi mở để em tự tìm ra lời giải cho bài toán này!';
    content = content.replace(oldWelcomeClean, newWelcomeClean);
}

// 6. Label edit problem
content = content.replace(
    '<label class="form-label">Nội dung đề bài (LaTeX / văn bản):</label>',
    '<label class="form-label">Nội dung đề bài (LaTeX và văn bản):</label>'
);

// 7. Button Word in create problem form
// Since we have multiple button replacements, we can do it via split-join or regex or replace. 
// We already replaced one above, let's replace the second one or use a regex with global flag if needed.
// But wait, the first replace above was for the solution form, which is exactly the same markup.
// Let's do a global replace for the button Word markup:
content = content.split('<button type="button" class="btn btn-secondary mode-btn" data-mode="word"><i class="fa-solid fa-file-word"></i> Văn bản (Word)</button>').join('<button type="button" class="btn btn-secondary mode-btn" data-mode="word"><i class="fa-solid fa-file-word"></i> Văn bản</button>');

// 8. Label create problem
content = content.replace(
    '<label class="form-label">Nội dung đề bài (LaTeX):</label>',
    '<label class="form-label">Nội dung đề bài (LaTeX và văn bản):</label>'
);

fs.writeFileSync(appJsPath, content, 'utf8');
console.log('Successfully updated tutor settings and stripped English annotations from app.js!');
