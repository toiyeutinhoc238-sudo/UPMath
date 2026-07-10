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
    googleId:  { type: String, required: true, unique: true },
    email:     { type: String, required: true },
    name:      { type: String, required: true },
    picture:   String,
    points:    { type: Number, default: 0 },
    rank:      { type: String, default: 'Đồng' },
    role:      { type: String, enum: ['user', 'admin'], default: 'user' },
    joinedAt:  { type: Date, default: Date.now }
});

const problemSchema = new mongoose.Schema({
    title:           { type: String, required: true },
    content:         { type: String, required: true },
    category:        { type: String, enum: ['calculus', 'algebra'], required: true },
    tags:            [String],
    creator:         { type: String, required: true },
    creatorPicture:  String,
    creatorGoogleId: String,
    points:          { type: Number, default: 25 },
    imageUrl:        String,
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
    createdAt:       { type: Date, default: Date.now }
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
    createdAt:       { type: Date, default: Date.now }
});

const commentSchema = new mongoose.Schema({
    targetType:      { type: String, enum: ['problem', 'discussion'], required: true },
    targetId:        { type: String, required: true },
    author:          { type: String, required: true },
    authorPicture:   String,
    authorGoogleId:  String,
    content:         { type: String, required: true },
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
        const { googleId, email, name, picture } = req.body;
        if (!googleId || !email) return res.status(400).json({ error: 'googleId and email required' });

        const role = email === 'phanphiphu04@gmail.com' ? 'admin' : 'user';
        const user = await User.findOneAndUpdate(
            { googleId },
            { $set: { email, name, picture, role } },
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
        await solution.save();
        if (req.body.authorGoogleId) {
            const u = await User.findOne({ googleId: req.body.authorGoogleId });
            if (u) { u.points += 15; u.rank = calcRank(u.points); await u.save(); }
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
