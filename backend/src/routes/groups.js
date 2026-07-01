const router = require('express').Router();
const db = require('../database');
const auth = require('../middleware/auth');
const { calculateGroupBalances } = require('../utils/balances');

const getMembers = (groupId) => db.prepare(`
  SELECT u.id, u.name, u.email, u.avatar_color, gm.role
  FROM users u JOIN group_members gm ON u.id = gm.user_id
  WHERE gm.group_id = ?
`).all(groupId);

router.get('/', auth, (req, res) => {
  const groups = db.prepare(`
    SELECT g.*, u.name as created_by_name,
      (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count,
      (SELECT COALESCE(SUM(amount),0) FROM expenses WHERE group_id = g.id) as total_spent
    FROM groups g
    JOIN group_members gm ON g.id = gm.group_id
    JOIN users u ON g.created_by = u.id
    WHERE gm.user_id = ? ORDER BY g.created_at DESC
  `).all(req.user.id);

  res.json(groups.map(g => ({ ...g, members: getMembers(g.id) })));
});

router.get('/:id', auth, (req, res) => {
  const group = db.prepare(`
    SELECT g.*, u.name as created_by_name,
      (SELECT COALESCE(SUM(amount),0) FROM expenses WHERE group_id = g.id) as total_spent
    FROM groups g JOIN users u ON g.created_by = u.id WHERE g.id = ?
  `).get(req.params.id);

  if (!group) return res.status(404).json({ error: 'Group not found' });
  if (!db.prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?').get(group.id, req.user.id))
    return res.status(403).json({ error: 'Not a member' });

  res.json({ ...group, members: getMembers(group.id) });
});

router.post('/', auth, (req, res) => {
  const { name, description, category, cover_color, member_emails } = req.body;
  if (!name) return res.status(400).json({ error: 'Group name is required' });

  const { lastInsertRowid: gid } = db.prepare(
    'INSERT INTO groups (name, description, category, cover_color, created_by) VALUES (?, ?, ?, ?, ?)'
  ).run(name, description || '', category || 'other', cover_color || '#6366f1', req.user.id);

  db.prepare('INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)').run(gid, req.user.id, 'admin');

  if (Array.isArray(member_emails)) {
    for (const email of member_emails) {
      const u = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
      if (u && u.id !== req.user.id) {
        db.prepare('INSERT OR IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)').run(gid, u.id);
      }
    }
  }

  const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(gid);
  res.status(201).json({ ...group, members: getMembers(gid) });
});

router.post('/:id/members', auth, (req, res) => {
  const { email } = req.body;
  const groupId = req.params.id;
  if (!db.prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?').get(groupId, req.user.id))
    return res.status(403).json({ error: 'Not a member' });

  const user = db.prepare('SELECT id, name, email, avatar_color FROM users WHERE email = ?').get(email?.toLowerCase());
  if (!user) return res.status(404).json({ error: 'User not found with that email' });

  db.prepare('INSERT OR IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)').run(groupId, user.id);
  res.json({ message: 'Member added', user });
});

router.get('/:id/balances', auth, (req, res) => {
  if (!db.prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?').get(req.params.id, req.user.id))
    return res.status(403).json({ error: 'Not a member' });
  res.json(calculateGroupBalances(req.params.id));
});

router.delete('/:id', auth, (req, res) => {
  const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found' });
  if (group.created_by !== req.user.id) return res.status(403).json({ error: 'Only group creator can delete' });
  db.prepare('DELETE FROM groups WHERE id = ?').run(req.params.id);
  res.json({ message: 'Group deleted' });
});

module.exports = router;
