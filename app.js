/* ==========================================================================
   UPMath Core Logic - SPA Router, MongoDB-backed API, KaTeX Integration
   ========================================================================== */

// ─── 0. GOOGLE AUTHENTICATION MODULE ─────────────────────────────────────────

const GOOGLE_CLIENT_ID = "114290400611-fnma9n755iluuniauu1563p0viioobkr.apps.googleusercontent.com";
const GOOGLE_USER_KEY = "upmath_google_user";
let replyToShout = null;
let editShoutId = null;

function decodeJwtPayload(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
            atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
        );
        return JSON.parse(jsonPayload);
    } catch (e) {
        console.error("JWT decode error:", e);
        return null;
    }
}

async function handleGoogleCredential(response) {
    const payload = decodeJwtPayload(response.credential);
    if (!payload) { showToast("Đăng nhập thất bại. Vui lòng thử lại!", "error"); return; }

    const googleUser = {
        username: payload.name,
        email: payload.email,
        picture: payload.picture,
        googleId: payload.sub,
        points: 0,
        rank: "Đồng"
    };

    try {
        const dbUser = await api.syncUser(googleUser);
        const merged = { ...googleUser, points: dbUser.points, rank: dbUser.rank, role: dbUser.role, _id: dbUser._id };
        localStorage.setItem(GOOGLE_USER_KEY, JSON.stringify(merged));
        showApp(merged);
        showToast(`Chào mừng ${merged.username.split(' ')[0]}! 🎉`, "success");
    } catch (err) {
        console.error("Sync user error:", err);
        localStorage.setItem(GOOGLE_USER_KEY, JSON.stringify(googleUser));
        showApp(googleUser);
        showToast(`Chào mừng! (Ngoại tuyến)`, "info");
    }
}

window.actualHandleGoogleCredential = handleGoogleCredential;
if (window._pendingGoogleResponse) {
    handleGoogleCredential(window._pendingGoogleResponse);
    delete window._pendingGoogleResponse;
}

function showApp(googleUser) {
    const overlay = document.getElementById("login-overlay");
    const appContainer = document.getElementById("app-container");
    if (overlay) { overlay.style.animation = "fadeOut 0.4s ease forwards"; setTimeout(() => { overlay.style.display = "none"; }, 400); }
    if (appContainer) { appContainer.style.display = ""; appContainer.style.animation = "fadeIn 0.4s ease"; }
    updateHeaderWithGoogle(googleUser);
    router();
}

function updateHeaderWithGoogle(u) {
    const fallback = `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(u.username)}`;
    const setImg = (el, src) => { if (!el) return; el.src = src; el.onerror = () => { el.src = fallback; }; };

    setImg(document.getElementById("header-avatar-img"), u.picture || fallback);
    setImg(document.getElementById("dropdown-avatar-img"), u.picture || fallback);

    const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setText("header-username", u.username.split(' ')[0]);
    setText("header-rank", u.rank || "Đồng");
    setText("dropdown-name", u.username);
    setText("dropdown-email", u.email);

    const adminBtn = document.getElementById("admin-panel-btn");
    if (adminBtn) {
        const isStaff = ['admin', 'professor', 'supporter'].includes(u.role);
        adminBtn.style.display = isStaff ? '' : 'none';
        adminBtn.innerHTML = u.role === 'admin' ? '<i class="fa-solid fa-lock"></i> Quản trị' : (u.role === 'professor' ? '<i class="fa-solid fa-graduation-cap"></i> Giảng viên' : '<i class="fa-solid fa-user-shield"></i> Hỗ trợ');
    }
}

async function refreshCurrentUser() {
    const user = getCurrentUser();
    if (!user) return;
    try {
        const freshUser = await api.getUser(user.googleId);
        const merged = { ...user, points: freshUser.points, rank: freshUser.rank, role: freshUser.role };
        localStorage.setItem(GOOGLE_USER_KEY, JSON.stringify(merged));
        updateHeaderWithGoogle(merged);

        // Immediately update profile sidebar and banner elements if visible on the screen
        const sidebarPoints = document.getElementById("sidebar-points");
        if (sidebarPoints) sidebarPoints.textContent = (freshUser.points || 0).toLocaleString();

        const sidebarRank = document.getElementById("sidebar-rank");
        if (sidebarRank) sidebarRank.textContent = freshUser.rank || "Đồng";

        const bannerRank = document.getElementById("banner-rank");
        if (bannerRank) bannerRank.textContent = freshUser.rank || "Đồng";

        const sidebarNextInfo = document.getElementById("sidebar-nextInfo");
        if (sidebarNextInfo && typeof getNextRankInfo === 'function') {
            const nextInfo = getNextRankInfo(freshUser.points || 0);
            sidebarNextInfo.innerHTML = nextInfo.nextName === 'Tối đa' ? 'Tối đa' : `<span style="color:#a855f7;font-weight:600;">${nextInfo.nextName}</span><br><span style="font-size:0.75rem;color:var(--text-muted);">thiếu <strong>${nextInfo.diff}</strong> điểm</span>`;
        }
    } catch (err) {
        console.error("Failed to refresh user stats:", err);
    }
}

function toggleUserDropdown() {
    document.getElementById("user-dropdown")?.classList.toggle("open");
}

document.addEventListener("click", (e) => {
    const menu = document.getElementById("user-profile-menu");
    const dd = document.getElementById("user-dropdown");
    if (menu && dd && !menu.contains(e.target)) dd.classList.remove("open");
});

function logoutGoogle() {
    const u = getCurrentUser();
    if (window.google?.accounts?.id && u?.email) google.accounts.id.revoke(u.email, () => { });
    localStorage.removeItem(GOOGLE_USER_KEY);
    document.getElementById("user-dropdown")?.classList.remove("open");
    const overlay = document.getElementById("login-overlay");
    const appContainer = document.getElementById("app-container");
    if (overlay) { overlay.style.animation = ""; overlay.style.display = "flex"; }
    if (appContainer) appContainer.style.display = "none";
    setTimeout(renderLoginMath, 150);
    showToast("Đã đăng xuất!", "info");
}

function renderLoginMath() {
    const bg = document.getElementById("login-math-bg");
    if (!bg) return;

    bg.innerHTML = "";

    const items = [
        "0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
        "\\sum", "\\int", "\\pi", "\\infty", "\\sqrt{x}", "\\theta",
        "x^2 + y^2 = z^2", "f(x)", "\\Delta", "\\lim_{n \\to \\infty}",
        "A \\cup B", "x \\in \\mathbb{R}", "\\log(x)", "\\sin(x)",
        "\\vec{v}", "\\lambda", "\\approx", "\\neq", "\\frac{d}{dx}"
    ];

    for (let i = 0; i < 35; i++) {
        const item = document.createElement("span");
        item.className = "math-bg-item";

        const content = items[Math.floor(Math.random() * items.length)];
        item.innerHTML = `$${content}$`;

        item.style.left = `${Math.random() * 95}%`;
        item.style.top = `${Math.random() * 95}%`;

        const size = 0.9 + Math.random() * 1.1;
        item.style.fontSize = `${size}rem`;

        item.style.opacity = `${0.12 + Math.random() * 0.12}`;

        const duration = 15 + Math.random() * 20;
        item.style.animationDuration = `${duration}s`;
        item.style.animationDelay = `${-Math.random() * 20}s`;

        bg.appendChild(item);
    }

    if (window.MathJax) {
        MathJax.typesetPromise([bg]).catch((err) => console.log("MathJax bg error:", err));
    }
}

function getCurrentUser() {
    const s = localStorage.getItem(GOOGLE_USER_KEY);
    return s ? JSON.parse(s) : null;
}

function checkAuthAndBoot() {
    const stored = localStorage.getItem(GOOGLE_USER_KEY);
    if (stored) {
        showApp(JSON.parse(stored));
        refreshCurrentUser(); // Sync points and rank in background
    } else {
        document.getElementById("login-overlay").style.display = "flex";
        document.getElementById("app-container").style.display = "none";
        setTimeout(renderLoginMath, 500);
    }
}

// Inject fadeOut keyframe
const _fadeStyle = document.createElement("style");
_fadeStyle.textContent = "@keyframes fadeOut { from{opacity:1} to{opacity:0} }";
document.head.appendChild(_fadeStyle);

// ─── 1. MONGODB API CLIENT ────────────────────────────────────────────────────

const API_BASE = window.location.origin.includes("localhost") || window.location.origin.includes("127.0.0.1")
    ? 'http://localhost:3000/api'
    : 'https://upmath.onrender.com/api';

const api = {
    async _req(method, path, body) {
        const opts = { method, headers: { 'Content-Type': 'application/json' } };
        if (body) opts.body = JSON.stringify(body);
        const res = await fetch(`${API_BASE}${path}`, opts);
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `HTTP ${res.status}`); }
        return res.json();
    },

    // Problems
    getProblems: (cat) => api._req('GET', cat && cat !== 'all' ? `/problems?category=${cat}` : '/problems'),
    getProblem: (id) => api._req('GET', `/problems/${id}`),
    addProblem: (data) => api._req('POST', '/problems', data),
    updateProblem: (id, data) => api._req('PUT', `/problems/${id}`, data),
    deleteProblem: (id) => api._req('DELETE', `/problems/${id}`),
    generateProblem: (data) => api._req('POST', '/ai-tutor/generate-problem', data),
    createSimilarProblem: (id, data) => api._req('POST', `/problems/${id}/similar`, data),

    // Solutions
    getSolutions: (pid) => api._req('GET', `/solutions?problemId=${pid}`),
    addSolution: (data) => api._req('POST', '/solutions', data),
    updateSolution: (id, data) => api._req('PUT', `/solutions/${id}`, data),
    deleteSolution: (id) => api._req('DELETE', `/solutions/${id}`),
    upvoteSol: (id) => api._req('PUT', `/solutions/${id}/upvote`),

    // Discussions
    getDiscussions: () => api._req('GET', '/discussions'),
    getDiscussion: (id) => api._req('GET', `/discussions/${id}`),
    addDiscussion: (data) => api._req('POST', '/discussions', data),

    // Comments
    getComments: (type, tid) => api._req('GET', `/comments?targetType=${type}&targetId=${tid}`),
    addComment: (data) => api._req('POST', '/comments', data),

    // Shouts
    getShouts: () => api._req('GET', '/shouts'),
    addShout: (data) => api._req('POST', '/shouts', data),
    reactShout: (id, data) => api._req('PUT', `/shouts/${id}/react`, data),
    updateShout: (id, data) => api._req('PUT', `/shouts/${id}`, data),
    deleteShout: (id, googleId) => api._req('DELETE', `/shouts/${id}?googleId=${googleId}`),
    chatAiTutor: (problemId, messages) => api._req('POST', '/ai-tutor', { problemId, messages }),

    // Users
    getUsers: () => api._req('GET', '/users'),
    syncUser: (data) => api._req('POST', '/users/sync', data),
    getUser: (gid) => api._req('GET', `/users/${gid}`),
    addPoints: (gid, amt) => api._req('PUT', `/users/${gid}/points`, { amount: amt }),
    getUserProblems: (gid) => api._req('GET', `/users/${gid}/problems`),
    getUserSolutions: (gid) => api._req('GET', `/users/${gid}/solutions`),
    updateProfile: (gid, data) => api._req('PUT', `/users/${gid}/profile`, data),
    updateSolutionStatus: (id, status) => api._req('PUT', `/solutions/${id}/status`, { status }),
    updateRole: (gid, role) => api._req('PUT', `/users/${gid}/role`, { role }),

    // Contests & Stats
    getContests: () => api._req('GET', '/contests'),
    addContest: (data) => api._req('POST', '/contests', data),
    deleteContest: (id) => api._req('DELETE', `/contests/${id}`),
    registerContest: (id, data) => api._req('POST', `/contests/${id}/register`, data),
    updateContest: (id, data) => api._req('PUT', `/contests/${id}`, data),
    deleteProblem: (id) => api._req('DELETE', `/problems/${id}`),
    getStats: () => api._req('GET', '/stats'),

    // Likes/Dislikes
    vote: (type, id, googleId, action) => api._req('PUT', `/${type}/${id}/${action}`, { googleId }),
};

// ─── 2. THEMING ───────────────────────────────────────────────────────────────

const themeBtn = document.getElementById("theme-toggle");
const loginThemeBtn = document.getElementById("login-theme-toggle");
const bodyEl = document.body;
const savedTheme = localStorage.getItem("upmath_theme") || "dark-theme";

// Apply the saved theme immediately
bodyEl.className = savedTheme;

// Function to update the icons of all theme buttons based on active theme
function updateThemeIcons(theme) {
    const isDark = theme === "dark-theme";
    const newIconClass = isDark ? "fa-solid fa-sun" : "fa-solid fa-moon";

    if (themeBtn) {
        const icon = themeBtn.querySelector("i");
        if (icon) icon.className = newIconClass;
    }
    if (loginThemeBtn) {
        const icon = loginThemeBtn.querySelector("i");
        if (icon) icon.className = newIconClass;
    }
}

// Initial icon setup
updateThemeIcons(savedTheme);

function toggleTheme() {
    const isDark = bodyEl.classList.contains("dark-theme");
    const nextTheme = isDark ? "light-theme" : "dark-theme";
    bodyEl.className = nextTheme;
    localStorage.setItem("upmath_theme", nextTheme);
    updateThemeIcons(nextTheme);
}

if (themeBtn) themeBtn.addEventListener("click", toggleTheme);
if (loginThemeBtn) loginThemeBtn.addEventListener("click", toggleTheme);

// ─── 3. HELPERS ───────────────────────────────────────────────────────────────

const mainContent = document.getElementById("app-content");

function setActiveNav(route) {
    document.querySelectorAll(".app-nav .nav-item").forEach(el =>
        el.classList.toggle("active", el.getAttribute("data-route") === route)
    );
}

function showToast(msg, type = "info") {
    const c = document.getElementById("toast-container");
    if (!c) return;
    const t = document.createElement("div");
    t.className = `toast toast-${type}`;
    const icons = { success: "fa-check-circle", error: "fa-exclamation-circle", warning: "fa-exclamation-triangle", info: "fa-info-circle" };
    t.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i><span>${msg}</span>`;
    c.appendChild(t);
    setTimeout(() => t.classList.add("show"), 10);
    setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 300); }, 3500);
}

function renderLaTeX(el) {
    if (window.MathJax && el) {
        try {
            MathJax.typesetClear([el]);
            MathJax.typesetPromise([el]).catch((err) => console.log("MathJax error:", err));
        } catch (e) {
            MathJax.typesetPromise([el]).catch((err) => console.log("MathJax error:", err));
        }
    }
}

function preprocessLaTeX(text) {
    if (!text) return "";

    // Clean trailing quote from AI response formatting errors
    text = text.trim();
    if (text.endsWith('"') && !text.endsWith('\\\"')) {
        text = text.slice(0, -1).trim();
    }

    // Convert double-escaped backslash-n to actual newlines, but only if they are not part of LaTeX commands (not followed by letters)
    text = text.replace(/\\n(?![a-z])/g, "\n").replace(/\\r(?![a-z])/g, "\r");

    // Convert double backslashes before LaTeX commands, brackets, or parenthesis to single backslash
    text = text.replace(/\\+([a-zA-Z\[\]\(\)])/g, (m, p1) => "\\" + p1);

    // Clean blank lines (double newlines) inside \[ ... \] and $$ ... $$ blocks to prevent KaTeX parsing errors
    text = text.replace(/\\\[([\s\S]*?)\\\]/g, (m, p1) => {
        const cleaned = p1.split('\n').filter(line => line.trim() !== '').join('\n');
        return `\\[${cleaned}\\]`;
    });
    text = text.replace(/\$\$([\s\S]*?)\$\$/g, (m, p1) => {
        const cleaned = p1.split('\n').filter(line => line.trim() !== '').join('\n');
        return `$$${cleaned}$$`;
    });

    // Convert markdown-style headings (## Heading) from AI responses
    text = text.replace(/^###\s+(.+)$/gm, '<h4 style="margin: 0.85rem 0 0.4rem; font-size: 1rem; color: var(--accent-blue); font-weight:700;">$1</h4>');
    text = text.replace(/^##\s+(.+)$/gm, '<h3 style="margin: 1rem 0 0.5rem; font-size: 1.15rem; color: var(--accent-blue); font-weight:700;">$1</h3>');
    text = text.replace(/^#\s+(.+)$/gm, '<h2 style="margin: 1.1rem 0 0.6rem; font-size: 1.3rem; color: var(--accent-blue); font-weight:700;">$1</h2>');

    // 1. Strip LaTeX comments
    let lines = text.split("\n");
    lines = lines.map(line => {
        let idx = -1;
        for (let i = 0; i < line.length; i++) {
            if (line[i] === '%' && (i === 0 || line[i - 1] !== '\\')) {
                idx = i;
                break;
            }
        }
        if (idx !== -1) return line.substring(0, idx);
        return line;
    });
    text = lines.join("\n");

    // 2. LaTeX Headings
    text = text.replace(/\\subsubsection\*?\{([^}]+)\}/g, '<h4 style="margin: 0.85rem 0 0.5rem; font-size: 1.15rem; color: var(--accent-blue); font-weight:600;">$1</h4>');
    text = text.replace(/\\subsection\*?\{([^}]+)\}/g, '<h3 style="margin: 1.1rem 0 0.65rem; font-size: 1.3rem; color: var(--accent-blue); font-weight:600;">$1</h3>');

    // Bold & Italic (LaTeX style & Markdown style)
    text = text.replace(/\\textbf\{([^}]+)\}/g, '<strong>$1</strong>');
    text = text.replace(/\\textit\{([^}]+)\}/g, '<em>$1</em>');
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // 3. Remove unsupported formatting/spaces commands
    text = text.replace(/\\noindent/g, "");

    // 4. Minipages
    text = text.replace(/\\begin\{minipage\}(\{[^}]*\})?(\{[^}]*\})?/g, '<div style="display:inline-block; vertical-align:top; width: 100%;">');
    text = text.replace(/\\end\{minipage\}/g, '</div>');

    // 5. Lists (enumerate & itemize)
    text = text.replace(/\\begin\{enumerate\}/g, '<ol style="margin-left: 1.8rem; list-style-type: decimal; margin-bottom: 0.75rem; display: flex; flex-direction: column; gap: 0.5rem;">');
    text = text.replace(/\\end\{enumerate\}/g, '</li></ol>');
    text = text.replace(/\\begin\{itemize\}/g, '<ul style="margin-left: 1.8rem; list-style-type: disc; margin-bottom: 0.75rem; display: flex; flex-direction: column; gap: 0.5rem;">');
    text = text.replace(/\\end\{itemize\}/g, '</li></ul>');

    let parts = text.split(/\\item/g);
    if (parts.length > 1) {
        let newText = parts[0];
        for (let i = 1; i < parts.length; i++) {
            let prev = parts[i - 1].trim();
            if (prev.endsWith('">') || prev.endsWith('ul>') || prev.endsWith('ol>')) {
                newText += "<li>" + parts[i];
            } else {
                newText += "</li><li>" + parts[i];
            }
        }
        text = newText;
    }
    text = text.replace(/<li>\\s*<\/li>/g, "");

    // 6. Convert newlines / double backslashes while respecting math delimiters
    let segs = text.split(/(\$\$[\s\S]*?\$\$|\$[^$\n]+?\$|\\\\\[[\s\S]*?\\\\]|\\\\\([\s\S]*?\\\\\))/);
    for (let i = 0; i < segs.length; i++) {
        // Even-indexed segments are outside math
        if (i % 2 === 0) {
            segs[i] = segs[i].replace(/\\\\/g, "<br>");
            segs[i] = segs[i].replace(/\n{2,}/g, "</p><p style='margin-top:0.6rem'>");
            segs[i] = segs[i].replace(/\n/g, "<br>");
        }
    }
    text = segs.join("");

    return text;
}

function showLoading() {
    if (mainContent) mainContent.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;min-height:300px;color:var(--text-muted);gap:0.75rem;font-size:1rem;">
            <i class="fa-solid fa-spinner fa-spin fa-lg"></i> Đang tải...
        </div>`;
}

function showError(msg) {
    if (mainContent) mainContent.innerHTML = `
        <div class="card" style="text-align:center;padding:3rem;">
            <i class="fa-solid fa-triangle-exclamation fa-2x" style="color:var(--accent-red);margin-bottom:1rem;"></i>
            <p style="color:var(--text-muted);">${msg}</p>
            <button class="btn btn-secondary" onclick="router()" style="margin-top:1rem;">
                <i class="fa-solid fa-rotate-right"></i> Thử lại
            </button>
        </div>`;
}

function timeSince(dateStr) {
    const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
    if (diff < 60) return `${diff} giây trước`;
    if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
    return new Date(dateStr).toLocaleDateString('vi-VN');
}

function avatarTag(picture, name, size = 32) {
    const fb = `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(name)}`;
    return `<img src="${picture || fb}" alt="${name}" 
                 style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;"
                 onerror="this.src='${fb}'">`;
}

// Image Upload & Vote system globals
let p_uploadedImages = [];
let s_uploadedImages = [];

function handleImageFileSelect(input, type) {
    const files = input.files;
    if (!files || files.length === 0) return;

    const statusId = type === 'problem' ? 'p-image-upload-status' : 's-image-upload-status';
    const statusEl = document.getElementById(statusId);
    if (statusEl) statusEl.textContent = "Đang xử lý các ảnh...";

    let loadedCount = 0;
    const currentFiles = Array.from(files);
    
    currentFiles.forEach(file => {
        if (!file.type.startsWith('image/')) {
            loadedCount++;
            return;
        }

        const reader = new FileReader();
        reader.onload = function (e) {
            const base64 = e.target.result;
            if (type === 'problem') {
                p_uploadedImages.push(base64);
            } else {
                s_uploadedImages.push(base64);
            }
            loadedCount++;
            if (loadedCount === currentFiles.length) {
                const total = type === 'problem' ? p_uploadedImages.length : s_uploadedImages.length;
                if (statusEl) statusEl.textContent = `Tải lên thành công! Tổng số: ${total} ảnh.`;
                renderImagePreviews(type);
            }
        };
        reader.readAsDataURL(file);
    });
    
    // Reset file input value to allow selecting the same files again
    input.value = "";
}

function renderImagePreviews(type) {
    const previewId = type === 'problem' ? 'p-image-upload-preview' : 's-image-upload-preview';
    const previewEl = document.getElementById(previewId);
    if (!previewEl) return;

    const list = type === 'problem' ? p_uploadedImages : s_uploadedImages;
    
    if (list.length === 0) {
        previewEl.innerHTML = "";
        return;
    }

    previewEl.style.display = "flex";
    previewEl.style.flexWrap = "wrap";
    previewEl.style.gap = "0.75rem";
    previewEl.style.marginTop = "0.75rem";

    previewEl.innerHTML = list.map((base64, index) => `
        <div style="position:relative; width:90px; height:90px; border: 1px solid var(--border-color); border-radius:8px; overflow:hidden; background:var(--bg-input);">
            <img src="${base64}" style="width:100%; height:100%; object-fit:cover;">
            <button type="button" onclick="removeUploadedImage('${type}', ${index})" style="position:absolute; top:4px; right:4px; background:rgba(239,68,68,0.95); color:white; border:none; border-radius:50%; width:18px; height:18px; font-size:0.6rem; display:flex; align-items:center; justify-content:center; cursor:pointer;" title="Gỡ ảnh">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>
    `).join("");
}

function removeUploadedImage(type, index) {
    if (type === 'problem') {
        p_uploadedImages.splice(index, 1);
    } else {
        s_uploadedImages.splice(index, 1);
    }
    renderImagePreviews(type);
    
    const statusId = type === 'problem' ? 'p-image-upload-status' : 's-image-upload-status';
    const statusEl = document.getElementById(statusId);
    if (statusEl) {
        const list = type === 'problem' ? p_uploadedImages : s_uploadedImages;
        statusEl.textContent = list.length > 0 ? `Đã cập nhật danh sách ảnh (${list.length} ảnh)` : "";
    }
}

window.removeUploadedImage = removeUploadedImage;

async function voteItem(type, id, action) {
    const user = getCurrentUser();
    if (!user) {
        showToast("Vui lòng đăng nhập để bình chọn!", "warning");
        return;
    }
    try {
        await api.vote(type, id, user.googleId, action);
        showToast(action === 'like' ? "Đã thích! 👍" : "Đã không thích! 👎", "success");
        await router(); // Reload view
    } catch (err) {
        showToast("Bình chọn thất bại: " + err.message, "error");
    }
}

// Bind to window for global access from HTML event handlers
window.handleImageFileSelect = handleImageFileSelect;
window.voteItem = voteItem;

// ======= IMAGE LIGHTBOX GLOBAL FUNCTIONS =======
window.openLightbox = function(src, alt = "") {
    const modal = document.getElementById("image-lightbox");
    const modalImg = document.getElementById("lightbox-img");
    const captionText = document.getElementById("lightbox-caption");
    if (modal && modalImg) {
        modal.style.display = "flex";
        modalImg.src = src;
        if (captionText) captionText.textContent = alt;
        modalImg.onclick = function(e) { e.stopPropagation(); };
    }
};

window.closeLightbox = function() {
    const modal = document.getElementById("image-lightbox");
    if (modal) modal.style.display = "none";
};

// ─── 4. SIDEBARS ──────────────────────────────────────────────────────────────

async function renderSidebars() {
    try {
        const [problems, discussions, stats, contests] = await Promise.all([
            api.getProblems(), api.getDiscussions(), api.getStats(), api.getContests()
        ]);

        // Left — recent problems
        const lpEl = document.getElementById("new-problems-list");
        if (lpEl) {
            lpEl.innerHTML = problems.slice(0, 5).map(p => `
                <a href="#problem/${p._id}" class="sidebar-item">
                    <div class="sidebar-item-title">${preprocessLaTeX(p.title)}</div>
                    <div class="sidebar-item-meta">
                        <span class="badge ${p.category === 'calculus' ? 'badge-calculus' : 'badge-algebra'}">
                            ${p.category === 'calculus' ? 'Giải tích' : 'Đại số'}
                        </span>
                        <span>${timeSince(p.createdAt)}</span>
                    </div>
                </a>`).join("") || '<p style="color:var(--text-muted);font-size:0.85rem;text-align:center;padding:1rem;">Chưa có bài tập</p>';
        }

        // Right — contests
        const cEl = document.getElementById("upcoming-contests-list");
        if (cEl) {
            const uc = contests.filter(c => c.status !== 'ended').slice(0, 3);
            cEl.innerHTML = uc.map(c => `
                <div class="sidebar-item">
                    <div class="sidebar-item-title">${preprocessLaTeX(c.title)}</div>
                    <div class="sidebar-item-meta">
                        <span><i class="fa-solid fa-clock"></i> ${c.duration}</span>
                        <span class="badge ${c.status === 'running' ? 'badge-calculus' : 'badge-tag'}">
                            ${c.status === 'running' ? '🔴 Đang diễn ra' : c.startTime}
                        </span>
                    </div>
                </div>`).join("") || '<p style="color:var(--text-muted);font-size:0.85rem;text-align:center;padding:1rem;">Chưa có kỳ thi</p>';
        }

        // Right — discussions
        const dEl = document.getElementById("new-discussions-list");
        if (dEl) {
            dEl.innerHTML = discussions.slice(0, 3).map(d => `
                <a href="#discussion/${d._id}" class="sidebar-item">
                    <div class="sidebar-item-title">${preprocessLaTeX(d.title)}</div>
                    <div class="sidebar-item-meta">
                        <span class="badge badge-tag">${d.category}</span>
                        <span><i class="fa-regular fa-comment"></i> ${d.replies}</span>
                    </div>
                </a>`).join("") || '<p style="color:var(--text-muted);font-size:0.85rem;text-align:center;padding:1rem;">Chưa có thảo luận</p>';
        }

        // Stats
        [['total-problems-count', stats.problems],
        ['total-solutions-count', stats.solutions],
        ['total-members-count', stats.users]].forEach(([id, val]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val ?? 0;
        });

        // Render LaTeX in sidebars
        if (lpEl) renderLaTeX(lpEl);
        if (cEl) renderLaTeX(cEl);
        if (dEl) renderLaTeX(dEl);
    } catch (e) {
        console.warn("Sidebar load error:", e.message);
    }
}

// ─── 5. PAGE VIEWS ────────────────────────────────────────────────────────────

// ── HOME ──────────────────────────────────────────────────────────────────────
async function viewHome() {
    setActiveNav("home");
    const user = getCurrentUser();
    const canSendAnnounce = user && ['admin', 'professor'].includes(user.role);

    mainContent.innerHTML = `
        <div class="card home-announcement-card">
            <div class="announcement-icon"><i class="fa-solid fa-graduation-cap"></i></div>
            <h2 style="margin-bottom:0.5rem;font-weight:700;">UPMath — Nơi bạn tìm thấy cảm hứng học Toán</h2>
            <p class="announcement-text">
                Nền tảng học tập dành riêng cho sinh viên học phần <strong>COMP1800 — Cơ sở Toán học trong CNTT</strong> tại HCMUE.
                Soạn đề toán bằng mã <strong>LaTeX</strong>, đăng lời giải và thảo luận cùng cộng đồng.
            </p>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
            <a href="#exercises" onclick="event.preventDefault();viewExercises('calculus');"
               class="card subject-card subject-card-calculus" style="text-decoration:none;display:block;cursor:pointer;">
                <div class="subject-card-icon"><i class="fa-solid fa-wave-square"></i></div>
                <h3 class="subject-card-title">Giải Tích</h3>
                <p class="subject-card-desc">Dãy số &amp; giới hạn, đạo hàm, tích phân, chuỗi số và ứng dụng tối ưu hóa CNTT.</p>
                <div class="subject-card-chapters">
                    <span class="badge badge-calculus">Dãy số</span>
                    <span class="badge badge-calculus">Giới hạn</span>
                    <span class="badge badge-calculus">Đạo hàm</span>
                    <span class="badge badge-calculus">Tích phân</span>
                    <span class="badge badge-calculus">Chuỗi số</span>
                </div>
            </a>
            <a href="#exercises" onclick="event.preventDefault();viewExercises('algebra');"
               class="card subject-card subject-card-algebra" style="text-decoration:none;display:block;cursor:pointer;">
                <div class="subject-card-icon"><i class="fa-solid fa-table-cells"></i></div>
                <h3 class="subject-card-title">Đại Số Tuyến Tính</h3>
                <p class="subject-card-desc">Ma trận, định thức, hệ PT tuyến tính, không gian vector và trị riêng.</p>
                <div class="subject-card-chapters">
                    <span class="badge badge-algebra">Ma trận</span>
                    <span class="badge badge-algebra">Định thức</span>
                    <span class="badge badge-algebra">Hệ PT</span>
                    <span class="badge badge-algebra">Vector</span>
                    <span class="badge badge-algebra">Trị riêng</span>
                </div>
            </a>
        </div>

        <div class="card shoutbox-card">
            <div class="shoutbox-header">
                <h3 class="card-title shoutbox-title"><i class="fa-solid fa-comment-dots"></i> Shoutbox cộng đồng</h3>
            </div>
            <div class="shoutbox-messages" id="shoutbox-container">
                <div style="text-align:center;padding:1rem;color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i></div>
            </div>
            <form id="shoutbox-form" class="shoutbox-input-area">
                <div class="input-group">
                    <input type="text" id="shoutbox-input" class="form-input"
                           placeholder="Nhập tin nhắn..." required autocomplete="off">
                </div>
                <button type="submit" class="btn btn-primary"><i class="fa-solid fa-paper-plane"></i> Gửi</button>
                ${canSendAnnounce ? `
                <div style="width: 100%; display: flex; align-items: center; gap: 0.5rem; margin-top: 0.25rem; font-size: 0.85rem; color: var(--text-muted);">
                    <input type="checkbox" id="shoutbox-email-notify" style="cursor:pointer;">
                    <label for="shoutbox-email-notify" style="cursor:pointer; display: flex; align-items: center; gap: 0.25rem; user-select: none;">
                        <i class="fa-solid fa-envelope" style="color: var(--accent-orange);"></i> Gửi thông báo quan trọng này qua Email cho tất cả thành viên
                    </label>
                </div>
                ` : ''}
            </form>
        </div>

        <div class="card">
            <div class="card-header">
                <h3 class="card-title"><i class="fa-solid fa-fire"></i> Bài toán nổi bật hôm nay</h3>
                <a href="#exercises" class="btn btn-secondary btn-sm">Xem tất cả <i class="fa-solid fa-chevron-right"></i></a>
            </div>
            <div id="featured-container">
                <div style="text-align:center;padding:2rem;color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải...</div>
            </div>
        </div>`;

    renderLaTeX(mainContent);

    // Load shouts + problems in parallel
    try {
        const [shouts, problems] = await Promise.all([api.getShouts(), api.getProblems()]);
        renderShouts(shouts);

        const fc = document.getElementById("featured-container");
        if (fc) {
            fc.innerHTML = problems.length === 0
                ? `<p style="text-align:center;padding:2rem;color:var(--text-muted);">Chưa có bài toán nào. <a href="#create-problem">Đăng bài đầu tiên!</a></p>`
                : problems.slice(0, 3).map(p => problemCardHTML(p)).join("");
            renderLaTeX(fc);
        }
    } catch (e) {
        console.error("Home load error:", e);
    }

    // Shoutbox form
    document.getElementById("shoutbox-form")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const user = getCurrentUser();
        if (!user) return;
        const inp = document.getElementById("shoutbox-input");
        const val = inp.value.trim();
        if (!val) return;
        try {
            if (editShoutId) {
                // Update existing Shout
                await api.updateShout(editShoutId, { text: val, googleId: user.googleId });
                showToast("Đã sửa tin nhắn!", "success");
                editShoutId = null;
            } else {
                // Create new Shout
                const now = new Date();
                const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} ${now.toLocaleDateString('vi-VN')}`;
                const emailNotifyCheck = document.getElementById("shoutbox-email-notify");
                const sendEmail = emailNotifyCheck ? emailNotifyCheck.checked : false;

                await api.addShout({
                    username: user.username,
                    userPicture: user.picture,
                    authorGoogleId: user.googleId,
                    text: val,
                    time: timeStr,
                    replyTo: replyToShout,
                    sendEmail: sendEmail
                });
                replyToShout = null;
                if (emailNotifyCheck) emailNotifyCheck.checked = false;
            }
            inp.value = "";
            showShoutPreview();
            renderShouts(await api.getShouts());
        } catch (err) {
            showToast("Thao tác thất bại: " + err.message, "error");
        }
    });
}

function problemCardHTML(p) {
    return `
        <div class="problem-card-item">
            <div class="problem-item-details">
                <div class="problem-item-title-row">
                    <a href="#problem/${p._id}" class="problem-item-title">${preprocessLaTeX(p.title)}</a>
                    <span class="badge ${p.category === 'calculus' ? 'badge-calculus' : 'badge-algebra'}">
                        ${p.category === 'calculus' ? 'Giải tích' : 'Đại số'}
                    </span>
                </div>
                <div class="problem-item-tags">
                    ${(p.tags || []).map(t => `<span class="badge badge-tag">${t}</span>`).join("")}
                </div>
                <div class="problem-item-stats">
                    <span><i class="fa-solid fa-user"></i> ${p.creator}</span>
                    <span><i class="fa-solid fa-star"></i> ${p.points} điểm</span>
                    ${p.difficulty ? `<span>${{ 'easy': '🟢 Dễ', 'medium': '🟡 Trung bình', 'hard': '🔴 Khó', 'extreme': '⚡ Siêu khó' }[p.difficulty] || ''}</span>` : ''}
                    <span><i class="fa-regular fa-clock"></i> ${timeSince(p.createdAt)}</span>
                </div>
            </div>
            <div class="problem-item-action">
                <a href="#problem/${p._id}" class="btn btn-primary btn-sm">
                    <i class="fa-solid fa-arrow-right-to-bracket"></i> Giải ngay
                </a>
            </div>
        </div>`;
}

function renderShouts(shouts) {
    const c = document.getElementById("shoutbox-container");
    if (!c) return;
    if (!shouts.length) {
        c.innerHTML = `<p style="text-align:center;padding:1rem;color:var(--text-muted);">Chưa có tin nhắn nào. Hãy là người đầu tiên!</p>`;
        return;
    }
    const me = getCurrentUser();
    const reactEmojis = { like: '👍', love: '❤️', haha: '😂', wow: '😮', sad: '😢', angry: '😡' };

    c.innerHTML = shouts.map(s => {
        const isOwn = me && me.googleId === s.authorGoogleId;

        // Group reactions
        const grouped = {};
        (s.reactions || []).forEach(r => {
            grouped[r.reactionType] = (grouped[r.reactionType] || 0) + 1;
        });

        const hasReactions = Object.keys(grouped).length > 0;
        const announcementStyle = s.isAnnouncement 
            ? 'style="background: rgba(251, 146, 60, 0.06); border: 1px dashed rgba(251, 146, 60, 0.4); border-left: 4px solid var(--accent-orange); padding: 0.6rem; border-radius: 8px; margin: 0.35rem 0;"' 
            : '';

        return `
        <div class="shout-msg ${isOwn ? 'is-own-msg' : ''}" id="shout-msg-${s._id}" ${announcementStyle}>
            <div class="shout-avatar">
                <a href="#profile/${s.authorGoogleId || ''}">${avatarTag(s.userPicture, s.username, 28)}</a>
            </div>
            <div class="shout-content">
                <div class="shout-meta">
                    <span class="shout-author"><a href="#profile/${s.authorGoogleId || ''}" style="color:var(--accent-blue); text-decoration:none; font-weight:700;">${s.username}</a></span>
                    <span class="shout-time">${s.time || timeSince(s.createdAt)}</span>
                    ${s.isAnnouncement ? '<span style="background: var(--accent-orange); color: #fff; padding: 1px 6px; font-size: 0.65rem; border-radius: 4px; font-weight: 700; margin-left: 0.4rem; display: inline-flex; align-items: center; gap: 0.25rem;"><i class="fa-solid fa-bullhorn"></i> Thông báo</span>' : ''}
                    ${s.isEdited ? '<span style="font-size:0.65rem;color:var(--text-muted);font-style:italic;">(đã sửa)</span>' : ''}
                </div>
                
                ${s.replyTo && s.replyTo.parentId ? `
                    <div class="shout-quoted-box">
                        <span class="quoted-author">${s.replyTo.parentAuthor}:</span>
                        <span>${s.replyTo.parentText}</span>
                    </div>
                ` : ''}

                <div class="shout-text">${s.text}</div>
                
                ${hasReactions ? `
                    <div class="shout-reactions-list">
                        ${Object.entries(grouped).map(([type, count]) => `
                            <span class="reaction-badge" data-shout-id="${s._id}" data-type="${type}" title="${(s.reactions || []).filter(r => r.reactionType === type).map(r => r.username).join(', ')}">
                                ${reactEmojis[type]} ${count}
                            </span>
                        `).join("")}
                    </div>
                ` : ''}
            </div>

            <!-- Hover menu actions -->
            <div class="shout-msg-hover-actions">
                <div class="shout-action-btn react-btn">
                    <i class="fa-regular fa-face-smile"></i>
                    <div class="reaction-emoji-bar">
                        <span class="emoji-item" data-shout-id="${s._id}" data-type="like">👍</span>
                        <span class="emoji-item" data-shout-id="${s._id}" data-type="love">❤️</span>
                        <span class="emoji-item" data-shout-id="${s._id}" data-type="haha">😂</span>
                        <span class="emoji-item" data-shout-id="${s._id}" data-type="wow">😮</span>
                        <span class="emoji-item" data-shout-id="${s._id}" data-type="sad">😢</span>
                        <span class="emoji-item" data-shout-id="${s._id}" data-type="angry">😡</span>
                    </div>
                </div>
                <button class="shout-action-btn reply-btn" data-shout-id="${s._id}" data-author="${s.username}" data-text="${encodeURIComponent(s.text)}" title="Trả lời">
                    <i class="fa-solid fa-reply"></i>
                </button>
                ${(() => {
                    if (!me) return '';
                    const isOwner = me.googleId === s.authorGoogleId;
                    const isAdmin = me.role === 'admin';
                    const diffMs = Date.now() - new Date(s.createdAt).getTime();

                    const canEdit = isOwner && (diffMs < 15 * 60 * 1000);
                    const canDelete = isAdmin || (isOwner && (diffMs < 24 * 60 * 60 * 1000));

                    let btns = '';
                    if (canEdit) {
                        btns += `
                            <button class="shout-action-btn edit-btn" data-shout-id="${s._id}" data-text="${encodeURIComponent(s.text)}" title="Chỉnh sửa">
                                <i class="fa-solid fa-pencil"></i>
                            </button>
                        `;
                    }
                    if (canDelete) {
                        btns += `
                            <button class="shout-action-btn delete-btn delete" data-shout-id="${s._id}" title="Xóa">
                                <i class="fa-regular fa-trash-can"></i>
                            </button>
                        `;
                    }
                    return btns;
                })()}
            </div>
        </div>`;
    }).join("");

    // Bind event listeners for reactions, reply, edit, delete
    c.querySelectorAll(".emoji-item").forEach(item => {
        item.addEventListener("click", async () => {
            if (!me) { showToast("Vui lòng đăng nhập!", "warning"); return; }
            const sId = item.getAttribute("data-shout-id");
            const type = item.getAttribute("data-type");
            try {
                await api.reactShout(sId, { type, googleId: me.googleId, username: me.username });
                renderShouts(await api.getShouts());
            } catch (err) {
                console.error("Reaction failed:", err);
            }
        });
    });

    c.querySelectorAll(".reaction-badge").forEach(badge => {
        badge.addEventListener("click", async () => {
            if (!me) { showToast("Vui lòng đăng nhập!", "warning"); return; }
            const sId = badge.getAttribute("data-shout-id");
            const type = badge.getAttribute("data-type");
            try {
                await api.reactShout(sId, { type, googleId: me.googleId, username: me.username });
                renderShouts(await api.getShouts());
            } catch (err) {
                console.error("Reaction failed:", err);
            }
        });
    });

    c.querySelectorAll(".reply-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            if (!me) { showToast("Vui lòng đăng nhập!", "warning"); return; }
            const sId = btn.getAttribute("data-shout-id");
            const author = btn.getAttribute("data-author");
            const text = decodeURIComponent(btn.getAttribute("data-text"));

            replyToShout = { parentId: sId, parentText: text, parentAuthor: author };
            editShoutId = null; // Cancel editing when replying

            showShoutPreview();

            const inp = document.getElementById("shoutbox-input");
            if (inp) inp.focus();
        });
    });

    c.querySelectorAll(".edit-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const sId = btn.getAttribute("data-shout-id");
            const text = decodeURIComponent(btn.getAttribute("data-text"));

            editShoutId = sId;
            replyToShout = null; // Cancel reply when editing

            const inp = document.getElementById("shoutbox-input");
            if (inp) {
                inp.value = text;
                inp.focus();
            }
            showShoutPreview();
        });
    });

    c.querySelectorAll(".delete-btn").forEach(btn => {
        btn.addEventListener("click", async () => {
            if (!confirm("Bạn có chắc chắn muốn xóa tin nhắn này?")) return;
            const sId = btn.getAttribute("data-shout-id");
            try {
                await api.deleteShout(sId, me.googleId);
                showToast("Đã xóa tin nhắn!", "success");
                renderShouts(await api.getShouts());
            } catch (err) {
                showToast("Xóa tin nhắn thất bại: " + err.message, "error");
            }
        });
    });

    // Bind click togglers for reaction emoji bar (like Messenger)
    c.querySelectorAll(".react-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation(); // Prevent document click handler from closing it immediately
            const emojiBar = btn.querySelector(".reaction-emoji-bar");
            const actionsMenu = btn.closest(".shout-msg-hover-actions");

            const wasActive = emojiBar?.classList.contains("active");

            // Close all other reaction bars
            document.querySelectorAll(".reaction-emoji-bar").forEach(bar => {
                bar.classList.remove("active");
                bar.closest(".shout-msg-hover-actions")?.classList.remove("active");
            });

            if (!wasActive) {
                emojiBar?.classList.add("active");
                actionsMenu?.classList.add("active");
            }
        });
    });

    c.scrollTop = c.scrollHeight;
}

function showShoutPreview() {
    const form = document.getElementById("shoutbox-form");
    if (!form) return;

    // Remove existing preview boxes
    form.querySelector(".shout-reply-preview")?.remove();
    form.querySelector(".shout-edit-preview")?.remove();

    if (replyToShout) {
        const preview = document.createElement("div");
        preview.className = "shout-reply-preview";
        preview.innerHTML = `
            <span class="reply-text"><i class="fa-solid fa-reply"></i> Đang trả lời <strong>${replyToShout.parentAuthor}</strong>: "${replyToShout.parentText}"</span>
            <button type="button" class="cancel-reply-btn"><i class="fa-solid fa-xmark"></i></button>
        `;
        preview.querySelector(".cancel-reply-btn").addEventListener("click", () => {
            replyToShout = null;
            preview.remove();
        });
        form.insertBefore(preview, form.firstChild);
    } else if (editShoutId) {
        const preview = document.createElement("div");
        preview.className = "shout-edit-preview";
        preview.innerHTML = `
            <span><i class="fa-solid fa-pencil"></i> Đang chỉnh sửa tin nhắn...</span>
            <button type="button" class="cancel-edit-btn"><i class="fa-solid fa-xmark"></i></button>
        `;
        preview.querySelector(".cancel-edit-btn").addEventListener("click", () => {
            editShoutId = null;
            preview.remove();
            const inp = document.getElementById("shoutbox-input");
            if (inp) inp.value = "";
        });
        form.insertBefore(preview, form.firstChild);
    }
}

// ── EXERCISES ─────────────────────────────────────────────────────────────────
async function viewExercises(categoryFilter = "all") {
    setActiveNav("exercises");
    showLoading();
    try {
        const problems = await api.getProblems(categoryFilter);
        const me = getCurrentUser();
        const canCreate = me && ['admin', 'professor', 'supporter'].includes(me.role);
        mainContent.innerHTML = `
            <div class="page-header">
                <h2 class="page-title"><i class="fa-solid fa-book-open-reader"></i> Kho Bài Tập <span>COMP1800</span></h2>
                ${canCreate ? `<a href="#create-problem" class="btn btn-primary"><i class="fa-solid fa-plus"></i> Đăng đề bài</a>` : ''}
            </div>
            <div id="cat-filters" style="display:flex;gap:0.5rem;margin-bottom:1.5rem;flex-wrap:wrap;">
                <button class="filter-tag-btn ${categoryFilter === 'all' ? 'active' : ''}" data-c="all">Tất cả</button>
                <button class="filter-tag-btn ${categoryFilter === 'calculus' ? 'active' : ''}" data-c="calculus">🔵 Giải tích</button>
                <button class="filter-tag-btn ${categoryFilter === 'algebra' ? 'active' : ''}" data-c="algebra">🟣 Đại số</button>
            </div>
            <div id="prob-list">
                ${problems.length === 0
                ? `<div class="card" style="text-align:center;padding:3rem;">
                           <i class="fa-solid fa-book-open fa-3x" style="color:var(--text-muted);margin-bottom:1rem;"></i>
                           <p style="color:var(--text-muted);">Chưa có bài tập nào${categoryFilter !== 'all' ? ` trong chuyên mục này` : ''}.</p>
                           ${canCreate ? `<a href="#create-problem" class="btn btn-primary" style="margin-top:1rem;">Đăng bài toán đầu tiên!</a>` : ''}
                       </div>`
                : problems.map(p => problemCardHTML(p)).join("")}
            </div>`;

        document.querySelectorAll("#cat-filters .filter-tag-btn").forEach(btn =>
            btn.addEventListener("click", () => viewExercises(btn.getAttribute("data-c")))
        );
        renderLaTeX(mainContent);
    } catch (e) {
        showError("Không thể tải bài tập. Kiểm tra server backend!");
    }
}

// ── PROBLEM DETAIL ────────────────────────────────────────────────────────────
async function viewProblemDetail(id) {
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

        mainContent.innerHTML = `
            <div class="page-header">
                <div>
                    <a href="#exercises" style="font-size:0.9rem;"><i class="fa-solid fa-arrow-left"></i> Quay lại kho bài tập</a>
                    <h2 class="page-title" style="margin-top:0.5rem;">${preprocessLaTeX(problem.title)}</h2>
                </div>
                <span class="badge ${problem.category === 'calculus' ? 'badge-calculus' : 'badge-algebra'}" style="font-size:0.9rem;padding:0.4rem 0.8rem;">
                    <i class="fa-solid ${problem.category === 'calculus' ? 'fa-wave-square' : 'fa-table-cells'}"></i>
                    ${problem.category === 'calculus' ? 'Giải tích' : 'Đại số'}
                </span>
            </div>

            <div class="problem-page-layout">
                <!-- Left column: Problem card, Solutions, and Comments -->
                <div class="problem-left-col">
                    <div class="card" style="margin-bottom:0;">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
                            <div style="display:flex;align-items:center;gap:0.6rem;">
                                <a href="#profile/${problem.creatorGoogleId}">${avatarTag(problem.creatorPicture, problem.creator, 36)}</a>
                                <div>
                                    <strong><a href="#profile/${problem.creatorGoogleId}" style="color:var(--text-primary); text-decoration:none; transition:color 0.2s;" onmouseover="this.style.color='var(--accent-blue)'" onmouseout="this.style.color='var(--text-primary)'">${problem.creator}</a></strong>
                                    <div style="font-size:0.75rem;color:var(--text-muted);">${timeSince(problem.createdAt)}</div>
                                </div>
                            </div>
                            <div style="display:flex;gap:0.4rem;flex-wrap:wrap;">
                                ${(problem.tags || []).map(t => `<span class="badge badge-tag">${t}</span>`).join("")}
                            </div>
                        </div>
                        <div class="problem-content" style="margin-bottom: 1rem;">${preprocessLaTeX(problem.content)}</div>
                        ${(problem.imageUrls && problem.imageUrls.length > 0) ? `
                            <div style="display:flex; flex-direction:column; gap:0.75rem; margin-top:1rem; margin-bottom:1rem;">
                                ${problem.imageUrls.map(url => `<img src="${url}" alt="Hình bài toán" onclick="openLightbox(this.src)" style="max-width:100%;border-radius:8px;display:block;cursor:zoom-in;">`).join("")}
                            </div>
                        ` : (problem.imageUrl ? `<img src="${problem.imageUrl}" alt="Hình bài toán" style="max-width:100%;border-radius:8px;margin-top:1rem;margin-bottom:1rem;display:block;">` : '')}
                        
                        ${problem.gradingRubric ? `
                            <div style="margin-top: 1.25rem; margin-bottom: 1.25rem; padding: 1rem; background: rgba(139, 92, 246, 0.05); border-left: 4px solid #8b5cf6; border-radius: 4px; font-size: 0.9rem;">
                                <strong style="color: #a78bfa; display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                                    <i class="fa-solid fa-ruler-combined"></i> Thang điểm chấm bài chi tiết:
                                </strong>
                                <div style="line-height: 1.6; color: var(--text-secondary); white-space: pre-wrap;">${preprocessLaTeX(problem.gradingRubric)}</div>
                            </div>
                        ` : ''}
                        
                        <div style="margin-top:1rem;padding-top:1rem;border-top:1px solid var(--border-color);display:flex;justify-content:space-between;align-items:center;font-size:0.85rem;color:var(--text-muted);flex-wrap:wrap;gap:0.75rem;">
                            <div style="display:flex;gap:1rem;">
                                <span><i class="fa-solid fa-star" style="color:#f59e0b;"></i> ${problem.points} điểm thưởng</span>
                                ${problem.difficulty ? `<span>${{ 'easy': '🟢 Dễ', 'medium': '🟡 Trung bình', 'hard': '🔴 Khó', 'extreme': '⚡ Siêu khó' }[problem.difficulty] || ''}</span>` : ''}
                                <span><i class="fa-solid fa-lightbulb"></i> ${solutions.length} lời giải</span>
                            </div>
                            <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
                                ${(user && (user.role === 'admin' || user.role === 'professor' || problem.creatorGoogleId === user.googleId)) ? `
                                    <button class="btn btn-secondary btn-sm" id="edit-problem-btn" style="height:32px;padding:0.3rem 0.75rem;font-size:0.8rem;">
                                        <i class="fa-solid fa-pen-to-square"></i> Chỉnh sửa
                                    </button>
                                    <button class="btn btn-secondary btn-sm" id="delete-problem-btn" style="height:32px;padding:0.3rem 0.75rem;font-size:0.8rem;color:var(--accent-red);">
                                        <i class="fa-solid fa-trash"></i> Xóa đề bài
                                    </button>
                                ` : ''}
                                <button class="vote-btn ${hasLikedProblem ? 'active-like' : ''}" onclick="voteItem('problems', '${problem._id}', 'like')">
                                    <i class="fa-solid fa-thumbs-up"></i> Thích <span>(${pLikes})</span>
                                </button>
                                <button class="vote-btn ${hasDislikedProblem ? 'active-dislike' : ''}" onclick="voteItem('problems', '${problem._id}', 'dislike')">
                                    <i class="fa-solid fa-thumbs-down"></i> Không thích <span>(${pDislikes})</span>
                                </button>
                                <button class="vote-btn" id="ai-similar-problem-btn" style="background: linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.15)); border: 1px solid rgba(99, 102, 241, 0.25); color: #818cf8;" title="AI tự tạo một bài toán tự luận tương tự đề này">
                                    <i class="fa-solid fa-wand-magic-sparkles"></i> Bài tương tự (AI)
                                </button>
                            </div>
                        </div>
                    </div>

                    <div class="card">
                        <h3 style="margin-bottom:1.25rem;"><i class="fa-solid fa-lightbulb"></i> Lời giải (${solutions.length})</h3>
                        <div id="solutions-box">
                            ${solutions.length === 0
                ? '<p style="color:var(--text-muted);text-align:center;padding:1.5rem;">Chưa có lời giải. Hãy là người đầu tiên!</p>'
                : solutions.map(s => `
                                    <div class="card" style="margin-bottom:1rem;padding:1.25rem;">
                                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem;">
                                            <div style="display:flex;align-items:center;gap:0.6rem;">
                                                <a href="#profile/${s.authorGoogleId}">${avatarTag(s.authorPicture, s.author, 32)}</a>
                                                <div>
                                                    <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">
                                                        <strong style="font-size:0.92rem;"><a href="#profile/${s.authorGoogleId}" style="color:var(--text-primary); text-decoration:none; transition:color 0.2s;" onmouseover="this.style.color='var(--accent-blue)'" onmouseout="this.style.color='var(--text-primary)'">${s.author}</a></strong>
                                                        ${s.status === 'correct' ? `
                                                            <span class="badge" style="background:rgba(16,185,129,0.1); color:#10b981; border:1px solid rgba(16,185,129,0.25); text-transform:none; font-size:0.68rem; padding:0.15rem 0.35rem; display:inline-flex; align-items:center; gap:0.25rem;">
                                                                <i class="fa-solid fa-circle-check"></i> Đúng
                                                            </span>
                                                        ` : s.status === 'incorrect' ? `
                                                            <span class="badge" style="background:rgba(244,63,94,0.1); color:#f43f5e; border:1px solid rgba(244,63,94,0.25); text-transform:none; font-size:0.68rem; padding:0.15rem 0.35rem; display:inline-flex; align-items:center; gap:0.25rem;">
                                                                <i class="fa-solid fa-circle-xmark"></i> Sai
                                                            </span>
                                                        ` : `
                                                            <span class="badge" style="background:rgba(251,146,60,0.1); color:#fb923c; border:1px solid rgba(251,146,60,0.25); text-transform:none; font-size:0.68rem; padding:0.15rem 0.35rem; display:inline-flex; align-items:center; gap:0.25rem;">
                                                                <i class="fa-solid fa-circle-question"></i> Chờ duyệt
                                                            </span>
                                                        `}
                                                    </div>
                                                    <div style="font-size:0.72rem;color:var(--text-muted);">${timeSince(s.createdAt)}</div>
                                                </div>
                                            </div>
                                            <div style="display:flex;align-items:center;gap:0.4rem;">
                                                ${(user && (user.role === 'admin' || user.role === 'professor' || problem.creatorGoogleId === user.googleId) && s.status === 'pending') ? `
                                                    <div style="display:inline-flex; gap:0.25rem; margin-right:0.25rem;">
                                                        <button class="btn btn-secondary btn-sm set-correct-btn" data-id="${s._id}" title="Đánh dấu Đúng" style="padding:0.3rem 0.45rem; height:28px; color:#10b981; min-width:auto;">
                                                            <i class="fa-solid fa-check"></i>
                                                        </button>
                                                        <button class="btn btn-secondary btn-sm set-incorrect-btn" data-id="${s._id}" title="Đánh dấu Sai" style="padding:0.3rem 0.45rem; height:28px; color:#f43f5e; min-width:auto;">
                                                            <i class="fa-solid fa-xmark"></i>
                                                        </button>
                                                    </div>
                                                ` : ''}
                                                ${(user && (user.role === 'admin' || user.role === 'professor' || s.authorGoogleId === user.googleId)) ? `
                                                    <div style="display:inline-flex; gap:0.25rem; margin-right:0.25rem;">
                                                        <button class="btn btn-secondary btn-sm edit-sol-btn" data-id="${s._id}" data-content="${encodeURIComponent(s.content)}" data-has-image="${!!s.imageUrl}" title="Chỉnh sửa lời giải" style="padding:0.3rem 0.45rem; height:28px; min-width:auto;">
                                                            <i class="fa-solid fa-pen"></i>
                                                        </button>
                                                        <button class="btn btn-secondary btn-sm delete-sol-btn" data-id="${s._id}" title="Xóa lời giải" style="padding:0.3rem 0.45rem; height:28px; color:var(--accent-red); min-width:auto;">
                                                            <i class="fa-solid fa-trash"></i>
                                                        </button>
                                                    </div>
                                                ` : ''}
                                                <button class="btn btn-secondary btn-sm upvote-btn" data-id="${s._id}" style="height:28px; padding:0.3rem 0.6rem;">
                                                    <i class="fa-solid fa-thumbs-up"></i> <span>${s.votes}</span>
                                                </button>
                                            </div>
                                        </div>
                                        <div class="sol-body-container" id="sol-body-${s._id}">
                                            <div style="margin-bottom:0.5rem; line-height:1.6;">${preprocessLaTeX(s.content)}</div>
                                            ${(s.imageUrls && s.imageUrls.length > 0) ? `
                                                <div style="display:flex; flex-direction:column; gap:0.75rem; margin-top:0.75rem; margin-bottom:0.75rem;">
                                                    ${s.imageUrls.map(url => `<img src="${url}" alt="Ảnh lời giải" onclick="openLightbox(this.src)" style="max-width:100%;max-height:400px;object-fit:contain;border-radius:8px;display:block;cursor:zoom-in;">`).join("")}
                                                </div>
                                            ` : (s.imageUrl ? `<img src="${s.imageUrl}" alt="Ảnh lời giải" style="max-width:100%;max-height:400px;object-fit:contain;border-radius:8px;margin-top:0.75rem;display:block;">` : '')}
                                            ${s.aiFeedback ? `
                                                <div style="margin-top:0.9rem; padding:1rem 1.25rem; background:rgba(99,102,241,0.03); border:1px dashed rgba(99,102,241,0.3); border-radius:8px; font-size:0.9rem;">
                                                    <div style="font-weight:600; color:var(--accent-blue); margin-bottom:0.5rem; display:flex; align-items:center; gap:0.35rem; font-size:0.95rem;">
                                                        <i class="fa-solid fa-robot"></i> Đánh giá từ AI Assistant:
                                                    </div>
                                                    <div style="line-height: 1.7; color: var(--text-secondary); word-break: break-word;">${preprocessLaTeX(s.aiFeedback)}</div>
                                                </div>
                                            ` : ''}
                                        </div>
                                    </div>`).join("")
            }
                        </div>
                        
                        <div style="margin-top:2rem;padding-top:1.5rem;border-top:1px solid var(--border-color);">
                            <h4 style="margin-bottom:1rem;"><i class="fa-solid fa-pen-to-square"></i> Đăng lời giải của bạn</h4>
                            <form id="sol-form">
                                <div class="form-group">
                                    <label class="form-label">Chọn phương thức nhập lời giải:</label>
                                    <div class="input-modes" id="s-input-modes">
                                        <button type="button" class="btn btn-secondary mode-btn active" data-mode="latex"><i class="fa-solid fa-code"></i> LaTeX</button>
                                        <button type="button" class="btn btn-secondary mode-btn" data-mode="word"><i class="fa-solid fa-file-word"></i> Văn bản</button>
                                        <button type="button" class="btn btn-secondary mode-btn" data-mode="image"><i class="fa-solid fa-camera"></i> Chụp / Tải ảnh</button>
                                    </div>
                                </div>
                                
                                <div class="form-group" id="s-mode-latex-container">
                                    <label class="form-label">Nội dung lời giải (LaTeX và Văn bản):</label>
                                    <textarea id="sol-content" class="form-textarea" style="min-height:180px;"
                                        placeholder="Nhập lời giải chi tiết. Ví dụ: $$\int_0^1 x^2 dx = \frac{1}{3}$$"></textarea>
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
                                        <input type="file" id="s-image-file-input" accept="image/*" style="display: none;" multiple onchange="handleImageFileSelect(this, 'solution')">
                                        <div id="s-image-upload-status" style="font-size: 0.82rem; color: var(--accent-blue); margin-top: 0.5rem; font-weight: 600;"></div>
                                        <div id="s-image-upload-preview"></div>
                                    </div>
                                </div>

                                <div style="margin-top:1.25rem;padding:1rem;background:rgba(99,102,241,0.07);border:1px solid rgba(99,102,241,0.2);border-radius:10px;">
                                    <div style="font-size:0.8rem;color:var(--text-muted);display:flex;align-items:center;gap:0.5rem;margin-bottom:0.85rem;">
                                        <i class="fa-solid fa-circle-info" style="color:#818cf8;"></i>
                                        <span>Chọn cách nộp bài: đăng để cộng đồng góp ý, hoặc nhờ hệ thống chấm điểm tự động ngay.</span>
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
                        <h3 style="margin-bottom:1.25rem;"><i class="fa-solid fa-comments"></i> Thảo luận (${comments.length})</h3>
                        <div id="prob-comments">
                            ${comments.length === 0
                ? '<p style="color:var(--text-muted);text-align:center;padding:1rem;">Chưa có bình luận.</p>'
                : comments.map(c => commentHTML(c)).join("")}
                        </div>
                        <form id="prob-comment-form" style="display:flex;gap:0.5rem;margin-top:0.75rem;padding-top:0.75rem;border-top:1px solid var(--border-color);">
                            <input type="text" id="prob-comment-input" class="form-input" placeholder="Bình luận về bài toán này..." required>
                            <button type="submit" class="btn btn-secondary"><i class="fa-solid fa-paper-plane"></i></button>
                        </form>
                    </div>
                </div>
            </div>

            <!-- Floating AI Tutor Widget Trigger Button -->
            <button type="button" id="tutor-floating-trigger" class="tutor-trigger-btn" title="Trợ lý Học tập AI">
                <i class="fa-solid fa-graduation-cap"></i>
                <span class="pulse-ring"></span>
            </button>

            <!-- Floating AI Tutor Chatbox Widget Container -->
            <div class="ai-tutor-widget-container" id="tutor-widget-container">
                <div class="ai-tutor-card" id="tutor-card">
                    <div class="ai-tutor-header" style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem;">
                        <div style="display:flex; align-items:center; gap:0.6rem;">
                            <div class="header-bot-icon"><i class="fa-solid fa-robot"></i></div>
                            <div>
                                <h4 class="ai-tutor-title" style="margin:0; font-size:0.95rem;">Trợ lý Học tập AI</h4>
                                <div class="ai-tutor-tagline" style="font-size:0.68rem;">Hướng dẫn từng bước gợi mở</div>
                            </div>
                        </div>
                        <div style="display:flex; gap:0.25rem;">
                            <button type="button" id="toggle-tutor-size-btn" class="btn-tutor-action-btn" title="Phóng to / Thu nhỏ">
                                <i class="fa-solid fa-expand"></i>
                            </button>
                            <button type="button" id="close-tutor-widget-btn" class="btn-tutor-action-btn" title="Thu gọn" style="color:var(--text-muted);">
                                <i class="fa-solid fa-minus"></i>
                            </button>
                        </div>
                    </div>
                    <div class="ai-tutor-messages" id="ai-tutor-chat-messages">
                        <!-- Messages will render here -->
                    </div>
                    
                    <!-- Preview ảnh đính kèm -->
                    <div id="tutor-image-preview-container" style="display:none; padding:0.5rem 1rem; border-top:1px dashed var(--border-color); background:rgba(0,0,0,0.05); position:relative;">
                        <img id="tutor-image-preview" src="" alt="Preview" style="max-height:80px; max-width:100%; border-radius:6px; object-fit:contain; border:1px solid var(--border-color);">
                        <button type="button" id="remove-tutor-image-btn" style="position:absolute; top:8px; left:110px; background:rgba(239,68,68,0.9); color:white; border:none; border-radius:50%; width:20px; height:20px; font-size:0.6rem; display:flex; align-items:center; justify-content:center; cursor:pointer;" title="Xóa ảnh">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>

                    <div class="ai-tutor-hints">
                        <button type="button" class="ai-hint-btn" id="ai-hint-start"><i class="fa-regular fa-lightbulb"></i> Gợi ý bước đầu</button>
                        <button type="button" class="ai-hint-btn" id="ai-hint-formula"><i class="fa-solid fa-book"></i> Lý thuyết cần dùng</button>
                        <button type="button" class="ai-hint-btn" id="ai-hint-next"><i class="fa-solid fa-forward"></i> Gợi ý tiếp theo</button>
                    </div>
                    <form id="ai-tutor-chat-form" class="ai-tutor-input-area" style="display:flex; gap:0.4rem; align-items:flex-end;">
                        <input type="file" id="tutor-image-file-input" accept="image/*" style="display:none;">
                        <button type="button" id="tutor-attach-image-btn" class="btn btn-secondary" style="min-width:auto; padding:0.5rem 0.65rem; height:38px;" title="Đính kèm ảnh bài làm/nháp">
                            <i class="fa-solid fa-image"></i>
                        </button>
                        <textarea id="ai-tutor-chat-input" class="form-input" placeholder="Hỏi Trợ lý AI cách giải..." required autocomplete="off" rows="1" style="resize:none; padding:0.5rem; height:38px; line-height:1.4; flex-grow:1;"></textarea>
                        <button type="submit" class="btn btn-primary" style="min-width:auto; padding:0 0.85rem; height:38px;"><i class="fa-solid fa-paper-plane"></i></button>
                    </form>
                </div>
            </div>`;

        renderLaTeX(mainContent);

        // Reset solution image upload variables on entry
        s_uploadedImages = [];

        // Initialize Quill Editor if snow theme is loaded
        let sQuill = null;
        if (window.Quill) {
            sQuill = new Quill('#s-quill-editor', {
                theme: 'snow',
                placeholder: 'Soạn thảo lời giải của bạn tại đây...'
            });
        }

        // --- AI Tutor conversational logic state ---
        // Khởi đầu bằng role 'user' giới thiệu đề bài (Gemini API yêu cầu cuộc hội thoại bắt đầu bằng 'user')
        const problemContextMsg = problem.content
            ? `Em đang học bài toán sau: "${problem.title}". Nội dung: ${problem.content}`
            : `Em đang học bài toán sau: "${problem.title}". Đây là bài dạng hình ảnh, thầy hãy hướng dẫn các kiến thức liên quan đến chủ đề này nhé.`;

        let problemChatMessages = [
            { role: "user",  content: problemContextMsg },
            { role: "model", content: `Chào em! Thầy là người hướng dẫn học tập của em. Thầy đã xem qua bài toán của em rồi. Nếu em chưa biết hướng giải, hoặc muốn tìm hiểu các lý thuyết, công thức liên quan, hãy cứ hỏi thầy nhé. Thầy sẽ hướng dẫn từng bước gợi mở để em tự tìm ra lời giải! 😊` }
        ];

        function renderTutorMessages() {
            const container = document.getElementById("ai-tutor-chat-messages");
            if (!container) return;
            // Skip the first user message (problem context - hidden from UI)
            const visibleMessages = problemChatMessages.slice(1);
            container.innerHTML = visibleMessages.map(m => `
                <div class="ai-msg ${m.role === 'model' ? 'ai' : 'user'}">
                    <div class="ai-msg-avatar">
                        ${m.role === 'model'
                    ? `<div style="background:rgba(99,102,241,0.1); width:24px; height:24px; display:flex; align-items:center; justify-content:center; border-radius:50%; color:var(--accent-blue); font-size:0.75rem;"><i class="fa-solid fa-chalkboard-teacher"></i></div>`
                    : `<img src="${user ? user.picture : 'https://avatar.iran.liara.run/public/1'}" alt="Avatar" style="width:24px;height:24px;border-radius:50%;object-fit:cover;">`
                }
                    </div>
                    <div class="ai-msg-content-wrap">
                        <div class="ai-msg-bubble" style="line-height: 1.7; font-size: 0.92rem; padding: 0.75rem 1rem; border-radius: 12px; word-break: break-word;">${preprocessLaTeX(
                            m.role === 'model'
                                ? m.content.replace(/\\n/g, '\n')
                                : m.content
                        )}</div>
                        ${m.image ? `<img src="${m.image}" alt="Ảnh đính kèm" onclick="openLightbox(this.src)" style="max-width:180px; max-height:120px; border-radius:6px; margin-top:0.25rem; border:1px solid var(--border-color); display:block; cursor: zoom-in;">` : ''}
                        ${m.verified === true ? '<div class="ai-verify-badge verified"><i class="fa-solid fa-circle-check"></i> Đã kiểm tra</div>' : ''}
                        ${m.verified === false ? '<div class="ai-verify-badge corrected"><i class="fa-solid fa-triangle-exclamation"></i> Đã điều chỉnh</div>' : ''}
                    </div>
                </div>
            `).join("");
            renderLaTeX(container);
            container.scrollTop = container.scrollHeight;
        }

        // Biến lưu trữ ảnh đính kèm của AI Tutor
        let tutorUploadedImageBase64 = null;

        // Auto-resize textarea input chat
        const tutorTextarea = document.getElementById("ai-tutor-chat-input");
        tutorTextarea?.addEventListener("input", function() {
            this.style.height = "auto";
            this.style.height = (this.scrollHeight) + "px";
            if (this.scrollHeight > 150) {
                this.style.overflowY = "auto";
                this.style.height = "150px";
            } else {
                this.style.overflowY = "hidden";
            }
        });

        // Đính kèm ảnh cho AI Tutor
        const attachBtn = document.getElementById("tutor-attach-image-btn");
        const fileInput = document.getElementById("tutor-image-file-input");
        const previewContainer = document.getElementById("tutor-image-preview-container");
        const previewImg = document.getElementById("tutor-image-preview");
        const removeImgBtn = document.getElementById("remove-tutor-image-btn");

        attachBtn?.addEventListener("click", () => fileInput?.click());

        fileInput?.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function(evt) {
                tutorUploadedImageBase64 = evt.target.result;
                if (previewImg) previewImg.src = tutorUploadedImageBase64;
                if (previewContainer) previewContainer.style.display = "block";
            };
            reader.readAsDataURL(file);
        });

        removeImgBtn?.addEventListener("click", () => {
            tutorUploadedImageBase64 = null;
            if (fileInput) fileInput.value = "";
            if (previewContainer) previewContainer.style.display = "none";
            if (previewImg) previewImg.src = "";
        });

        // Phóng to / Thu nhỏ Trợ lý học tập
        const toggleSizeBtn = document.getElementById("toggle-tutor-size-btn");
        toggleSizeBtn?.addEventListener("click", () => {
            const layout = document.querySelector(".problem-page-layout");
            const icon = toggleSizeBtn.querySelector("i");
            if (layout.classList.contains("tutor-expanded")) {
                layout.classList.remove("tutor-expanded");
                icon.className = "fa-solid fa-expand";
                toggleSizeBtn.title = "Phóng to";
            } else {
                layout.classList.add("tutor-expanded");
                icon.className = "fa-solid fa-compress";
                toggleSizeBtn.title = "Thu nhỏ";
            }
        });

        async function sendTutorMessage(text, imageData = null) {
            problemChatMessages.push({ role: "user", content: text, image: imageData });
            renderTutorMessages();

            const container = document.getElementById("ai-tutor-chat-messages");
            const typingDiv = document.createElement("div");
            typingDiv.className = "ai-msg ai";
            typingDiv.innerHTML = `
                <div class="ai-msg-avatar">
                    <div style="background:rgba(99,102,241,0.1); width:24px; height:24px; display:flex; align-items:center; justify-content:center; border-radius:50%; color:var(--accent-blue); font-size:0.75rem;"><i class="fa-solid fa-chalkboard-teacher"></i></div>
                </div>
                <div class="ai-msg-bubble" style="color:var(--text-muted); font-style:italic;">
                    <i class="fa-solid fa-spinner fa-spin"></i> Thầy đang suy nghĩ...
                </div>
            `;
            container?.appendChild(typingDiv);
            container.scrollTop = container.scrollHeight;

            try {
                const reply = await api.chatAiTutor(id, problemChatMessages);
                typingDiv.remove();
                problemChatMessages.push({
                    role: "model",
                    content: reply.text,
                    verified: reply.verified,
                    issues: reply.issues
                });
                renderTutorMessages();
            } catch (err) {
                typingDiv.remove();
                problemChatMessages.push({ role: "model", content: `⚠️ Lỗi kết nối trợ lý: ${err.message}` });
                renderTutorMessages();
            }
        }

        // Render initial welcome message
        renderTutorMessages();

        // Toggle show/hide AI Tutor Chatbox Widget
        document.getElementById("tutor-floating-trigger")?.addEventListener("click", () => {
            document.getElementById("tutor-widget-container")?.classList.add("open");
        });

        document.getElementById("close-tutor-widget-btn")?.addEventListener("click", () => {
            document.getElementById("tutor-widget-container")?.classList.remove("open");
        });

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
            sendTutorMessage("Em chưa biết bắt đầu từ đâu, thầy gợi ý cho em hướng giải và bước đi đầu tiên của bài toán này nhé!");
        });

        document.getElementById("ai-hint-formula")?.addEventListener("click", () => {
            sendTutorMessage("Thầy hãy chỉ ra các công thức toán học và lý thuyết quan trọng cần biết để giải quyết bài toán này cho em ạ.");
        });

        document.getElementById("ai-hint-next")?.addEventListener("click", () => {
            sendTutorMessage("Em muốn thầy gợi ý thêm bước tiếp theo để tiến gần hơn tới lời giải của bài toán này.");
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
        // AI Similar Problem button
        document.getElementById("ai-similar-problem-btn")?.addEventListener("click", async () => {
            const btn = document.getElementById("ai-similar-problem-btn");
            const originalHTML = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang tạo bài tương tự...`;
            try {
                const newProb = await api.createSimilarProblem(problem._id, {
                    creator: user ? user.name : "Hệ thống AI",
                    creatorGoogleId: user ? user.googleId : null
                });
                showToast("AI đã sinh đề bài tương tự thành công! 🪄", "success");
                window.location.hash = `#problem/${newProb._id}`;
            } catch (err) {
                showToast("Lỗi khi sinh đề bài tương tự: " + err.message, "error");
                btn.disabled = false;
                btn.innerHTML = originalHTML;
            }
        });

        // Edit Solution button (inline edit)
        document.querySelectorAll(".edit-sol-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                const sId = btn.getAttribute("data-id");
                const originalContent = decodeURIComponent(btn.getAttribute("data-content"));

                const bodyDiv = document.getElementById(`sol-body-${sId}`);
                if (!bodyDiv) return;

                const originalHTML = bodyDiv.innerHTML;

                bodyDiv.innerHTML = `
                    <div style="margin-bottom:0.5rem;">
                        <textarea id="edit-sol-content-${sId}" class="form-textarea" style="min-height:120px;width:100%;box-sizing:border-box;font-family:inherit;font-size:0.95rem;line-height:1.6;padding:0.5rem 0.75rem;">${originalContent}</textarea>
                    </div>
                    <div style="font-size:0.76rem;color:var(--text-muted);margin-bottom:0.5rem;display:flex;align-items:center;gap:0.35rem;">
                        <i class="fa-solid fa-circle-info"></i>
                        <span>Ấn Lưu sẽ tự động chấm điểm và nhận xét lại bài làm.</span>
                    </div>
                    <div style="display:flex;justify-content:flex-end;gap:0.5rem;">
                        <button class="btn btn-secondary btn-sm cancel-edit-btn" style="height:30px;padding:0 0.75rem;font-size:0.8rem;">Hủy</button>
                        <button class="btn btn-primary btn-sm save-edit-btn" style="height:30px;padding:0 0.75rem;font-size:0.8rem;background:linear-gradient(135deg,#6366f1,#8b5cf6);border:none;font-weight:600;">Lưu &amp; Chấm lại</button>
                    </div>
                `;

                // Bind Cancel click
                bodyDiv.querySelector(".cancel-edit-btn")?.addEventListener("click", () => {
                    bodyDiv.innerHTML = originalHTML;
                });

                // Bind Save click
                bodyDiv.querySelector(".save-edit-btn")?.addEventListener("click", async () => {
                    const newContent = document.getElementById(`edit-sol-content-${sId}`).value.trim();
                    if (!newContent) {
                        showToast("Nội dung không được bỏ trống!", "warning");
                        return;
                    }

                    const saveBtn = bodyDiv.querySelector(".save-edit-btn");
                    saveBtn.disabled = true;
                    saveBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang chấm lại...`;

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
            let imageUrls = [];

            if (mode === 'latex') {
                content = document.getElementById("sol-content").value.trim();
                if (!content) { showToast("Vui lòng điền nội dung lời giải!", "warning"); return; }
            } else if (mode === 'word') {
                content = sQuill ? sQuill.root.innerHTML.trim() : "";
                if (content === "<p><br></p>" || !content) { showToast("Vui lòng soạn thảo lời giải!", "warning"); return; }
            } else if (mode === 'image') {
                content = "[Lời giải dạng hình ảnh]";
                imageUrls = s_uploadedImages;
                imageUrl = imageUrls[0] || ""; // Fallback cho ảnh đầu tiên
                if (imageUrls.length === 0) { showToast("Vui lòng tải lên hoặc chụp ít nhất 1 ảnh lời giải!", "warning"); return; }
            }

            const isGrading = e.submitter?.value === 'grade';

            const submitBtns = e.target.querySelectorAll("button[type='submit']");
            submitBtns.forEach(b => { b.disabled = true; });
            const gradeBtn = e.target.querySelector("button[value='grade']");
            const postBtn = e.target.querySelector("button[value='post']");
            const origGradeHTML = gradeBtn ? gradeBtn.innerHTML : '';
            const origPostHTML = postBtn ? postBtn.innerHTML : '';
            if (isGrading && gradeBtn) gradeBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> AI đang chấm bài...`;
            else if (postBtn) postBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang đăng...`;
            if (isGrading) showToast("AI đang tiến hành chấm bài của bạn, vui lòng đợi trong giây lát...", "info");

            try {
                const solution = await api.addSolution({ problemId: id, author: user.username, authorPicture: user.picture, authorGoogleId: user.googleId, content, imageUrl, imageUrls, skipGrading: !isGrading });
                if (isGrading) {
                    if (solution.status === 'correct') {
                        showToast(`AI chấm: Lời giải chính xác! Bạn được cộng +${problem.points} điểm 🎉`, "success");
                        await refreshCurrentUser();
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
                await refreshCurrentUser();
                viewProblemDetail(id);
            } catch { showToast("Bình luận thất bại!", "error"); }
        });

    } catch (e) { showError(`Không thể tải bài toán: ${e.message}`); }
}

function commentHTML(c) {
    const user = getCurrentUser();
    const likesCount = c.likes ? c.likes.length : 0;
    const dislikesCount = c.dislikes ? c.dislikes.length : 0;
    const hasLiked = user && c.likes && c.likes.includes(user.googleId);
    const hasDisliked = user && c.dislikes && c.dislikes.includes(user.googleId);

    return `
        <div style="display:flex;gap:0.6rem;margin-bottom:1rem;" class="comment-item" data-id="${c._id}">
            <div style="flex-shrink:0;">${avatarTag(c.authorPicture, c.author, 30)}</div>
            <div style="flex:1;background:rgba(255,255,255,0.03);border:1px solid var(--border-color);border-radius:0 10px 10px 10px;padding:0.6rem 0.85rem;">
                <div style="display:flex;gap:0.4rem;align-items:center;margin-bottom:0.2rem;">
                    <strong style="font-size:0.85rem;">${c.author}</strong>
                    <span style="font-size:0.7rem;color:var(--text-muted);">${timeSince(c.createdAt)}</span>
                </div>
                <div style="font-size:0.87rem;margin-bottom:0.4rem;">${c.content}</div>
                <div style="display:flex;gap:0.75rem;align-items:center;font-size:0.78rem;">
                    <button class="comment-vote-btn comment-like-btn ${hasLiked ? 'active-like' : ''}" onclick="voteItem('comments', '${c._id}', 'like')">
                        <i class="fa-solid fa-thumbs-up"></i> <span>${likesCount}</span>
                    </button>
                    <button class="comment-vote-btn comment-dislike-btn ${hasDisliked ? 'active-dislike' : ''}" onclick="voteItem('comments', '${c._id}', 'dislike')">
                        <i class="fa-solid fa-thumbs-down"></i> <span>${dislikesCount}</span>
                    </button>
                </div>
            </div>
        </div>`;
}

// ── EDIT PROBLEM ─────────────────────────────────────────────────────────────
function viewEditProblem(problem) {
    if (!mainContent) return;
    const categoryOptions = ['calculus', 'algebra'].map(c =>
        `<option value="${c}" ${problem.category === c ? 'selected' : ''}>${c === 'calculus' ? 'Giải tích' : 'Đại số tuyến tính'}</option>`
    ).join('');
    mainContent.innerHTML = `
        <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:1.5rem;">
            <button class="btn btn-secondary btn-sm" onclick="viewProblemDetail('${problem._id}')"><i class="fa-solid fa-arrow-left"></i> Quay lại</button>
            <h2 style="margin:0;font-size:1.4rem;"><i class="fa-solid fa-pen-to-square"></i> Chỉnh sửa Đề bài</h2>
        </div>
        <div class="card">
            <form id="edit-prob-form">
                <div class="form-group">
                    <label class="form-label" for="ep-title">Tiêu đề bài toán:</label>
                    <input type="text" id="ep-title" class="form-input" required value="${problem.title.replace(/"/g, '&quot;')}">
                </div>

                <div class="form-group">
                    <label class="form-label">Nội dung đề bài (LaTeX và văn bản):</label>
                    <textarea id="ep-content" class="form-textarea" style="min-height:200px;">${problem.content}</textarea>
                </div>

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-top:1rem;">
                    <div class="form-group">
                        <label class="form-label">Môn học:</label>
                        <select id="ep-category" class="form-select" required>${categoryOptions}</select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Thẻ tag (phân cách dấu phẩy):</label>
                        <input type="text" id="ep-tags" class="form-input" value="${(problem.tags || []).join(', ')}">
                    </div>
                </div>

                <div style="display:grid;grid-template-columns:110px 1fr 1fr;gap:1rem;margin-top:1rem;align-items:end;">
                    <div class="form-group" style="margin-bottom:0;">
                        <label class="form-label">Tổng điểm:</label>
                        <input type="number" id="ep-points" class="form-input" min="1" max="1000" value="${problem.points || 10}" style="text-align:center;font-weight:700;font-size:1.1rem;">
                    </div>
                    <div class="form-group" style="margin-bottom:0;">
                        <label class="form-label">Cấp độ:</label>
                        <select id="ep-difficulty" class="form-select">
                            <option value="easy" ${(problem.difficulty || 'medium') === 'easy' ? 'selected' : ''}>🟢 Dễ</option>
                            <option value="medium" ${(problem.difficulty || 'medium') === 'medium' ? 'selected' : ''}>🟡 Trung bình</option>
                            <option value="hard" ${(problem.difficulty || 'medium') === 'hard' ? 'selected' : ''}>🔴 Khó</option>
                            <option value="extreme" ${(problem.difficulty || 'medium') === 'extreme' ? 'selected' : ''}>⚡ Siêu khó</option>
                        </select>
                    </div>
                    <div class="form-group" style="margin-bottom:0;">
                        <label class="form-label">Thang điểm chấm bài <span style="color:var(--text-muted);font-weight:400;font-size:0.76rem;">(tuỳ chọn)</span>:</label>
                        <textarea id="ep-rubric" class="form-textarea" style="min-height:42px;max-height:120px;resize:vertical;" placeholder="Câu 1 (5đ): ...&#10;Câu 2 (5đ): ...">${problem.gradingRubric || ''}</textarea>
                    </div>
                </div>

                <div style="display:flex;justify-content:flex-end;gap:0.75rem;margin-top:1.5rem;border-top:1px solid var(--border-color);padding-top:1rem;">
                    <button type="button" class="btn btn-secondary" onclick="viewProblemDetail('${problem._id}')">Hủy</button>
                    <button type="submit" id="save-prob-btn" class="btn btn-primary">
                        <i class="fa-solid fa-floppy-disk"></i> Lưu thay đổi
                    </button>
                </div>
            </form>
        </div>`;

    document.getElementById("edit-prob-form")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const title = document.getElementById("ep-title").value.trim();
        const content = document.getElementById("ep-content").value.trim();
        const category = document.getElementById("ep-category").value;
        const tagsRaw = document.getElementById("ep-tags").value;
        const tags = tagsRaw ? tagsRaw.split(",").map(t => t.trim()).filter(Boolean) : [];
        const points = parseInt(document.getElementById("ep-points").value) || 10;
        const gradingRubric = document.getElementById("ep-rubric").value.trim();
        const difficulty = document.getElementById("ep-difficulty").value;

        const btn = document.getElementById("save-prob-btn");
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang lưu...`;

        try {
            await api.updateProblem(problem._id, { title, content, category, tags, points, gradingRubric, difficulty });
            showToast("Đã cập nhật đề bài thành công! ✅", "success");
            window.location.hash = `#problem/${problem._id}`;
            viewProblemDetail(problem._id);
        } catch (err) {
            showToast("Lưu thất bại: " + err.message, "error");
            btn.disabled = false;
            btn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Lưu thay đổi`;
        }
    });
}

// ── CREATE PROBLEM ────────────────────────────────────────────────────────────
function viewCreateProblem() {
    const me = getCurrentUser();
    if (!me || !['admin', 'professor', 'supporter'].includes(me.role)) {
        showError("Bạn không có quyền đăng đề bài mới!");
        return;
    }
    setActiveNav("exercises");
    mainContent.innerHTML = `
        <div class="page-header">
            <div>
                <a href="#exercises" style="font-size:0.9rem;"><i class="fa-solid fa-arrow-left"></i> Quay lại</a>
                <h2 class="page-title" style="margin-top:0.5rem;"><i class="fa-solid fa-pen-to-square"></i> Đăng Đề Bài Mới</h2>
            </div>
        </div>
        <div class="card">
            <!-- ✨ TRỢ LÝ SOẠN ĐỀ AI WIDGET -->
            <div style="margin-bottom: 2rem; padding: 1.25rem; border: 1px dashed rgba(139, 92, 246, 0.4); background: rgba(99,102,241,0.04); border-radius: 12px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; flex-wrap:wrap; gap:0.5rem;">
                    <h3 style="margin:0; font-size:1.1rem; color:#818cf8; display:flex; align-items:center; gap:0.5rem;">
                        <i class="fa-solid fa-wand-magic-sparkles"></i> Trợ lý Soạn đề AI (Beta)
                    </h3>
                    <span style="font-size:0.78rem; color:var(--text-muted);">Tự động tạo đề bài toán tự luận nhanh chóng và tiện lợi</span>
                </div>
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:1rem; align-items:end;">
                    <div class="form-group" style="margin-bottom:0;">
                        <label class="form-label" style="font-size:0.8rem;">Chủ đề toán học:</label>
                        <select id="ai-gen-category" class="form-select">
                            <option value="random">🎲 Ngẫu nhiên</option>
                            <option value="calculus">📐 Giải tích</option>
                            <option value="algebra">🔢 Đại số tuyến tính</option>
                        </select>
                    </div>
                    <div class="form-group" style="margin-bottom:0;">
                        <label class="form-label" style="font-size:0.8rem;">Độ khó đề:</label>
                        <select id="ai-gen-difficulty" class="form-select">
                            <option value="easy">🟢 Dễ</option>
                            <option value="medium" selected>🟡 Trung bình</option>
                            <option value="hard">🔴 Khó</option>
                            <option value="extreme">⚡ Siêu khó</option>
                        </select>
                    </div>
                    <div class="form-group" style="margin-bottom:0;">
                        <label class="form-label" style="font-size:0.8rem;">Số lượng câu hỏi:</label>
                        <select id="ai-gen-count" class="form-select">
                            <option value="1" selected>1 câu hỏi</option>
                            <option value="2">2 câu hỏi</option>
                            <option value="3">3 câu hỏi</option>
                            <option value="4">4 câu hỏi</option>
                            <option value="5">5 câu hỏi</option>
                        </select>
                    </div>
                    <button type="button" id="ai-gen-submit-btn" class="btn btn-primary" style="background:linear-gradient(135deg,#6366f1,#8b5cf6); border:none; height:38px; display:flex; align-items:center; justify-content:center; gap:0.5rem; font-weight:600;">
                        <i class="fa-solid fa-wand-magic-sparkles"></i> Sinh đề bài
                    </button>
                </div>
            </div>

            <form id="create-prob-form">
                <div class="form-group">
                    <label class="form-label" for="p-title">Tiêu đề bài toán:</label>
                    <input type="text" id="p-title" class="form-input" required
                           placeholder="Ví dụ: Tính $\\int_0^1 x^2 e^x dx$">
                </div>
                
                <div class="form-group">
                    <label class="form-label">Chọn phương thức soạn đề bài:</label>
                    <div class="input-modes" id="p-input-modes">
                        <button type="button" class="btn btn-secondary mode-btn active" data-mode="latex"><i class="fa-solid fa-code"></i> LaTeX</button>
                        <button type="button" class="btn btn-secondary mode-btn" data-mode="word"><i class="fa-solid fa-file-word"></i> Văn bản</button>
                        <button type="button" class="btn btn-secondary mode-btn" data-mode="image"><i class="fa-solid fa-camera"></i> Chụp / Tải ảnh</button>
                    </div>
                </div>

                <div class="form-group" id="p-mode-latex-container">
                    <label class="form-label">Nội dung đề bài (LaTeX và văn bản):</label>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
                        <div>
                            <label class="form-label" style="font-size:0.78rem;color:var(--text-muted);">✏️ Soạn LaTeX</label>
                            <textarea id="p-content" class="form-textarea" style="min-height:200px;"
                                oninput="updateProblemPreview()"
                                placeholder="Nhập nội dung. Ví dụ:&#10;Tính tích phân:&#10;$$I = \\int_0^{\\pi}\\sin^2(x)\\,dx$$"></textarea>
                        </div>
                        <div>
                            <label class="form-label" style="font-size:0.78rem;color:var(--text-muted);">👁️ Xem trước</label>
                            <div id="prob-preview" style="min-height:200px;background:var(--bg-input);border:1px solid var(--border-color);border-radius:8px;padding:0.8rem 1rem;overflow-y:auto;line-height:1.8;font-size:1.05rem;"></div>
                        </div>
                    </div>
                </div>

                <div class="form-group" id="p-mode-word-container" style="display:none;">
                    <label class="form-label">Soạn thảo văn bản đề bài:</label>
                    <div id="p-quill-editor" style="min-height:220px;"></div>
                </div>

                <div class="form-group" id="p-mode-image-container" style="display:none;">
                    <label class="form-label">Tải lên hoặc chụp hình ảnh đề bài:</label>
                    <div class="image-upload-zone" onclick="document.getElementById('p-image-file-input').click()">
                        <i class="fa-solid fa-cloud-arrow-up fa-3x"></i>
                        <p>Kéo thả ảnh hoặc click để chọn ảnh đề bài</p>
                        <span>Hỗ trợ PNG, JPG, JPEG</span>
                        <input type="file" id="p-image-file-input" accept="image/*" style="display: none;" multiple onchange="handleImageFileSelect(this, 'problem')">
                        <div id="p-image-upload-status" style="font-size: 0.82rem; color: var(--accent-blue); margin-top: 0.5rem; font-weight: 600;"></div>
                        <div id="p-image-upload-preview"></div>
                    </div>
                </div>

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-top:1.5rem;">
                    <div class="form-group">
                        <label class="form-label">Môn học:</label>
                        <select id="p-category" class="form-select" required>
                            <option value="calculus">Giải tích</option>
                            <option value="algebra">Đại số tuyến tính</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Thẻ tag (phân cách dấu phẩy):</label>
                        <input type="text" id="p-tags" class="form-input" placeholder="tích phân, đạo hàm, giới hạn">
                    </div>
                </div>

                <div style="display:grid;grid-template-columns:110px 1fr 1fr;gap:1rem;margin-top:1rem;align-items:end;">
                    <div class="form-group" style="margin-bottom:0;">
                        <label class="form-label">Tổng điểm:</label>
                        <input type="number" id="p-points" class="form-input" min="1" max="1000" value="10" style="text-align:center;font-weight:700;font-size:1.1rem;">
                    </div>
                    <div class="form-group" style="margin-bottom:0;">
                        <label class="form-label">Cấp độ:</label>
                        <select id="p-difficulty" class="form-select">
                            <option value="easy">🟢 Dễ</option>
                            <option value="medium" selected>🟡 Trung bình</option>
                            <option value="hard">🔴 Khó</option>
                            <option value="extreme">⚡ Siêu khó</option>
                        </select>
                    </div>
                    <div class="form-group" style="margin-bottom:0;">
                        <label class="form-label">Thang điểm chấm bài <span style="color:var(--text-muted);font-weight:400;font-size:0.76rem;">(tuỳ chọn)</span>:</label>
                        <textarea id="p-rubric" class="form-textarea" style="min-height:42px;max-height:120px;resize:vertical;" placeholder="Câu 1 (5đ): ...&#10;Câu 2 (5đ): ..."></textarea>
                    </div>
                </div>
                
                <div style="display:flex;justify-content:flex-end;gap:0.75rem;margin-top:1.5rem;border-top:1px solid var(--border-color);padding-top:1rem;">
                    <a href="#exercises" class="btn btn-secondary">Hủy</a>
                    <button type="submit" id="submit-prob-btn" class="btn btn-primary">
                        <i class="fa-solid fa-paper-plane"></i> Đăng đề bài
                    </button>
                </div>
            </form>
        </div>`;

    // Reset uploaded image variables
    p_uploadedImages = [];

    // Initialize Quill Editor
    let pQuill = null;
    if (window.Quill) {
        pQuill = new Quill('#p-quill-editor', {
            theme: 'snow',
            placeholder: 'Soạn thảo nội dung đề bài giống Word...'
        });
    }

    // AI Generate Problem Button Event Listener
    document.getElementById("ai-gen-submit-btn")?.addEventListener("click", async () => {
        const btn = document.getElementById("ai-gen-submit-btn");
        const category = document.getElementById("ai-gen-category").value;
        const difficulty = document.getElementById("ai-gen-difficulty").value;
        const questionsCount = parseInt(document.getElementById("ai-gen-count").value) || 1;

        const originalHTML = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang sinh đề bài...`;

        try {
            const data = await api.generateProblem({ category, difficulty, questionsCount });
            
            // Tự động chuyển mode soạn thảo sang LaTeX
            const latexModeBtn = document.querySelector('#p-input-modes .mode-btn[data-mode="latex"]');
            if (latexModeBtn) {
                latexModeBtn.click();
            }

            // Autofill các trường thông tin đề bài
            document.getElementById("p-title").value = data.title || "";
            document.getElementById("p-content").value = data.content || "";
            document.getElementById("p-tags").value = (data.tags || []).join(", ");
            document.getElementById("p-category").value = data.category || "calculus";
            document.getElementById("p-difficulty").value = data.difficulty || "medium";
            document.getElementById("p-rubric").value = data.gradingRubric || "";

            // Cập nhật Preview LaTeX
            updateProblemPreview();

            showToast("Đã tự động điền đề bài do AI sinh thành công! ✨", "success");
        } catch (err) {
            showToast("Sinh đề bài bằng AI thất bại: " + err.message, "error");
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalHTML;
        }
    });

    // Tab buttons event listeners
    document.querySelectorAll("#p-input-modes .mode-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll("#p-input-modes .mode-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            const mode = btn.getAttribute("data-mode");
            document.getElementById("p-mode-latex-container").style.display = mode === 'latex' ? 'block' : 'none';
            document.getElementById("p-mode-word-container").style.display = mode === 'word' ? 'block' : 'none';
            document.getElementById("p-mode-image-container").style.display = mode === 'image' ? 'block' : 'none';

            // Update title placeholder based on mode
            const titleInput = document.getElementById("p-title");
            if (titleInput) {
                if (mode === 'latex') {
                    titleInput.placeholder = "Ví dụ: Tính $\\int_0^1 x^2 e^x dx$";
                } else {
                    titleInput.placeholder = "Ví dụ: Tính tích phân từ 0 đến 1 của hàm x bình phương nhân e mũ x";
                }
            }
        });
    });

    document.getElementById("create-prob-form")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const user = getCurrentUser();
        if (!user) { showToast("Vui lòng đăng nhập!", "error"); return; }

        const activeBtn = document.querySelector("#p-input-modes .mode-btn.active");
        const mode = activeBtn ? activeBtn.getAttribute("data-mode") : 'latex';

        let content = "";
        let imageUrl = "";
        let imageUrls = [];

        if (mode === 'latex') {
            content = document.getElementById("p-content").value.trim();
            if (!content) { showToast("Vui lòng điền nội dung đề bài!", "warning"); return; }
        } else if (mode === 'word') {
            content = pQuill ? pQuill.root.innerHTML.trim() : "";
            if (content === "<p><br></p>" || !content) { showToast("Vui lòng soạn thảo đề bài!", "warning"); return; }
        } else if (mode === 'image') {
            content = "[Đề bài dạng hình ảnh]";
            imageUrls = p_uploadedImages;
            imageUrl = imageUrls[0] || ""; // Fallback cho ảnh thứ nhất
            if (imageUrls.length === 0) { showToast("Vui lòng tải lên hoặc chụp ít nhất 1 ảnh đề bài!", "warning"); return; }
        }

        const title = document.getElementById("p-title").value.trim();
        const category = document.getElementById("p-category").value;
        const tagsRaw = document.getElementById("p-tags").value;
        const tags = tagsRaw ? tagsRaw.split(",").map(t => t.trim()).filter(Boolean) : [];
        const points = parseInt(document.getElementById("p-points").value) || 10;
        const gradingRubric = document.getElementById("p-rubric").value.trim();
        const difficulty = document.getElementById("p-difficulty").value;

        const btn = document.getElementById("submit-prob-btn");
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang đăng...`;

        try {
            await api.addProblem({ title, content, category, tags, creator: user.username, creatorPicture: user.picture, creatorGoogleId: user.googleId, points, gradingRubric, difficulty, imageUrl, imageUrls });
            showToast("Đã đăng bài toán! +10 điểm 🎉", "success");
            window.location.hash = "#exercises";
        } catch (err) {
            showToast("Đăng thất bại: " + err.message, "error");
            btn.disabled = false;
            btn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Đăng đề bài`;
        }
    });
}

function updateProblemPreview() {
    const c = document.getElementById("p-content");
    const p = document.getElementById("prob-preview");
    if (c && p) { p.innerHTML = preprocessLaTeX(c.value); renderLaTeX(p); }
}

// ── DISCUSSIONS ───────────────────────────────────────────────────────────────
async function viewDiscussions() {
    setActiveNav("discussions");
    showLoading();
    try {
        const discs = await api.getDiscussions();
        mainContent.innerHTML = `
            <div class="page-header">
                <h2 class="page-title"><i class="fa-solid fa-comments"></i> Diễn Đàn Thảo Luận <span>Toán Học</span></h2>
                <button id="btn-new-disc" class="btn btn-primary"><i class="fa-solid fa-pencil"></i> Tạo chủ đề mới</button>
            </div>
            <div class="card" id="new-disc-card" style="display:none;animation:fadeIn 0.25s ease-out;">
                <h3 style="border-bottom:1px solid var(--border-color);padding-bottom:0.5rem;margin-bottom:1.25rem;">Tạo chủ đề thảo luận mới</h3>
                <form id="create-disc-form">
                    <div class="form-group">
                        <label class="form-label">Tiêu đề:</label>
                        <input type="text" id="d-title" class="form-input" required placeholder="Câu hỏi hoặc chủ đề bạn muốn thảo luận...">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Chuyên mục:</label>
                        <select id="d-category" class="form-select">
                            <option value="Giải tích">Giải tích</option>
                            <option value="Đại số">Đại số</option>
                            <option value="Tài liệu & Kinh nghiệm">Tài liệu &amp; Kinh nghiệm</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Nội dung (hỗ trợ LaTeX):</label>
                        <textarea id="d-content" class="form-textarea" required placeholder="Nội dung chi tiết..."></textarea>
                    </div>
                    <div style="display:flex;justify-content:flex-end;gap:0.5rem;">
                        <button type="button" id="btn-cancel-disc" class="btn btn-secondary">Hủy</button>
                        <button type="submit" class="btn btn-primary">Đăng chủ đề</button>
                    </div>
                </form>
            </div>
            <div id="disc-list">
                ${discs.length === 0
                ? `<div class="card" style="text-align:center;padding:3rem;">
                           <i class="fa-solid fa-comments fa-3x" style="color:var(--text-muted);margin-bottom:1rem;"></i>
                           <p style="color:var(--text-muted);">Chưa có chủ đề nào.</p>
                       </div>`
                : discs.map(d => `
                        <a href="#discussion/${d._id}" class="card" style="display:block;text-decoration:none;margin-bottom:0.75rem;padding:1.1rem;transition:all 0.2s;">
                            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;">
                                <div>
                                    <div style="font-weight:600;margin-bottom:0.4rem;">${d.title}</div>
                                    <div style="font-size:0.82rem;color:var(--text-muted);">
                                        <span><i class="fa-solid fa-user"></i> ${d.creator}</span> &nbsp;·&nbsp;
                                        <span><i class="fa-regular fa-clock"></i> ${timeSince(d.createdAt)}</span>
                                    </div>
                                </div>
                                <div style="display:flex;flex-direction:column;align-items:flex-end;gap:0.4rem;flex-shrink:0;">
                                    <span class="badge badge-tag">${d.category}</span>
                                    <div style="font-size:0.8rem;color:var(--text-muted);">
                                        <span><i class="fa-regular fa-comment"></i> ${d.replies}</span> &nbsp;·&nbsp;
                                        <span><i class="fa-solid fa-eye"></i> ${d.views}</span>
                                    </div>
                                </div>
                            </div>
                        </a>`).join("")}
            </div>`;

        document.getElementById("btn-new-disc")?.addEventListener("click", () => {
            const c = document.getElementById("new-disc-card");
            c.style.display = c.style.display === "none" ? "block" : "none";
        });
        document.getElementById("btn-cancel-disc")?.addEventListener("click", () => {
            document.getElementById("new-disc-card").style.display = "none";
        });
        document.getElementById("create-disc-form")?.addEventListener("submit", async (e) => {
            e.preventDefault();
            const user = getCurrentUser();
            if (!user) { showToast("Vui lòng đăng nhập!", "error"); return; }
            try {
                await api.addDiscussion({
                    title: document.getElementById("d-title").value.trim(),
                    category: document.getElementById("d-category").value,
                    content: document.getElementById("d-content").value.trim(),
                    creator: user.username, creatorPicture: user.picture, creatorGoogleId: user.googleId
                });
                showToast("Đã tạo chủ đề! +5 điểm", "success");
                await refreshCurrentUser();
                viewDiscussions();
            } catch { showToast("Tạo thảo luận thất bại!", "error"); }
        });
        renderLaTeX(mainContent);
    } catch (e) { showError("Không thể tải thảo luận!"); }
}

// ── DISCUSSION DETAIL ─────────────────────────────────────────────────────────
async function viewDiscussionDetail(id) {
    setActiveNav("discussions");
    showLoading();
    try {
        const [disc, comments] = await Promise.all([api.getDiscussion(id), api.getComments('discussion', id)]);
        const user = getCurrentUser();

        const dLikes = disc.likes ? disc.likes.length : 0;
        const dDislikes = disc.dislikes ? disc.dislikes.length : 0;
        const hasLikedDisc = user && disc.likes && disc.likes.includes(user.googleId);
        const hasDislikedDisc = user && disc.dislikes && disc.dislikes.includes(user.googleId);

        mainContent.innerHTML = `
            <div class="page-header">
                <div>
                    <a href="#discussions" style="font-size:0.9rem;"><i class="fa-solid fa-arrow-left"></i> Quay lại diễn đàn</a>
                    <h2 class="page-title" style="margin-top:0.5rem;">${disc.title}</h2>
                </div>
                <span class="badge badge-tag" style="font-size:0.9rem;padding:0.4rem 0.8rem;">${disc.category}</span>
            </div>
            <div class="card" style="margin-bottom:1.5rem;">
                <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:1rem;">
                    ${avatarTag(disc.creatorPicture, disc.creator, 38)}
                    <div>
                        <strong>${disc.creator}</strong>
                        <div style="font-size:0.75rem;color:var(--text-muted);">${timeSince(disc.createdAt)} · ${disc.views} lượt xem</div>
                    </div>
                </div>
                <div style="margin-bottom:1rem; line-height:1.6;">${preprocessLaTeX(disc.content)}</div>
                
                <div style="margin-top:1rem;padding-top:1rem;border-top:1px solid var(--border-color);display:flex;justify-content:flex-end;gap:0.5rem;">
                    <button class="vote-btn ${hasLikedDisc ? 'active-like' : ''}" onclick="voteItem('discussions', '${disc._id}', 'like')">
                        <i class="fa-solid fa-thumbs-up"></i> Thích <span>(${dLikes})</span>
                    </button>
                    <button class="vote-btn ${hasDislikedDisc ? 'active-dislike' : ''}" onclick="voteItem('discussions', '${disc._id}', 'dislike')">
                        <i class="fa-solid fa-thumbs-down"></i> Không thích <span>(${dDislikes})</span>
                    </button>
                </div>
            </div>
            <div class="card">
                <h3 style="margin-bottom:1.25rem;"><i class="fa-solid fa-comments"></i> Phản hồi (${comments.length})</h3>
                <div id="disc-comments">
                    ${comments.length === 0
                ? '<p style="color:var(--text-muted);text-align:center;padding:1rem;">Chưa có phản hồi.</p>'
                : comments.map(c => commentHTML(c)).join("")}
                </div>
                <form id="disc-comment-form" style="display:flex;gap:0.5rem;margin-top:0.75rem;padding-top:0.75rem;border-top:1px solid var(--border-color);">
                    <input type="text" id="disc-comment-input" class="form-input" placeholder="Nhập phản hồi..." required>
                    <button type="submit" class="btn btn-primary"><i class="fa-solid fa-paper-plane"></i> Gửi</button>
                </form>
            </div>`;

        renderLaTeX(mainContent);
        document.getElementById("disc-comment-form")?.addEventListener("submit", async (e) => {
            e.preventDefault();
            const user = getCurrentUser();
            if (!user) { showToast("Vui lòng đăng nhập!", "error"); return; }
            const content = document.getElementById("disc-comment-input").value.trim();
            try {
                await api.addComment({ targetType: 'discussion', targetId: id, author: user.username, authorPicture: user.picture, authorGoogleId: user.googleId, content });
                showToast("Đã gửi phản hồi! +2 điểm", "success");
                await refreshCurrentUser();
                viewDiscussionDetail(id);
            } catch { showToast("Gửi phản hồi thất bại!", "error"); }
        });
    } catch (e) { showError(`Không thể tải thảo luận: ${e.message}`); }
}

// ── CONTESTS ──────────────────────────────────────────────────────────────────
async function viewContests() {
    setActiveNav("contests");
    showLoading();
    try {
        const contests = await api.getContests();
        mainContent.innerHTML = `
            <div class="page-header">
                <h2 class="page-title"><i class="fa-solid fa-trophy"></i> Kỳ Thi &amp; <span>Đấu Trường</span></h2>
            </div>
            ${contests.length === 0
                ? `<div class="card" style="text-align:center;padding:4rem;">
                       <i class="fa-solid fa-trophy fa-3x" style="color:var(--text-muted);margin-bottom:1rem;"></i>
                       <p style="color:var(--text-muted);">Chưa có kỳ thi nào. Hãy theo dõi để cập nhật!</p>
                   </div>`
                : contests.map(c => `
                    <div class="card contest-list-card" onclick="window.location.hash='#contest/${c._id}'" style="margin-bottom:1.5rem;padding:1.5rem;border-left:4px solid ${c.status === 'running' ? 'var(--accent-green)' : c.status === 'upcoming' ? 'var(--accent-blue)' : 'var(--text-muted)'}; cursor: pointer; transition: transform 0.2s ease, box-shadow 0.2s ease;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='var(--shadow-md)';" onmouseout="this.style.transform='none'; this.style.boxShadow='none';">
                        <div style="display:flex;justify-content:space-between;align-items:center;">
                            <div>
                                <h3 style="font-size:1.15rem;margin-bottom:0.4rem;font-weight:700;color:var(--text-primary);">${c.title}</h3>
                                <div style="font-size:0.85rem;color:var(--text-muted);display:flex;gap:1.25rem;">
                                    <span><i class="fa-solid fa-clock"></i> <strong>Thời lượng:</strong> ${c.duration}</span>
                                    <span><i class="fa-solid fa-calendar"></i> <strong>Bắt đầu:</strong> ${c.startTime}</span>
                                </div>
                            </div>
                            <div style="display:flex; gap:0.75rem; align-items:center;">
                                <span class="badge ${c.status === 'running' ? 'badge-calculus' : c.status === 'upcoming' ? 'badge-algebra' : 'badge-tag'}">
                                    ${c.status === 'running' ? '🔴 Đang diễn ra' : c.status === 'upcoming' ? '⏳ Sắp diễn ra' : '✅ Đã kết thúc'}
                                </span>
                                <span style="color: var(--accent-blue); font-size: 0.82rem; font-weight: 600; display: flex; align-items: center; gap: 0.35rem;">
                                    Xem chi tiết <i class="fa-solid fa-arrow-right-long"></i>
                                </span>
                            </div>
                        </div>
                    </div>`).join("")}`;
    } catch (e) { showError("Không thể tải kỳ thi!"); }
}

// ── LEADERBOARD ───────────────────────────────────────────────────────────────
async function viewLeaderboard() {
    setActiveNav("leaderboard");
    showLoading();
    try {
        const users = await api.getUsers();
        const me = getCurrentUser();
        const medals = ['🥇', '🥈', '🥉'];
        mainContent.innerHTML = `
            <div class="page-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
                <h2 class="page-title" style="margin:0;"><i class="fa-solid fa-chart-simple"></i> Bảng Xếp Hạng <span>Cộng Đồng</span></h2>
                <button onclick="window.print()" class="btn btn-secondary btn-print" style="display:inline-flex; align-items:center; gap:0.5rem; padding:0.5rem 1rem; border-radius:8px; font-size:0.9rem; font-weight:600; cursor:pointer;">
                    <i class="fa-solid fa-file-pdf"></i> Xuất PDF / In
                </button>
            </div>
            ${users.length === 0
                ? `<div class="card" style="text-align:center;padding:3rem;">
                       <i class="fa-solid fa-users fa-3x" style="color:var(--text-muted);margin-bottom:1rem;"></i>
                       <p style="color:var(--text-muted);">Chưa có thành viên nào. Hãy đăng nhập và tham gia!</p>
                   </div>`
                : `<div class="card"><div style="overflow-x:auto;">
                       <table style="width:100%;border-collapse:collapse;">
                           <thead>
                               <tr style="border-bottom:1px solid var(--border-color);font-size:0.82rem;color:var(--text-muted);text-align:left;">
                                   <th style="padding:0.75rem;">Hạng</th>
                                   <th style="padding:0.75rem;">Thành viên</th>
                                   <th style="padding:0.75rem;">Cấp bậc</th>
                                   <th style="padding:0.75rem;text-align:right;">Điểm</th>
                               </tr>
                           </thead>
                           <tbody>
                               ${users.map((u, i) => {
                    const isMe = me && me.email === u.email;
                    const displayName = u.fullName || (u.name && u.name !== 'undefined' ? u.name : '') || u.username || 'Người dùng';
                    // Xác định màu nền và viền trái dựa trên thứ hạng (i: 0-indexed) - Tăng độ nổi bật màu sắc
                    let rowStyle = 'border-bottom:1px solid var(--border-color); border-left:5px solid transparent;';
                    if (i === 0) {
                        // Hạng 1: Vàng hoàng kim rực rỡ
                        rowStyle += 'background: rgba(245, 158, 11, 0.18) !important; border-left-color: #f59e0b !important;';
                    } else if (i === 1) {
                        // Hạng 2: Bạc bạch kim sáng
                        rowStyle += 'background: rgba(148, 163, 184, 0.18) !important; border-left-color: #cbd5e1 !important;';
                    } else if (i === 2) {
                        // Hạng 3: Đồng đỏ rực
                        rowStyle += 'background: rgba(180, 83, 9, 0.18) !important; border-left-color: #d97706 !important;';
                    } else if (i >= 3 && i <= 9) {
                        // Hạng 4-10: Xanh biển hy vọng nổi bật
                        rowStyle += 'background: rgba(14, 165, 233, 0.12) !important; border-left-color: #38bdf8 !important;';
                    }

                    if (isMe) {
                        rowStyle += 'background: rgba(99, 102, 241, 0.22) !important; border-left-color: #818cf8 !important; font-weight: 700;';
                    }

                    return `<tr style="${rowStyle}">
                                       <td style="padding:0.9rem 0.75rem;font-size:${i < 3 ? '1.3rem' : '0.9rem'};font-weight:700;">${medals[i] || i + 1}</td>
                                       <td style="padding:0.9rem 0.75rem;">
                                           <div style="display:flex;align-items:center;gap:0.6rem;"><a href="#profile/${u.googleId}" style="display:inline-flex; border-radius:50%;">
                                               <img src="${u.picture || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(displayName)}`}"
                                                    alt="${displayName}" style="width:34px;height:34px;border-radius:50%;object-fit:cover;border:2px solid ${isMe ? 'var(--accent-blue)' : 'var(--border-color)'}"
                                                    onerror="this.src='https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(displayName)}'"></a>
                                               <div>
                                                   <div style="font-weight:600;font-size:0.9rem;"><a href="#profile/${u.googleId}" style="color:var(--text-primary); text-decoration:none; transition:color 0.2s;" onmouseover="this.style.color='var(--accent-blue)'" onmouseout="this.style.color='var(--text-primary)'">${displayName}</a>${isMe ? ' <span style="color:var(--accent-blue);font-size:0.75rem;">(Bạn)</span>' : ''}</div>
                                                   <div style="font-size:0.75rem;color:var(--text-muted);">${isMe ? u.email : u.email.replace(/(.{2})(.*)(@.*)/, '$1***$3')}</div>
                                               </div>
                                           </div>
                                       </td>
                                       <td style="padding:0.9rem 0.75rem;"><span class="badge badge-tag">${u.rank}</span></td>
                                       <td style="padding:0.9rem 0.75rem;text-align:right;font-weight:700;color:var(--accent-blue);">${u.points.toLocaleString()}</td>
                                   </tr>`;
                }).join("")}
                           </tbody>
                       </table>
                   </div></div>`}`;
    } catch (e) { showError("Không thể tải bảng xếp hạng!"); }
}

// ── PROFILE ──────────────────────────────────────────────────────────────────
// ── PROFILE ──────────────────────────────────────────────────────────────────
function getNextRankInfo(pts) {
    const thresholds = [
        { pts: 100, name: 'Bạc' },
        { pts: 300, name: 'Vàng' },
        { pts: 500, name: 'Bạch kim' },
        { pts: 1000, name: 'Kim cương' },
        { pts: 2000, name: 'Tinh anh' },
        { pts: 4000, name: 'Cao thủ' },
        { pts: 8000, name: 'Chiến thần' },
        { pts: 15000, name: 'Thạc sĩ' },
        { pts: 30000, name: 'Tiến sĩ' },
        { pts: 60000, name: 'Phó Giáo sư' },
        { pts: 100000, name: 'Giáo sư' }
    ];
    for (const t of thresholds) {
        if (pts < t.pts) {
            return { nextName: t.name, diff: t.pts - pts };
        }
    }
    return { nextName: 'Tối đa', diff: 0 };
}

async function viewProfile(targetGoogleId) {
    setActiveNav(""); // Clear active nav classes
    showLoading();
    try {
        const me = getCurrentUser();
        // If no targetGoogleId is specified, view our own profile
        const isOwnProfile = !targetGoogleId || (me && targetGoogleId === me.googleId);

        if (!isOwnProfile && !targetGoogleId) {
            showError("Không tìm thấy thông tin người dùng!");
            return;
        }

        // Fetch user data, user problems, user solutions, and all problems
        const [users, allProblems] = await Promise.all([
            api.getUsers(),
            api.getProblems()
        ]);

        let freshMe = null;
        if (isOwnProfile) {
            if (!me) {
                showError("Vui lòng đăng nhập để xem hồ sơ!");
                return;
            }
            freshMe = users.find(u => u.googleId === me.googleId) || me;
            // Update localstorage and header with the fresh data
            const merged = { ...me, ...freshMe };
            localStorage.setItem(GOOGLE_USER_KEY, JSON.stringify(merged));
            updateHeaderWithGoogle(merged);
        } else {
            freshMe = users.find(u => u.googleId === targetGoogleId);
            if (!freshMe) {
                showError("Không tìm thấy người dùng này trên hệ thống!");
                return;
            }
        }

        // Fetch solutions and problems for this user
        const solutions = await api.getUserSolutions(freshMe.googleId);

        // Process solved (correct) and wrong (incorrect) problems
        const solvedSet = new Set(solutions.filter(s => s.status === 'correct').map(s => s.problemId));
        const wrongSet = new Set(solutions.filter(s => s.status === 'incorrect').map(s => s.problemId));
        // Remove from wrongSet if solved correctly in another attempt
        solvedSet.forEach(id => wrongSet.delete(id));

        const correctProblems = allProblems.filter(p => solvedSet.has(p._id));
        const incorrectProblems = allProblems.filter(p => wrongSet.has(p._id));

        let activeTab = 'correct';
        let currentPage = 1;
        const itemsPerPage = 24;

        function updateLayout() {
            const nextInfo = getNextRankInfo(freshMe.points || 0);
            const fbAvatar = `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(freshMe.username)}`;
            const displayEmail = isOwnProfile ? freshMe.email : (freshMe.email ? freshMe.email.replace(/(.{2})(.*)(@.*)/, '$1***$3') : 'Ẩn');

            mainContent.innerHTML = `
                <div class="profile-layout">
                    <aside class="profile-sidebar">
                        <div class="card profile-info-card">
                            <div class="profile-info-header">
                                <h3>${isOwnProfile ? 'Hồ sơ của bạn' : 'Hồ sơ thành viên'}</h3>
                            </div>
                            <div class="profile-info-list">
                                <div class="profile-info-row">
                                    <span class="info-label">Họ và tên</span>
                                    <span class="info-value" id="sidebar-fullName">${freshMe.fullName || (freshMe.name && freshMe.name !== 'undefined' ? freshMe.name : '') || freshMe.username || 'Người dùng'}</span>
                                </div>
                                <div class="profile-info-row">
                                    <span class="info-label">Ngày sinh</span>
                                    <span class="info-value" id="sidebar-dob">${freshMe.dob || 'Chưa cập nhật'}</span>
                                </div>
                                <div class="profile-info-row">
                                    <span class="info-label">Điểm kinh nghiệm</span>
                                    <span class="info-value" id="sidebar-points" style="font-weight:700; color:var(--accent-blue);">${(freshMe.points || 0).toLocaleString()}</span>
                                </div>
                                <div class="profile-info-row">
                                    <span class="info-label">Cấp độ</span>
                                    <span class="info-value" id="sidebar-rank" style="font-weight:600; color:#a855f7;">${freshMe.rank || 'Đồng'}</span>
                                </div>
                                <div class="profile-info-row">
                                    <span class="info-label">Cấp độ tiếp theo</span>
                                    <span class="info-value next-level-value" id="sidebar-nextInfo">
                                        ${nextInfo.nextName === 'Tối đa' ? 'Tối đa' : `<span style="color:#a855f7;font-weight:600;">${nextInfo.nextName}</span><br><span style="font-size:0.75rem;color:var(--text-muted);">thiếu <strong>${nextInfo.diff}</strong> điểm</span>`}
                                    </span>
                                </div>
                                <div class="profile-info-row">
                                    <span class="info-label">Email</span>
                                    <span class="info-value email-value" title="${isOwnProfile ? freshMe.email : ''}">${displayEmail}</span>
                                </div>
                                <div class="profile-info-row">
                                    <span class="info-label">Đăng ký lúc</span>
                                    <span class="info-value">${freshMe.joinedAt ? new Date(freshMe.joinedAt).toLocaleDateString('vi-VN') : 'Chưa cập nhật'}</span>
                                </div>
                                <div class="profile-info-row">
                                    <span class="info-label">Login cuối</span>
                                    <span class="info-value">${freshMe.lastLogin ? new Date(freshMe.lastLogin).toLocaleString('vi-VN') : 'Chưa cập nhật'}</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="card profile-stat-box">
                            <div class="stat-lbl">Tổng số bài làm được</div>
                            <div class="stat-val" id="sidebar-solvedCount">${correctProblems.length} bài</div>
                        </div>
                    </aside>
                    
                    <section class="profile-content-area">
                        <div class="card profile-header-banner">
                            <div class="banner-overlay">
                                <div class="banner-avatar">
                                    <img src="${freshMe.picture || fbAvatar}" alt="Avatar" id="profile-banner-avatar-img" onerror="this.src='${fbAvatar}'">
                                </div>
                                <div class="banner-user-info">
                                    <h2 id="banner-username">${freshMe.fullName || (freshMe.name && freshMe.name !== 'undefined' ? freshMe.name : '') || freshMe.username || 'Người dùng'}</h2>
                                    <p><span class="badge badge-tag" id="banner-rank" style="background:rgba(56,189,248,0.15); color:var(--accent-blue);">${freshMe.rank}</span></p>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Profile Tab Navigation -->
                        <div class="profile-tabs">
                            <button class="profile-tab-btn active" data-tab="correct"><i class="fa-solid fa-circle-check" style="color:var(--accent-green);"></i> Bài làm đúng</button>
                            <button class="profile-tab-btn" data-tab="incorrect"><i class="fa-solid fa-circle-xmark" style="color:var(--accent-red);"></i> Bài làm sai</button>
                            ${isOwnProfile ? `
                                <button class="profile-tab-btn" data-tab="settings"><i class="fa-solid fa-user-gear"></i> Cài đặt</button>
                                <button class="profile-tab-btn" data-tab="avatar"><i class="fa-solid fa-image"></i> Đổi hình đại diện</button>
                            ` : ''}
                        </div>
                        
                        <!-- Profile Tab Content Container -->
                        <div class="profile-tab-content" id="profile-tab-content-container">
                            <!-- Dynamic tab contents -->
                        </div>
                    </section>
                </div>
            `;

            // Bind click events on tab buttons
            document.querySelectorAll(".profile-tab-btn").forEach(btn => {
                btn.addEventListener("click", () => {
                    document.querySelectorAll(".profile-tab-btn").forEach(b => b.classList.remove("active"));
                    btn.classList.add("active");
                    activeTab = btn.getAttribute("data-tab");
                    currentPage = 1;
                    renderTabContent();
                });
            });

            // Initial render
            renderTabContent();
        }

        function renderTabContent() {
            const container = document.getElementById("profile-tab-content-container");
            if (!container) return;

            if (activeTab === 'correct' || activeTab === 'incorrect') {
                const list = activeTab === 'correct' ? correctProblems : incorrectProblems;
                const totalItems = list.length;
                const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;

                if (currentPage > totalPages) currentPage = totalPages;
                const startIndex = (currentPage - 1) * itemsPerPage;
                const pageItems = list.slice(startIndex, startIndex + itemsPerPage);

                container.innerHTML = `
                    ${totalItems === 0 ? `
                        <div style="text-align:center; padding:3rem; color:var(--text-muted);">
                            <i class="fa-solid ${activeTab === 'correct' ? 'fa-circle-check' : 'fa-circle-xmark'} fa-3x" style="margin-bottom:1rem; opacity:0.4;"></i>
                            <p>Không có bài tập nào.</p>
                        </div>
                    ` : `
                        <div class="problems-grid">
                            ${pageItems.map(p => `
                                <a href="#problem/${p._id}" class="grid-problem-link" title="${p.title.replace(/"/g, '&quot;')}">
                                    ${preprocessLaTeX(p.title)}
                                </a>
                            `).join("")}
                        </div>
                        
                        ${totalPages > 1 ? `
                            <div class="profile-pagination">
                                <button class="pag-btn prev-btn" ${currentPage === 1 ? 'disabled' : ''}>«</button>
                                ${Array.from({ length: totalPages }, (_, i) => i + 1).map(p => `
                                    <button class="pag-btn num-btn ${p === currentPage ? 'active' : ''}" data-page="${p}">${p}</button>
                                `).join("")}
                                <button class="pag-btn next-btn" ${currentPage === totalPages ? 'disabled' : ''}>»</button>
                            </div>
                        ` : ''}
                    `}
                `;

                // Bind pagination clicks
                container.querySelector(".prev-btn")?.addEventListener("click", () => {
                    if (currentPage > 1) { currentPage--; renderTabContent(); }
                });
                container.querySelector(".next-btn")?.addEventListener("click", () => {
                    if (currentPage < totalPages) { currentPage++; renderTabContent(); }
                });
                container.querySelectorAll(".num-btn").forEach(btn => {
                    btn.addEventListener("click", () => {
                        currentPage = parseInt(btn.getAttribute("data-page"));
                        renderTabContent();
                    });
                });

                // Render KaTeX for titles containing LaTeX
                renderLaTeX(container);

            } else if (activeTab === 'settings') {
                container.innerHTML = `<form id="profile-settings-form" class="settings-form">
                        <div class="form-grid" style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
                            <div class="form-group">
                                <label class="form-label" for="edit-fullname">Họ và tên:</label>
                                <input type="text" id="edit-fullname" class="form-input" value="${freshMe.fullName || freshMe.name || ''}">
                            </div>
                            <div class="form-group">
                                <label class="form-label" for="edit-dob">Ngày sinh (DD/MM/YYYY):</label>
                                <input type="text" id="edit-dob" class="form-input" value="${freshMe.dob || ''}">
                            </div>
                        </div>
                        <button type="submit" class="btn btn-primary" style="margin-top:1.5rem;"><i class="fa-solid fa-save"></i> Lưu cài đặt</button>
                    </form>`;

                // Handle submit
                document.getElementById("profile-settings-form").addEventListener("submit", async (e) => {
                    e.preventDefault();
                    const fullName = document.getElementById("edit-fullname").value.trim();
                    const dob = document.getElementById("edit-dob").value.trim();

                    const btn = e.target.querySelector("button[type='submit']");
                    btn.disabled = true;
                    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang lưu...`;

                    try {
                        const updated = await api.updateProfile(freshMe.googleId, { fullName, dob });
                        freshMe = updated;
                        // Update localstorage cache
                        const localCached = getCurrentUser();
                        if (localCached) {
                            const merged = { ...localCached, ...updated };
                            localStorage.setItem(GOOGLE_USER_KEY, JSON.stringify(merged));
                            updateHeaderWithGoogle(merged);
                        }
                        showToast("Đã lưu thông tin cài đặt!", "success");
                        updateLayout();
                    } catch (err) {
                        showToast("Không thể lưu cài đặt: " + err.message, "error");
                        btn.disabled = false;
                        btn.innerHTML = `<i class="fa-solid fa-save"></i> Lưu cài đặt`;
                    }
                });

            } else if (activeTab === 'avatar') {
                container.innerHTML = `
                    <div class="avatar-upload-tab" style="display:flex; flex-direction:column; align-items:center; text-align:center; padding:1rem 0;">
                        <p style="color:var(--text-secondary); margin-bottom:1.5rem;">Tải lên hoặc chụp ảnh mới để cập nhật ảnh đại diện của bạn.</p>
                        
                        <div class="avatar-preview-box" style="margin-bottom:1.5rem;">
                            <img src="${freshMe.picture || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(freshMe.username)}`}" 
                                 alt="Avatar Preview" id="avatar-tab-preview-img" 
                                 style="width:120px; height:120px; border-radius:50%; object-fit:cover; border:3px solid var(--accent-blue); box-shadow:var(--shadow-md);">
                        </div>
                        
                        <div class="image-upload-zone" id="avatar-upload-zone" style="max-width:320px; width:100%; cursor:pointer;" onclick="document.getElementById('avatar-file-input').click()">
                            <i class="fa-solid fa-cloud-arrow-up fa-2x" style="color:var(--text-secondary); margin-bottom:0.5rem;"></i>
                            <p style="margin:0; font-size:0.9rem; color:var(--text-secondary);">Chọn tệp hình ảnh</p>
                            <input type="file" id="avatar-file-input" accept="image/*" style="display: none;">
                        </div>
                        
                        <div id="avatar-upload-status" style="font-size: 0.82rem; color: var(--accent-blue); margin-top: 0.75rem; font-weight: 600;"></div>
                        
                        <button id="save-avatar-btn" class="btn btn-primary" style="margin-top:1.5rem; width:100%; max-width:320px;" disabled>
                            <i class="fa-solid fa-circle-check"></i> Cập nhật ảnh đại diện
                        </button>
                    </div>
                `;

                let selectedBase64 = null;
                const fileInput = document.getElementById("avatar-file-input");
                const previewImg = document.getElementById("avatar-tab-preview-img");
                const saveBtn = document.getElementById("save-avatar-btn");
                const statusDiv = document.getElementById("avatar-upload-status");

                fileInput.addEventListener("change", () => {
                    const file = fileInput.files[0];
                    if (!file) return;

                    if (!file.type.startsWith('image/')) {
                        showToast("Vui lòng chọn hình ảnh hợp lệ!", "error");
                        return;
                    }

                    statusDiv.textContent = "Đang đọc ảnh...";
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        selectedBase64 = e.target.result;
                        previewImg.src = selectedBase64;
                        saveBtn.disabled = false;
                        statusDiv.textContent = "Tải ảnh lên thành công! Nhấn cập nhật để lưu.";
                    };
                    reader.readAsDataURL(file);
                });

                saveBtn.addEventListener("click", async () => {
                    if (!selectedBase64) return;
                    saveBtn.disabled = true;
                    saveBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang tải...`;

                    try {
                        const updated = await api.updateProfile(freshMe.googleId, { picture: selectedBase64 });
                        freshMe = updated;
                        // Update local cache
                        const localCached = getCurrentUser();
                        if (localCached) {
                            const merged = { ...localCached, picture: selectedBase64 };
                            localStorage.setItem(GOOGLE_USER_KEY, JSON.stringify(merged));
                            updateHeaderWithGoogle(merged);
                        }
                        showToast("Đã cập nhật ảnh đại diện thành công!", "success");
                        updateLayout();
                    } catch (err) {
                        showToast("Cập nhật ảnh đại diện thất bại!", "error");
                        saveBtn.disabled = false;
                        saveBtn.innerHTML = `<i class="fa-solid fa-circle-check"></i> Cập nhật ảnh đại diện`;
                    }
                });
            }
        }

        // Render main layout
        updateLayout();

    } catch (e) {
        showError("Không thể tải hồ sơ cá nhân!");
    }
}

// ── ADMIN PANEL ──────────────────────────────────────────────────────────────
async function viewAdmin() {
    setActiveNav(""); // Clear active nav classes
    showLoading();
    try {
        const me = getCurrentUser();
        const isStaff = me && ['admin', 'professor', 'supporter'].includes(me.role);
        if (!isStaff) {
            showError("Bạn không có quyền truy cập trang quản lý!");
            return;
        }

        // Fetch data
        const [users, problems, contests] = await Promise.all([
            api.getUsers(),
            api.getProblems(),
            api.getContests()
        ]);

        mainContent.innerHTML = `
            <div class="page-header">
                <h2 class="page-title"><i class="fa-solid fa-lock"></i> Trang <span>Quản Lý Hệ Thống</span></h2>
            </div>

            <!-- Tabs Navigation -->
            <div id="admin-tabs" style="display: flex; gap: 0.5rem; margin-bottom: 1.5rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">
                ${['admin', 'professor'].includes(me.role) ? `<button class="filter-tag-btn active" data-tab="contests"><i class="fa-solid fa-trophy"></i> Quản lý Kỳ thi</button>` : ''}
                ${['admin', 'professor', 'supporter'].includes(me.role) ? `<button class="filter-tag-btn ${!['admin', 'professor'].includes(me.role) ? 'active' : ''}" data-tab="problems"><i class="fa-solid fa-book-open"></i> Quản lý Đề bài</button>` : ''}
                ${me.role === 'admin' ? `<button class="filter-tag-btn ${!['admin', 'professor'].includes(me.role) && !['admin', 'professor', 'supporter'].includes(me.role) ? 'active' : ''}" data-tab="users"><i class="fa-solid fa-users"></i> Quản lý Thành viên</button>` : ''}
            </div>

            <!-- Tab 1: CONTESTS MANAGER -->
            ${['admin', 'professor'].includes(me.role) ? `
            <div id="admin-tab-contests" class="admin-tab-content">
                <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 1.5rem;">
                    <!-- List Contests -->
                    <div class="card">
                        <h3 style="margin-bottom: 1rem; font-size: 1.1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">Danh sách kỳ thi</h3>
                        <div style="display: flex; flex-direction: column; gap: 0.75rem; max-height: 450px; overflow-y: auto;">
                            ${contests.length === 0
                    ? `<p style="color: var(--text-muted); text-align: center; padding: 2rem;">Chưa có kỳ thi nào.</p>`
                    : contests.map(c => `
                                    <div style="padding: 0.85rem; background: rgba(255,255,255,0.01); border: 1px solid var(--border-color); border-radius: 8px; display: flex; justify-content: space-between; align-items: center; gap: 1rem;">
                                        <div>
                                            <div style="font-weight: 600; font-size: 0.95rem; margin-bottom: 0.25rem;">${c.title}</div>
                                            <div style="font-size: 0.78rem; color: var(--text-muted); display: flex; gap: 0.75rem;">
                                                <span>Thời gian: ${c.duration}</span>
                                                <span>Bắt đầu: ${c.startTime}</span>
                                            </div>
                                        </div>
                                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                                            <span class="badge ${c.status === 'running' ? 'badge-calculus' : c.status === 'upcoming' ? 'badge-algebra' : 'badge-tag'}" style="font-size: 0.75rem;">
                                                ${c.status === 'running' ? '🔴 Đang chạy' : c.status === 'upcoming' ? '⏳ Sắp mở' : '✅ Đã đóng'}
                                            </span>
                                            <button class="btn btn-secondary btn-sm" onclick="viewEditContestQuestions('${c._id}')" style="padding: 0.35rem 0.5rem; color: var(--accent-orange);" title="Soạn đề thi">
                                                <i class="fa-solid fa-file-signature"></i> Soạn đề
                                            </button>
                                            <button class="btn btn-secondary btn-sm extend-contest-btn" data-id="${c._id}" data-title="${c.title}" data-duration="${c.duration}" style="padding: 0.35rem 0.5rem; color: var(--accent-blue);" title="Gia hạn thời gian">
                                                <i class="fa-solid fa-clock-rotate-left"></i> Gia hạn
                                            </button>
                                            ${c.status === 'running' ? `
                                                <button class="btn btn-secondary btn-sm toggle-contest-status-btn" data-id="${c._id}" data-target-status="ended" style="padding: 0.35rem 0.5rem; color: var(--accent-orange);" title="Dừng kỳ thi">
                                                    <i class="fa-solid fa-circle-stop"></i> Dừng
                                                </button>
                                            ` : (c.status === 'ended' ? `
                                                <button class="btn btn-secondary btn-sm toggle-contest-status-btn" data-id="${c._id}" data-target-status="running" style="padding: 0.35rem 0.5rem; color: var(--accent-green);" title="Tiếp tục kỳ thi">
                                                    <i class="fa-solid fa-circle-play"></i> Tiếp tục
                                                </button>
                                            ` : '')}
                                            <button class="btn btn-secondary btn-sm delete-contest-btn" data-id="${c._id}" style="padding: 0.35rem 0.5rem; color: var(--accent-red);">
                                                <i class="fa-regular fa-trash-can"></i>
                                            </button>
                                        </div>
                                    </div>
                                `).join("")
                }
                        </div>
                    </div>

                    <!-- Create Contest Form -->
                    <div class="card">
                        <h3 style="margin-bottom: 1rem; font-size: 1.1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">Tạo kỳ thi mới</h3>
                        <form id="create-contest-form">
                            <div class="form-group">
                                <label class="form-label" for="c-title">Tiêu đề kỳ thi:</label>
                                <input type="text" id="c-title" class="form-input" required placeholder="Ví dụ: Giữa kỳ Giải tích 1">
                            </div>
                            <div class="form-group">
                                <label class="form-label" for="c-duration">Thời lượng:</label>
                                <select id="c-duration" class="form-select" style="background:var(--bg-input); border:1px solid var(--border-color); color:inherit; padding:0.625rem; border-radius:8px; width: 100%;">
                                    <option value="45 phút">45 phút</option>
                                    <option value="60 phút">60 phút</option>
                                    <option value="90 phút" selected>90 phút</option>
                                    <option value="120 phút">120 phút</option>
                                    <option value="150 phút">150 phút</option>
                                    <option value="180 phút">180 phút</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label" for="c-start">Thời gian bắt đầu:</label>
                                <input type="datetime-local" id="c-start" class="form-input" required style="background:var(--bg-input); border:1px solid var(--border-color); color:inherit; padding:0.625rem; border-radius:8px; width: 100%;">
                            </div>
                            <div class="form-group">
                                <label class="form-label" for="c-status">Trạng thái:</label>
                                <select id="c-status" class="form-select" style="background:var(--bg-input); border:1px solid var(--border-color); color:inherit; padding:0.625rem; border-radius:8px; width: 100%;">
                                    <option value="upcoming">Chưa bắt đầu</option>
                                    <option value="running">Đang diễn ra</option>
                                    <option value="ended">Đã kết thúc</option>
                                </select>
                            </div>
                            
                            
                            <button type="submit" class="btn btn-primary" style="margin-top: 1rem; width: 100%;"><i class="fa-solid fa-plus"></i> Tạo kỳ thi</button>
                        </form>
                    </div>
                </div>
            </div>
            ` : ''}

            <!-- Tab 2: PROBLEMS MANAGER -->
            ${['admin', 'professor', 'supporter'].includes(me.role) ? `
            <div id="admin-tab-problems" class="admin-tab-content" style="${!['admin', 'professor'].includes(me.role) ? '' : 'display: none;'}">
                <div class="card">
                    <h3 style="margin-bottom: 1rem; font-size: 1.1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">Quản lý kho đề bài</h3>
                    <div style="display: flex; flex-direction: column; gap: 0.75rem; max-height: 500px; overflow-y: auto;">
                        ${problems.length === 0
                    ? `<p style="color: var(--text-muted); text-align: center; padding: 2rem;">Chưa có đề bài nào.</p>`
                    : problems.map(p => `
                                <div style="padding: 0.85rem; background: rgba(255,255,255,0.01); border: 1px solid var(--border-color); border-radius: 8px; display: flex; justify-content: space-between; align-items: center; gap: 1rem;">
                                    <div>
                                        <div style="font-weight: 600; font-size: 0.95rem; margin-bottom: 0.25rem;">${preprocessLaTeX(p.title)}</div>
                                        <div style="font-size: 0.78rem; color: var(--text-muted); display: flex; gap: 0.75rem;">
                                            <span>Người đăng: ${p.creator}</span>
                                            <span>Phân loại: ${p.category === 'calculus' ? 'Giải tích' : 'Đại số'}</span>
                                        </div>
                                    </div>
                                    <button class="btn btn-secondary btn-sm delete-problem-btn" data-id="${p._id}" style="padding: 0.35rem 0.5rem; color: var(--accent-red);">
                                        <i class="fa-regular fa-trash-can"></i> Xóa đề
                                    </button>
                                </div>
                            `).join("")
                }
                    </div>
                </div>
            </div>
            ` : ''}

            <!-- Tab 3: USERS MANAGER -->
            ${me.role === 'admin' ? `
            <div id="admin-tab-users" class="admin-tab-content" style="display: none;">
                <div class="card">
                    <h3 style="margin-bottom: 1rem; font-size: 1.1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">Phân vai trò &amp; Quản lý điểm số</h3>
                    <div style="overflow-x: auto;">
                        <table style="width: 100%; border-collapse: collapse; min-width: 600px;">
                            <thead>
                                <tr style="border-bottom: 1px solid var(--border-color); font-size: 0.82rem; color: var(--text-muted); text-align: left;">
                                    <th style="padding: 0.75rem;">Thành viên</th>
                                    <th style="padding: 0.75rem;">Vai trò</th>
                                    <th style="padding: 0.75rem;">Cấp bậc</th>
                                    <th style="padding: 0.75rem;">Điểm hiện tại</th>
                                    <th style="padding: 0.75rem; text-align: right;">Cộng / Trừ điểm</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${users.map(u => `
                                    <tr style="border-bottom: 1px solid var(--border-color);">
                                        <td style="padding: 0.75rem;">
                                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                                <img src="${u.picture || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(u.name)}`}" 
                                                     style="width: 30px; height: 30px; border-radius: 50%; object-fit: cover;"
                                                     onerror="this.src='https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(u.name)}'">
                                                <div>
                                                    <div style="font-weight: 600; font-size: 0.88rem;">${u.fullName || u.name}</div>
                                                    <div style="font-size: 0.72rem; color: var(--text-muted);">${u.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td style="padding: 0.75rem;">
                                            <select class="form-select role-select" data-gid="${u.googleId}" style="font-size: 0.75rem; padding: 0.2rem 0.4rem; height: auto; width: auto; display: inline-block; background: var(--bg-input); border: 1px solid var(--border-color); color: var(--text-primary); border-radius: 4px;" ${u.role === 'admin' ? 'disabled' : ''}>
                                                <option value="user" ${u.role === 'user' ? 'selected' : ''}>Thành viên</option>
                                                <option value="professor" ${u.role === 'professor' ? 'selected' : ''}>Professor</option>
                                                <option value="supporter" ${u.role === 'supporter' ? 'selected' : ''}>Supporter</option>
                                                ${u.role === 'admin' ? '<option value="admin" selected>Admin</option>' : ''}
                                            </select>
                                        </td>
                                        <td style="padding: 0.75rem;">
                                            <span class="badge badge-tag" style="font-size: 0.72rem;">${u.rank}</span>
                                        </td>
                                        <td style="padding: 0.75rem; font-weight: 700; color: var(--accent-blue);">
                                            ${u.points}
                                        </td>
                                        <td style="padding: 0.75rem; text-align: right;">
                                            <div style="display: inline-flex; gap: 0.25rem;">
                                                <input type="number" class="form-input pts-adjust-input" data-gid="${u.googleId}" style="width: 70px; padding: 0.25rem 0.4rem; font-size: 0.8rem; height: auto;" value="10">
                                                <button class="btn btn-primary btn-sm adjust-pts-btn" data-gid="${u.googleId}" data-dir="1" style="padding: 0.25rem 0.5rem; font-size: 0.8rem;"><i class="fa-solid fa-plus"></i></button>
                                                <button class="btn btn-secondary btn-sm adjust-pts-btn" data-gid="${u.googleId}" data-dir="-1" style="padding: 0.25rem 0.5rem; font-size: 0.8rem;"><i class="fa-solid fa-minus"></i></button>
                                            </div>
                                        </td>
                                    </tr>
                                `).join("")}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            ` : ''}
        `;
        // Add Tabs Event Listeners
        document.querySelectorAll("#admin-tabs .filter-tag-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                document.querySelectorAll("#admin-tabs .filter-tag-btn").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                const tab = btn.getAttribute("data-tab");
                document.querySelectorAll(".admin-tab-content").forEach(content => content.style.display = "none");
                document.getElementById(`admin-tab-${tab}`).style.display = "block";
            });
        });



        // Add Contest submission
        document.getElementById("create-contest-form")?.addEventListener("submit", async (e) => {
            e.preventDefault();
            const title = document.getElementById("c-title").value.trim();
            const duration = document.getElementById("c-duration").value;
            const startInputVal = document.getElementById("c-start").value;
            
            let startTime = "";
            if (startInputVal) {
                const [datePart, timePart] = startInputVal.split('T');
                const [year, month, day] = datePart.split('-');
                startTime = `${timePart} ${day}/${month}/${year}`;
            }
            
            const status = document.getElementById("c-status").value;
            const statusLabel = status === 'upcoming' ? 'Chưa bắt đầu' : status === 'running' ? 'Đang diễn ra' : 'Đã kết thúc';

            const confirmMsg = `Bạn có chắc chắn muốn tạo kỳ thi này với thông tin sau?\n\n` +
                               `- Tiêu đề: ${title}\n` +
                               `- Thời lượng: ${duration}\n` +
                               `- Bắt đầu lúc: ${startTime}\n` +
                               `- Trạng thái: ${statusLabel}`;

            if (!confirm(confirmMsg)) return;

            try {
                const newContest = await api.addContest({ title, duration, startTime, status });
                showToast("Thông tin kỳ thi đã tạo! Vui lòng soạn đề thi bên dưới.", "success");
                viewEditContestQuestions(newContest._id);
            } catch (err) {
                showToast("Tạo kỳ thi thất bại!", "error");
            }
        });

        // Extend Contest Time Action
        document.querySelectorAll(".extend-contest-btn").forEach(btn => {
            btn.addEventListener("click", async () => {
                const id = btn.getAttribute("data-id");
                const currentDuration = btn.getAttribute("data-duration") || "90 phút";
                const currentMins = parseInt(currentDuration) || 90;
                
                const val = prompt(`Gia hạn thời gian cho kỳ thi. Nhập số phút muốn cộng thêm (tối đa 180 phút):`, "30");
                if (val === null) return;
                
                const addedMins = parseInt(val) || 0;
                if (addedMins <= 0 || addedMins > 180) {
                    showToast("Số phút gia hạn không hợp lệ (từ 1 đến 180 phút)!", "warning");
                    return;
                }
                
                const newDuration = `${currentMins + addedMins} phút`;
                try {
                    await api.updateContest(id, { duration: newDuration });
                    showToast(`Đã gia hạn thêm ${addedMins} phút cho kỳ thi thành công!`, "success");
                    viewAdmin();
                } catch (err) {
                    showToast("Gia hạn thất bại!", "error");
                }
            });
        });

        // Pause / Resume Contest Action
        document.querySelectorAll(".toggle-contest-status-btn").forEach(btn => {
            btn.addEventListener("click", async () => {
                const id = btn.getAttribute("data-id");
                const targetStatus = btn.getAttribute("data-target-status");
                const actionText = targetStatus === 'ended' ? 'Dừng' : 'Tiếp tục';
                
                if (!confirm(`Bạn có chắc chắn muốn ${actionText} kỳ thi này không?`)) return;
                
                try {
                    await api.updateContest(id, { status: targetStatus });
                    showToast(`Đã ${actionText} kỳ thi thành công!`, "success");
                    viewAdmin();
                } catch {
                    showToast(`Không thể ${actionText} kỳ thi!`, "error");
                }
            });
        });

        // Delete Contest Action
        document.querySelectorAll(".delete-contest-btn").forEach(btn => {
            btn.addEventListener("click", async () => {
                if (!confirm("Bạn có chắc chắn muốn xóa kỳ thi này không?")) return;
                const id = btn.getAttribute("data-id");
                try {
                    await api.deleteContest(id);
                    showToast("Đã xóa kỳ thi!", "success");
                    viewAdmin();
                } catch { showToast("Không thể xóa kỳ thi!", "error"); }
            });
        });

        // Delete Problem Action
        document.querySelectorAll(".delete-problem-btn").forEach(btn => {
            btn.addEventListener("click", async () => {
                if (!confirm("Bạn có chắc chắn muốn xóa đề bài này không?")) return;
                const id = btn.getAttribute("data-id");
                try {
                    await api.deleteProblem(id);
                    showToast("Đã xóa đề bài khỏi hệ thống!", "success");
                    viewAdmin();
                } catch { showToast("Không thể xóa đề bài!", "error"); }
            });
        });

        // Change Role Action
        document.querySelectorAll(".role-select").forEach(select => {
            select.addEventListener("change", async (e) => {
                const gid = select.getAttribute("data-gid");
                const role = select.value;
                try {
                    await api.updateRole(gid, role);
                    showToast("Đã cập nhật vai trò thành công!", "success");
                    viewAdmin();
                } catch (err) {
                    showToast("Không thể cập nhật vai trò: " + err.message, "error");
                }
            });
        });

        // Adjust Points Action
        document.querySelectorAll(".adjust-pts-btn").forEach(btn => {
            btn.addEventListener("click", async () => {
                const gid = btn.getAttribute("data-gid");
                const dir = parseInt(btn.getAttribute("data-dir"));
                const input = document.querySelector(`.pts-adjust-input[data-gid="${gid}"]`);
                const val = parseInt(input.value) || 0;
                if (val <= 0) return;
                try {
                    const amount = dir * val;
                    const u = await api.addPoints(gid, amount);
                    showToast(`Đã cập nhật điểm cho ${u.name}! Tổng điểm mới: ${u.points}`, "success");
                    // Refresh tab users content
                    viewAdmin();
                } catch { showToast("Lỗi khi điều chỉnh điểm!", "error"); }
            });
        });

        // Render LaTeX for Admin Panel
        renderLaTeX(mainContent);

    } catch (e) {
        showError("Lỗi tải trang quản trị!");
    }
}

// ─── 6. ROUTER ────────────────────────────────────────────────────────────────

async function router() {
    const hash = window.location.hash || "#home";
    
    // Standalone contest leaderboard route
    if (hash.startsWith("#contest/") && hash.endsWith("/leaderboard")) {
        const parts = hash.split("/");
        const contestId = parts[1];
        await viewStandaloneLeaderboard(contestId);
        return;
    }
    renderSidebars(); // load sidebar in background

    if (hash === "#home" || hash === "#" || hash === "") { await viewHome(); return; }
    if (hash.startsWith("#problem/")) { await viewProblemDetail(hash.split("/")[1]); return; }
    if (hash.startsWith("#discussion/")) { await viewDiscussionDetail(hash.split("/")[1]); return; }
    if (hash.startsWith("#profile/")) { await viewProfile(hash.split("/")[1]); return; }
    if (hash.startsWith("#contest/")) { await viewContestDetail(hash.split("/")[1]); return; }

    const map = {
        exercises: () => viewExercises(),
        'create-problem': viewCreateProblem,
        discussions: viewDiscussions,
        contests: viewContests,
        leaderboard: viewLeaderboard,
        profile: viewProfile,
        about: viewAbout,
        admin: viewAdmin
    };

    const fn = map[hash.substring(1)];
    if (fn) await fn(); else await viewHome();
}

async function viewAbout() {
    setActiveNav(""); // Unset active state for standard nav items
    if (!mainContent) return;

    showLoading();

    try {
        mainContent.innerHTML = `
        <div style="max-width: 900px; margin: 0 auto; padding: 1.5rem 0.5rem;">
            <!-- Hero Header Section -->
            <div style="text-align: center; padding: 3rem 1.5rem; background: linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.12) 100%); border: 1px solid rgba(99,102,241,0.2); border-radius: 16px; margin-bottom: 2rem; position: relative; overflow: hidden;">
                <div style="position: absolute; top: -50px; left: -50px; width: 150px; height: 150px; background: rgba(99,102,241,0.15); filter: blur(50px); border-radius: 50%;"></div>
                <div style="position: absolute; bottom: -50px; right: -50px; width: 150px; height: 150px; background: rgba(139,92,246,0.15); filter: blur(50px); border-radius: 50%;"></div>
                
                <img src="logo.png" alt="UPMath Logo" style="height: 80px; width: 80px; border-radius: 16px; object-fit: contain; box-shadow: 0 10px 25px rgba(0,0,0,0.3); margin-bottom: 1.5rem; border: 1px solid rgba(255,255,255,0.1);">
                
                <h1 style="font-size: 2.2rem; font-weight: 800; background: linear-gradient(135deg, #a5b4fc, #c084fc); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 0 0 0.5rem 0; letter-spacing: -0.5px;">UPMath</h1>
                <p style="font-size: 1.15rem; color: #a78bfa; font-weight: 600; margin: 0 0 1.25rem 0; letter-spacing: 0.5px;">KHƠI NGUỒN CẢM HỨNG – KẾT NỐI TRI THỨC TOÁN HỌC</p>
                <div style="max-width: 600px; margin: 0 auto; line-height: 1.7; color: var(--text-secondary); font-size: 0.95rem;">
                    Chào các bạn, những người yêu Toán!
                </div>
                
                <div style="margin-top: 1.75rem; display: flex; justify-content: center; gap: 1rem;">
                    <a href="#exercises" class="btn btn-primary" style="background: linear-gradient(135deg, #6366f1, #8b5cf6); border: none; padding: 0.6rem 1.5rem; font-weight: 600; border-radius: 8px;">
                        <i class="fa-solid fa-graduation-cap"></i> Học tập ngay
                    </a>
                    <a href="#discussions" class="btn btn-secondary" style="padding: 0.6rem 1.5rem; border-radius: 8px;">
                        <i class="fa-solid fa-comments"></i> Thảo luận nhóm
                    </a>
                </div>
            </div>

            <!-- Introduction Narrative -->
            <div class="card" style="padding: 2rem; margin-bottom: 2rem; border-left: 4px solid #6366f1;">
                <p style="margin-top: 0; line-height: 1.8; color: var(--text-primary); font-size: 1rem; font-style: italic;">
                    "Chắc hẳn ai từng vật lộn với những bài toán khó đều hiểu: Hành trình chinh phục những con số, những giới hạn hay ma trận đôi khi rất gian nan. Sẽ có những lúc bạn giải mãi không ra, không biết mình sai ở bước nào, hay đơn giản là cần một người để thảo luận. Thấu hiểu những khó khăn đó, dự án UPMath đã được chúng mình ấp ủ và cho ra đời."
                </p>
                <p style="margin-bottom: 0; line-height: 1.8; color: var(--text-secondary); font-size: 0.95rem;">
                    UPMath không phải là một cỗ máy giải toán tự động khô khan. Chúng mình xây dựng nền tảng này với mong muốn tạo ra một không gian học tập thực sự – nơi bạn không chỉ tìm thấy đáp án, mà còn hiểu được bản chất của vấn đề.
                </p>
            </div>

            <!-- Features Portfolio Grid -->
            <h2 style="font-size: 1.35rem; font-weight: 700; color: var(--text-primary); margin-bottom: 1.25rem; display: flex; align-items: center; gap: 0.5rem;">
                <i class="fa-solid fa-star" style="color: #fbbf24;"></i> Các tính năng thiết thực tại UPMath
            </h2>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1.25rem; margin-bottom: 2rem;">
                <!-- Feature 1 -->
                <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 12px; padding: 1.5rem; transition: transform 0.25s ease, border-color 0.25s ease;" onmouseover="this.style.transform='translateY(-4px)'; this.style.borderColor='rgba(99,102,241,0.4)';" onmouseout="this.style.transform='none'; this.style.borderColor='var(--border-color)';">
                    <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.85rem;">
                        <div style="background: rgba(99,102,241,0.15); color: #818cf8; width: 38px; height: 38px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 1.1rem;">
                            <i class="fa-solid fa-book-open"></i>
                        </div>
                        <h3 style="font-size: 1.05rem; font-weight: 700; margin: 0; color: var(--text-primary);">Kho bài tập đa dạng, bài bản</h3>
                    </div>
                    <p style="font-size: 0.88rem; line-height: 1.6; color: var(--text-muted); margin: 0;">
                        Tập trung vào các mảng kiến thức quan trọng như Giải tích và Đại số tuyến tính, hệ thống bài tập được sắp xếp khoa học giúp bạn ôn luyện từ cơ bản đến nâng cao.
                    </p>
                </div>

                <!-- Feature 2 -->
                <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 12px; padding: 1.5rem; transition: transform 0.25s ease, border-color 0.25s ease;" onmouseover="this.style.transform='translateY(-4px)'; this.style.borderColor='rgba(99,102,241,0.4)';" onmouseout="this.style.transform='none'; this.style.borderColor='var(--border-color)';">
                    <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.85rem;">
                        <div style="background: rgba(139,92,246,0.15); color: #a78bfa; width: 38px; height: 38px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 1.1rem;">
                            <i class="fa-solid fa-graduation-cap"></i>
                        </div>
                        <h3 style="font-size: 1.05rem; font-weight: 700; margin: 0; color: var(--text-primary);">"Gia sư" chấm chữa thông minh</h3>
                    </div>
                    <p style="font-size: 0.88rem; line-height: 1.6; color: var(--text-muted); margin: 0;">
                        Khi bạn nộp bài, hệ thống sẽ tự động phân tích từng bước giải của bạn, chỉ ra lỗi sai và gợi ý định hướng thân thiện để bạn dễ dàng hiểu bài và tự giải quyết.
                    </p>
                </div>

                <!-- Feature 3 -->
                <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 12px; padding: 1.5rem; transition: transform 0.25s ease, border-color 0.25s ease;" onmouseover="this.style.transform='translateY(-4px)'; this.style.borderColor='rgba(99,102,241,0.4)';" onmouseout="this.style.transform='none'; this.style.borderColor='var(--border-color)';">
                    <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.85rem;">
                        <div style="background: rgba(236,72,153,0.15); color: #f472b6; width: 38px; height: 38px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 1.1rem;">
                            <i class="fa-solid fa-code"></i>
                        </div>
                        <h3 style="font-size: 1.05rem; font-weight: 700; margin: 0; color: var(--text-primary);">Hiển thị chuẩn mực LaTeX</h3>
                    </div>
                    <p style="font-size: 0.88rem; line-height: 1.6; color: var(--text-muted); margin: 0;">
                        Tạm biệt những công thức lộn xộn, khó nhìn. Mọi biểu thức toán học trên nền tảng đều được tối ưu hiển thị cực kỳ sắc nét bằng chuẩn LaTeX mượt mà.
                    </p>
                </div>

                <!-- Feature 4 -->
                <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 12px; padding: 1.5rem; transition: transform 0.25s ease, border-color 0.25s ease;" onmouseover="this.style.transform='translateY(-4px)'; this.style.borderColor='rgba(99,102,241,0.4)';" onmouseout="this.style.transform='none'; this.style.borderColor='var(--border-color)';">
                    <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.85rem;">
                        <div style="background: rgba(16,185,129,0.15); color: #34d399; width: 38px; height: 38px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 1.1rem;">
                            <i class="fa-solid fa-images"></i>
                        </div>
                        <h3 style="font-size: 1.05rem; font-weight: 700; margin: 0; color: var(--text-primary);">Tải ảnh & Quản lý linh hoạt</h3>
                    </div>
                    <p style="font-size: 0.88rem; line-height: 1.6; color: var(--text-muted); margin: 0;">
                        Hỗ trợ người dùng đăng câu hỏi và gửi nhiều ảnh bài làm, kèm theo tính năng xem trước và gỡ bỏ ảnh trực tiếp cực kỳ trực quan và nhanh gọn.
                    </p>
                </div>

                <!-- Feature 5 -->
                <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 12px; padding: 1.5rem; transition: transform 0.25s ease, border-color 0.25s ease;" onmouseover="this.style.transform='translateY(-4px)'; this.style.borderColor='rgba(99,102,241,0.4)';" onmouseout="this.style.transform='none'; this.style.borderColor='var(--border-color)';">
                    <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.85rem;">
                        <div style="background: rgba(245,158,11,0.15); color: #fbbf24; width: 38px; height: 38px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 1.1rem;">
                            <i class="fa-solid fa-wand-magic-sparkles"></i>
                        </div>
                        <h3 style="font-size: 1.05rem; font-weight: 700; margin: 0; color: var(--text-primary);">Trợ thủ cho Giảng viên</h3>
                    </div>
                    <p style="font-size: 0.88rem; line-height: 1.6; color: var(--text-muted); margin: 0;">
                        Tính năng tạo "Bài tương tự" giúp thầy cô và trợ giảng tiết kiệm tối đa thời gian biên soạn câu hỏi tự luận và đáp án đề bài tương đồng cấu trúc.
                    </p>
                </div>

                <!-- Feature 6 -->
                <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 12px; padding: 1.5rem; transition: transform 0.25s ease, border-color 0.25s ease;" onmouseover="this.style.transform='translateY(-4px)'; this.style.borderColor='rgba(99,102,241,0.4)';" onmouseout="this.style.transform='none'; this.style.borderColor='var(--border-color)';">
                    <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.85rem;">
                        <div style="background: rgba(59,130,246,0.15); color: #60a5fa; width: 38px; height: 38px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 1.1rem;">
                            <i class="fa-solid fa-comments"></i>
                        </div>
                        <h3 style="font-size: 1.05rem; font-weight: 700; margin: 0; color: var(--text-primary);">Cộng đồng học tập gắn kết</h3>
                    </div>
                    <p style="font-size: 0.88rem; line-height: 1.6; color: var(--text-muted); margin: 0;">
                        Kênh thảo luận và Shoutbox trực tuyến giúp bạn hỏi bài trong thời gian thực. Đóng góp lời giải của bạn được vinh danh trên Bảng xếp hạng.
                    </p>
                </div>
            </div>

            <!-- Footer Quote / Call to action -->
            <div style="text-align: center; padding: 2rem; background: rgba(255,255,255,0.01); border: 1px dashed var(--border-color); border-radius: 12px; margin-top: 2rem;">
                <p style="font-size: 1rem; line-height: 1.7; color: var(--text-secondary); margin-top: 0;">
                    Toán học chưa bao giờ là những con số vô hồn nếu chúng ta biết cách tiếp cận nó. Dù bạn là một học sinh đang tìm kiếm lời giải, hay một giáo viên muốn tìm nguồn tài liệu chất lượng, UPMath luôn mở cửa chào đón bạn.
                </p>
                <div style="font-weight: 700; color: var(--accent-blue); font-size: 0.95rem; margin-top: 1rem;">
                    UPMath - Nơi bạn tìm thấy niềm vui học Toán.
                </div>
            </div>
        </div>
        `;

        renderLaTeX(mainContent);
    } catch (e) {
        showError("Lỗi tải trang giới thiệu!");
    }
}


// Global listener for AI Problem Generation in Contest creation
document.addEventListener("click", async (e) => {
    const btn = e.target.closest(".c-ai-gen-btn");
    if (btn) {
        const targetId = btn.getAttribute("data-target");
        const textarea = document.getElementById(targetId);
        if (!textarea) return;

        const category = document.getElementById("c-category").value;
        const difficulty = document.getElementById("c-difficulty").value;

        btn.disabled = true;
        const originalHtml = btn.innerHTML;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang sinh...`;

        try {
            const res = await api.generateProblem({ category, difficulty });
            if (res && res.content) {
                textarea.value = res.content;
                showToast("Đã sinh đề ngẫu nhiên thành công!", "success");
            } else {
                showToast("Không nhận được nội dung từ AI!", "error");
            }
        } catch (err) {
            showToast("Sinh đề ngẫu nhiên thất bại!", "error");
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        }
    }
});


// Global listener for contest question mode switching
document.addEventListener("click", (e) => {
    const btn = e.target.closest(".q-mode-btn");
    if (btn) {
        const mode = btn.getAttribute("data-mode");
        const idx = btn.getAttribute("data-index");
        const modesContainer = btn.closest(".q-modes");
        
        // Toggle active button
        modesContainer.querySelectorAll(".q-mode-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        
        // Toggle containers
        document.querySelectorAll(`.q-mode-container[data-index="${idx}"]`).forEach(c => {
            c.style.display = "none";
        });
        
        if (mode === "latex") {
            document.getElementById(`q-latex-container-${idx}`).style.display = "block";
        } else if (mode === "word") {
            document.getElementById(`q-word-container-${idx}`).style.display = "block";
            // Lazy init Quill if not initialized
            const quillId = `c-question-quill-${idx}`;
            window.contestQuills = window.contestQuills || {};
            if (!window.contestQuills[idx]) {
                window.contestQuills[idx] = new Quill(`#${quillId}`, { theme: 'snow' });
            }
        } else if (mode === "image") {
            document.getElementById(`q-image-container-${idx}`).style.display = "block";
        }
    }
});

// Image handler for contest questions
window.handleContestQuestionImage = function(input, index) {
    const file = input.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const base64 = e.target.result;
            window.contestImages = window.contestImages || {};
            window.contestImages[index] = base64;
            
            const preview = document.getElementById(`c-question-img-preview-${index}`);
            preview.style.display = "block";
            preview.innerHTML = `<img src="${base64}" style="max-height: 100px; border-radius: 6px; margin-top: 10px;" />`;
        };
        reader.readAsDataURL(file);
    }
};



async function viewStandaloneLeaderboard(contestId) {
    // Overwrite page HTML structure to render ONLY the leaderboard cleanly
    document.body.innerHTML = `
        <div style="display:flex; justify-content:center; align-items:center; min-height:100vh; background:#0b0f19; color:#f8fafc; font-family:'Be Vietnam Pro',sans-serif; padding:2rem;">
            <div id="standalone-leaderboard-container" style="width:100%; max-width:1000px; background:#111827; border:1px solid #1f2937; border-radius:16px; padding:2rem; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.3);">
                <div style="text-align:center; padding:3rem;">
                    <i class="fa-solid fa-spinner fa-spin fa-2x" style="color:var(--accent-orange);"></i>
                    <p style="margin-top:1rem; color:#9ca3af;">Đang tải bảng thành tích...</p>
                </div>
            </div>
        </div>
    `;

    try {
        const contests = await api.getContests();
        const c = contests.find(item => item._id === contestId);
        if (!c) {
            document.getElementById("standalone-leaderboard-container").innerHTML = `
                <div style="text-align:center; padding:2rem; color:#f43f5e;">
                    <i class="fa-solid fa-circle-exclamation fa-2x"></i>
                    <p style="margin-top:1rem;">Không tìm thấy kỳ thi!</p>
                </div>`;
            return;
        }

        const problems = await api.getProblems();
        const contestProblems = problems.filter(p => p.contestId === contestId).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

        const allSolutions = [];
        for (let p of contestProblems) {
            try {
                const sols = await api.getSolutions(p._id);
                allSolutions.push(...sols);
            } catch (err) {
                console.error(err);
            }
        }

        const users = await api.getUsers();
        const participantUsers = users.filter(u => c.participants && c.participants.includes(u.googleId));

        const leaderboardData = participantUsers.map(u => {
            let totalPoints = 0;
            const problemStatuses = contestProblems.map(p => {
                const userSols = allSolutions.filter(s => s.problemId === p._id && s.authorGoogleId === u.googleId);
                const correctSol = userSols.find(s => s.status === 'correct');
                const pendingSol = userSols.find(s => s.status === 'pending');
                const incorrectSol = userSols.find(s => s.status === 'incorrect');

                if (correctSol) {
                    totalPoints += p.points || 10;
                    return { status: 'correct', sol: correctSol };
                } else if (pendingSol) {
                    return { status: 'pending', sol: pendingSol };
                } else if (incorrectSol) {
                    return { status: 'incorrect', sol: incorrectSol };
                }
                return { status: 'none', sol: null };
            });

            return {
                user: u,
                problemStatuses,
                totalPoints
            };
        }).sort((a, b) => b.totalPoints - a.totalPoints);

        const problemHeaders = contestProblems.map((p, idx) => `<th style="padding: 12px; text-align: center; border-bottom: 1px solid #1f2937; color: #9ca3af; font-weight: 600; font-size: 0.85rem; text-transform: uppercase;">Câu ${idx+1}</th>`).join("");

        const rows = leaderboardData.length === 0 ? `
            <tr>
                <td colspan="${4 + contestProblems.length}" style="text-align:center; padding: 32px; color:#9ca3af; font-style:italic;">
                    Chưa có thí sinh nào đăng ký tham gia kỳ thi này.
                </td>
            </tr>
        ` : leaderboardData.map((data, idx) => {
            const username = data.user.mssv || (data.user.email ? data.user.email.split('@')[0] : 'N/A');
            const cells = data.problemStatuses.map(status => {
                let bg = 'transparent';
                let color = '#e2e8f0';
                let text = '-';
                if (status.status === 'correct') {
                    bg = '#10b981';
                    color = '#ffffff';
                    text = 'Đúng';
                } else if (status.status === 'pending') {
                    bg = '#fbbf24';
                    color = '#1e293b';
                    text = 'Chờ';
                } else if (status.status === 'incorrect') {
                    bg = '#f43f5e';
                    color = '#ffffff';
                    text = 'Sai';
                }
                return `<td style="padding: 12px; text-align: center; border-bottom: 1px solid #1f2937;">
                    ${text !== '-' ? `<span style="background:${bg}; color:${color}; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">${text}</span>` : '-'}
                </td>`;
            }).join("");

            return `
                <tr style="border-bottom: 1px solid #1f2937; transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.01)'" onmouseout="this.style.background='none'">
                    <td style="padding: 12px; border-bottom: 1px solid #1f2937; color:#e2e8f0;">${idx + 1}</td>
                    <td style="padding: 12px; font-weight: 600; color: #6366f1; border-bottom: 1px solid #1f2937;">${username}</td>
                    <td style="padding: 12px; border-bottom: 1px solid #1f2937; color: #e2e8f0;">${data.user.name}</td>
                    <td style="padding: 12px; text-align: center; font-weight: 700; color: #f59e0b; border-bottom: 1px solid #1f2937;">${data.totalPoints}</td>
                    ${cells}
                </tr>
            `;
        }).join("");

        document.getElementById("standalone-leaderboard-container").innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #1f2937; padding-bottom: 1.25rem; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
                <div style="display: flex; align-items: center; gap: 0.6rem;">
                    <img src="logo.png" style="height: 32px;" />
                    <span style="font-weight: 800; font-size: 1.45rem; color: #ffffff; letter-spacing: -0.5px; font-family: 'Be Vietnam Pro', sans-serif;">UP<span style="color: #6366f1;">Math</span></span>
                </div>
                <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
                    <button onclick="window.print()" class="btn-print" style="display: inline-flex; align-items: center; gap: 0.5rem; background: #374151; color: #ffffff; border: none; padding: 0.5rem 1rem; border-radius: 8px; font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='#4b5563'" onmouseout="this.style.background='#374151'">
                        <i class="fa-solid fa-file-pdf"></i> Xuất PDF / In
                    </button>
                    <div style="display: flex; align-items: center; gap: 0.5rem; color: #9ca3af; font-weight: 500; font-size: 0.95rem; background: rgba(255,255,255,0.03); padding: 0.4rem 0.85rem; border-radius: 20px; border: 1px solid #1f2937;">
                        <i class="fa-solid fa-ranking-star" style="color: #f59e0b;"></i>
                        <span>${c.title}</span>
                    </div>
                </div>
            </div>

            <div class="leaderboard-legend" style="display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.5rem; font-size: 0.85rem; color: #9ca3af; background: #1f2937; padding: 0.75rem 1rem; border-radius: 8px;">
                <div style="display:flex; align-items:center; gap:0.35rem;"><span style="width:12px; height:12px; border-radius:3px; background:#10b981;"></span> Đúng (Có điểm)</div>
                <div style="display:flex; align-items:center; gap:0.35rem;"><span style="width:12px; height:12px; border-radius:3px; background:#fbbf24;"></span> Đang chấm (Pending)</div>
                <div style="display:flex; align-items:center; gap:0.35rem;"><span style="width:12px; height:12px; border-radius:3px; background:#f43f5e;"></span> Làm sai</div>
            </div>

            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.95rem;">
                    <thead>
                        <tr>
                            <th style="padding: 12px; border-bottom: 1px solid #1f2937; color: #9ca3af; font-weight: 600; font-size: 0.85rem; text-transform: uppercase;">STT</th>
                            <th style="padding: 12px; border-bottom: 1px solid #1f2937; color: #9ca3af; font-weight: 600; font-size: 0.85rem; text-transform: uppercase;">Username</th>
                            <th style="padding: 12px; border-bottom: 1px solid #1f2937; color: #9ca3af; font-weight: 600; font-size: 0.85rem; text-transform: uppercase;">Họ và tên</th>
                            <th style="padding: 12px; text-align: center; border-bottom: 1px solid #1f2937; color: #9ca3af; font-weight: 600; font-size: 0.85rem; text-transform: uppercase;">Tổng điểm</th>
                            ${problemHeaders}
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
        `;
    } catch (err) {
        document.getElementById("standalone-leaderboard-container").innerHTML = `
            <div style="text-align:center; padding:2rem; color:#f43f5e;">
                <i class="fa-solid fa-circle-exclamation fa-2x"></i>
                <p style="margin-top:1rem;">Lỗi tải dữ liệu!</p>
            </div>`;
    }
}


// ─── 7. BOOT ──────────────────────────────────────────────────────────────────

window.addEventListener("hashchange", () => router());
window.addEventListener("load", checkAuthAndBoot);

// Sidebar left filter delegation
document.addEventListener("click", (e) => {
    const btn = e.target.closest(".sidebar-left .filter-tag-btn");
    if (btn) {
        const cat = btn.getAttribute("data-category");
        if (!cat) return;
        document.querySelectorAll(".sidebar-left .filter-tag-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        window.location.hash = "#exercises";
        setTimeout(() => viewExercises(cat), 50);
    }
});

// Close reactions menu when clicking outside
document.addEventListener("click", () => {
    document.querySelectorAll(".reaction-emoji-bar").forEach(bar => {
        bar.classList.remove("active");
        bar.closest(".shout-msg-hover-actions")?.classList.remove("active");
    });
});

window.handlePortalMockLogin = function (e) {
    e.preventDefault();
    const userInp = document.getElementById("portal-username");
    const passInp = document.getElementById("portal-password");
    const userErr = document.getElementById("portal-username-error");
    const passErr = document.getElementById("portal-password-error");

    let hasError = false;

    if (!userInp.value.trim()) {
        userInp.classList.add("has-error");
        if (userErr) userErr.style.display = "block";
        hasError = true;
    } else {
        userInp.classList.remove("has-error");
        if (userErr) userErr.style.display = "none";
    }

    if (!passInp.value.trim()) {
        passInp.classList.add("has-error");
        if (passErr) passErr.style.display = "block";
        hasError = true;
    } else {
        passInp.classList.remove("has-error");
        if (passErr) passErr.style.display = "none";
    }

    if (!hasError) {
        showToast("Để đồng bộ học tập, vui lòng đăng nhập bằng tài khoản Google trường cấp ở nút phía dưới! 🔑", "info");
    }
};


async function viewContestDetail(id) {
    setActiveNav("contests");
    showLoading();
    try {
        const contests = await api.getContests();
        const c = contests.find(item => item._id === id);
        if (!c) { showError("Không tìm thấy kỳ thi!"); return; }

        const me = getCurrentUser();
        const isRegistered = c.participants && c.participants.includes(me?.googleId);

        // Fetch all problems linked to this contest
        const problems = await api.getProblems();
        const contestProblems = problems.filter(p => p.contestId === id).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

        // Fetch all solutions for these problems
        const allSolutions = [];
        for (let p of contestProblems) {
            try {
                const sols = await api.getSolutions(p._id);
                allSolutions.push(...sols);
            } catch (err) {
                console.error(err);
            }
        }

        // Fetch users to display names/school details on leaderboard
        const users = await api.getUsers();
        const participantUsers = users.filter(u => c.participants && c.participants.includes(u.googleId));

        // Group solutions by user & calculate score
        const leaderboardData = participantUsers.map(u => {
            let totalPoints = 0;
            let timeScore = 0;
            const problemStatuses = contestProblems.map(p => {
                const userSols = allSolutions.filter(s => s.problemId === p._id && s.authorGoogleId === u.googleId);
                const correctSol = userSols.find(s => s.status === 'correct');
                const pendingSol = userSols.find(s => s.status === 'pending');
                const incorrectSol = userSols.find(s => s.status === 'incorrect');

                if (correctSol) {
                    totalPoints += p.points || 10;
                    return { status: 'correct', sol: correctSol };
                } else if (pendingSol) {
                    return { status: 'pending', sol: pendingSol };
                } else if (incorrectSol) {
                    return { status: 'incorrect', sol: incorrectSol };
                }
                return { status: 'none', sol: null };
            });

            return {
                user: u,
                totalPoints,
                timeScore,
                problemStatuses
            };
        }).sort((a, b) => b.totalPoints - a.totalPoints);

        const statusLabel = c.status === 'running' ? '🔴 Đang diễn ra' : c.status === 'upcoming' ? '⏳ Sắp bắt đầu' : '✅ Đã kết thúc';

        mainContent.innerHTML = `
            <div class="page-header" style="margin-bottom: 1.5rem;">
                <h2 class="page-title"><i class="fa-solid fa-trophy"></i> Chi Tiết <span>Kỳ Thi</span></h2>
                <button class="btn btn-secondary btn-sm" onclick="window.location.hash='#contests'" style="height: 38px; display:flex; align-items:center; gap:0.5rem;"><i class="fa-solid fa-arrow-left"></i> Quay lại</button>
            </div>

            <div class="card" style="margin-bottom: 1.5rem; padding: 1.5rem; border-left: 4px solid ${c.status === 'running' ? 'var(--accent-green)' : c.status === 'upcoming' ? 'var(--accent-blue)' : 'var(--text-muted)'};">
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-color); padding-bottom: 0.75rem; margin-bottom: 1rem;">
                    <div>
                        <h3 style="font-size: 1.3rem; font-weight:700; color:var(--text-primary); margin-bottom:0.25rem;">${c.title}</h3>
                        <div style="font-size:0.88rem; color:var(--text-secondary); display:flex; gap:1.5rem;">
                            <span>⏱️ <strong>Thời lượng:</strong> ${c.duration}</span>
                            <span>📅 <strong>Bắt đầu:</strong> ${c.startTime}</span>
                        </div>
                    </div>
                    <div style="display:flex; gap: 0.75rem; align-items:center;">
                        <span class="badge ${c.status === 'running' ? 'badge-calculus' : c.status === 'upcoming' ? 'badge-algebra' : 'badge-tag'}">${statusLabel}</span>
                        ${!isRegistered && me ? `
                            <button id="register-contest-btn" class="btn btn-primary btn-sm" style="background: linear-gradient(135deg,#4f46e5,#6366f1); border:none;"><i class="fa-solid fa-user-plus"></i> Đăng ký tham gia</button>
                        ` : (isRegistered ? `
                            <span class="badge badge-calculus" style="background: rgba(16,185,129,0.15); color: #10b981; border: 1px solid rgba(16,185,129,0.25);"><i class="fa-solid fa-circle-check"></i> Đã đăng ký</span>
                        ` : '')}
                    </div>
                </div>

                ${!isRegistered ? `
                    <div class="contest-question-box" style="background: rgba(255,255,255,0.02); padding: 1.5rem; border-radius: 8px; border: 1px solid var(--border-color); text-align: center; color: var(--text-muted);">
                        <i class="fa-solid fa-user-lock fa-3x" style="color: var(--accent-orange); margin-bottom: 1rem;"></i>
                        <p style="font-size: 1.05rem; font-weight:600; color: var(--text-primary);">Đề thi đã bị khóa</p>
                        <p style="font-size: 0.88rem; margin-top:0.5rem; color: var(--text-secondary);">Bạn cần nhấn nút <strong>Đăng ký tham gia</strong> ở phía trên để có quyền xem đề thi và làm bài.</p>
                    </div>
                ` : (c.status === 'upcoming' ? `
                    <div class="contest-question-box" style="background: rgba(255,255,255,0.02); padding: 1.5rem; border-radius: 8px; border: 1px solid var(--border-color); text-align: center; color: var(--text-muted);">
                        <i class="fa-solid fa-lock fa-3x" style="color: var(--accent-orange); margin-bottom: 1rem;"></i>
                        <p style="font-size: 1rem; font-weight:600;">Nội dung đề thi được bảo mật và sẽ tự động mở khi kỳ thi chính thức bắt đầu.</p>
                    </div>
                ` : `
                    <div class="contest-question-box" style="background: rgba(255,255,255,0.01); padding: 1.25rem; border-radius: 8px; border: 1px solid var(--border-color);">
                        <h4 style="font-size: 1rem; font-weight:700; color:var(--accent-blue); margin-bottom: 0.75rem;"><i class="fa-solid fa-file-invoice"></i> Đề thi chính thức:</h4>
                        
                        <div style="display:flex; flex-direction:column; gap:1rem; margin-bottom: 1.25rem;">
                            ${contestProblems.map((p, idx) => `
                                <div style="background: rgba(255,255,255,0.015); padding: 1rem; border-radius: 8px; border: 1px solid var(--border-color); border-left: 4px solid var(--accent-orange);">
                                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
                                        <span style="font-weight:700; color:var(--accent-orange);">Câu ${idx+1}</span>
                                        <a href="#problem/${p._id}" class="btn btn-secondary btn-xs" style="padding:0.25rem 0.5rem; font-size:0.75rem; border-radius:6px;"><i class="fa-solid fa-pen-to-square"></i> Làm bài này</a>
                                    </div>
                                    <div style="line-height:1.75; font-size:0.95rem;">
                                        ${preprocessLaTeX(p.content)}
                                    </div>
                                </div>
                            `).join("")}
                        </div>
                    </div>
                `)}
            </div>

            
            <!-- LEADERBOARD TRIGGER BUTTON -->
            <div style="margin-top: 1.5rem; display: flex; justify-content: center;">
                <button id="view-contest-leaderboard-btn" class="btn btn-primary" style="background: linear-gradient(135deg, #f59e0b, #d97706); border: none; color: white; display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1.75rem; font-size: 0.95rem; font-weight: 600; border-radius: 8px; box-shadow: var(--shadow-sm); cursor: pointer; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='none'">
                    <i class="fa-solid fa-ranking-star"></i> Xem Bảng Thành Tích Kỳ Thi
                </button>
            </div>

        `;

        // Register Button click handler
        document.getElementById("register-contest-btn")?.addEventListener("click", async () => {
            if (!me) { showToast("Vui lòng đăng nhập để đăng ký!", "error"); return; }
            try {
                await api.registerContest(id, { userEmail: me.email, googleId: me.googleId });
                showToast("Đăng ký tham gia kỳ thi thành công! Kiểm tra hộp thư của bạn 📧", "success");
                viewContestDetail(id);
            } catch (err) {
                showToast("Đăng ký thất bại: " + err.message, "error");
            }
        });

        // Register leaderboard modal listener
        document.getElementById("view-contest-leaderboard-btn")?.addEventListener("click", () => {
            window.open(`#contest/${id}/leaderboard`, "_blank");
        });

        renderLaTeX(mainContent);
    } catch (e) {
        showError("Không thể tải chi tiết kỳ thi!");
    }
}



// Helper to render question row with three input modes
function renderQuestionInputRow(idx, prefilledValue = "") {
    const isImage = prefilledValue.startsWith("data:image/") || prefilledValue.startsWith("<img");
    const isWord = prefilledValue.includes("<p>") || prefilledValue.includes("<br>") || prefilledValue.includes("<strong>");
    const initialMode = isImage ? "image" : (isWord ? "word" : "latex");
    
    // Store image base64 if prefilled
    if (isImage) {
        window.contestImages = window.contestImages || {};
        if (prefilledValue.startsWith("<img")) {
            // extract base64 from src
            const match = prefilledValue.match(/src="([^"]+)"/);
            if (match) window.contestImages[idx] = match[1];
        } else {
            window.contestImages[idx] = prefilledValue;
        }
    }

    return `
        <div class="form-group c-question-item" data-index="${idx}" style="margin-top: ${idx > 1 ? '1rem' : '0'}; border: 1px solid var(--border-color); padding: 1.25rem; border-radius: 8px; background: rgba(255,255,255,0.015);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 0.75rem;">
                <label class="form-label" style="font-weight: 600; color: var(--accent-orange); margin-bottom: 0;">Câu ${idx}:</label>
                <div style="display:flex; gap:0.5rem; align-items:center;">
                    <div class="input-modes q-modes" data-index="${idx}" style="margin-bottom:0; display:flex; gap:0.25rem;">
                        <button type="button" class="btn btn-secondary btn-xs q-mode-btn ${initialMode === 'latex' ? 'active' : ''}" data-mode="latex" data-index="${idx}">LaTeX</button>
                        <button type="button" class="btn btn-secondary btn-xs q-mode-btn ${initialMode === 'word' ? 'active' : ''}" data-mode="word" data-index="${idx}">Word</button>
                        <button type="button" class="btn btn-secondary btn-xs q-mode-btn ${initialMode === 'image' ? 'active' : ''}" data-mode="image" data-index="${idx}">Ảnh</button>
                    </div>
                    <button type="button" class="btn btn-secondary btn-xs c-ai-gen-btn" data-target="c-question-textarea-${idx}" style="padding: 0.2rem 0.5rem; font-size: 0.72rem; background: linear-gradient(135deg, #6366f1, #8b5cf6); border: none; color: white; border-radius: 6px;"><i class="fa-solid fa-wand-magic-sparkles"></i> Sinh ngẫu nhiên</button>
                </div>
            </div>
            
            <!-- LaTeX Mode Container -->
            <div id="q-latex-container-${idx}" class="q-mode-container" data-index="${idx}" style="display: ${initialMode === 'latex' ? 'block' : 'none'};">
                <textarea class="form-textarea c-question-content-latex" id="c-question-textarea-${idx}" style="min-height:90px;" placeholder="Nhập nội dung đề bài (LaTeX)...">${initialMode === 'latex' ? prefilledValue : ''}</textarea>
            </div>

            <!-- Word Mode Container -->
            <div id="q-word-container-${idx}" class="q-mode-container" data-index="${idx}" style="display: ${initialMode === 'word' ? 'block' : 'none'};">
                <div id="c-question-quill-${idx}" style="min-height:120px; background:var(--bg-input); border:1px solid var(--border-color); border-radius:8px; color:inherit;">${initialMode === 'word' ? prefilledValue : ''}</div>
            </div>

            <!-- Image Mode Container -->
            <div id="q-image-container-${idx}" class="q-mode-container" data-index="${idx}" style="display: ${initialMode === 'image' ? 'block' : 'none'};">
                <div class="image-upload-zone" style="padding: 1rem; cursor: pointer; text-align: center; border: 2px dashed var(--border-color); border-radius: 8px;" onclick="document.getElementById('c-question-file-${idx}').click()">
                    <i class="fa-solid fa-cloud-arrow-up fa-2x" style="color:var(--accent-blue); margin-bottom:0.5rem;"></i>
                    <p style="font-size:0.85rem; margin:0;">Click để chọn ảnh đề bài</p>
                    <input type="file" id="c-question-file-${idx}" accept="image/*" style="display:none;" onchange="handleContestQuestionImage(this, ${idx})">
                    <div id="c-question-img-preview-${idx}" style="margin-top:0.5rem; ${isImage ? 'display:block;' : 'display:none;'}">
                        ${isImage ? `<img src="${window.contestImages[idx]}" style="max-height: 100px; border-radius: 6px; margin-top: 10px;" />` : ''}
                    </div>
                </div>
            </div>
        </div>
    `;
}

async function viewEditContestQuestions(contestId) {
    setActiveNav("admin");
    showLoading();
    try {
        const contests = await api.getContests();
        const c = contests.find(item => item._id === contestId);
        if (!c) { showError("Không tìm thấy kỳ thi!"); return; }

        // Clear previous session states
        window.contestQuills = {};
        window.contestImages = {};

        const savedQuestions = c.questions || [];
        let questionCount = Math.max(1, savedQuestions.length);

        mainContent.innerHTML = `
            <div class="page-header" style="margin-bottom: 1.5rem;">
                <h2 class="page-title"><i class="fa-solid fa-file-signature"></i> Soạn Đề Thi <span>- ${c.title}</span></h2>
                <button class="btn btn-secondary btn-sm" onclick="viewAdmin()" style="height: 38px; display:flex; align-items:center; gap:0.5rem;"><i class="fa-solid fa-arrow-left"></i> Quay lại</button>
            </div>

            <div class="card">
                <form id="edit-contest-questions-form">
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom: 1.5rem;">
                        <div class="form-group">
                            <label class="form-label" for="c-category">Môn học (Dùng để sinh đề ngẫu nhiên):</label>
                            <select id="c-category" class="form-select" style="background:var(--bg-input); border:1px solid var(--border-color); color:inherit; padding:0.625rem; border-radius:8px; width:100%;">
                                <option value="calculus" ${c.category === 'calculus' ? 'selected' : ''}>Giải tích</option>
                                <option value="algebra" ${c.category === 'algebra' ? 'selected' : ''}>Đại số tuyến tính</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="c-difficulty">Độ khó (Dùng để sinh đề ngẫu nhiên):</label>
                            <select id="c-difficulty" class="form-select" style="background:var(--bg-input); border:1px solid var(--border-color); color:inherit; padding:0.625rem; border-radius:8px; width:100%;">
                                <option value="easy" ${c.difficulty === 'easy' ? 'selected' : ''}>Dễ</option>
                                <option value="medium" ${c.difficulty === 'medium' || !c.difficulty ? 'selected' : ''}>Trung bình</option>
                                <option value="hard" ${c.difficulty === 'hard' ? 'selected' : ''}>Khó</option>
                                <option value="extreme" ${c.difficulty === 'extreme' ? 'selected' : ''}>Cực khó</option>
                            </select>
                        </div>
                    </div>

                    <div id="c-questions-container">
                        ${savedQuestions.length === 0 ? renderQuestionInputRow(1) : savedQuestions.map((q, idx) => renderQuestionInputRow(idx + 1, q)).join("")}
                    </div>

                    <div style="display: flex; gap: 1rem; margin-bottom: 1.5rem; margin-top: 1rem;">
                        <button type="button" id="c-add-question-btn" class="btn btn-secondary btn-sm" style="flex: 1; padding: 0.5rem;"><i class="fa-solid fa-plus"></i> Thêm câu hỏi (Câu tiếp theo)</button>
                        <button type="button" id="c-remove-question-btn" class="btn btn-secondary btn-sm" style="flex: 1; padding: 0.5rem; color: var(--accent-red); ${questionCount <= 1 ? 'display: none;' : ''}"><i class="fa-solid fa-trash-can"></i> Xóa câu cuối</button>
                    </div>

                    <button type="submit" class="btn btn-primary" style="width: 100%;"><i class="fa-solid fa-floppy-disk"></i> Lưu đề thi</button>
                </form>
            </div>
        `;

        // Lazy initialize Quill editors for prefilled "word" modes
        savedQuestions.forEach((q, idx) => {
            const isWord = q.includes("<p>") || q.includes("<br>") || q.includes("<strong>");
            if (isWord) {
                const quillId = `c-question-quill-${idx + 1}`;
                window.contestQuills[idx + 1] = new Quill(`#${quillId}`, { theme: 'snow' });
            }
        });

        // Listeners for dynamic add/remove inside edit form
        document.getElementById("c-add-question-btn")?.addEventListener("click", () => {
            questionCount++;
            const container = document.getElementById("c-questions-container");
            const div = document.createElement("div");
            // Wrap in div container to avoid replacing it directly
            div.innerHTML = renderQuestionInputRow(questionCount);
            container.appendChild(div.firstElementChild);
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

        // Submit form
        document.getElementById("edit-contest-questions-form")?.addEventListener("submit", async (e) => {
            e.preventDefault();
            const category = document.getElementById("c-category").value;
            const difficulty = document.getElementById("c-difficulty").value;

            // Collect questions depending on active mode
            const questions = [];
            for (let i = 1; i <= questionCount; i++) {
                const activeBtn = document.querySelector(`.q-modes[data-index="${i}"] .q-mode-btn.active`);
                const mode = activeBtn ? activeBtn.getAttribute("data-mode") : "latex";
                
                let content = "";
                if (mode === "latex") {
                    content = document.getElementById(`c-question-textarea-${i}`).value.trim();
                } else if (mode === "word") {
                    content = window.contestQuills[i] ? window.contestQuills[i].root.innerHTML.trim() : "";
                    if (content === "<p><br></p>") content = "";
                } else if (mode === "image") {
                    const base64 = window.contestImages[i];
                    if (base64) {
                        content = `<img src="${base64}" style="max-width:100%; border-radius:8px; display:block; margin: 10px 0;" />`;
                    }
                }
                if (content) {
                    questions.push(content);
                }
            }

            if (!confirm(`Lưu đề thi gồm ${questions.length} câu hỏi?`)) return;

            try {
                await api.updateContest(contestId, { questions, category, difficulty });
                showToast("Tạo kỳ thi thành công!", "success");
                viewAdmin();
            } catch (err) {
                showToast("Không thể lưu đề thi: " + err.message, "error");
            }
        });

        renderLaTeX(mainContent);
    } catch (e) {
        showError("Lỗi tải trang soạn đề!");
    }
}
