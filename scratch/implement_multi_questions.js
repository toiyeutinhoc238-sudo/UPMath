const fs = require('fs');
const path = require('path');

// 1. Update backend/server.js
const serverPath = path.join(__dirname, '../backend/server.js');
let serverContent = fs.readFileSync(serverPath, 'utf8');

const oldContestSchema = `const contestSchema = new mongoose.Schema({
    title: { type: String, required: true },
    duration: String,
    startTime: String,
    status: { type: String, enum: ['upcoming', 'running', 'ended'], default: 'upcoming' },
    content: { type: String, default: "" },
    category: { type: String, default: "calculus" },
    difficulty: { type: String, default: "medium" },
    points: { type: Number, default: 10 },
    tags: { type: [String], default: [] },
    gradingRubric: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now }
});`;

const newContestSchema = `const contestSchema = new mongoose.Schema({
    title: { type: String, required: true },
    duration: String,
    startTime: String,
    status: { type: String, enum: ['upcoming', 'running', 'ended'], default: 'upcoming' },
    content: { type: String, default: "" },
    questions: { type: [String], default: [] },
    category: { type: String, default: "calculus" },
    difficulty: { type: String, default: "medium" },
    points: { type: Number, default: 10 },
    tags: { type: [String], default: [] },
    gradingRubric: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now }
});`;

const oldContestSchemaLF = oldContestSchema.replace(/\r\n/g, '\n');
const serverContentLF = serverContent.replace(/\r\n/g, '\n');
if (serverContentLF.includes(oldContestSchemaLF)) {
    serverContent = serverContentLF.replace(oldContestSchemaLF, () => newContestSchema.replace(/\r\n/g, '\n'));
    fs.writeFileSync(serverPath, serverContent, 'utf8');
    console.log("Updated contestSchema in server.js");
}

// 2. Update app.js (Frontend)
const appPath = path.join(__dirname, '../app.js');
let appContent = fs.readFileSync(appPath, 'utf8');

// Update create-contest-form HTML template to support dynamic questions list container
const oldHtmlPart = `<div style="margin: 1.5rem 0 1rem 0; border-top: 1px dashed var(--border-color); padding-top: 1rem;">
                                 <h4 style="color: var(--accent-blue); font-size: 0.95rem; margin-bottom: 0.75rem;"><i class="fa-solid fa-file-pen"></i> Nội dung câu hỏi kỳ thi</h4>
                             </div>
                             <div class="form-group">
                                 <label class="form-label" for="c-content">Đề bài (LaTeX và văn bản):</label>
                                 <textarea id="c-content" class="form-textarea" style="min-height:120px;" required
                                     placeholder="Nhập nội dung đề bài thi. Ví dụ:&#10;Tính tích phân:&#10;$$I = \\int_0^1 x^2 e^x dx$$"></textarea>
                             </div>`;

const newHtmlPart = `<div style="margin: 1.5rem 0 1rem 0; border-top: 1px dashed var(--border-color); padding-top: 1rem;">
                                 <h4 style="color: var(--accent-blue); font-size: 0.95rem; margin-bottom: 0.75rem;"><i class="fa-solid fa-file-pen"></i> Nội dung câu hỏi kỳ thi</h4>
                             </div>
                             
                             <div id="c-questions-container">
                                 <div class="form-group c-question-item" data-index="1">
                                     <label class="form-label" style="font-weight: 600; color: var(--accent-orange);">Câu 1:</label>
                                     <textarea class="form-textarea c-question-content" style="min-height:90px;" required
                                         placeholder="Nhập nội dung đề bài cho Câu 1..."></textarea>
                                 </div>
                             </div>
                             
                             <div style="display: flex; gap: 1rem; margin-bottom: 1.5rem; margin-top: 0.5rem;">
                                 <button type="button" id="c-add-question-btn" class="btn btn-secondary btn-sm" style="flex: 1; padding: 0.5rem;"><i class="fa-solid fa-plus"></i> Thêm câu hỏi (Câu tiếp theo)</button>
                                 <button type="button" id="c-remove-question-btn" class="btn btn-secondary btn-sm" style="flex: 1; padding: 0.5rem; color: var(--accent-red); display: none;"><i class="fa-solid fa-trash-can"></i> Xóa câu cuối</button>
                             </div>`;

const oldHtmlPartLF = oldHtmlPart.replace(/\r\n/g, '\n');
const appContentLF = appContent.replace(/\r\n/g, '\n');
if (appContentLF.includes(oldHtmlPartLF)) {
    appContent = appContentLF.replace(oldHtmlPartLF, () => newHtmlPart.replace(/\r\n/g, '\n'));
    console.log("Updated HTML template for Contest questions");
}

// Update submit handler to collect dynamic questions list and prompt total count confirmation
const oldSubmitBlock = `            const content = document.getElementById("c-content").value.trim();
            const category = document.getElementById("c-category").value;
            const difficulty = document.getElementById("c-difficulty").value;
            const points = parseInt(document.getElementById("c-points").value) || 10;
            const tagsRaw = document.getElementById("c-tags").value;
            const tags = tagsRaw ? tagsRaw.split(",").map(t => t.trim()).filter(Boolean) : [];
            const gradingRubric = document.getElementById("c-rubric").value.trim();

            const confirmMsg = \`Bạn có chắc chắn muốn tạo kỳ thi này với thông tin sau?\\n\\n\` +
                               \`- Tiêu đề: \${title}\\n\` +
                               \`- Thời lượng: \${duration}\\n\` +
                               \`- Bắt đầu lúc: \${startTime}\\n\` +
                               \`- Trạng thái: \${statusLabel}\`;

            if (!confirm(confirmMsg)) return;

            try {
                await api.addContest({ title, duration, startTime, status, content, category, difficulty, points, tags, gradingRubric });`;

const newSubmitBlock = `            const category = document.getElementById("c-category").value;
            const difficulty = document.getElementById("c-difficulty").value;
            const points = parseInt(document.getElementById("c-points").value) || 10;
            const tagsRaw = document.getElementById("c-tags").value;
            const tags = tagsRaw ? tagsRaw.split(",").map(t => t.trim()).filter(Boolean) : [];
            const gradingRubric = document.getElementById("c-rubric").value.trim();

            // Collect questions
            const questionTextareas = document.querySelectorAll(".c-question-content");
            const questions = Array.from(questionTextareas).map(ta => ta.value.trim()).filter(Boolean);

            const confirmMsg = \`Bạn có chắc chắn muốn tạo kỳ thi này với thông tin sau?\\n\\n\` +
                               \`- Tiêu đề: \${title}\\n\` +
                               \`- Thời lượng: \${duration}\\n\` +
                               \`- Bắt đầu lúc: \${startTime}\\n\` +
                               \`- Trạng thái: \${statusLabel}\\n\` +
                               \`- Tổng số câu hỏi: \${questions.length} câu\`;

            if (!confirm(confirmMsg)) return;

            try {
                await api.addContest({ 
                    title, 
                    duration, 
                    startTime, 
                    status, 
                    content: questions[0] || "", 
                    questions, 
                    category, 
                    difficulty, 
                    points, 
                    tags, 
                    gradingRubric 
                });`;

const oldSubmitBlockLF = oldSubmitBlock.replace(/\r\n/g, '\n');
const appContentLF2 = appContent.replace(/\r\n/g, '\n');
if (appContentLF2.includes(oldSubmitBlockLF)) {
    appContent = appContentLF2.replace(oldSubmitBlockLF, () => newSubmitBlock.replace(/\r\n/g, '\n'));
    console.log("Updated Submit handler for Contest questions");
}

// Update viewContests() renderer to display all questions line-by-line
const oldViewContestsBlock = `                                   <div style="line-height: 1.7; font-size: 0.95rem; word-break: break-word;">
                                       \${preprocessLaTeX(c.content || "")}
                                   </div>`;

const newViewContestsBlock = `                                   <div style="line-height: 1.7; font-size: 0.95rem; word-break: break-word; display: flex; flex-direction: column; gap: 0.85rem;">
                                       \${c.questions && c.questions.length > 0 
                                           ? c.questions.map((q, idx) => \`
                                               <div style="background: rgba(255,255,255,0.015); padding: 0.85rem; border-radius: 6px; border-left: 3px solid var(--accent-orange); border-top: 1px solid var(--border-color); border-right: 1px solid var(--border-color); border-bottom: 1px solid var(--border-color);">
                                                   <strong style="color: var(--accent-orange); display: block; margin-bottom: 0.35rem; font-size: 0.9rem;">Câu \${idx + 1}:</strong>
                                                   <div style="line-height: 1.65;">\${preprocessLaTeX(q)}</div>
                                               </div>
                                             \`).join("")
                                           : \`<div>\${preprocessLaTeX(c.content || "")}</div>\`
                                       }
                                   </div>`;

const oldViewContestsBlockLF = oldViewContestsBlock.replace(/\r\n/g, '\n');
const appContentLF3 = appContent.replace(/\r\n/g, '\n');
if (appContentLF3.includes(oldViewContestsBlockLF)) {
    appContent = appContentLF3.replace(oldViewContestsBlockLF, () => newViewContestsBlock.replace(/\r\n/g, '\n'));
    console.log("Updated viewContests() questions renderer");
}

// Add event listeners initialization inside viewAdmin() function in app.js
// We can find where form submit handler is registered in app.js, and register add/remove question click handlers right above it!
const oldReg = `        // Add Contest submission
        document.getElementById("create-contest-form")?.addEventListener("submit"`;

const newReg = `        // Initialize dynamic question count
        let questionCount = 1;
        document.getElementById("c-add-question-btn")?.addEventListener("click", () => {
            questionCount++;
            const container = document.getElementById("c-questions-container");
            const div = document.createElement("div");
            div.className = "form-group c-question-item";
            div.setAttribute("data-index", questionCount);
            div.style.marginTop = "1rem";
            div.innerHTML = \`
                <label class="form-label" style="font-weight: 600; color: var(--accent-orange);">Câu \${questionCount}:</label>
                <textarea class="form-textarea c-question-content" style="min-height:90px;" required
                    placeholder="Nhập nội dung đề bài cho Câu \${questionCount}..."></textarea>
            \`;
            container.appendChild(div);
            document.getElementById("c-remove-question-btn").style.display = "block";
        });

        document.getElementById("c-remove-question-btn")?.addEventListener("click", () => {
            if (questionCount > 1) {
                const container = document.getElementById("c-questions-container");
                container.lastElementChild.remove();
                questionCount--;
                if (questionCount === 1) {
                    document.getElementById("c-remove-question-btn").style.display = "none";
                }
            }
        });

        // Add Contest submission
        document.getElementById("create-contest-form")?.addEventListener("submit"`;

const oldRegLF = oldReg.replace(/\r\n/g, '\n');
const appContentLF4 = appContent.replace(/\r\n/g, '\n');
if (appContentLF4.includes(oldRegLF)) {
    appContent = appContentLF4.replace(oldRegLF, () => newReg.replace(/\r\n/g, '\n'));
    console.log("Added Contest questions dynamic button listeners in app.js");
}

fs.writeFileSync(appPath, appContent, 'utf8');
console.log("Completed all changes successfully");
