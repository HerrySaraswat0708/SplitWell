const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../database');
const authMiddleware = require('../middleware/auth');
const { sendVerificationEmail } = require('../utils/mailer');

const JWT_SECRET = process.env.JWT_SECRET || 'splitwise-secret-key';
const COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#ec4899'];

function safeUser(u) {
  const { password_hash, ...safe } = u;
  safe.email_verified = !!safe.email_verified;
  return safe;
}

function makeToken() { return crypto.randomBytes(32).toString('hex'); }

async function issueVerification(user) {
  const token = makeToken();
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  // Invalidate old unused tokens for this user
  await db.run('UPDATE verification_tokens SET used = 1 WHERE user_id = ? AND used = 0', [user.id]);
  await db.run('INSERT INTO verification_tokens (user_id, token, expires_at) VALUES (?, ?, ?)', [user.id, token, expires]);
  await sendVerificationEmail(user, token);
}

// ── Register ─────────────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: 'Name, email and password are required' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters' });

  try {
    if (await db.get('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]))
      return res.status(409).json({ error: 'Email already registered' });

    const password_hash = bcrypt.hashSync(password, 10);
    const avatar_color = COLORS[Math.floor(Math.random() * COLORS.length)];

    const { id } = await db.get(
      'INSERT INTO users (name, email, password_hash, avatar_color, email_verified) VALUES (?, ?, ?, ?, 0) RETURNING id',
      [name, email.toLowerCase(), password_hash, avatar_color]
    );

    const user = await db.get('SELECT * FROM users WHERE id = ?', [id]);
    const token = jwt.sign({ userId: id }, JWT_SECRET, { expiresIn: '30d' });

    // Send verification email (non-blocking — don't fail registration if mail fails)
    issueVerification(user).catch(e => console.error('Mailer error:', e));

    res.status(201).json({ token, user: safeUser(user) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

// ── Login ─────────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password are required' });

  try {
    const user = await db.get('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
    if (!user || !bcrypt.compareSync(password, user.password_hash))
      return res.status(401).json({ error: 'Invalid email or password' });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: safeUser(user) });
  } catch {
    res.status(500).json({ error: 'Login failed' });
  }
});

// ── Me ────────────────────────────────────────────────────────────────────────
router.get('/me', authMiddleware, async (req, res) => {
  const user = await db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
  res.json({ user: safeUser(user) });
});

// ── Verify email ──────────────────────────────────────────────────────────────
router.get('/verify-email', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Token is required' });

  const record = await db.get(
    'SELECT * FROM verification_tokens WHERE token = ? AND used = 0', [token]
  );

  if (!record) return res.status(400).json({ error: 'Invalid or already used verification link' });
  if (new Date(record.expires_at) < new Date())
    return res.status(400).json({ error: 'Verification link has expired. Please request a new one.' });

  await db.run('UPDATE users SET email_verified = 1 WHERE id = ?', [record.user_id]);
  await db.run('UPDATE verification_tokens SET used = 1 WHERE id = ?', [record.id]);

  const user = await db.get('SELECT * FROM users WHERE id = ?', [record.user_id]);
  const jwt_token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });

  res.json({ message: 'Email verified successfully!', token: jwt_token, user: safeUser(user) });
});

// ── Resend verification ───────────────────────────────────────────────────────
router.post('/resend-verification', authMiddleware, async (req, res) => {
  const user = await db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
  if (user.email_verified) return res.status(400).json({ error: 'Email is already verified' });

  // Rate-limit: check if a token was issued in the last 2 minutes
  const recent = await db.get(
    "SELECT id FROM verification_tokens WHERE user_id = ? AND used = 0 AND created_at > NOW() - INTERVAL '2 minutes'",
    [user.id]
  );
  if (recent) return res.status(429).json({ error: 'Please wait a moment before requesting another email' });

  try {
    await issueVerification(user);
    res.json({ message: 'Verification email sent! Check your inbox.' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to send verification email' });
  }
});

module.exports = router;
