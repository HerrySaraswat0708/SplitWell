const router = require('express').Router();
const db = require('../database');
const auth = require('../middleware/auth');

// Monthly spending for current user across all groups (last 6 months)
router.get('/monthly', auth, async (req, res) => {
  const rows = await db.all(`
    SELECT LEFT(e.date, 7) as month, SUM(es.amount) as amount
    FROM expense_splits es
    JOIN expenses e ON es.expense_id = e.id
    JOIN group_members gm ON e.group_id = gm.group_id AND gm.user_id = ?
    WHERE es.user_id = ? AND e.date >= to_char(CURRENT_DATE - INTERVAL '6 months', 'YYYY-MM-DD')
    GROUP BY month ORDER BY month ASC
  `, [req.user.id, req.user.id]);

  // Fill in missing months
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const found = rows.find(r => r.month === key);
    months.push({
      month: key,
      label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      amount: found ? Math.round(found.amount * 100) / 100 : 0
    });
  }

  res.json(months);
});

// Category breakdown for current user
router.get('/categories', auth, async (req, res) => {
  const rows = await db.all(`
    SELECT e.category, SUM(es.amount) as amount
    FROM expense_splits es
    JOIN expenses e ON es.expense_id = e.id
    JOIN group_members gm ON e.group_id = gm.group_id AND gm.user_id = ?
    WHERE es.user_id = ?
    GROUP BY e.category ORDER BY amount DESC
  `, [req.user.id, req.user.id]);

  const COLORS = {
    food: '#f97316', transport: '#06b6d4', entertainment: '#8b5cf6',
    utilities: '#6366f1', shopping: '#ec4899', health: '#10b981',
    travel: '#f59e0b', other: '#94a3b8'
  };

  res.json(rows.map(r => ({
    category: r.category,
    label: r.category.charAt(0).toUpperCase() + r.category.slice(1),
    amount: Math.round(r.amount * 100) / 100,
    color: COLORS[r.category] || '#94a3b8'
  })));
});

// Group-specific monthly spending
router.get('/group/:groupId/monthly', auth, async (req, res) => {
  if (!await db.get('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?', [req.params.groupId, req.user.id]))
    return res.status(403).json({ error: 'Not a member' });

  const rows = await db.all(`
    SELECT LEFT(date, 7) as month, SUM(amount) as amount
    FROM expenses WHERE group_id = ? AND date >= to_char(CURRENT_DATE - INTERVAL '6 months', 'YYYY-MM-DD')
    GROUP BY month ORDER BY month ASC
  `, [req.params.groupId]);

  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const found = rows.find(r => r.month === key);
    months.push({
      month: key,
      label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      amount: found ? Math.round(found.amount * 100) / 100 : 0
    });
  }
  res.json(months);
});

// Member contributions in a group
router.get('/group/:groupId/members', auth, async (req, res) => {
  if (!await db.get('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?', [req.params.groupId, req.user.id]))
    return res.status(403).json({ error: 'Not a member' });

  const rows = await db.all(`
    SELECT u.id, u.name, u.avatar_color, COALESCE(SUM(e.amount), 0) as paid
    FROM users u
    JOIN group_members gm ON u.id = gm.user_id
    LEFT JOIN expenses e ON u.id = e.paid_by AND e.group_id = ?
    WHERE gm.group_id = ?
    GROUP BY u.id
  `, [req.params.groupId, req.params.groupId]);

  res.json(rows);
});

// Recent activity for dashboard
router.get('/recent', auth, async (req, res) => {
  const expenses = await db.all(`
    SELECT e.id, e.description, e.amount, e.category, e.date, e.group_id,
      g.name as group_name, u.name as paid_by_name, u.avatar_color as paid_by_color,
      'expense' as type
    FROM expenses e
    JOIN groups g ON e.group_id = g.id
    JOIN users u ON e.paid_by = u.id
    JOIN group_members gm ON e.group_id = gm.group_id AND gm.user_id = ?
    ORDER BY e.created_at DESC LIMIT 15
  `, [req.user.id]);

  const settlements = await db.all(`
    SELECT s.id, s.amount, s.date, s.group_id,
      g.name as group_name,
      p.name as paid_by_name, p.avatar_color as paid_by_color,
      t.name as paid_to_name,
      'settlement' as type
    FROM settlements s
    LEFT JOIN groups g ON s.group_id = g.id
    JOIN users p ON s.paid_by = p.id
    JOIN users t ON s.paid_to = t.id
    WHERE s.paid_by = ? OR s.paid_to = ?
    ORDER BY s.created_at DESC LIMIT 10
  `, [req.user.id, req.user.id]);

  const combined = [...expenses, ...settlements]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 20);

  res.json(combined);
});

module.exports = router;
