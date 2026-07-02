const router = require('express').Router();
const db = require('../database');
const auth = require('../middleware/auth');
const { calculateGroupBalances } = require('../utils/balances');

const getMembers = (groupId) => db.prepare(`
  SELECT u.id, u.name, u.email, u.avatar_color, gm.role
  FROM users u JOIN group_members gm ON u.id = gm.user_id
  WHERE gm.group_id = ?
`).all(groupId);

// ── List user's groups ────────────────────────────────────────────────────────
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

// ── Get single group ──────────────────────────────────────────────────────────
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

// ── Create group ──────────────────────────────────────────────────────────────
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

// ── Delete group (creator only) ───────────────────────────────────────────────
router.delete('/:id', auth, (req, res) => {
  const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found' });
  if (group.created_by !== req.user.id)
    return res.status(403).json({ error: 'Only the group creator can delete the group' });

  db.prepare('DELETE FROM groups WHERE id = ?').run(req.params.id);
  res.json({ message: 'Group deleted' });
});

// ── Add member by email ───────────────────────────────────────────────────────
router.post('/:id/members', auth, (req, res) => {
  const { email } = req.body;
  const groupId = req.params.id;
  if (!db.prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?').get(groupId, req.user.id))
    return res.status(403).json({ error: 'Not a member' });

  const user = db.prepare('SELECT id, name, email, avatar_color FROM users WHERE email = ?').get(email?.toLowerCase());
  if (!user) return res.status(404).json({ error: 'No account found with that email' });
  if (db.prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?').get(groupId, user.id))
    return res.status(409).json({ error: `${user.name} is already in this group` });

  db.prepare('INSERT INTO group_members (group_id, user_id) VALUES (?, ?)').run(groupId, user.id);
  res.json({ message: 'Member added', user });
});

// ── Admin removes a specific member ──────────────────────────────────────────
router.delete('/:id/members/:userId', auth, (req, res) => {
  const groupId = req.params.id;
  const targetId = parseInt(req.params.userId);

  const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(groupId);
  if (!group) return res.status(404).json({ error: 'Group not found' });

  const myRole = db.prepare('SELECT role FROM group_members WHERE group_id = ? AND user_id = ?').get(groupId, req.user.id);
  if (!myRole) return res.status(403).json({ error: 'You are not a member of this group' });
  if (myRole.role !== 'admin') return res.status(403).json({ error: 'Only admins can remove members' });

  if (targetId === group.created_by)
    return res.status(400).json({ error: 'The group creator cannot be removed' });
  if (targetId === req.user.id)
    return res.status(400).json({ error: 'Use "Leave group" to remove yourself' });

  const targetMember = db.prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?').get(groupId, targetId);
  if (!targetMember) return res.status(404).json({ error: 'That user is not in this group' });

  db.prepare('DELETE FROM group_members WHERE group_id = ? AND user_id = ?').run(groupId, targetId);
  res.json({ message: 'Member removed' });
});

// ── Member leaves the group ───────────────────────────────────────────────────
router.delete('/:id/leave', auth, (req, res) => {
  const groupId = req.params.id;

  const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(groupId);
  if (!group) return res.status(404).json({ error: 'Group not found' });

  if (!db.prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?').get(groupId, req.user.id))
    return res.status(403).json({ error: 'You are not a member of this group' });

  if (group.created_by === req.user.id)
    return res.status(400).json({ error: 'You created this group — delete it instead of leaving' });

  db.prepare('DELETE FROM group_members WHERE group_id = ? AND user_id = ?').run(groupId, req.user.id);
  res.json({ message: 'You have left the group' });
});

// ── Group balances ────────────────────────────────────────────────────────────
router.get('/:id/balances', auth, (req, res) => {
  if (!db.prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?').get(req.params.id, req.user.id))
    return res.status(403).json({ error: 'Not a member' });
  res.json(calculateGroupBalances(req.params.id));
});

module.exports = router;
