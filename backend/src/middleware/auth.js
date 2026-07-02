const jwt = require('jsonwebtoken');
const db = require('../database');

const JWT_SECRET = process.env.JWT_SECRET || 'splitwise-secret-key';

module.exports = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    const { userId } = jwt.verify(header.split(' ')[1], JWT_SECRET);
    const row = await db.get(
      'SELECT id, name, email, avatar_color, email_verified, created_at FROM users WHERE id = ?', [userId]
    );
    if (!row) return res.status(401).json({ error: 'User not found' });
    req.user = { ...row, email_verified: !!row.email_verified };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};
