const router = require('express').Router();
const db = require('../database');
const auth = require('../middleware/auth');
const { calculateGroupBalances } = require('../utils/balances');

const getMembers = (groupId) => db.all(`
  SELECT u.id, u.name, u.email, u.avatar_color, gm.role
  FROM users u JOIN group_members gm ON u.id = gm.user_id
  WHERE gm.group_id = ?
`, [groupId]);

// ── List user's groups ────────────────────────────────────────────────────────
router.get('/', auth, async (req, res) => {
  const groups = await db.all(`
    SELECT g.*, u.name as created_by_name,
      (SELECT COUNT(*)::int FROM group_members WHERE group_id = g.id) as member_count,
      (SELECT COALESCE(SUM(amount),0) FROM expenses WHERE group_id = g.id) as total_spent
    FROM groups g
    JOIN group_members gm ON g.id = gm.group_id
    JOIN users u ON g.created_by = u.id
    WHERE gm.user_id = ? ORDER BY g.created_at DESC
  `, [req.user.id]);

  res.json(await Promise.all(groups.map(async g => ({ ...g, members: await getMembers(g.id) }))));
});

// ── Get single group ──────────────────────────────────────────────────────────
router.get('/:id', auth, async (req, res) => {
  const group = await db.get(`
    SELECT g.*, u.name as created_by_name,
      (SELECT COALESCE(SUM(amount),0) FROM expenses WHERE group_id = g.id) as total_spent
    FROM groups g JOIN users u ON g.created_by = u.id WHERE g.id = ?
  `, [req.params.id]);

  if (!group) return res.status(404).json({ error: 'Group not found' });
  if (!await db.get('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?', [group.id, req.user.id]))
    return res.status(403).json({ error: 'Not a member' });

  res.json({ ...group, members: await getMembers(group.id) });
});

// ── Create group ──────────────────────────────────────────────────────────────
router.post('/', auth, async (req, res) => {
  const { name, description, category, cover_color, member_emails } = req.body;
  if (!name) return res.status(400).json({ error: 'Group name is required' });

  const { id: gid } = await db.get(
    'INSERT INTO groups (name, description, category, cover_color, created_by) VALUES (?, ?, ?, ?, ?) RETURNING id',
    [name, description || '', category || 'other', cover_color || '#6366f1', req.user.id]
  );

  await db.run('INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)', [gid, req.user.id, 'admin']);

  if (Array.isArray(member_emails)) {
    for (const email of member_emails) {
      const u = await db.get('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
      if (u && u.id !== req.user.id) {
        await db.run('INSERT INTO group_members (group_id, user_id) VALUES (?, ?) ON CONFLICT (group_id, user_id) DO NOTHING', [gid, u.id]);
      }
    }
  }

  const group = await db.get('SELECT * FROM groups WHERE id = ?', [gid]);
  res.status(201).json({ ...group, members: await getMembers(gid) });
});

// ── Delete group (creator only) ───────────────────────────────────────────────
router.delete('/:id', auth, async (req, res) => {
  const group = await db.get('SELECT * FROM groups WHERE id = ?', [req.params.id]);
  if (!group) return res.status(404).json({ error: 'Group not found' });
  if (group.created_by !== req.user.id)
    return res.status(403).json({ error: 'Only the group creator can delete the group' });

  await db.run('DELETE FROM groups WHERE id = ?', [req.params.id]);
  res.json({ message: 'Group deleted' });
});

// ── Add member by email ───────────────────────────────────────────────────────
router.post('/:id/members', auth, async (req, res) => {
  const { email } = req.body;
  const groupId = req.params.id;
  if (!await db.get('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, req.user.id]))
    return res.status(403).json({ error: 'Not a member' });

  const user = await db.get('SELECT id, name, email, avatar_color FROM users WHERE email = ?', [email?.toLowerCase()]);
  if (!user) return res.status(404).json({ error: 'No account found with that email' });
  if (await db.get('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, user.id]))
    return res.status(409).json({ error: `${user.name} is already in this group` });

  await db.run('INSERT INTO group_members (group_id, user_id) VALUES (?, ?)', [groupId, user.id]);
  res.json({ message: 'Member added', user });
});

// ── Admin removes a specific member ──────────────────────────────────────────
router.delete('/:id/members/:userId', auth, async (req, res) => {
  const groupId = req.params.id;
  const targetId = parseInt(req.params.userId);

  const group = await db.get('SELECT * FROM groups WHERE id = ?', [groupId]);
  if (!group) return res.status(404).json({ error: 'Group not found' });

  const myRole = await db.get('SELECT role FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, req.user.id]);
  if (!myRole) return res.status(403).json({ error: 'You are not a member of this group' });
  if (myRole.role !== 'admin') return res.status(403).json({ error: 'Only admins can remove members' });

  if (targetId === group.created_by)
    return res.status(400).json({ error: 'The group creator cannot be removed' });
  if (targetId === req.user.id)
    return res.status(400).json({ error: 'Use "Leave group" to remove yourself' });

  const targetMember = await db.get('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, targetId]);
  if (!targetMember) return res.status(404).json({ error: 'That user is not in this group' });

  await db.run('DELETE FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, targetId]);
  res.json({ message: 'Member removed' });
});

// ── Member leaves the group ───────────────────────────────────────────────────
router.delete('/:id/leave', auth, async (req, res) => {
  const groupId = req.params.id;

  const group = await db.get('SELECT * FROM groups WHERE id = ?', [groupId]);
  if (!group) return res.status(404).json({ error: 'Group not found' });

  if (!await db.get('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, req.user.id]))
    return res.status(403).json({ error: 'You are not a member of this group' });

  if (group.created_by === req.user.id)
    return res.status(400).json({ error: 'You created this group — delete it instead of leaving' });

  await db.run('DELETE FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, req.user.id]);
  res.json({ message: 'You have left the group' });
});

// ── Group balances ────────────────────────────────────────────────────────────
router.get('/:id/balances', auth, async (req, res) => {
  if (!await db.get('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?', [req.params.id, req.user.id]))
    return res.status(403).json({ error: 'Not a member' });
  res.json(await calculateGroupBalances(req.params.id));
});

module.exports = router;
