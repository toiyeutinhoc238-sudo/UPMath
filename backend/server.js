/* ==========================================================================
   UPMath Backend Server
   Express + Mongoose + MongoDB Atlas
   ========================================================================== */
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));

// Serve static frontend files from parent directory
app.use(express.static(path.join(__dirname, '..')));

// ─── MONGODB CONNECTION ───────────────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ Connected to MongoDB Atlas — UPMath DB'))
    .catch(err => {
        console.error('❌ MongoDB connection error:', err.message);
        console.error('👉 Kiểm tra MONGODB_URI trong file backend/.env');
    });

// ─── SCHEMAS & MODELS ────────────────────────────────────────────────────────

const userSchema = new mongoose.Schema({
    googleId:        { type: String, required: true, unique: true },
    email:           { type: String, required: true },
    name:            { type: String, required: true },
    picture:         String,
    points:          { type: Number, default: 0 },
    rank:            { type: String, default: 'Đồng' },
    role:            { type: String, enum: ['user', 'admin', 'professor', 'supporter'], default: 'user' },
    joinedAt:        { type: Date, default: Date.now },
    // Custom profile fields
    fullName:        String,
    mssv:            String,
    dob:             String,
    defaultLang:     { type: String, default: 'C++14' },
    phone:           String,
    school:          String,
    codenodeFolder:  String,
    lastLogin:       { type: Date, default: Date.now }
});

const problemSchema = new mongoose.Schema({
    title:           { type: String, required: true },
    content:         { type: String, required: true },
    category:        { type: String, enum: ['calculus', 'algebra'], required: true },
    tags:            [String],
    creator:         { type: String, required: true },
    creatorPicture:  String,
    creatorGoogleId: String,
    points:          { type: Number, default: 10 },
    gradingRubric:   { type: String, default: '' },
    difficulty:      { type: String, enum: ['easy', 'medium', 'hard', 'extreme'], default: 'medium' },
    imageUrl:        String,
    likes:           { type: [String], default: [] },
    dislikes:        { type: [String], default: [] },
    createdAt:       { type: Date, default: Date.now }
});

const solutionSchema = new mongoose.Schema({
    problemId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Problem', required: true },
    author:          { type: String, required: true },
    authorPicture:   String,
    authorGoogleId:  String,
    content:         { type: String, required: true },
    votes:           { type: Number, default: 0 },
    imageUrl:        String,
    createdAt:       { type: Date, default: Date.now },
    status:          { type: String, enum: ['correct', 'incorrect', 'pending'], default: 'pending' },
    aiFeedback:      { type: String, default: "" }
});

const discussionSchema = new mongoose.Schema({
    title:           { type: String, required: true },
    content:         { type: String, required: true },
    creator:         { type: String, required: true },
    creatorPicture:  String,
    creatorGoogleId: String,
    category:        { type: String, default: 'Giải tích' },
    replies:         { type: Number, default: 0 },
    views:           { type: Number, default: 0 },
    likes:           { type: [String], default: [] },
    dislikes:        { type: [String], default: [] },
    createdAt:       { type: Date, default: Date.now }
});

const commentSchema = new mongoose.Schema({
    targetType:      { type: String, enum: ['problem', 'discussion'], required: true },
    targetId:        { type: String, required: true },
    author:          { type: String, required: true },
    authorPicture:   String,
    authorGoogleId:  String,
    content:         { type: String, required: true },
    likes:           { type: [String], default: [] },
    dislikes:        { type: [String], default: [] },
    createdAt:       { type: Date, default: Date.now }
});

const shoutSchema = new mongoose.Schema({
    username:    { type: String, required: true },
    userPicture: String,
    text:        { type: String, required: true },
    time:        String,
    createdAt:   { type: Date, default: Date.now }
});

const contestSchema = new mongoose.Schema({
    title:     { type: String, required: true },
    duration:  String,
    startTime: String,
    status:    { type: String, enum: ['upcoming', 'running', 'ended'], default: 'upcoming' },
    createdAt: { type: Date, default: Date.now }
});

const User       = mongoose.model('User',       userSchema);
const Problem    = mongoose.model('Problem',    problemSchema);
const Solution   = mongoose.model('Solution',   solutionSchema);
const Discussion = mongoose.model('Discussion', discussionSchema);
const Comment    = mongoose.model('Comment',    commentSchema);
const Shout      = mongoose.model('Shout',      shoutSchema);
const Contest    = mongoose.model('Contest',    contestSchema);

// ─── RANK HELPER ──────────────────────────────────────────────────────────────
function calcRank(pts) {
    if (pts >= 100000) return 'Giáo sư';
    if (pts >= 60000)  return 'Phó Giáo sư';
    if (pts >= 30000)  return 'Tiến sĩ';
    if (pts >= 15000)  return 'Thạc sĩ';
    if (pts >= 8000)   return 'Chiến thần';
    if (pts >= 4000)   return 'Cao thủ';
    if (pts >= 2000)   return 'Tinh anh';
    if (pts >= 1000)   return 'Kim cương';
    if (pts >= 500)    return 'Bạch kim';
    if (pts >= 300)    return 'Vàng';
    if (pts >= 100)    return 'Bạc';
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
        user.points = Math.max(0, user.points + (amount || 0));
        user.rank = calcRank(user.points);
        await user.save();
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
            }).catch(() => {});
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
                const prompt = `Bạn là một giảng viên chấm thi toán học chuyên nghiệp cho sinh viên đại học. Hãy kiểm tra lời giải của học sinh cho đề bài dưới đây và xác định xem lời giải đó là đúng hay sai.
Đề bài toán: ${problem.title}
Nội dung đề bài:
${problem.content}
${rubricSection}
Bài làm của học sinh:
${req.body.content || "[Không có văn bản thô, chỉ có ảnh chụp bài giải]"}

Hãy chấm điểm lời giải này và trả về kết quả ở định dạng JSON duy nhất dưới đây (không có bất cứ ký tự bao ngoài nào khác ngoài JSON, chỉ trả về JSON thô):
{
  "isCorrect": true hoặc false,
  "feedback": "Nhận xét chi tiết của bạn bằng tiếng Việt. Chỉ rõ các bước sai và cách sửa nếu có lỗi. Hãy viết các công thức toán học dưới dạng LaTeX đặt trong cặp dấu đô la $ ... $ hoặc $$ ... $$ để hiển thị đẹp mắt."
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

                let url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`;
                const headers = { 'Content-Type': 'application/json' };

                if (apiKey.startsWith('AIza')) {
                    url += `?key=${apiKey}`;
                } else {
                    headers['Authorization'] = `Bearer ${apiKey}`;
                }

                const contentsParts = [{ text: prompt }];
                if (inlineData) {
                    contentsParts.push({ inlineData });
                }

                console.log("- Sending request to Gemini...");
                const apiResponse = await fetch(url, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify({
                        contents: [{ parts: contentsParts }],
                        generationConfig: {
                            responseMimeType: 'application/json'
                        }
                    })
                });

                console.log("- Gemini Response Status:", apiResponse.status);
                if (apiResponse.ok) {
                    const result = await apiResponse.json();
                    const textResult = result.candidates?.[0]?.content?.parts?.[0]?.text;
                    console.log("- Gemini Response Text:", textResult);
                    if (textResult) {
                        const parsed = JSON.parse(textResult.trim());
                        solution.status = parsed.isCorrect ? 'correct' : 'incorrect';
                        solution.aiFeedback = parsed.feedback || "";
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

        // Award points ONLY if the solution is correct (either by AI or pre-graded)
        if (solution.status === 'correct' && req.body.authorGoogleId) {
            const u = await User.findOne({ googleId: req.body.authorGoogleId });
            if (u) {
                u.points += 15;
                u.rank = calcRank(u.points);
                await u.save();
            }
        }

        res.status(201).json(solution);
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
            if (u) { u.points += 5; u.rank = calcRank(u.points); await u.save(); }
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

        // Award points if manually changed to correct
        if (status === 'correct' && oldStatus !== 'correct' && sol.authorGoogleId) {
            const u = await User.findOne({ googleId: sol.authorGoogleId });
            if (u) { u.points += 15; u.rank = calcRank(u.points); await u.save(); }
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
        if (req.query.targetId)   filter.targetId   = req.query.targetId;
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
