const fs = require('fs');
const path = require('path');

const appJsPath = 'c:/Users/BRAVO 15/Downloads/web hoc toan/app.js';
let content = fs.readFileSync(appJsPath, 'utf8');

const startMarker = 'async function viewProblemDetail(id) {';
const endMarker = 'function commentHTML(c) {';

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex === -1) {
    console.error('Start marker not found!');
    process.exit(1);
}
if (endIndex === -1) {
    console.error('End marker not found!');
    process.exit(1);
}

console.log(`Replacing from index ${startIndex} to ${endIndex}...`);

const replacement = `async function viewProblemDetail(id) {
    setActiveNav("exercises");
    showLoading();
    try {
        const [problem, solutions, comments] = await Promise.all([
            api.getProblem(id), api.getSolutions(id), api.getComments('problem', id)
        ]);
        const user = getCurrentUser();

        // Check if user has liked/disliked the problem
        const pLikes = problem.likes ? problem.likes.length : 0;
        const pDislikes = problem.dislikes ? problem.dislikes.length : 0;
        const hasLikedProblem = user && problem.likes && problem.likes.includes(user.googleId);
        const hasDislikedProblem = user && problem.dislikes && problem.dislikes.includes(user.googleId);

        mainContent.innerHTML = \`
            <div class="page-header">
                <div>
                    <a href="#exercises" style="font-size:0.9rem;"><i class="fa-solid fa-arrow-left"></i> Quay lại kho bài tập</a>
                    <h2 class="page-title" style="margin-top:0.5rem;">\${preprocessLaTeX(problem.title)}</h2>
                </div>
                <span class="badge \${problem.category === 'calculus' ? 'badge-calculus' : 'badge-algebra'}" style="font-size:0.9rem;padding:0.4rem 0.8rem;">
                    <i class="fa-solid \${problem.category === 'calculus' ? 'fa-wave-square' : 'fa-table-cells'}"></i>
                    \${problem.category === 'calculus' ? 'Giải tích' : 'Đại số'}
                </span>
            </div>

            <div class="problem-page-layout">
                <!-- Left column: Problem card, Solutions, and Comments -->
                <div class="problem-left-col">
                    <div class="card" style="margin-bottom:0;">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
                            <div style="display:flex;align-items:center;gap:0.6rem;">
                                <a href="#profile/\${problem.creatorGoogleId}">\${avatarTag(problem.creatorPicture, problem.creator, 36)}</a>
                                <div>
                                    <strong><a href="#profile/\${problem.creatorGoogleId}" style="color:var(--text-primary); text-decoration:none; transition:color 0.2s;" onmouseover="this.style.color='var(--accent-blue)'" onmouseout="this.style.color='var(--text-primary)'">\${problem.creator}</a></strong>
                                    <div style="font-size:0.75rem;color:var(--text-muted);">\${timeSince(problem.createdAt)}</div>
                                </div>
                            </div>
                            <div style="display:flex;gap:0.4rem;flex-wrap:wrap;">
                                \${(problem.tags || []).map(t => \`<span class="badge badge-tag">\${t}</span>\`).join("")}
                            </div>
                        </div>
                        <div class="problem-content" style="margin-bottom: 1rem;">\${preprocessLaTeX(problem.content)}</div>
                        \${problem.imageUrl ? \`<img src="\${problem.imageUrl}" alt="Hình bài toán" style="max-width:100%;border-radius:8px;margin-top:1rem;margin-bottom:1rem;display:block;">\` : ''}
                        
                        <div style="margin-top:1rem;padding-top:1rem;border-top:1px solid var(--border-color);display:flex;justify-content:space-between;align-items:center;font-size:0.85rem;color:var(--text-muted);flex-wrap:wrap;gap:0.75rem;">
                            <div style="display:flex;gap:1rem;">
                                <span><i class="fa-solid fa-star" style="color:#f59e0b;"></i> \${problem.points} điểm thưởng</span>
                                \${problem.difficulty ? \`<span>\${{'easy':'🟢 Dễ','medium':'🟡 Trung bình','hard':'🔴 Khó','extreme':'⚡ Siêu khó'}[problem.difficulty] || ''}</span>\` : ''}
                                <span><i class="fa-solid fa-lightbulb"></i> \${solutions.length} lời giải</span>
                            </div>
                            <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
                                \${(user && (user.role === 'admin' || user.role === 'professor' || problem.creatorGoogleId === user.googleId)) ? \`
                                    <button class="btn btn-secondary btn-sm" id="edit-problem-btn" style="height:32px;padding:0.3rem 0.75rem;font-size:0.8rem;">
                                        <i class="fa-solid fa-pen-to-square"></i> Chỉnh sửa
                                    </button>
                                    <button class="btn btn-secondary btn-sm" id="delete-problem-btn" style="height:32px;padding:0.3rem 0.75rem;font-size:0.8rem;color:var(--accent-red);">
                                        <i class="fa-solid fa-trash"></i> Xóa đề bài
                                    </button>
                                \` : ''}
                                <button class="vote-btn \${hasLikedProblem ? 'active-like' : ''}" onclick="voteItem('problems', '\${problem._id}', 'like')">
                                    <i class="fa-solid fa-thumbs-up"></i> Thích <span>(\${pLikes})</span>
                                </button>
                                <button class="vote-btn \${hasDislikedProblem ? 'active-dislike' : ''}" onclick="voteItem('problems', '\${problem._id}', 'dislike')">
                                    <i class="fa-solid fa-thumbs-down"></i> Không thích <span>(\${pDislikes})</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    <div class="card">
                        <h3 style="margin-bottom:1.25rem;"><i class="fa-solid fa-lightbulb"></i> Lời giải (\${solutions.length})</h3>
                        <div id="solutions-box">
                            \${solutions.length === 0
                        ? '<p style="color:var(--text-muted);text-align:center;padding:1.5rem;">Chưa có lời giải. Hãy là người đầu tiên!</p>'
                        : solutions.map(s => \`
                                    <div class="card" style="margin-bottom:1rem;padding:1.25rem;">
                                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem;">
                                            <div style="display:flex;align-items:center;gap:0.6rem;">
                                                <a href="#profile/\${s.authorGoogleId}">\${avatarTag(s.authorPicture, s.author, 32)}</a>
                                                <div>
                                                    <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">
                                                        <strong style="font-size:0.92rem;"><a href="#profile/\${s.authorGoogleId}" style="color:var(--text-primary); text-decoration:none; transition:color 0.2s;" onmouseover="this.style.color='var(--accent-blue)'" onmouseout="this.style.color='var(--text-primary)'">\${s.author}</a></strong>
                                                        \${s.status === 'correct' ? \`
                                                            <span class="badge" style="background:rgba(16,185,129,0.1); color:#10b981; border:1px solid rgba(16,185,129,0.25); text-transform:none; font-size:0.68rem; padding:0.15rem 0.35rem; display:inline-flex; align-items:center; gap:0.25rem;">
                                                                <i class="fa-solid fa-circle-check"></i> Đúng
                                                            </span>
                                                        \` : s.status === 'incorrect' ? \`
                                                            <span class="badge" style="background:rgba(244,63,94,0.1); color:#f43f5e; border:1px solid rgba(244,63,94,0.25); text-transform:none; font-size:0.68rem; padding:0.15rem 0.35rem; display:inline-flex; align-items:center; gap:0.25rem;">
                                                                <i class="fa-solid fa-circle-xmark"></i> Sai
                                                            </span>
                                                        \` : \`
                                                            <span class="badge" style="background:rgba(251,146,60,0.1); color:#fb923c; border:1px solid rgba(251,146,60,0.25); text-transform:none; font-size:0.68rem; padding:0.15rem 0.35rem; display:inline-flex; align-items:center; gap:0.25rem;">
                                                                <i class="fa-solid fa-circle-question"></i> Chờ duyệt
                                                            </span>
                                                        \`}
                                                    </div>
                                                    <div style="font-size:0.72rem;color:var(--text-muted);">\${timeSince(s.createdAt)}</div>
                                                </div>
                                            </div>
                                            <div style="display:flex;align-items:center;gap:0.4rem;">
                                                \${(user && (user.role === 'admin' || user.role === 'professor' || problem.creatorGoogleId === user.googleId)) ? \`
                                                    <div style="display:inline-flex; gap:0.25rem; margin-right:0.25rem;">
                                                        <button class="btn btn-secondary btn-sm set-correct-btn" data-id="\${s._id}" title="Đánh dấu Đúng" style="padding:0.3rem 0.45rem; height:28px; color:#10b981; min-width:auto;">
                                                            <i class="fa-solid fa-check"></i>
                                                        </button>
                                                        <button class="btn btn-secondary btn-sm set-incorrect-btn" data-id="\${s._id}" title="Đánh dấu Sai" style="padding:0.3rem 0.45rem; height:28px; color:#f43f5e; min-width:auto;">
                                                            <i class="fa-solid fa-xmark"></i>
                                                        </button>
                                                    </div>
                                                \` : ''}
                                                \${(user && (user.role === 'admin' || user.role === 'professor' || s.authorGoogleId === user.googleId)) ? \`
                                                    <div style="display:inline-flex; gap:0.25rem; margin-right:0.25rem;">
                                                        <button class="btn btn-secondary btn-sm edit-sol-btn" data-id="\${s._id}" data-content="\${encodeURIComponent(s.content)}" data-has-image="\${!!s.imageUrl}" title="Chỉnh sửa lời giải" style="padding:0.3rem 0.45rem; height:28px; min-width:auto;">
                                                            <i class="fa-solid fa-pen"></i>
                                                        </button>
                                                        <button class="btn btn-secondary btn-sm delete-sol-btn" data-id="\${s._id}" title="Xóa lời giải" style="padding:0.3rem 0.45rem; height:28px; color:var(--accent-red); min-width:auto;">
                                                            <i class="fa-solid fa-trash"></i>
                                                        </button>
                                                    </div>
                                                \` : ''}
                                                <button class="btn btn-secondary btn-sm upvote-btn" data-id="\${s._id}" style="height:28px; padding:0.3rem 0.6rem;">
                                                    <i class="fa-solid fa-thumbs-up"></i> <span>\${s.votes}</span>
                                                </button>
                                            </div>
                                        </div>
                                        <div class="sol-body-container" id="sol-body-\${s._id}">
                                            <div style="margin-bottom:0.5rem; line-height:1.6;">\${preprocessLaTeX(s.content)}</div>
                                            \${s.imageUrl ? \`<img src="\${s.imageUrl}" alt="Ảnh lời giải" style="max-width:100%;max-height:400px;object-fit:contain;border-radius:8px;margin-top:0.75rem;display:block;">\` : ''}
                                            \${s.aiFeedback ? \`
                                                <div style="margin-top:0.75rem; padding:0.75rem 1rem; background:rgba(255,255,255,0.02); border:1px dashed var(--border-color); border-radius:6px; font-size:0.85rem; color:var(--text-muted);">
                                                    <div style="font-weight:600; color:var(--accent-blue); margin-bottom:0.25rem; display:flex; align-items:center; gap:0.35rem;">
                                                        <i class="fa-solid fa-robot"></i> Đánh giá từ AI Assistant:
                                                    </div>
                                                    <div>\${preprocessLaTeX(s.aiFeedback)}</div>
                                                </div>
                                            \` : ''}
                                        </div>
                                    </div>\`).join("")
                            }
                        </div>
                        
                        <div style="margin-top:2rem;padding-top:1.5rem;border-top:1px solid var(--border-color);">
                            <h4 style="margin-bottom:1rem;"><i class="fa-solid fa-pen-to-square"></i> Đăng lời giải của bạn</h4>
                            <form id="sol-form">
                                <div class="form-group">
                                    <label class="form-label">Chọn phương thức nhập lời giải:</label>
                                    <div class="input-modes" id="s-input-modes">
                                        <button type="button" class="btn btn-secondary mode-btn active" data-mode="latex"><i class="fa-solid fa-code"></i> LaTeX</button>
                                        <button type="button" class="btn btn-secondary mode-btn" data-mode="word"><i class="fa-solid fa-file-word"></i> Văn bản (Word)</button>
                                        <button type="button" class="btn btn-secondary mode-btn" data-mode="image"><i class="fa-solid fa-camera"></i> Chụp / Tải ảnh</button>
                                    </div>
                                </div>
                                
                                <div class="form-group" id="s-mode-latex-container">
                                    <label class="form-label">Nội dung lời giải (LaTeX & Text):</label>
                                    <textarea id="sol-content" class="form-textarea" style="min-height:180px;"
                                        placeholder="Nhập lời giải chi tiết. Ví dụ: $$\\int_0^1 x^2 dx = \\frac{1}{3}$$"></textarea>
                                </div>
                                
                                <div class="form-group" id="s-mode-word-container" style="display:none;">
                                    <label class="form-label">Soạn thảo văn bản:</label>
                                    <div id="s-quill-editor" style="min-height:180px;"></div>
                                </div>
                                
                                <div class="form-group" id="s-mode-image-container" style="display:none;">
                                    <label class="form-label">Tải lên hoặc chụp ảnh lời giải:</label>
                                    <div class="image-upload-zone" onclick="document.getElementById('s-image-file-input').click()">
                                        <i class="fa-solid fa-cloud-arrow-up fa-3x"></i>
                                        <p>Kéo thả ảnh hoặc click để chọn ảnh lời giải</p>
                                        <span>Chụp bài làm từ điện thoại hoặc tải ảnh chụp màn hình</span>
                                        <input type="file" id="s-image-file-input" accept="image/*" style="display: none;" onchange="handleImageFileSelect(this, 'solution')">
                                        <div id="s-image-upload-status" style="font-size: 0.82rem; color: var(--accent-blue); margin-top: 0.5rem; font-weight: 600;"></div>
                                        <div id="s-image-upload-preview"></div>
                                    </div>
                                </div>

                                <div style="margin-top:1.25rem;padding:1rem;background:rgba(99,102,241,0.07);border:1px solid rgba(99,102,241,0.2);border-radius:10px;">
                                    <div style="font-size:0.8rem;color:var(--text-muted);display:flex;align-items:center;gap:0.5rem;margin-bottom:0.85rem;">
                                        <i class="fa-solid fa-circle-info" style="color:#818cf8;"></i>
                                        <span>Chọn cách nộp bài: đăng để cộng đồng góp ý, hoặc nhờ AI Gemini chấm điểm ngay.</span>
                                    </div>
                                    <div style="display:flex;gap:0.75rem;justify-content:flex-end;flex-wrap:wrap;">
                                        <button type="submit" name="action" value="post" class="btn btn-secondary" style="display:flex;align-items:center;gap:0.4rem;">
                                            <i class="fa-solid fa-paper-plane"></i> Đăng lời giải
                                        </button>
                                        <button type="submit" name="action" value="grade" class="btn btn-primary" style="background:linear-gradient(135deg,#6366f1,#8b5cf6);border:none;font-weight:600;display:flex;align-items:center;gap:0.4rem;">
                                            <i class="fa-solid fa-robot"></i> Nộp bài &amp; Chấm tự động
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>

                    <div class="card">
                        <h3 style="margin-bottom:1.25rem;"><i class="fa-solid fa-comments"></i> Thảo luận (\${comments.length})</h3>
                        <div id="prob-comments">
                            \${comments.length === 0
                        ? '<p style="color:var(--text-muted);text-align:center;padding:1rem;">Chưa có bình luận.</p>'
                        : comments.map(c => commentHTML(c)).join("")}
                        </div>
                        <form id="prob-comment-form" style="display:flex;gap:0.5rem;margin-top:0.75rem;padding-top:0.75rem;border-top:1px solid var(--border-color);">
                            <input type="text" id="prob-comment-input" class="form-input" placeholder="Bình luận về bài toán này..." required>
                            <button type="submit" class="btn btn-secondary"><i class="fa-solid fa-paper-plane"></i></button>
                        </form>
                    </div>
                </div>

                <!-- Right column: Interactive AI Tutor Chatbox -->
                <div class="problem-right-col">
                    <div class="ai-tutor-card">
                        <div class="ai-tutor-header">
                            <h4 class="ai-tutor-title"><i class="fa-solid fa-robot"></i> Trợ lý Học tập AI</h4>
                            <div class="ai-tutor-tagline">Hướng dẫn từng bước (Socratic Method)</div>
                        </div>
                        <div class="ai-tutor-messages" id="ai-tutor-chat-messages">
                            <!-- Messages will render here -->
                        </div>
                        <div class="ai-tutor-hints">
                            <button type="button" class="ai-hint-btn" id="ai-hint-start"><i class="fa-regular fa-lightbulb"></i> Gợi ý bước đầu</button>
                            <button type="button" class="ai-hint-btn" id="ai-hint-formula"><i class="fa-solid fa-book"></i> Lý thuyết cần dùng</button>
                            <button type="button" class="ai-hint-btn" id="ai-hint-next"><i class="fa-solid fa-forward"></i> Gợi ý tiếp theo</button>
                        </div>
                        <form id="ai-tutor-chat-form" class="ai-tutor-input-area">
                            <input type="text" id="ai-tutor-chat-input" class="form-input" placeholder="Hỏi Trợ lý AI cách giải..." required autocomplete="off">
                            <button type="submit" class="btn btn-primary" style="min-width:auto;padding:0 0.85rem;"><i class="fa-solid fa-paper-plane"></i></button>
                        </form>
                    </div>
                </div>
            </div>\`;

        renderLaTeX(mainContent);

        // Reset solution image upload variables on entry
        s_uploadedImageBase64 = null;

        // Initialize Quill Editor if snow theme is loaded
        let sQuill = null;
        if (window.Quill) {
            sQuill = new Quill('#s-quill-editor', {
                theme: 'snow',
                placeholder: 'Soạn thảo lời giải của bạn tại đây...'
            });
        }

        // --- AI Tutor conversational logic state ---
        let problemChatMessages = [
            {
                role: "model",
                content: \`Chào **\${user ? user.username.split(' ')[0] : 'bạn'}**! Mình là Trợ lý Học tập AI. Nếu bạn chưa biết hướng giải bài tập này, hoặc muốn tìm hiểu các lý thuyết, công thức liên quan, hãy chat với mình nhé. Mình sẽ hướng dẫn từng bước (Socratic Method) để bạn tự giải được bài toán này! 😉\`
            }
        ];

        function renderTutorMessages() {
            const container = document.getElementById("ai-tutor-chat-messages");
            if (!container) return;
            container.innerHTML = problemChatMessages.map(m => \`
                <div class="ai-msg \${m.role === 'model' ? 'ai' : 'user'}">
                    <div class="ai-msg-avatar">
                        \${m.role === 'model'
                            ? \`<div style="background:rgba(99,102,241,0.1); width:24px; height:24px; display:flex; align-items:center; justify-content:center; border-radius:50%; color:var(--accent-blue); font-size:0.75rem;"><i class="fa-solid fa-robot"></i></div>\`
                            : \`<img src="\${user ? user.picture : 'https://avatar.iran.liara.run/public/1'}" alt="Avatar">\`
                        }
                    </div>
                    <div class="ai-msg-bubble">
                        \${preprocessLaTeX(m.content)}
                    </div>
                </div>
            \`).join("");
            renderLaTeX(container);
            container.scrollTop = container.scrollHeight;
        }

        async function sendTutorMessage(text) {
            problemChatMessages.push({ role: "user", content: text });
            renderTutorMessages();

            const container = document.getElementById("ai-tutor-chat-messages");
            const typingDiv = document.createElement("div");
            typingDiv.className = "ai-msg ai";
            typingDiv.innerHTML = \`
                <div class="ai-msg-avatar">
                    <div style="background:rgba(99,102,241,0.1); width:24px; height:24px; display:flex; align-items:center; justify-content:center; border-radius:50%; color:var(--accent-blue); font-size:0.75rem;"><i class="fa-solid fa-robot"></i></div>
                </div>
                <div class="ai-msg-bubble" style="color:var(--text-muted); font-style:italic;">
                    <i class="fa-solid fa-spinner fa-spin"></i> Đang suy nghĩ gợi ý...
                </div>
            \`;
            container?.appendChild(typingDiv);
            container.scrollTop = container.scrollHeight;

            try {
                const reply = await api.chatAiTutor(id, problemChatMessages);
                typingDiv.remove();
                problemChatMessages.push({ role: "model", content: reply.text });
                renderTutorMessages();
            } catch (err) {
                typingDiv.remove();
                problemChatMessages.push({ role: "model", content: "⚠️ Có lỗi xảy ra khi kết nối trợ lý AI. Vui lòng thử lại!" });
                renderTutorMessages();
            }
        }

        // Render initial welcome message
        renderTutorMessages();

        // AI Tutor Event Listeners
        document.getElementById("ai-tutor-chat-form")?.addEventListener("submit", async (e) => {
            e.preventDefault();
            const inp = document.getElementById("ai-tutor-chat-input");
            const val = inp.value.trim();
            if (!val) return;
            inp.value = "";
            await sendTutorMessage(val);
        });

        document.getElementById("ai-hint-start")?.addEventListener("click", () => {
            sendTutorMessage("Hãy gợi ý cho mình hướng giải hoặc bước đi đầu tiên của bài toán này.");
        });

        document.getElementById("ai-hint-formula")?.addEventListener("click", () => {
            sendTutorMessage("Hãy chỉ ra các công thức toán học và lý thuyết quan trọng cần biết để giải quyết bài toán này.");
        });

        document.getElementById("ai-hint-next")?.addEventListener("click", () => {
            sendTutorMessage("Mình muốn biết bước tiếp theo sau các định hướng cơ bản là gì.");
        });

        // Add event listeners for mode switcher
        document.querySelectorAll("#s-input-modes .mode-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                document.querySelectorAll("#s-input-modes .mode-btn").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                const mode = btn.getAttribute("data-mode");
                document.getElementById("s-mode-latex-container").style.display = mode === 'latex' ? 'block' : 'none';
                document.getElementById("s-mode-word-container").style.display = mode === 'word' ? 'block' : 'none';
                document.getElementById("s-mode-image-container").style.display = mode === 'image' ? 'block' : 'none';
            });
        });

        // Set solution status correct
        document.querySelectorAll(".set-correct-btn").forEach(btn => {
            btn.addEventListener("click", async () => {
                const sId = btn.getAttribute("data-id");
                try {
                    await api.updateSolutionStatus(sId, 'correct');
                    showToast("Đã duyệt lời giải Đúng! ✔️", "success");
                    viewProblemDetail(id);
                } catch (e) {
                    showToast("Lỗi khi duyệt lời giải: " + e.message, "error");
                }
            });
        });

        // Set solution status incorrect
        document.querySelectorAll(".set-incorrect-btn").forEach(btn => {
            btn.addEventListener("click", async () => {
                const sId = btn.getAttribute("data-id");
                try {
                    await api.updateSolutionStatus(sId, 'incorrect');
                    showToast("Đã đánh dấu lời giải Sai! ❌", "warning");
                    viewProblemDetail(id);
                } catch (e) {
                    showToast("Lỗi khi đánh dấu lời giải: " + e.message, "error");
                }
            });
        });

        // Upvote
        document.querySelectorAll(".upvote-btn").forEach(btn => {
            btn.addEventListener("click", async () => {
                try {
                    const updated = await api.upvoteSol(btn.getAttribute("data-id"));
                    btn.querySelector("span").textContent = updated.votes;
                    btn.style.color = "var(--accent-blue)";
                    showToast("Đã upvote! +5 điểm cho tác giả", "success");
                } catch { showToast("Không thể upvote!", "error"); }
            });
        });

        // Edit Problem button
        document.getElementById("edit-problem-btn")?.addEventListener("click", () => {
            viewEditProblem(problem);
        });

        // Delete Problem button
        document.getElementById("delete-problem-btn")?.addEventListener("click", async () => {
            if (confirm("Bạn có chắc chắn muốn xóa đề bài này cùng tất cả lời giải liên quan? Thao tác này không thể phục hồi!")) {
                try {
                    await api.deleteProblem(problem._id);
                    showToast("Đã xóa đề bài thành công! 🗑️", "success");
                    window.location.hash = "#exercises";
                } catch (e) {
                    showToast("Xóa đề bài thất bại: " + e.message, "error");
                }
            }
        });

        // Edit Solution button (inline edit)
        document.querySelectorAll(".edit-sol-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                const sId = btn.getAttribute("data-id");
                const originalContent = decodeURIComponent(btn.getAttribute("data-content"));
                
                const bodyDiv = document.getElementById(\`sol-body-\${sId}\`);
                if (!bodyDiv) return;

                const originalHTML = bodyDiv.innerHTML;

                bodyDiv.innerHTML = \`
                    <div style="margin-bottom:0.5rem;">
                        <textarea id="edit-sol-content-\${sId}" class="form-textarea" style="min-height:120px;width:100%;box-sizing:border-box;font-family:inherit;font-size:0.95rem;line-height:1.6;padding:0.5rem 0.75rem;">\${originalContent}</textarea>
                    </div>
                    <div style="font-size:0.76rem;color:var(--text-muted);margin-bottom:0.5rem;display:flex;align-items:center;gap:0.35rem;">
                        <i class="fa-solid fa-circle-info"></i>
                        <span>Ấn Lưu sẽ tự động nhờ AI Gemini chấm điểm và nhận xét lại bài làm.</span>
                    </div>
                    <div style="display:flex;justify-content:flex-end;gap:0.5rem;">
                        <button class="btn btn-secondary btn-sm cancel-edit-btn" style="height:30px;padding:0 0.75rem;font-size:0.8rem;">Hủy</button>
                        <button class="btn btn-primary btn-sm save-edit-btn" style="height:30px;padding:0 0.75rem;font-size:0.8rem;background:linear-gradient(135deg,#6366f1,#8b5cf6);border:none;font-weight:600;">Lưu &amp; Chấm lại</button>
                    </div>
                \`;

                // Bind Cancel click
                bodyDiv.querySelector(".cancel-edit-btn")?.addEventListener("click", () => {
                    bodyDiv.innerHTML = originalHTML;
                });

                // Bind Save click
                bodyDiv.querySelector(".save-edit-btn")?.addEventListener("click", async () => {
                    const newContent = document.getElementById(\`edit-sol-content-\${sId}\`).value.trim();
                    if (!newContent) {
                        showToast("Nội dung không được bỏ trống!", "warning");
                        return;
                    }

                    const saveBtn = bodyDiv.querySelector(".save-edit-btn");
                    saveBtn.disabled = true;
                    saveBtn.innerHTML = \`<i class="fa-solid fa-spinner fa-spin"></i> Đang chấm lại...\`;

                    try {
                        await api.updateSolution(sId, { content: newContent, skipGrading: false });
                        showToast("Đã cập nhật lời giải và AI đã chấm điểm lại! 🎉", "success");
                        viewProblemDetail(id);
                    } catch (err) {
                        showToast("Cập nhật thất bại: " + err.message, "error");
                        saveBtn.disabled = false;
                        saveBtn.innerHTML = "Lưu &amp; Chấm lại";
                    }
                });
            });
        });

        // Delete Solution button
        document.querySelectorAll(".delete-sol-btn").forEach(btn => {
            btn.addEventListener("click", async () => {
                const sId = btn.getAttribute("data-id");
                if (confirm("Bạn có chắc chắn muốn xóa lời giải này không?")) {
                    try {
                        await api.deleteSolution(sId);
                        showToast("Đã xóa lời giải thành công! 🗑️", "success");
                        viewProblemDetail(id);
                    } catch (e) {
                        showToast("Xóa lời giải thất bại: " + e.message, "error");
                    }
                }
            });
        });

        // Add solution
        document.getElementById("sol-form")?.addEventListener("submit", async (e) => {
            e.preventDefault();
            const user = getCurrentUser();
            if (!user) { showToast("Vui lòng đăng nhập!", "error"); return; }
            
            const activeBtn = document.querySelector("#s-input-modes .mode-btn.active");
            const mode = activeBtn ? activeBtn.getAttribute("data-mode") : 'latex';
            
            let content = "";
            let imageUrl = "";
            
            if (mode === 'latex') {
                content = document.getElementById("sol-content").value.trim();
                if (!content) { showToast("Vui lòng điền nội dung lời giải!", "warning"); return; }
            } else if (mode === 'word') {
                content = sQuill ? sQuill.root.innerHTML.trim() : "";
                if (content === "<p><br></p>" || !content) { showToast("Vui lòng soạn thảo lời giải!", "warning"); return; }
            } else if (mode === 'image') {
                content = "[Lời giải dạng hình ảnh]";
                imageUrl = s_uploadedImageBase64;
                if (!imageUrl) { showToast("Vui lòng tải lên hoặc chụp ảnh lời giải!", "warning"); return; }
            }

            const isGrading = e.submitter?.value === 'grade';

            const submitBtns = e.target.querySelectorAll("button[type='submit']");
            submitBtns.forEach(b => { b.disabled = true; });
            const gradeBtn = e.target.querySelector("button[value='grade']");
            const postBtn = e.target.querySelector("button[value='post']");
            const origGradeHTML = gradeBtn ? gradeBtn.innerHTML : '';
            const origPostHTML = postBtn ? postBtn.innerHTML : '';
            if (isGrading && gradeBtn) gradeBtn.innerHTML = \`<i class="fa-solid fa-spinner fa-spin"></i> AI đang chấm bài...\`;
            else if (postBtn) postBtn.innerHTML = \`<i class="fa-solid fa-spinner fa-spin"></i> Đang đăng...\`;
            if (isGrading) showToast("AI đang tiến hành chấm bài của bạn, vui lòng đợi trong giây lát...", "info");

            try {
                const solution = await api.addSolution({ problemId: id, author: user.username, authorPicture: user.picture, authorGoogleId: user.googleId, content, imageUrl, skipGrading: !isGrading });
                if (isGrading) {
                    if (solution.status === 'correct') {
                        showToast(\`AI chấm: Lời giải chính xác! Bạn được cộng +\${problem.points} điểm 🎉\`, "success");
                    } else if (solution.status === 'incorrect') {
                        showToast("AI chấm: Lời giải chưa chính xác! Hãy đọc kỹ nhận xét.", "warning");
                    } else {
                        showToast("Đã nộp bài. AI không chấm được, chờ giảng viên duyệt.", "info");
                    }
                } else {
                    showToast("Đã đăng lời giải! Mọi người có thể xem và góp ý. 💬", "success");
                }
                viewProblemDetail(id);
            } catch (err) {
                showToast("Đăng lời giải thất bại: " + err.message, "error");
            } finally {
                submitBtns.forEach(b => { b.disabled = false; });
                if (gradeBtn) gradeBtn.innerHTML = origGradeHTML;
                if (postBtn) postBtn.innerHTML = origPostHTML;
            }
        });

        // Add comment
        document.getElementById("prob-comment-form")?.addEventListener("submit", async (e) => {
            e.preventDefault();
            const user = getCurrentUser();
            if (!user) { showToast("Vui lòng đăng nhập!", "error"); return; }
            const content = document.getElementById("prob-comment-input").value.trim();
            try {
                await api.addComment({ targetType: 'problem', targetId: id, author: user.username, authorPicture: user.picture, authorGoogleId: user.googleId, content });
                showToast("Đã bình luận! +2 điểm", "success");
                viewProblemDetail(id);
            } catch { showToast("Bình luận thất bại!", "error"); }
        });

    } catch (e) { showError(\`Không thể tải bài toán: \${e.message}\`); }
}

`;

const updatedContent = content.substring(0, startIndex) + replacement + content.substring(endIndex);
fs.writeFileSync(appJsPath, updatedContent, 'utf8');
console.log('Successfully updated app.js!');
