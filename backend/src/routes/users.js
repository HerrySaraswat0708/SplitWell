const router = require('express').Router();
const db = require('../database');
const auth = require('../middleware/auth');
const { getUserNetBalance } = require('../utils/balances');

router.get('/search', auth, (req, res) => {
  const { q } = req.query;
  if (!q) return res.json([]);
  const users = db.prepare(`
    SELECT id, name, email, avatar_color FROM users
    WHERE (name LIKE ? OR email LIKE ?) AND id != ?
    LIMIT 10
  `).all(`%${q}%`, `%${q}%`, req.user.id);
  res.json(users);
});

router.get('/dashboard', auth, (req, res) => {
  const balance = getUserNetBalance(req.user.id);
  res.json(balance);
});

module.exports = router;
