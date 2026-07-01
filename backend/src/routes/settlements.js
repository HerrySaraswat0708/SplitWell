const router = require('express').Router();
const db = require('../database');
const auth = require('../middleware/auth');

router.get('/group/:groupId', auth, (req, res) => {
  if (!db.prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?').get(req.params.groupId, req.user.id))
    return res.status(403).json({ error: 'Not a member' });

  const settlements = db.prepare(`
    SELECT s.*,
      p.name as paid_by_name, p.avatar_color as paid_by_color,
      t.name as paid_to_name, t.avatar_color as paid_to_color
    FROM settlements s
    JOIN users p ON s.paid_by = p.id
    JOIN users t ON s.paid_to = t.id
    WHERE s.group_id = ? ORDER BY s.date DESC, s.created_at DESC
  `).all(req.params.groupId);

  res.json(settlements);
});

router.post('/', auth, (req, res) => {
  const { group_id, paid_to, amount, date, note } = req.body;

  if (!paid_to || !amount || !date)
    return res.status(400).json({ error: 'paid_to, amount and date are required' });

  if (group_id && !db.prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?').get(group_id, req.user.id))
    return res.status(403).json({ error: 'Not a member' });

  const { lastInsertRowid: id } = db.prepare(
    'INSERT INTO settlements (group_id, paid_by, paid_to, amount, date, note) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(group_id || null, req.user.id, parseInt(paid_to), parseFloat(amount), date, note || '');

  const settlement = db.prepare(`
    SELECT s.*,
      p.name as paid_by_name, p.avatar_color as paid_by_color,
      t.name as paid_to_name, t.avatar_color as paid_to_color
    FROM settlements s
    JOIN users p ON s.paid_by = p.id
    JOIN users t ON s.paid_to = t.id
    WHERE s.id = ?
  `).get(id);

  res.status(201).json(settlement);
});

router.delete('/:id', auth, (req, res) => {
  const s = db.prepare('SELECT * FROM settlements WHERE id = ?').get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Not found' });
  if (s.paid_by !== req.user.id) return res.status(403).json({ error: 'Not authorized' });
  db.prepare('DELETE FROM settlements WHERE id = ?').run(req.params.id);
  res.json({ message: 'Settlement deleted' });
});

module.exports = router;
