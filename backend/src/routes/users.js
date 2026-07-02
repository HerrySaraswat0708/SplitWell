const router = require('express').Router();
const db = require('../database');
const auth = require('../middleware/auth');
const { getUserNetBalance } = require('../utils/balances');

router.get('/search', auth, async (req, res) => {
  const { q } = req.query;
  if (!q) return res.json([]);
  const users = await db.all(`
    SELECT id, name, email, avatar_color FROM users
    WHERE (name ILIKE ? OR email ILIKE ?) AND id != ?
    LIMIT 10
  `, [`%${q}%`, `%${q}%`, req.user.id]);
  res.json(users);
});

router.get('/dashboard', auth, async (req, res) => {
  const balance = await getUserNetBalance(req.user.id);
  res.json(balance);
});

module.exports = router;
