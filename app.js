/* ==========================================================================
   UPMath Core Logic - SPA Router, MongoDB-backed API, KaTeX Integration
   ========================================================================== */

// ─── 0. GOOGLE AUTHENTICATION MODULE ─────────────────────────────────────────

const GOOGLE_CLIENT_ID = "114290400611-fnma9n755iluuniauu1563p0viioobkr.apps.googleusercontent.com";
const GOOGLE_USER_KEY = "upmath_google_user";

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
        showToast(`Chào mừng! (Chế độ offline)`, "info");
    }
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
    if (adminBtn) adminBtn.style.display = u.role === 'admin' ? '' : 'none';
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
    const el = document.getElementById("login-math-preview");
    if (el && window.renderMathInElement) {
        renderMathInElement(el, { delimiters: [{ left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }], throwOnError: false });
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

    // Solutions
    getSolutions: (pid) => api._req('GET', `/solutions?problemId=${pid}`),
    addSolution: (data) => api._req('POST', '/solutions', data),
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

    // Users
    getUsers: () => api._req('GET', '/users'),
    syncUser: (data) => api._req('POST', '/users/sync', data),
    addPoints: (gid, amt) => api._req('PUT', `/users/${gid}/points`, { amount: amt }),
    getUserProblems: (gid) => api._req('GET', `/users/${gid}/problems`),
    getUserSolutions: (gid) => api._req('GET', `/users/${gid}/solutions`),

    // Contests & Stats
    getContests: () => api._req('GET', '/contests'),
    addContest: (data) => api._req('POST', '/contests', data),
    deleteContest: (id) => api._req('DELETE', `/contests/${id}`),
    deleteProblem: (id) => api._req('DELETE', `/problems/${id}`),
    getStats: () => api._req('GET', '/stats'),

    // Likes/Dislikes
    vote: (type, id, googleId, action) => api._req('PUT', `/${type}/${id}/${action}`, { googleId }),
};

// ─── 2. THEMING ───────────────────────────────────────────────────────────────

const themeBtn = document.getElementById("theme-toggle");
const bodyEl = document.body;
const savedTheme = localStorage.getItem("upmath_theme") || "dark-theme";
bodyEl.className = savedTheme;
if (themeBtn) {
    const icon = themeBtn.querySelector("i");
    if (icon && savedTheme === "light-theme") icon.className = "fa-solid fa-moon";
    themeBtn.addEventListener("click", () => {
        const isDark = bodyEl.classList.contains("dark-theme");
        bodyEl.className = isDark ? "light-theme" : "dark-theme";
        localStorage.setItem("upmath_theme", bodyEl.className);
        if (icon) icon.className = isDark ? "fa-solid fa-moon" : "fa-solid fa-sun";
    });
}

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
    if (window.renderMathInElement && el) {
        renderMathInElement(el, {
            delimiters: [{ left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }],
            throwOnError: false
        });
    }
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
let p_uploadedImageBase64 = null;
let s_uploadedImageBase64 = null;

function handleImageFileSelect(input, type) {
    const file = input.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        showToast("Vui lòng tải lên file hình ảnh hợp lệ!", "error");
        return;
    }

    const reader = new FileReader();
    const statusId = type === 'problem' ? 'p-image-upload-status' : 's-image-upload-status';
    const previewId = type === 'problem' ? 'p-image-upload-preview' : 's-image-upload-preview';

    const statusEl = document.getElementById(statusId);
    if (statusEl) statusEl.textContent = "Đang xử lý ảnh...";

    reader.onload = function(e) {
        const base64 = e.target.result;
        if (type === 'problem') {
            p_uploadedImageBase64 = base64;
        } else {
            s_uploadedImageBase64 = base64;
        }
        const previewEl = document.getElementById(previewId);
        if (previewEl) {
            previewEl.innerHTML = `<img src="${base64}" style="max-width:100%;max-height:220px;border-radius:8px;border:1px solid var(--border-color);margin-top:0.75rem;">`;
        }
        if (statusEl) statusEl.textContent = "Tải ảnh thành công!";
    };
    reader.readAsDataURL(file);
}

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
                    <div class="sidebar-item-title">${p.title}</div>
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
                    <div class="sidebar-item-title">${c.title}</div>
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
                    <div class="sidebar-item-title">${d.title}</div>
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
    } catch (e) {
        console.warn("Sidebar load error:", e.message);
    }
}

// ─── 5. PAGE VIEWS ────────────────────────────────────────────────────────────

// ── HOME ──────────────────────────────────────────────────────────────────────
async function viewHome() {
    setActiveNav("home");
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
                <span class="shoutbox-tagline">Gõ $công thức$ để viết ký hiệu toán</span>
            </div>
            <div class="shoutbox-messages" id="shoutbox-container">
                <div style="text-align:center;padding:1rem;color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i></div>
            </div>
            <form id="shoutbox-form" class="shoutbox-input-area">
                <div class="input-group">
                    <input type="text" id="shoutbox-input" class="form-input"
                           placeholder="Nhập tin nhắn... Ví dụ: tính $\\lim_{x\\to 0}\\frac{\\sin x}{x}$?" required autocomplete="off">
                </div>
                <button type="submit" class="btn btn-primary"><i class="fa-solid fa-paper-plane"></i> Gửi</button>
            </form>
            <div class="shoutbox-tip"><i class="fa-solid fa-lightbulb"></i> Mẹo: <strong>$$A\\vec{x} = \\lambda\\vec{x}$$</strong> = Block LaTeX.</div>
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
            const now = new Date();
            const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} ${now.toLocaleDateString('vi-VN')}`;
            await api.addShout({ username: user.username, userPicture: user.picture, text: val, time: timeStr });
            inp.value = "";
            renderShouts(await api.getShouts());
        } catch {
            showToast("Gửi tin nhắn thất bại!", "error");
        }
    });
}

function problemCardHTML(p) {
    return `
        <div class="problem-card-item">
            <div class="problem-item-details">
                <div class="problem-item-title-row">
                    <a href="#problem/${p._id}" class="problem-item-title">${p.title}</a>
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
    c.innerHTML = shouts.map(s => `
        <div class="shout-msg">
            <div class="shout-avatar">${avatarTag(s.userPicture, s.username, 28)}</div>
            <div class="shout-content">
                <div class="shout-meta">
                    <span class="shout-author">${s.username}</span>
                    <span class="shout-time">${s.time || timeSince(s.createdAt)}</span>
                </div>
                <div class="shout-text">${s.text}</div>
            </div>
        </div>`).join("");
    renderLaTeX(c);
    c.scrollTop = c.scrollHeight;
}

// ── EXERCISES ─────────────────────────────────────────────────────────────────
async function viewExercises(categoryFilter = "all") {
    setActiveNav("exercises");
    showLoading();
    try {
        const problems = await api.getProblems(categoryFilter);
        mainContent.innerHTML = `
            <div class="page-header">
                <h2 class="page-title"><i class="fa-solid fa-book-open-reader"></i> Kho Bài Tập <span>COMP1800</span></h2>
                <a href="#create-problem" class="btn btn-primary"><i class="fa-solid fa-plus"></i> Đăng đề bài</a>
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
                           <a href="#create-problem" class="btn btn-primary" style="margin-top:1rem;">Đăng bài toán đầu tiên!</a>
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
                    <h2 class="page-title" style="margin-top:0.5rem;">${problem.title}</h2>
                </div>
                <span class="badge ${problem.category === 'calculus' ? 'badge-calculus' : 'badge-algebra'}" style="font-size:0.9rem;padding:0.4rem 0.8rem;">
                    <i class="fa-solid ${problem.category === 'calculus' ? 'fa-wave-square' : 'fa-table-cells'}"></i>
                    ${problem.category === 'calculus' ? 'Giải tích' : 'Đại số'}
                </span>
            </div>

            <div class="card" style="margin-bottom:1.5rem;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
                    <div style="display:flex;align-items:center;gap:0.6rem;">
                        ${avatarTag(problem.creatorPicture, problem.creator, 36)}
                        <div>
                            <strong>${problem.creator}</strong>
                            <div style="font-size:0.75rem;color:var(--text-muted);">${timeSince(problem.createdAt)}</div>
                        </div>
                    </div>
                    <div style="display:flex;gap:0.4rem;flex-wrap:wrap;">
                        ${(problem.tags || []).map(t => `<span class="badge badge-tag">${t}</span>`).join("")}
                    </div>
                </div>
                <div class="problem-content" style="margin-bottom: 1rem;">${problem.content}</div>
                ${problem.imageUrl ? `<img src="${problem.imageUrl}" alt="Hình bài toán" style="max-width:100%;border-radius:8px;margin-top:1rem;margin-bottom:1rem;display:block;">` : ''}
                
                <div style="margin-top:1rem;padding-top:1rem;border-top:1px solid var(--border-color);display:flex;justify-content:space-between;align-items:center;font-size:0.85rem;color:var(--text-muted);flex-wrap:wrap;gap:0.75rem;">
                    <div style="display:flex;gap:1rem;">
                        <span><i class="fa-solid fa-star" style="color:#f59e0b;"></i> ${problem.points} điểm thưởng</span>
                        <span><i class="fa-solid fa-lightbulb"></i> ${solutions.length} lời giải</span>
                    </div>
                    <div style="display:flex;gap:0.5rem;">
                        <button class="vote-btn ${hasLikedProblem ? 'active-like' : ''}" onclick="voteItem('problems', '${problem._id}', 'like')">
                            <i class="fa-solid fa-thumbs-up"></i> Thích <span>(${pLikes})</span>
                        </button>
                        <button class="vote-btn ${hasDislikedProblem ? 'active-dislike' : ''}" onclick="voteItem('problems', '${problem._id}', 'dislike')">
                            <i class="fa-solid fa-thumbs-down"></i> Không thích <span>(${pDislikes})</span>
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
                                        ${avatarTag(s.authorPicture, s.author, 32)}
                                        <div>
                                            <strong>${s.author}</strong>
                                            <div style="font-size:0.72rem;color:var(--text-muted);">${timeSince(s.createdAt)}</div>
                                        </div>
                                    </div>
                                    <button class="btn btn-secondary btn-sm upvote-btn" data-id="${s._id}">
                                        <i class="fa-solid fa-thumbs-up"></i> <span>${s.votes}</span>
                                    </button>
                                </div>
                                <div style="margin-bottom:0.5rem; line-height:1.6;">${s.content}</div>
                                ${s.imageUrl ? `<img src="${s.imageUrl}" alt="Ảnh lời giải" style="max-width:100%;max-height:400px;object-fit:contain;border-radius:8px;margin-top:0.75rem;display:block;">` : ''}
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

                        <div style="display:flex;justify-content:flex-end;margin-top:1rem;">
                            <button type="submit" class="btn btn-primary"><i class="fa-solid fa-paper-plane"></i> Đăng lời giải</button>
                        </div>
                    </form>
                </div>
            </div>

            <div class="card" style="margin-top:1.5rem;">
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
            </div>`;

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

            try {
                await api.addSolution({ problemId: id, author: user.username, authorPicture: user.picture, authorGoogleId: user.googleId, content, imageUrl });
                showToast("Đã đăng lời giải! +15 điểm 🎉", "success");
                viewProblemDetail(id);
            } catch { showToast("Đăng lời giải thất bại!", "error"); }
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

// ── CREATE PROBLEM ────────────────────────────────────────────────────────────
function viewCreateProblem() {
    setActiveNav("exercises");
    mainContent.innerHTML = `
        <div class="page-header">
            <div>
                <a href="#exercises" style="font-size:0.9rem;"><i class="fa-solid fa-arrow-left"></i> Quay lại</a>
                <h2 class="page-title" style="margin-top:0.5rem;"><i class="fa-solid fa-pen-to-square"></i> Đăng Đề Bài Mới</h2>
            </div>
        </div>
        <div class="card">
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
                        <button type="button" class="btn btn-secondary mode-btn" data-mode="word"><i class="fa-solid fa-file-word"></i> Văn bản (Word)</button>
                        <button type="button" class="btn btn-secondary mode-btn" data-mode="image"><i class="fa-solid fa-camera"></i> Chụp / Tải ảnh</button>
                    </div>
                </div>

                <div class="form-group" id="p-mode-latex-container">
                    <label class="form-label">Nội dung đề bài (LaTeX):</label>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
                        <div>
                            <label class="form-label" style="font-size:0.78rem;color:var(--text-muted);">✏️ Soạn LaTeX</label>
                            <textarea id="p-content" class="form-textarea" style="min-height:200px;"
                                oninput="updateProblemPreview()"
                                placeholder="Nhập nội dung. Ví dụ:&#10;Tính tích phân:&#10;$$I = \\int_0^{\\pi}\\sin^2(x)\\,dx$$"></textarea>
                        </div>
                        <div>
                            <label class="form-label" style="font-size:0.78rem;color:var(--text-muted);">👁️ Xem trước</label>
                            <div id="prob-preview" style="min-height:200px;background:var(--bg-input);border:1px solid var(--border-color);border-radius:8px;padding:0.6rem 0.75rem;overflow-y:auto;"></div>
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
                        <input type="file" id="p-image-file-input" accept="image/*" style="display: none;" onchange="handleImageFileSelect(this, 'problem')">
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
                
                <div style="display:flex;justify-content:flex-end;gap:0.75rem;margin-top:1.5rem;border-top:1px solid var(--border-color);padding-top:1rem;">
                    <a href="#exercises" class="btn btn-secondary">Hủy</a>
                    <button type="submit" id="submit-prob-btn" class="btn btn-primary">
                        <i class="fa-solid fa-paper-plane"></i> Đăng đề bài
                    </button>
                </div>
            </form>
        </div>`;

    // Reset uploaded image variables
    p_uploadedImageBase64 = null;

    // Initialize Quill Editor
    let pQuill = null;
    if (window.Quill) {
        pQuill = new Quill('#p-quill-editor', {
            theme: 'snow',
            placeholder: 'Soạn thảo nội dung đề bài giống Word...'
        });
    }

    // Tab buttons event listeners
    document.querySelectorAll("#p-input-modes .mode-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll("#p-input-modes .mode-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            const mode = btn.getAttribute("data-mode");
            document.getElementById("p-mode-latex-container").style.display = mode === 'latex' ? 'block' : 'none';
            document.getElementById("p-mode-word-container").style.display = mode === 'word' ? 'block' : 'none';
            document.getElementById("p-mode-image-container").style.display = mode === 'image' ? 'block' : 'none';
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
        
        if (mode === 'latex') {
            content = document.getElementById("p-content").value.trim();
            if (!content) { showToast("Vui lòng điền nội dung đề bài!", "warning"); return; }
        } else if (mode === 'word') {
            content = pQuill ? pQuill.root.innerHTML.trim() : "";
            if (content === "<p><br></p>" || !content) { showToast("Vui lòng soạn thảo đề bài!", "warning"); return; }
        } else if (mode === 'image') {
            content = "[Đề bài dạng hình ảnh]";
            imageUrl = p_uploadedImageBase64;
            if (!imageUrl) { showToast("Vui lòng tải lên hoặc chụp ảnh đề bài!", "warning"); return; }
        }

        const title = document.getElementById("p-title").value.trim();
        const category = document.getElementById("p-category").value;
        const tagsRaw = document.getElementById("p-tags").value;
        const tags = tagsRaw ? tagsRaw.split(",").map(t => t.trim()).filter(Boolean) : [];
        
        const btn = document.getElementById("submit-prob-btn");
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang đăng...`;
        
        try {
            await api.addProblem({ title, content, category, tags, creator: user.username, creatorPicture: user.picture, creatorGoogleId: user.googleId, points: category === 'calculus' ? 30 : 25, imageUrl });
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
    if (c && p) { p.innerHTML = c.value; renderLaTeX(p); }
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
                <div style="margin-bottom:1rem; line-height:1.6;">${disc.content}</div>
                
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
                    <div class="card" style="margin-bottom:1rem;padding:1.25rem;border-left:3px solid ${c.status === 'running' ? 'var(--accent-green)' : c.status === 'upcoming' ? 'var(--accent-blue)' : 'var(--text-muted)'};">
                        <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                            <div>
                                <h3 style="font-size:1.05rem;margin-bottom:0.4rem;">${c.title}</h3>
                                <div style="font-size:0.85rem;color:var(--text-muted);display:flex;gap:1rem;">
                                    <span><i class="fa-solid fa-clock"></i> ${c.duration}</span>
                                    <span><i class="fa-solid fa-calendar"></i> ${c.startTime}</span>
                                </div>
                            </div>
                            <span class="badge ${c.status === 'running' ? 'badge-calculus' : c.status === 'upcoming' ? 'badge-algebra' : 'badge-tag'}">
                                ${c.status === 'running' ? '🔴 Đang diễn ra' : c.status === 'upcoming' ? '⏳ Sắp diễn ra' : '✅ Đã kết thúc'}
                            </span>
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
            <div class="page-header">
                <h2 class="page-title"><i class="fa-solid fa-chart-simple"></i> Bảng Xếp Hạng <span>Cộng Đồng</span></h2>
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
                    return `<tr style="border-bottom:1px solid var(--border-color);${isMe ? 'background:rgba(56,189,248,0.06);' : ''}">
                                       <td style="padding:0.9rem 0.75rem;font-size:${i < 3 ? '1.3rem' : '0.9rem'};font-weight:700;">${medals[i] || i + 1}</td>
                                       <td style="padding:0.9rem 0.75rem;">
                                           <div style="display:flex;align-items:center;gap:0.6rem;">
                                               <img src="${u.picture || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(u.name)}`}"
                                                    alt="${u.name}" style="width:34px;height:34px;border-radius:50%;object-fit:cover;border:2px solid ${isMe ? 'var(--accent-blue)' : 'var(--border-color)'}"
                                                    onerror="this.src='https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(u.name)}'">
                                               <div>
                                                   <div style="font-weight:600;font-size:0.9rem;">${u.name}${isMe ? ' <span style="color:var(--accent-blue);font-size:0.75rem;">(Bạn)</span>' : ''}</div>
                                                   <div style="font-size:0.75rem;color:var(--text-muted);">${u.email}</div>
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
async function viewProfile() {
    setActiveNav(""); // Clear active nav classes
    showLoading();
    try {
        const me = getCurrentUser();
        if (!me) {
            showError("Vui lòng đăng nhập để xem hồ sơ!");
            return;
        }

        // Fetch user's problems and solutions
        const [problems, solutions] = await Promise.all([
            api.getUserProblems(me.googleId),
            api.getUserSolutions(me.googleId)
        ]);

        const fbAvatar = `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(me.username)}`;

        mainContent.innerHTML = `
            <div class="page-header">
                <h2 class="page-title"><i class="fa-solid fa-user-gear"></i> Hồ Sơ <span>Cá Nhân</span></h2>
            </div>
            
            <div class="card" style="display: flex; gap: 2rem; align-items: center; padding: 2rem; margin-bottom: 2rem; flex-wrap: wrap;">
                <div style="flex-shrink: 0; position: relative;">
                    <img src="${me.picture || fbAvatar}" alt="Avatar" 
                         style="width: 110px; height: 110px; border-radius: 50%; object-fit: cover; border: 4px solid var(--accent-blue); box-shadow: 0 4px 15px rgba(56, 189, 248, 0.2);"
                         onerror="this.src='${fbAvatar}'">
                </div>
                <div style="flex: 1; min-width: 250px;">
                    <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
                        <h3 style="font-size: 1.5rem; font-weight: 700; margin: 0;">${me.username}</h3>
                        <span class="badge badge-tag" style="font-size: 0.85rem; padding: 0.35rem 0.75rem; background: rgba(56, 189, 248, 0.1); color: var(--accent-blue); border: 1px solid rgba(56, 189, 248, 0.2);">
                            ${me.rank || "Học sinh"}
                        </span>
                    </div>
                    <p style="color: var(--text-muted); margin: 0.5rem 0 1rem 0; font-size: 0.95rem;">
                        <i class="fa-regular fa-envelope"></i> ${me.email}
                    </p>
                    <div style="display: flex; gap: 2rem; flex-wrap: wrap;">
                        <div>
                            <div style="font-size: 0.78rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.25rem;">Điểm tích lũy</div>
                            <div style="font-size: 1.5rem; font-weight: 800; color: var(--accent-blue);">${(me.points || 0).toLocaleString()} <span style="font-size: 0.9rem; font-weight: 500;">điểm</span></div>
                        </div>
                        <div>
                            <div style="font-size: 0.78rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.25rem;">Bài tập đã đăng</div>
                            <div style="font-size: 1.5rem; font-weight: 800; color: var(--text-muted);">${problems.length}</div>
                        </div>
                        <div>
                            <div style="font-size: 0.78rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.25rem;">Lời giải đã đăng</div>
                            <div style="font-size: 1.5rem; font-weight: 800; color: var(--text-muted);">${solutions.length}</div>
                        </div>
                    </div>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; flex-wrap: wrap;">
                <!-- Left: User's Problems -->
                <div class="card" style="padding: 1.5rem;">
                    <h3 style="font-size: 1.15rem; margin-bottom: 1.25rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.75rem;">
                        <i class="fa-solid fa-book-open" style="color: var(--accent-blue); margin-right: 0.5rem;"></i> Đề bài đã đăng (${problems.length})
                    </h3>
                    <div style="display: flex; flex-direction: column; gap: 0.75rem; max-height: 400px; overflow-y: auto; padding-right: 0.25rem;">
                        ${problems.length === 0
                ? `<p style="color: var(--text-muted); text-align: center; padding: 2rem 0; font-size: 0.9rem;">Bạn chưa đăng đề bài nào.</p>`
                : problems.map(p => `
                                <div style="padding: 0.85rem; background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border-color); border-radius: 8px; display: flex; justify-content: space-between; align-items: center; gap: 1rem;">
                                    <div style="flex: 1; min-width: 0;">
                                        <a href="#problem/${p._id}" style="font-weight: 600; font-size: 0.9rem; text-decoration: none; color: var(--text-color); display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-bottom: 0.25rem;">
                                            ${p.title}
                                        </a>
                                        <span class="badge ${p.category === 'calculus' ? 'badge-calculus' : 'badge-algebra'}" style="font-size: 0.7rem;">
                                            ${p.category === 'calculus' ? 'Giải tích' : 'Đại số'}
                                        </span>
                                    </div>
                                    <a href="#problem/${p._id}" class="btn btn-secondary btn-sm" style="flex-shrink: 0; padding: 0.35rem 0.6rem;">
                                        <i class="fa-solid fa-arrow-up-right-from-square"></i>
                                    </a>
                                </div>
                            `).join("")
            }
                    </div>
                </div>

                <!-- Right: User's Solutions -->
                <div class="card" style="padding: 1.5rem;">
                    <h3 style="font-size: 1.15rem; margin-bottom: 1.25rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.75rem;">
                        <i class="fa-solid fa-lightbulb" style="color: #f59e0b; margin-right: 0.5rem;"></i> Lời giải đã đăng (${solutions.length})
                    </h3>
                    <div style="display: flex; flex-direction: column; gap: 0.75rem; max-height: 400px; overflow-y: auto; padding-right: 0.25rem;">
                        ${solutions.length === 0
                ? `<p style="color: var(--text-muted); text-align: center; padding: 2rem 0; font-size: 0.9rem;">Bạn chưa đăng lời giải nào.</p>`
                : solutions.map(s => `
                                <div style="padding: 0.85rem; background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border-color); border-radius: 8px; display: flex; justify-content: space-between; align-items: center; gap: 1rem;">
                                    <div style="flex: 1; min-width: 0;">
                                        <div style="font-weight: 500; font-size: 0.88rem; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-bottom: 0.25rem;">
                                            ${s.content.replace(/\$/g, "")}
                                        </div>
                                        <div style="font-size: 0.72rem; color: var(--text-muted); display: flex; align-items: center; gap: 0.5rem;">
                                            <span><i class="fa-solid fa-thumbs-up" style="color: var(--accent-blue);"></i> ${s.votes} lượt thích</span>
                                            <span>·</span>
                                            <span>${timeSince(s.createdAt)}</span>
                                        </div>
                                    </div>
                                    <a href="#problem/${s.problemId}" class="btn btn-secondary btn-sm" style="flex-shrink: 0; padding: 0.35rem 0.6rem;">
                                        <i class="fa-solid fa-arrow-up-right-from-square"></i> Xem
                                    </a>
                                </div>
                            `).join("")
            }
                    </div>
                </div>
            </div>
        `;
        renderLaTeX(mainContent);
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
        if (!me || me.role !== 'admin') {
            showError("Bạn không có quyền truy cập trang quản trị!");
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
                <h2 class="page-title"><i class="fa-solid fa-lock"></i> Trang <span>Quản Trị Hệ Thống</span></h2>
            </div>

            <!-- Tabs Navigation -->
            <div id="admin-tabs" style="display: flex; gap: 0.5rem; margin-bottom: 1.5rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">
                <button class="filter-tag-btn active" data-tab="contests"><i class="fa-solid fa-trophy"></i> Quản lý Kỳ thi</button>
                <button class="filter-tag-btn" data-tab="problems"><i class="fa-solid fa-book-open"></i> Quản lý Đề bài</button>
                <button class="filter-tag-btn" data-tab="users"><i class="fa-solid fa-users"></i> Quản lý Thành viên</button>
            </div>

            <!-- Tab 1: CONTESTS MANAGER -->
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
                                <input type="text" id="c-title" class="form-input" required placeholder="Ví dụ: Giữa kỳ môn Cơ sở toán">
                            </div>
                            <div class="form-group">
                                <label class="form-label" for="c-duration">Thời lượng:</label>
                                <input type="text" id="c-duration" class="form-input" required placeholder="Ví dụ: 90 phút, 180 phút">
                            </div>
                            <div class="form-group">
                                <label class="form-label" for="c-start">Thời gian bắt đầu:</label>
                                <input type="text" id="c-start" class="form-input" required placeholder="Ví dụ: 08:30 ngày 15/10/2026">
                            </div>
                            <div class="form-group">
                                <label class="form-label" for="c-status">Trạng thái:</label>
                                <select id="c-status" class="form-select">
                                    <option value="upcoming">Chưa mở (Sắp diễn ra)</option>
                                    <option value="running">🔴 Đang mở (Đang diễn ra)</option>
                                    <option value="ended">Đã kết thúc</option>
                                </select>
                            </div>
                            <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 0.5rem;">
                                <i class="fa-solid fa-plus"></i> Tạo kỳ thi
                            </button>
                        </form>
                    </div>
                </div>
            </div>

            <!-- Tab 2: PROBLEMS MANAGER -->
            <div id="admin-tab-problems" class="admin-tab-content" style="display: none;">
                <div class="card">
                    <h3 style="margin-bottom: 1rem; font-size: 1.1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">Quản lý kho bài tập</h3>
                    <div style="display: flex; flex-direction: column; gap: 0.75rem; max-height: 500px; overflow-y: auto;">
                        ${problems.length === 0
                ? `<p style="color: var(--text-muted); text-align: center; padding: 2rem;">Chưa có bài tập nào.</p>`
                : problems.map(p => `
                                <div style="padding: 0.85rem; background: rgba(255,255,255,0.01); border: 1px solid var(--border-color); border-radius: 8px; display: flex; justify-content: space-between; align-items: center; gap: 1rem;">
                                    <div style="min-width: 0; flex: 1;">
                                        <a href="#problem/${p._id}" style="font-weight: 600; text-decoration: none; color: var(--text-color); font-size: 0.95rem; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-bottom: 0.25rem;">
                                            ${p.title}
                                        </a>
                                        <div style="font-size: 0.75rem; color: var(--text-muted);">
                                            <span>Người đăng: ${p.creator}</span> · 
                                            <span>Môn: ${p.category === 'calculus' ? 'Giải tích' : 'Đại số'}</span> · 
                                            <span>Đăng vào: ${new Date(p.createdAt).toLocaleDateString('vi-VN')}</span>
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

            <!-- Tab 3: USERS MANAGER -->
            <div id="admin-tab-users" class="admin-tab-content" style="display: none;">
                <div class="card">
                    <h3 style="margin-bottom: 1rem; font-size: 1.1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">Cấp quyền &amp; Quản lý điểm số</h3>
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
                                                    <div style="font-weight: 600; font-size: 0.88rem;">${u.name}</div>
                                                    <div style="font-size: 0.72rem; color: var(--text-muted);">${u.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td style="padding: 0.75rem;">
                                            <span class="badge" style="background: ${u.role === 'admin' ? 'var(--accent-red)' : 'var(--bg-input)'}; color: ${u.role === 'admin' ? '#fff' : 'var(--text-muted)'}; font-size: 0.72rem; padding: 0.25rem 0.5rem;">
                                                ${u.role === 'admin' ? 'Quản trị' : 'Thành viên'}
                                            </span>
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
            const duration = document.getElementById("c-duration").value.trim();
            const startTime = document.getElementById("c-start").value.trim();
            const status = document.getElementById("c-status").value;

            try {
                await api.addContest({ title, duration, startTime, status });
                showToast("Tạo kỳ thi thành công!", "success");
                viewAdmin();
            } catch (err) {
                showToast("Tạo kỳ thi thất bại!", "error");
            }
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

    } catch (e) {
        showError("Lỗi tải trang quản trị!");
    }
}

// ─── 6. ROUTER ────────────────────────────────────────────────────────────────

async function router() {
    const hash = window.location.hash || "#home";
    renderSidebars(); // load sidebar in background

    if (hash === "#home" || hash === "#" || hash === "") { await viewHome(); return; }
    if (hash.startsWith("#problem/")) { await viewProblemDetail(hash.split("/")[1]); return; }
    if (hash.startsWith("#discussion/")) { await viewDiscussionDetail(hash.split("/")[1]); return; }

    const map = {
        exercises: () => viewExercises(),
        'create-problem': viewCreateProblem,
        discussions: viewDiscussions,
        contests: viewContests,
        leaderboard: viewLeaderboard,
        profile: viewProfile,
        admin: viewAdmin
    };

    const fn = map[hash.substring(1)];
    if (fn) await fn(); else await viewHome();
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
