/* ==========================================================================
   UPMath Backend Server
   Express + Mongoose + MongoDB Atlas
   ========================================================================== */
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const nodemailer = require('nodemailer');

// ─── SENDGRID EMAIL API CONFIGURATION ─────────────────────────────────────────
/**
 * Gửi email thông báo qua API của SendGrid (sử dụng cổng HTTPS 443 không bị chặn)
 * @param {string} to - email người nhận
 * @param {string} subject - tiêu đề email
 * @param {string} html - nội dung định dạng html
 */
async function sendNotificationEmail(to, subject, html) {
    const apiKey = process.env.EMAIL_PASS; // API Key của SendGrid (SG.xxxx)
    const fromEmail = process.env.EMAIL_USER; // Email người gửi đã được xác minh trên SendGrid
    
    if (!apiKey || !fromEmail) {
        console.warn(`[Email fallback] Thư từ gửi tới <${to}>: "${subject}". (Chưa cấu hình đầy đủ EMAIL_PASS/EMAIL_USER trên Render)`);
        return;
    }
    
    try {
        const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                personalizations: [{
                    to: [{ email: to }]
                }],
                from: {
                    email: fromEmail,
                    name: 'UPMath'
                },
                subject: subject,
                content: [{
                    type: 'text/html',
                    value: html
                }]
            })
        });

        if (response.status === 202) {
            console.log(`[Email SendGrid] Đã gửi thành công tới ${to}`);
        } else {
            const errBody = await response.text();
            console.error(`[Email SendGrid Error] API trả về status ${response.status}:`, errBody);
        }
    } catch (err) {
        console.error(`[Email SendGrid Error] Thất bại khi kết nối tới SendGrid API:`, err.message);
    }
}


const app = express();
const PORT = process.env.PORT || 3000;

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));

// Serve static frontend files from parent directory
app.use(express.static(path.join(__dirname, '..')));

// ─── GEMINI API HELPER ────────────────────────────────────────────────────────
// Model duy nhất hoạt động với API key hiện tại
// (gemini-2.5-flash=404 deprecated, gemini-2.0-flash=429 quota, gemini-1.5-flash=404)
const GEMINI_MODEL = 'gemini-flash-latest';

/**
 * Gọi Gemini API với tự động retry khi gặp 503/429 (tối đa 3 lần)
 * @param {string} apiKey
 * @param {object} body  - request body JSON
 * @param {number} maxRetries
 * @returns {Promise<Response>}
 */
async function callGeminiWithRetry(apiKey, body, maxRetries = 4) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
    let lastResponse;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        lastResponse = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        // Retry nếu gặp 503 (overload) hoặc 429 (rate limit)
        if (lastResponse.status === 503 || lastResponse.status === 429) {
            if (attempt < maxRetries) {
                const waitMs = attempt * 3000; // 3s, 6s, 9s, 12s
                console.warn(`[Gemini] Attempt ${attempt}/${maxRetries} got ${lastResponse.status}, retrying in ${waitMs}ms...`);
                await new Promise(r => setTimeout(r, waitMs));
                continue;
            } else {
                // Clone để đọc body error mà không consume stream
                const errText = await lastResponse.clone().text();
                console.error(`[Gemini] All ${maxRetries} attempts failed. Last status: ${lastResponse.status}. Body: ${errText.substring(0, 200)}`);
            }
        }
        return lastResponse;
    }
    return lastResponse;
}

// ─── MONGODB CONNECTION ───────────────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ Connected to MongoDB Atlas — UPMath DB'))
    .catch(err => {
        console.error('❌ MongoDB connection error:', err.message);
        console.error('👉 Kiểm tra MONGODB_URI trong file backend/.env');
    });

// ─── SCHEMAS & MODELS ────────────────────────────────────────────────────────

const userSchema = new mongoose.Schema({
    googleId: { type: String, required: true, unique: true },
    email: { type: String, required: true },
    name: { type: String, required: true },
    picture: String,
    points: { type: Number, default: 0 },
    rank: { type: String, default: 'Đồng' },
    role: { type: String, enum: ['user', 'admin', 'professor', 'supporter'], default: 'user' },
    joinedAt: { type: Date, default: Date.now },
    // Custom profile fields
    fullName: String,
    mssv: String,
    dob: String,
    defaultLang: { type: String, default: 'C++14' },
    phone: String,
    school: String,
    codenodeFolder: String,
    lastLogin: { type: Date, default: Date.now }
});

const problemSchema = new mongoose.Schema({
    title: { type: String, required: true },
    content: { type: String, required: true },
    category: { type: String, enum: ['calculus', 'algebra'], required: true },
    tags: [String],
    creator: { type: String, required: true },
    creatorPicture: String,
    creatorGoogleId: String,
    points: { type: Number, default: 10 },
    gradingRubric: { type: String, default: '' },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard', 'extreme'], default: 'medium' },
    imageUrl: String,
    likes: { type: [String], default: [] },
    dislikes: { type: [String], default: [] },
    createdAt: { type: Date, default: Date.now }
});

const solutionSchema = new mongoose.Schema({
    problemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Problem', required: true },
    author: { type: String, required: true },
    authorPicture: String,
    authorGoogleId: String,
    content: { type: String, required: true },
    votes: { type: Number, default: 0 },
    imageUrl: String,
    createdAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['correct', 'incorrect', 'pending'], default: 'pending' },
    aiFeedback: { type: String, default: "" }
});

const discussionSchema = new mongoose.Schema({
    title: { type: String, required: true },
    content: { type: String, required: true },
    creator: { type: String, required: true },
    creatorPicture: String,
    creatorGoogleId: String,
    category: { type: String, default: 'Giải tích' },
    replies: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
    likes: { type: [String], default: [] },
    dislikes: { type: [String], default: [] },
    createdAt: { type: Date, default: Date.now }
});

const commentSchema = new mongoose.Schema({
    targetType: { type: String, enum: ['problem', 'discussion'], required: true },
    targetId: { type: String, required: true },
    author: { type: String, required: true },
    authorPicture: String,
    authorGoogleId: String,
    content: { type: String, required: true },
    likes: { type: [String], default: [] },
    dislikes: { type: [String], default: [] },
    createdAt: { type: Date, default: Date.now }
});

const shoutSchema = new mongoose.Schema({
    username: { type: String, required: true },
    userPicture: String,
    authorGoogleId: String,
    text: { type: String, required: true },
    time: String,
    createdAt: { type: Date, default: Date.now },
    reactions: {
        type: [
            {
                googleId: String,
                username: String,
                reactionType: String
            }
        ],
        default: []
    },
    replyTo: {
        parentId: String,
        parentText: String,
        parentAuthor: String
    },
    isEdited: { type: Boolean, default: false }
});

const contestSchema = new mongoose.Schema({
    title: { type: String, required: true },
    duration: String,
    startTime: String,
    status: { type: String, enum: ['upcoming', 'running', 'ended'], default: 'upcoming' },
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Problem = mongoose.model('Problem', problemSchema);
const Solution = mongoose.model('Solution', solutionSchema);
const Discussion = mongoose.model('Discussion', discussionSchema);
const Comment = mongoose.model('Comment', commentSchema);
const Shout = mongoose.model('Shout', shoutSchema);
const Contest = mongoose.model('Contest', contestSchema);

// ─── RANK HELPER ──────────────────────────────────────────────────────────────
function calcRank(pts) {
    if (pts >= 100000) return 'Giáo sư';
    if (pts >= 60000) return 'Phó Giáo sư';
    if (pts >= 30000) return 'Tiến sĩ';
    if (pts >= 15000) return 'Thạc sĩ';
    if (pts >= 8000) return 'Chiến thần';
    if (pts >= 4000) return 'Cao thủ';
    if (pts >= 2000) return 'Tinh anh';
    if (pts >= 1000) return 'Kim cương';
    if (pts >= 500) return 'Bạch kim';
    if (pts >= 300) return 'Vàng';
    if (pts >= 100) return 'Bạc';
    return 'Đồng';
}

// ─── ROUTES: USERS ────────────────────────────────────────────────────────────

// Sync / upsert Google user
app.post('/api/users/sync', async (req, res) => {
    try {
        const { googleId, email, name, username, picture } = req.body;
        if (!googleId || !email) return res.status(400).json({ error: 'googleId and email required' });

        const displayName = name || username || 'Người dùng';
        const role = email === 'phanphiphu04@gmail.com' ? 'admin' : 'user';
        const user = await User.findOneAndUpdate(
            { googleId },
            { $set: { email, name: displayName, picture, role, lastLogin: new Date() } },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get all users sorted by points
app.get('/api/users', async (req, res) => {
    try {
        const users = await User.find().sort({ points: -1 }).limit(100);
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add points to a user
app.put('/api/users/:googleId/points', async (req, res) => {
    try {
        const { amount } = req.body;
        const user = await User.findOne({ googleId: req.params.googleId });
        if (!user) return res.status(404).json({ error: 'User not found' });
        
        const oldPoints = user.points;
        const oldRank = user.rank;
        
        user.points = Math.max(0, user.points + (amount || 0));
        user.rank = calcRank(user.points);
        await user.save();

        // Gửi email thông báo điều chỉnh điểm
        const diff = user.points - oldPoints;
        const isAddition = diff >= 0;
        const diffText = isAddition ? `+${diff}` : `${diff}`;
        const actionText = isAddition ? 'Cộng điểm' : 'Trừ điểm';
        const color = isAddition ? '#10b981' : '#f43f5e';

        const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
                <h2 style="color: #6366f1; border-bottom: 2px solid #6366f1; padding-bottom: 10px; margin-top: 0;">Thông Báo Điều Chỉnh Điểm Tích Lũy</h2>
                <p>Chào <strong>${user.name}</strong>,</p>
                <p>Quản trị viên hệ thống <strong>UPMath</strong> vừa thực hiện điều chỉnh điểm tích lũy của em:</p>
                <div style="background-color: #f8fafc; padding: 15px; border-left: 4px solid ${color}; border-radius: 4px; margin: 20px 0; font-size: 1.05rem;">
                    Hành động: <strong>${actionText}</strong><br>
                    Số điểm thay đổi: <strong style="color: ${color}; font-size: 1.15rem;">${diffText} điểm</strong><br>
                    Tổng điểm mới: <strong>${user.points} điểm</strong><br>
                    Cấp bậc hiện tại: <strong>${user.rank}</strong>
                </div>
                <p>Nếu có thắc mắc về điểm số, em hãy liên hệ trực tiếp với Giảng viên quản lý môn học COMP1800.</p>
                <p style="margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 15px; font-size: 0.85rem; color: #64748b;">
                    Trân trọng,<br>
                    <strong>Hệ thống UPMath</strong>
                </p>
            </div>
        `;

        sendNotificationEmail(user.email, `[UPMath] Tài khoản của bạn đã được ${actionText.toLowerCase()} (${diffText} điểm)`, emailHtml);

        res.json(user);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update user role
app.put('/api/users/:googleId/role', async (req, res) => {
    try {
        const { role } = req.body;
        if (!['user', 'admin', 'professor', 'supporter'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }
        const user = await User.findOneAndUpdate(
            { googleId: req.params.googleId },
            { $set: { role } },
            { new: true }
        );
        if (!user) return res.status(404).json({ error: 'User not found' });

        // Gửi email thông báo đổi quyền
        const roleNames = {
            'user': 'Thành viên (Học sinh)',
            'professor': 'Giảng viên (Professor)',
            'supporter': 'Người hỗ trợ học tập (Supporter)',
            'admin': 'Quản trị viên (Admin)'
        };
        const roleName = roleNames[role] || role;

        const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
                <h2 style="color: #6366f1; border-bottom: 2px solid #6366f1; padding-bottom: 10px; margin-top: 0;">Thông Báo Thay Đổi Vai Trò</h2>
                <p>Chào <strong>${user.name}</strong>,</p>
                <p>Quản trị viên hệ thống học tập toán cao cấp <strong>UPMath</strong> vừa thực hiện cập nhật vai trò tài khoản của em trên hệ thống:</p>
                <div style="background-color: #f8fafc; padding: 15px; border-left: 4px solid #6366f1; border-radius: 4px; margin: 20px 0; font-size: 1.05rem;">
                    Vai trò mới của em: <strong>${roleName}</strong>
                </div>
                <p>Nếu có bất cứ thắc mắc nào, em vui lòng phản hồi trực tiếp qua email này hoặc liên hệ giảng viên môn học COMP1800.</p>
                <p style="margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 15px; font-size: 0.85rem; color: #64748b;">
                    Trân trọng,<br>
                    <strong>Ban quản trị UPMath</strong>
                </p>
            </div>
        `;
        
        // Gửi email bất đồng bộ (không bắt user đợi email gửi xong mới trả về response)
        sendNotificationEmail(user.email, `[UPMath] Tài khoản của bạn đã được cập nhật vai trò mới`, emailHtml);

        res.json(user);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get all problems created by a specific user
app.get('/api/users/:googleId/problems', async (req, res) => {
    try {
        const problems = await Problem.find({ creatorGoogleId: req.params.googleId }).sort({ createdAt: -1 });
        res.json(problems);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get all solutions posted by a specific user
app.get('/api/users/:googleId/solutions', async (req, res) => {
    try {
        const solutions = await Solution.find({ authorGoogleId: req.params.googleId }).sort({ createdAt: -1 });
        res.json(solutions);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update user profile fields
app.put('/api/users/:googleId/profile', async (req, res) => {
    try {
        const { fullName, mssv, dob, defaultLang, phone, school, codenodeFolder, picture } = req.body;
        const updateFields = {};
        if (fullName !== undefined) updateFields.fullName = fullName;
        if (mssv !== undefined) updateFields.mssv = mssv;
        if (dob !== undefined) updateFields.dob = dob;
        if (defaultLang !== undefined) updateFields.defaultLang = defaultLang;
        if (phone !== undefined) updateFields.phone = phone;
        if (school !== undefined) updateFields.school = school;
        if (codenodeFolder !== undefined) updateFields.codenodeFolder = codenodeFolder;
        if (picture !== undefined) updateFields.picture = picture;

        const user = await User.findOneAndUpdate(
            { googleId: req.params.googleId },
            { $set: updateFields },
            { new: true }
        );
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── ROUTES: PROBLEMS ─────────────────────────────────────────────────────────

app.get('/api/problems', async (req, res) => {
    try {
        const filter = {};
        if (req.query.category && req.query.category !== 'all') filter.category = req.query.category;
        const problems = await Problem.find(filter).sort({ createdAt: -1 });
        res.json(problems);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/problems/:id', async (req, res) => {
    try {
        const problem = await Problem.findById(req.params.id);
        if (!problem) return res.status(404).json({ error: 'Problem not found' });
        res.json(problem);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Edit problem (by creator, admin, or professor)
app.put('/api/problems/:id', async (req, res) => {
    try {
        const { title, content, category, tags, points, gradingRubric, difficulty, imageUrl } = req.body;
        const updateFields = {};
        if (title !== undefined) updateFields.title = title;
        if (content !== undefined) updateFields.content = content;
        if (category !== undefined) updateFields.category = category;
        if (tags !== undefined) updateFields.tags = tags;
        if (points !== undefined) updateFields.points = points;
        if (gradingRubric !== undefined) updateFields.gradingRubric = gradingRubric;
        if (difficulty !== undefined) updateFields.difficulty = difficulty;
        if (imageUrl !== undefined) updateFields.imageUrl = imageUrl;

        const problem = await Problem.findByIdAndUpdate(
            req.params.id,
            { $set: updateFields },
            { new: true }
        );
        if (!problem) return res.status(404).json({ error: 'Problem not found' });
        res.json(problem);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/problems/:id', async (req, res) => {
    try {
        const p = await Problem.findByIdAndDelete(req.params.id);
        if (!p) return res.status(404).json({ error: 'Problem not found' });
        // Delete all associated solutions
        await Solution.deleteMany({ problemId: req.params.id });
        res.json({ message: 'Problem deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/problems', async (req, res) => {
    try {
        const problem = new Problem(req.body);
        await problem.save();
        // Award points to creator
        if (req.body.creatorGoogleId) {
            await User.findOneAndUpdate(
                { googleId: req.body.creatorGoogleId },
                [{ $set: { points: { $add: ['$points', 10] } } }]
            ).then(async u => {
                if (u) { u.rank = calcRank(u.points + 10); await u.save(); }
            }).catch(() => { });
        }
        res.status(201).json(problem);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── ROUTES: SOLUTIONS ────────────────────────────────────────────────────────

app.get('/api/solutions', async (req, res) => {
    try {
        const filter = {};
        if (req.query.problemId) filter.problemId = req.query.problemId;
        const solutions = await Solution.find(filter).sort({ votes: -1, createdAt: -1 });
        res.json(solutions);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/solutions', async (req, res) => {
    try {
        const solution = new Solution(req.body);
        solution.status = 'pending'; // start as pending

        const problem = await Problem.findById(req.body.problemId);
        const apiKey = process.env.GEMINI_API_KEY;

        console.log("AI Auto-grading request details:");
        console.log("- Has API Key:", !!apiKey);
        console.log("- Has Problem:", !!problem);
        console.log("- skipGrading:", req.body.skipGrading);

        if (apiKey && problem && !req.body.skipGrading) {
            try {
                const rubricSection = problem.gradingRubric ? `\nThang điểm chấm bài (do giảng viên cung cấp):\n${problem.gradingRubric}\n` : '';
                const prompt = `Bạn là một giảng viên chấm thi toán học đại học chuyên nghiệp và tận tâm. Hãy kiểm tra lời giải của học sinh cho đề bài dưới đây và xác định xem lời giải đó là đúng hay sai.
Đề bài toán: ${problem.title}
Nội dung đề bài:
${problem.content}
${rubricSection}
Bài làm của học sinh:
${req.body.content || "[Không có văn bản thô, chỉ có ảnh chụp bài giải]"}

Hãy chấm điểm lời giải này và trả về kết quả ở định dạng JSON duy nhất dưới đây (không có bất cứ ký tự bao ngoài nào khác ngoài JSON, chỉ trả về JSON thô):
{
  "isCorrect": true hoặc false,
  "feedback": "Nhận xét chi tiết của bạn bằng tiếng Việt dưới vai trò một giảng viên chấm thi (xưng hô Thầy/Cô - em). Hãy chỉ rõ các bước sai, khen ngợi bước làm tốt, và hướng dẫn cách sửa nếu có lỗi. Tuyệt đối không xưng là AI hay chatbot. Viết các công thức toán học dưới dạng LaTeX đặt trong cặp dấu đô la $ ... $ hoặc $$ ... $$ để hiển thị đẹp mắt."
}`;

                let inlineData = null;
                if (req.body.imageUrl && req.body.imageUrl.startsWith('data:')) {
                    const parts = req.body.imageUrl.split(',');
                    const mimeMatches = parts[0].match(/:(.*?);/);
                    const mime = mimeMatches ? mimeMatches[1] : 'image/png';
                    const data = parts[1];
                    inlineData = { mimeType: mime, data: data };
                    console.log("- Solution has image, size:", data.length);
                }

                const contentsParts = [{ text: prompt }];
                if (inlineData) {
                    contentsParts.push({ inlineData });
                }

                console.log("- Sending request to Gemini...");
                const apiResponse = await callGeminiWithRetry(apiKey, {
                    contents: [{ parts: contentsParts }],
                    generationConfig: {
                        responseMimeType: 'application/json',
                        responseSchema: {
                            type: "OBJECT",
                            properties: {
                                isCorrect: { type: "BOOLEAN" },
                                feedback: { type: "STRING" }
                            },
                            required: ["isCorrect", "feedback"]
                        }
                    }
                });

                console.log("- Gemini Response Status:", apiResponse.status);
                if (apiResponse.ok) {
                    const result = await apiResponse.json();
                    const textResult = result.candidates?.[0]?.content?.parts?.[0]?.text;
                    console.log("- Gemini Response Text:", textResult);
                    if (textResult) {
                        let cleanedText = textResult.trim();
                        if (cleanedText.startsWith("```json")) {
                            cleanedText = cleanedText.substring(7);
                        }
                        if (cleanedText.endsWith("```")) {
                            cleanedText = cleanedText.substring(0, cleanedText.length - 3);
                        }
                        cleanedText = cleanedText.trim();

                        try {
                            const parsed = JSON.parse(cleanedText);
                            solution.status = parsed.isCorrect ? 'correct' : 'incorrect';
                            solution.aiFeedback = parsed.feedback || "";
                        } catch (parseErr) {
                            console.warn("Failed standard JSON parse, attempting regex extraction...", parseErr);
                            const isCorrectMatch = cleanedText.match(/"isCorrect"\s*:\s*(true|false)/);
                            const feedbackMatch = cleanedText.match(/"feedback"\s*:\s*"([\s\S]*)"\s*}/);

                            if (isCorrectMatch) {
                                solution.status = (isCorrectMatch[1] === 'true') ? 'correct' : 'incorrect';
                            } else {
                                solution.status = cleanedText.toLowerCase().includes('"iscorrect": true') ? 'correct' : 'incorrect';
                            }

                            if (feedbackMatch) {
                                solution.aiFeedback = feedbackMatch[1]
                                    .replace(/\\"/g, '"')
                                    .replace(/\\n/g, '\n')
                                    .replace(/\\t/g, '\t');
                            } else {
                                solution.aiFeedback = cleanedText;
                            }
                        }
                    }
                } else {
                    const errText = await apiResponse.text();
                    console.error("- Gemini Error Response:", errText);
                    solution.status = 'pending';
                    solution.aiFeedback = `Lỗi hệ thống AI (Status ${apiResponse.status}). Vui lòng báo quản trị viên kiểm tra API Key.`;
                }
            } catch (err) {
                console.error("AI Auto-grading error:", err.message);
                solution.status = 'pending';
                solution.aiFeedback = "Lỗi khi gọi AI chấm bài: " + err.message;
            }
        }

        await solution.save();

        // Award points ONLY if the solution is correct AND they don't already have another correct solution for this problem
        if (solution.status === 'correct' && req.body.authorGoogleId) {
            const alreadyHasCorrect = await Solution.findOne({
                problemId: solution.problemId,
                authorGoogleId: req.body.authorGoogleId,
                status: 'correct',
                _id: { $ne: solution._id } // exclude current solution
            });

            if (!alreadyHasCorrect) {
                const u = await User.findOne({ googleId: req.body.authorGoogleId });
                if (u) {
                    u.points += (problem.points || 10);
                    u.rank = calcRank(u.points);
                    await u.save();
                }
            }
        }

        res.status(201).json(solution);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete a solution
app.delete('/api/solutions/:id', async (req, res) => {
    try {
        const sol = await Solution.findByIdAndDelete(req.params.id);
        if (!sol) return res.status(404).json({ error: 'Solution not found' });
        res.json({ message: 'Solution deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Edit a solution (and optionally re-grade)
app.put('/api/solutions/:id', async (req, res) => {
    try {
        const { content, imageUrl, skipGrading } = req.body;
        const sol = await Solution.findById(req.params.id);
        if (!sol) return res.status(404).json({ error: 'Solution not found' });

        const oldStatus = sol.status;
        const problem = await Problem.findById(sol.problemId);
        const pointsToAward = problem ? (problem.points || 10) : 10;

        if (content !== undefined) sol.content = content;
        if (imageUrl !== undefined) sol.imageUrl = imageUrl;

        if (!skipGrading) {
            sol.status = 'pending';
            const apiKey = process.env.GEMINI_API_KEY;

            if (apiKey && problem) {
                try {
                    const rubricSection = problem.gradingRubric ? `\nThang điểm chấm bài (do giảng viên cung cấp):\n${problem.gradingRubric}\n` : '';
                    const prompt = `Bạn là một giảng viên chấm thi toán học chuyên nghiệp cho sinh viên đại học. Hãy kiểm tra lời giải của học sinh cho đề bài dưới đây và xác định xem lời giải đó là đúng hay sai.
Đề bài toán: ${problem.title}
Nội dung đề bài:
${problem.content}
${rubricSection}
Bài làm của học sinh:
${sol.content || "[Không có văn bản thô, chỉ có ảnh chụp bài giải]"}

Hãy chấm điểm lời giải này và trả về kết quả ở định dạng JSON duy nhất dưới đây (không có bất cứ ký tự bao ngoài nào khác ngoài JSON, chỉ trả về JSON thô):
{
  "isCorrect": true hoặc false,
  "feedback": "Nhận xét chi tiết của bạn bằng tiếng Việt. Chỉ rõ các bước sai và cách sửa nếu có lỗi. Hãy viết các công thức toán học dưới dạng LaTeX đặt trong cặp dấu đô la $ ... $ hoặc $$ ... $$ để hiển thị đẹp mắt."
}`;

                    let inlineData = null;
                    if (sol.imageUrl && sol.imageUrl.startsWith('data:')) {
                        const parts = sol.imageUrl.split(',');
                        const mimeMatches = parts[0].match(/:(.*?);/);
                        const mime = mimeMatches ? mimeMatches[1] : 'image/png';
                        const data = parts[1];
                        inlineData = { mimeType: mime, data: data };
                    }

                    const contentsParts = [{ text: prompt }];
                    if (inlineData) {
                        contentsParts.push({ inlineData });
                    }

                    const apiResponse = await callGeminiWithRetry(apiKey, {
                        contents: [{ parts: contentsParts }],
                        generationConfig: {
                            responseMimeType: 'application/json',
                            responseSchema: {
                                type: "OBJECT",
                                properties: {
                                    isCorrect: { type: "BOOLEAN" },
                                    feedback: { type: "STRING" }
                                },
                                required: ["isCorrect", "feedback"]
                            }
                        }
                    });

                    if (apiResponse.ok) {
                        const result = await apiResponse.json();
                        const textResult = result.candidates?.[0]?.content?.parts?.[0]?.text;
                        if (textResult) {
                            let cleanedText = textResult.trim();
                            if (cleanedText.startsWith("```json")) {
                                cleanedText = cleanedText.substring(7);
                            }
                            if (cleanedText.endsWith("```")) {
                                cleanedText = cleanedText.substring(0, cleanedText.length - 3);
                            }
                            cleanedText = cleanedText.trim();

                            try {
                                const parsed = JSON.parse(cleanedText);
                                sol.status = parsed.isCorrect ? 'correct' : 'incorrect';
                                sol.aiFeedback = parsed.feedback || "";
                            } catch (parseErr) {
                                console.warn("Failed standard JSON parse, attempting regex extraction...", parseErr);
                                const isCorrectMatch = cleanedText.match(/"isCorrect"\s*:\s*(true|false)/);
                                const feedbackMatch = cleanedText.match(/"feedback"\s*:\s*"([\s\S]*)"\s*}/);

                                if (isCorrectMatch) {
                                    sol.status = (isCorrectMatch[1] === 'true') ? 'correct' : 'incorrect';
                                } else {
                                    sol.status = cleanedText.toLowerCase().includes('"iscorrect": true') ? 'correct' : 'incorrect';
                                }

                                if (feedbackMatch) {
                                    sol.aiFeedback = feedbackMatch[1]
                                        .replace(/\\"/g, '"')
                                        .replace(/\\n/g, '\n')
                                        .replace(/\\t/g, '\t');
                                } else {
                                    sol.aiFeedback = cleanedText;
                                }
                            }
                        }
                    } else {
                        sol.status = 'pending';
                        sol.aiFeedback = `Lỗi hệ thống AI (Status ${apiResponse.status}). Vui lòng báo quản trị viên kiểm tra API Key.`;
                    }
                } catch (err) {
                    console.error("AI Auto-grading error:", err.message);
                    sol.status = 'pending';
                    sol.aiFeedback = "Lỗi khi gọi AI chấm bài: " + err.message;
                }
            }
        } else {
            sol.status = 'pending';
            sol.aiFeedback = '';
        }

        await sol.save();

        // Handle points awarding/deduction after successful save
        if (sol.authorGoogleId) {
            // Case 1: Status changed from non-correct to correct
            if (sol.status === 'correct' && oldStatus !== 'correct') {
                const alreadyHasCorrect = await Solution.findOne({
                    problemId: sol.problemId,
                    authorGoogleId: sol.authorGoogleId,
                    status: 'correct',
                    _id: { $ne: sol._id }
                });
                if (!alreadyHasCorrect) {
                    const u = await User.findOne({ googleId: sol.authorGoogleId });
                    if (u) {
                        u.points += pointsToAward;
                        u.rank = calcRank(u.points);
                        await u.save();
                    }
                }
            }
            // Case 2: Status changed from correct to non-correct (e.g. downgraded by admin)
            else if (sol.status !== 'correct' && oldStatus === 'correct') {
                const stillHasCorrect = await Solution.findOne({
                    problemId: sol.problemId,
                    authorGoogleId: sol.authorGoogleId,
                    status: 'correct',
                    _id: { $ne: sol._id }
                });
                if (!stillHasCorrect) {
                    const u = await User.findOne({ googleId: sol.authorGoogleId });
                    if (u) {
                        u.points = Math.max(0, u.points - pointsToAward);
                        u.rank = calcRank(u.points);
                        await u.save();
                    }
                }
            }
        }

        res.json(sol);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/solutions/:id/upvote', async (req, res) => {
    try {
        const sol = await Solution.findByIdAndUpdate(
            req.params.id,
            { $inc: { votes: 1 } },
            { new: true }
        );
        if (!sol) return res.status(404).json({ error: 'Solution not found' });
        
        // Award upvote points to solution author
        if (sol.authorGoogleId) {
            const u = await User.findOne({ googleId: sol.authorGoogleId });
            if (u) { 
                u.points += 5; 
                u.rank = calcRank(u.points); 
                await u.save(); 

                // Gửi email báo nhận được Upvote
                const problem = await Problem.findById(sol.problemId);
                const emailHtml = `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
                        <h2 style="color: #6366f1; border-bottom: 2px solid #6366f1; padding-bottom: 10px; margin-top: 0;">Tương Tác Bài Giải Mới</h2>
                        <p>Chào <strong>${u.name}</strong>,</p>
                        <p>Một học viên vừa thả tim (Upvote) cho lời giải của em trong bài toán: <strong>"${problem ? problem.title : 'Bài toán'}"</strong>.</p>
                        <div style="background-color: #f8fafc; padding: 15px; border-left: 4px solid #10b981; border-radius: 4px; margin: 20px 0; font-size: 1rem;">
                            🎉 Em vừa nhận được <strong>+5 điểm thưởng</strong>. Điểm tích lũy hiện tại: <strong>${u.points} (${u.rank})</strong>.
                        </div>
                        <p>Hãy tiếp tục chia sẻ những lời giải hay để hỗ trợ các bạn cùng khóa học nhé!</p>
                        <p style="margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 15px; font-size: 0.85rem; color: #64748b;">
                            Trân trọng,<br>
                            <strong>Hệ thống UPMath</strong>
                        </p>
                    </div>
                `;
                sendNotificationEmail(u.email, `[UPMath] Lời giải của bạn vừa được nhận lượt thích (Upvote)`, emailHtml);
            }
        }
        res.json(sol);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update solution status (correct/incorrect/pending)
app.put('/api/solutions/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        if (!['correct', 'incorrect', 'pending'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }
        const sol = await Solution.findById(req.params.id);
        if (!sol) return res.status(404).json({ error: 'Solution not found' });

        const oldStatus = sol.status;
        sol.status = status;
        await sol.save();

        const problem = await Problem.findById(sol.problemId);
        const pointsToAward = problem ? (problem.points || 10) : 10;

        if (sol.authorGoogleId) {
            const u = await User.findOne({ googleId: sol.authorGoogleId });
            if (u) {
                // Award points if manually changed to correct
                if (status === 'correct' && oldStatus !== 'correct') {
                    u.points += pointsToAward;
                    u.rank = calcRank(u.points);
                    await u.save();
                } 
                // Deduct points if downgraded from correct
                else if (status !== 'correct' && oldStatus === 'correct') {
                    u.points = Math.max(0, u.points - pointsToAward);
                    u.rank = calcRank(u.points);
                    await u.save();
                }

                // Gửi email thông báo trạng thái bài giải được phê duyệt bởi Giảng viên
                const statusNames = {
                    'correct': 'ĐÚNG (Chấp nhận)',
                    'incorrect': 'SAI (Cần chỉnh sửa)',
                    'pending': 'Chờ kiểm duyệt'
                };
                const statusColor = status === 'correct' ? '#10b981' : '#f43f5e';
                const statusName = statusNames[status];

                const emailHtml = `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
                        <h2 style="color: #6366f1; border-bottom: 2px solid #6366f1; padding-bottom: 10px; margin-top: 0;">Kết Quả Phê Duyệt Lời Giải</h2>
                        <p>Chào <strong>${u.name}</strong>,</p>
                        <p>Giảng viên vừa thực hiện kiểm duyệt lời giải của em cho bài toán: <strong>"${problem ? problem.title : 'Bài toán'}"</strong>.</p>
                        <div style="background-color: #f8fafc; padding: 15px; border-left: 4px solid ${statusColor}; border-radius: 4px; margin: 20px 0; font-size: 1.05rem;">
                            Trạng thái lời giải: <strong style="color: ${statusColor};">${statusName}</strong>
                            ${status === 'correct' ? `<br>🎉 Em được cộng <strong>+${pointsToAward} điểm thưởng</strong>! Điểm hiện tại: <strong>${u.points} (${u.rank})</strong>.` : ''}
                        </div>
                        ${status === 'incorrect' ? '<p>💡 <em>Lời giải chưa chính xác, em hãy kiểm tra lại các bước tính toán và chỉnh sửa để nộp lại nhé.</em></p>' : ''}
                        <p style="margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 15px; font-size: 0.85rem; color: #64748b;">
                            Trân trọng,<br>
                            <strong>Hệ thống UPMath</strong>
                        </p>
                    </div>
                `;
                sendNotificationEmail(u.email, `[UPMath] Kết quả đánh giá lời giải bài toán "${problem ? problem.title : 'học tập'}"`, emailHtml);
            }
        }
        res.json(sol);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── ROUTES: DISCUSSIONS ──────────────────────────────────────────────────────

app.get('/api/discussions', async (req, res) => {
    try {
        const discussions = await Discussion.find().sort({ createdAt: -1 });
        res.json(discussions);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/discussions/:id', async (req, res) => {
    try {
        const disc = await Discussion.findByIdAndUpdate(
            req.params.id,
            { $inc: { views: 1 } },
            { new: true }
        );
        if (!disc) return res.status(404).json({ error: 'Discussion not found' });
        res.json(disc);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/discussions', async (req, res) => {
    try {
        const disc = new Discussion(req.body);
        await disc.save();
        if (req.body.creatorGoogleId) {
            const u = await User.findOne({ googleId: req.body.creatorGoogleId });
            if (u) { u.points += 5; u.rank = calcRank(u.points); await u.save(); }
        }
        res.status(201).json(disc);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── ROUTES: COMMENTS ─────────────────────────────────────────────────────────

app.get('/api/comments', async (req, res) => {
    try {
        const filter = {};
        if (req.query.targetType) filter.targetType = req.query.targetType;
        if (req.query.targetId) filter.targetId = req.query.targetId;
        const comments = await Comment.find(filter).sort({ createdAt: 1 });
        res.json(comments);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/comments', async (req, res) => {
    try {
        const comment = new Comment(req.body);
        await comment.save();
        // Increment replies on parent discussion
        if (req.body.targetType === 'discussion') {
            await Discussion.findByIdAndUpdate(req.body.targetId, { $inc: { replies: 1 } });
        }
        if (req.body.authorGoogleId) {
            const u = await User.findOne({ googleId: req.body.authorGoogleId });
            if (u) { u.points += 2; u.rank = calcRank(u.points); await u.save(); }
        }
        res.status(201).json(comment);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── LIKE / DISLIKE SYSTEM ───────────────────────────────────────────────────

async function toggleLikeOrDislike(model, id, googleId, action) {
    const item = await model.findById(id);
    if (!item) throw new Error('Không tìm thấy bản ghi');

    if (!item.likes) item.likes = [];
    if (!item.dislikes) item.dislikes = [];

    const likedIndex = item.likes.indexOf(googleId);
    const dislikedIndex = item.dislikes.indexOf(googleId);

    if (action === 'like') {
        if (likedIndex > -1) {
            item.likes.splice(likedIndex, 1);
        } else {
            item.likes.push(googleId);
            if (dislikedIndex > -1) item.dislikes.splice(dislikedIndex, 1);
        }
    } else if (action === 'dislike') {
        if (dislikedIndex > -1) {
            item.dislikes.splice(dislikedIndex, 1);
        } else {
            item.dislikes.push(googleId);
            if (likedIndex > -1) item.likes.splice(likedIndex, 1);
        }
    }

    await item.save();
    return item;
}

app.put('/api/:type/:id/like', async (req, res) => {
    try {
        const { googleId } = req.body;
        if (!googleId) return res.status(400).json({ error: 'googleId is required' });
        const type = req.params.type; // 'problems', 'discussions', 'comments'
        let model;
        if (type === 'problems') model = Problem;
        else if (type === 'discussions') model = Discussion;
        else if (type === 'comments') model = Comment;
        else return res.status(400).json({ error: 'Invalid item type' });

        const updated = await toggleLikeOrDislike(model, req.params.id, googleId, 'like');
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/:type/:id/dislike', async (req, res) => {
    try {
        const { googleId } = req.body;
        if (!googleId) return res.status(400).json({ error: 'googleId is required' });
        const type = req.params.type;
        let model;
        if (type === 'problems') model = Problem;
        else if (type === 'discussions') model = Discussion;
        else if (type === 'comments') model = Comment;
        else return res.status(400).json({ error: 'Invalid item type' });

        const updated = await toggleLikeOrDislike(model, req.params.id, googleId, 'dislike');
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── ROUTES: SHOUTS ───────────────────────────────────────────────────────────

app.get('/api/shouts', async (req, res) => {
    try {
        const shouts = await Shout.find().sort({ createdAt: -1 }).limit(30);
        res.json(shouts.reverse()); // oldest first for chat display
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/shouts', async (req, res) => {
    try {
        const shout = new Shout(req.body);
        await shout.save();
        // Keep only 50 most recent shouts
        const total = await Shout.countDocuments();
        if (total > 50) {
            const toDelete = await Shout.find().sort({ createdAt: 1 }).limit(total - 50).select('_id');
            await Shout.deleteMany({ _id: { $in: toDelete.map(s => s._id) } });
        }
        res.status(201).json(shout);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// React to a shout
app.put('/api/shouts/:id/react', async (req, res) => {
    try {
        const { type, googleId, username } = req.body;
        const shout = await Shout.findById(req.params.id);
        if (!shout) return res.status(404).json({ error: 'Shout not found' });

        if (!shout.reactions) shout.reactions = [];

        const existingIdx = shout.reactions.findIndex(r => r.googleId === googleId);
        if (existingIdx !== -1) {
            if (shout.reactions[existingIdx].reactionType === type) {
                shout.reactions.splice(existingIdx, 1);
            } else {
                shout.reactions[existingIdx].reactionType = type;
            }
        } else {
            shout.reactions.push({ googleId, username, reactionType: type });
        }

        shout.markModified('reactions');
        await shout.save();
        res.json(shout);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Edit a shout
app.put('/api/shouts/:id', async (req, res) => {
    try {
        const { text, googleId } = req.body;
        const shout = await Shout.findById(req.params.id);
        if (!shout) return res.status(404).json({ error: 'Shout not found' });

        if (shout.authorGoogleId !== googleId) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        shout.text = text;
        shout.isEdited = true;
        await shout.save();
        res.json(shout);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete a shout
app.delete('/api/shouts/:id', async (req, res) => {
    try {
        // Find and delete the shout
        const shout = await Shout.findByIdAndDelete(req.params.id);
        if (!shout) return res.status(404).json({ error: 'Shout not found' });
        res.json({ message: 'Shout deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// AI Tutor chat interaction with Knowledge Base + Verification Layer
app.post('/api/ai-tutor', async (req, res) => {
    try {
        const { problemId, messages } = req.body;
        const problem = await Problem.findById(problemId);
        if (!problem) return res.status(404).json({ error: 'Problem not found' });

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) return res.status(500).json({ error: 'Gemini API key is not configured' });

        // ── CƠ SỞ TRI THỨC COMP1800 (đã được xác minh) ──────────────────────
        const knowledgeBase = `
CƠ SỞ TRI THỨC COMP1800 (ĐÃ ĐƯỢC XÁC MINH - BẮT BUỘC TUÂN THEO):

GIẢI TÍCH:
• Giới hạn cơ bản: lim(x→0) sin(x)/x = 1; lim(x→0) (e^x-1)/x = 1; lim(x→0) ln(1+x)/x = 1; lim(x→0) (1-cos x)/x² = 1/2
• Vô cùng bé tương đương (x→0): sin x ~ x; tan x ~ x; arcsin x ~ x; arctan x ~ x; 1-cos x ~ x²/2; e^x-1 ~ x; ln(1+x) ~ x; (1+x)^α - 1 ~ αx
• Quy tắc L'Hôpital: Dạng 0/0 hoặc ∞/∞ → lim f/g = lim f'/g' (áp dụng từng bước, kiểm tra dạng vô định trước mỗi lần áp dụng)
• Đạo hàm cơ bản: (x^n)'=nx^(n-1); (sin x)'=cos x; (cos x)'=-sin x; (tan x)'=1/cos²x; (e^x)'=e^x; (a^x)'=a^x·ln a; (ln x)'=1/x; (arcsin x)'=1/√(1-x²); (arctan x)'=1/(1+x²)
• Quy tắc đạo hàm: (uv)'=u'v+uv'; (u/v)'=(u'v-uv')/v²; [f(g(x))]'=f'(g(x))·g'(x)
• Đạo hàm hàm ẩn và hàm số mũ: y=f(x)^g(x) → ln y = g(x)·ln f(x) → lấy đạo hàm 2 vế
• Tích phân cơ bản: ∫x^n dx=x^(n+1)/(n+1)+C; ∫sin x dx=-cos x+C; ∫cos x dx=sin x+C; ∫e^x dx=e^x+C; ∫1/x dx=ln|x|+C; ∫1/(1+x²) dx=arctan x+C; ∫1/√(1-x²) dx=arcsin x+C
• Phương pháp tích phân: Từng phần ∫u dv=uv-∫v du; Đổi biến; Phân thức từng phần

ĐẠI SỐ TUYẾN TÍNH:
• Định thức 2×2: det[a b; c d]=ad-bc
• Định thức 3×3 theo khai triển Laplace: chọn hàng/cột ít số 0 nhất
• Ma trận nghịch đảo: A⁻¹=adj(A)/det(A), tồn tại khi và chỉ khi det(A)≠0
• Hệ Cramer: x_i=D_i/D với D=det(A), D_i thay cột i bằng vector vế phải
• Phép khử Gauss: biến đổi sơ cấp hàng để đưa về dạng bậc thang
• Trị riêng: det(A-λI)=0; Vec-tơ riêng ứng với λ: (A-λI)x=0
• Hạng ma trận (rank): số hàng khác 0 sau khử Gauss

NGUYÊN TẮC SỬ DỤNG TRI THỨC:
1. Chỉ sử dụng các công thức có trong cơ sở tri thức trên hoặc các định lý toán học chuẩn đã được kiểm chứng
2. Trước mỗi bước tính toán, xác định rõ áp dụng quy tắc/công thức nào
3. Kiểm tra điều kiện áp dụng của mỗi công thức (ví dụ: vô cùng bé tương đương chỉ dùng khi x→0 và là tích/thương, KHÔNG dùng cho tổng/hiệu)
4. Khi không chắc chắn về một kết quả, nói rõ và đề nghị học viên kiểm tra với giáo trình`;

        const systemInstruction = `Bạn là một giảng viên toán học đại học xuất sắc (xưng hô là "Thầy" và gọi người học là "em").
Nhiệm vụ: hướng dẫn học viên tự giải bài toán từng bước, đóng vai giáo viên thực thụ, KHÔNG xưng là "AI", "chatbot", hay "mô hình ngôn ngữ".

Đề bài: ${problem.title}
Nội dung: ${problem.content || '[Bài dạng hình ảnh - hướng dẫn theo chủ đề và tiêu đề bài]'}
${problem.gradingRubric ? `Thang điểm: ${problem.gradingRubric}` : ''}

${knowledgeBase}

Quy tắc giảng dạy:
1. Gợi mở từng bước, đặt câu hỏi nhỏ định hướng - KHÔNG cho toàn bộ lời giải ngay
2. Áp dụng đúng công thức từ cơ sở tri thức, nêu rõ đang dùng quy tắc nào
3. Nếu học viên làm sai, chỉ ra lỗi cụ thể và hướng dẫn sửa
4. Viết công thức bằng LaTeX: $...$ (inline) hoặc $$...$$ (block)
5. Phản hồi bằng tiếng Việt tự nhiên, ấm áp, khuyến khích`;

        const contents = [];
        const firstMessageText = `HƯỚNG DẪN HỆ THỐNG:\n${systemInstruction}\n\nCuộc trò chuyện:\n`;

        messages.forEach((msg, idx) => {
            let txt = msg.content;
            if (idx === 0) txt = firstMessageText + txt;

            const parts = [{ text: txt }];
            if (msg.image && msg.image.startsWith('data:')) {
                const imgParts = msg.image.split(',');
                const mimeMatches = imgParts[0].match(/:(.*?);/);
                const mime = mimeMatches ? mimeMatches[1] : 'image/png';
                const data = imgParts[1];
                parts.push({
                    inlineData: {
                        mimeType: mime,
                        data: data
                    }
                });
            }

            contents.push({
                role: msg.role === 'model' ? 'model' : 'user',
                parts: parts
            });
        });

        // ── TẦNG 1: Sinh câu trả lời ──────────────────────────────────────────
        const response1 = await callGeminiWithRetry(apiKey, { contents });

        const data1 = await response1.json();
        if (!data1.candidates?.[0]?.content?.parts) {
            console.error("Gemini Tutor Error:", JSON.stringify(data1));
            return res.status(500).json({ error: "Không nhận được phản hồi từ AI" });
        }
        const rawAiText = data1.candidates[0].content.parts[0].text;

        // ── TẦNG 2: Xác minh độ chính xác toán học ───────────────────────────
        let finalText = rawAiText;
        let verified = null;
        let issues = '';

        try {
            const verifyPrompt = `Bạn là giám khảo toán học đại học. Hãy kiểm tra câu trả lời dưới đây của một gia sư toán.

Đề bài: ${problem.title}
Nội dung đề: ${problem.content || '[Bài hình ảnh]'}

Câu trả lời cần kiểm tra:
${rawAiText}

Yêu cầu: Kiểm tra từng công thức, quy tắc, bước tính toán. Phát hiện bất kỳ lỗi toán học nào (dù nhỏ).
Trả về JSON (chỉ JSON thuần):
{
  "isAccurate": true hoặc false,
  "issues": "Mô tả ngắn gọn lỗi phát hiện, để trống nếu đúng",
  "correctedResponse": "Câu trả lời đã sửa đúng hoàn toàn nếu có lỗi (giữ văn phong Thầy-em), để trống nếu đúng"
}`;

            const response2 = await callGeminiWithRetry(apiKey, {
                contents: [{ parts: [{ text: verifyPrompt }] }],
                generationConfig: {
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: "OBJECT",
                        properties: {
                            isAccurate: { type: "BOOLEAN" },
                            issues: { type: "STRING" },
                            correctedResponse: { type: "STRING" }
                        },
                        required: ["isAccurate", "issues", "correctedResponse"]
                    }
                }
            });

            if (response2.ok) {
                const data2 = await response2.json();
                const verifyText = data2.candidates?.[0]?.content?.parts?.[0]?.text;
                if (verifyText) {
                    const verifyResult = JSON.parse(verifyText);
                    verified = verifyResult.isAccurate;
                    issues = verifyResult.issues || '';
                    // Nếu phát hiện lỗi và có bản sửa → dùng bản sửa
                    if (!verifyResult.isAccurate && verifyResult.correctedResponse) {
                        finalText = verifyResult.correctedResponse;
                    }
                    console.log(`[AI Tutor] Verification: ${verified ? 'PASS' : 'CORRECTED'} ${issues ? '| Issues: ' + issues : ''}`);
                }
            }
        } catch (verifyErr) {
            console.warn('[AI Tutor] Verification step failed (non-critical):', verifyErr.message);
            // Không crash - trả về bản gốc nếu verification fail
        }

        res.json({ text: finalText, verified, issues });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── ROUTES: CONTESTS ─────────────────────────────────────────────────────────

app.get('/api/contests', async (req, res) => {
    try {
        const contests = await Contest.find().sort({ createdAt: -1 });
        res.json(contests);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/contests', async (req, res) => {
    try {
        const contest = new Contest(req.body);
        await contest.save();
        res.status(201).json(contest);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/contests/:id', async (req, res) => {
    try {
        const c = await Contest.findByIdAndDelete(req.params.id);
        if (!c) return res.status(404).json({ error: 'Contest not found' });
        res.json({ message: 'Contest deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── ROUTE: STATS ─────────────────────────────────────────────────────────────

app.get('/api/stats', async (req, res) => {
    try {
        const [problems, solutions, users] = await Promise.all([
            Problem.countDocuments(),
            Solution.countDocuments(),
            User.countDocuments()
        ]);
        res.json({ problems, solutions, users });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── FALLBACK: Serve index.html for all non-API routes ────────────────────────

app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(__dirname, '..', 'index.html'));
    }
});

// ─── START ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
    console.log(`\n🚀 UPMath Server đang chạy tại http://localhost:${PORT}`);
    console.log(`📚 API endpoint: http://localhost:${PORT}/api`);
    console.log(`🌐 Frontend: http://localhost:${PORT}\n`);
});
