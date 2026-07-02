const router = require('express').Router();
const db = require('../database');
const auth = require('../middleware/auth');

router.get('/group/:groupId', auth, async (req, res) => {
  if (!await db.get('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?', [req.params.groupId, req.user.id]))
    return res.status(403).json({ error: 'Not a member' });

  const settlements = await db.all(`
    SELECT s.*,
      p.name as paid_by_name, p.avatar_color as paid_by_color,
      t.name as paid_to_name, t.avatar_color as paid_to_color
    FROM settlements s
    JOIN users p ON s.paid_by = p.id
    JOIN users t ON s.paid_to = t.id
    WHERE s.group_id = ? ORDER BY s.date DESC, s.created_at DESC
  `, [req.params.groupId]);

  res.json(settlements);
});

router.post('/', auth, async (req, res) => {
  const { group_id, paid_to, amount, date, note } = req.body;

  if (!paid_to || !amount || !date)
    return res.status(400).json({ error: 'paid_to, amount and date are required' });

  if (group_id && !await db.get('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?', [group_id, req.user.id]))
    return res.status(403).json({ error: 'Not a member' });

  const { id } = await db.get(
    'INSERT INTO settlements (group_id, paid_by, paid_to, amount, date, note) VALUES (?, ?, ?, ?, ?, ?) RETURNING id',
    [group_id || null, req.user.id, parseInt(paid_to), parseFloat(amount), date, note || '']
  );

  const settlement = await db.get(`
    SELECT s.*,
      p.name as paid_by_name, p.avatar_color as paid_by_color,
      t.name as paid_to_name, t.avatar_color as paid_to_color
    FROM settlements s
    JOIN users p ON s.paid_by = p.id
    JOIN users t ON s.paid_to = t.id
    WHERE s.id = ?
  `, [id]);

  res.status(201).json(settlement);
});

router.delete('/:id', auth, async (req, res) => {
  const s = await db.get('SELECT * FROM settlements WHERE id = ?', [req.params.id]);
  if (!s) return res.status(404).json({ error: 'Not found' });
  if (s.paid_by !== req.user.id) return res.status(403).json({ error: 'Not authorized' });
  await db.run('DELETE FROM settlements WHERE id = ?', [req.params.id]);
  res.json({ message: 'Settlement deleted' });
});

module.exports = router;
