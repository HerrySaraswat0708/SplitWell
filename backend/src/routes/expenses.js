const router = require('express').Router();
const db = require('../database');
const auth = require('../middleware/auth');

const CATEGORY_KEYWORDS = {
  food: ['food','restaurant','pizza','burger','coffee','lunch','dinner','breakfast','grocery','groceries','cafe','eat','meal','sushi','chicken','mcdonalds','doordash','ubereats','snack','drink','drinks'],
  transport: ['uber','lyft','taxi','bus','train','metro','gas','petrol','fuel','parking','flight','airline','travel','transit','fare','ride','car'],
  entertainment: ['movie','cinema','theater','concert','netflix','spotify','game','bowling','bar','club','party','event','ticket','streaming','show'],
  utilities: ['electric','electricity','water','internet','wifi','phone','bill','utility','rent','utilities','cable','insurance'],
  shopping: ['amazon','walmart','target','shop','store','clothes','clothing','shoes','mall','purchase'],
  health: ['doctor','hospital','pharmacy','medicine','gym','fitness','health','dental','medical','yoga'],
  travel: ['hotel','airbnb','vacation','trip','holiday','resort','booking'],
};

function detectCategory(desc) {
  const d = desc.toLowerCase();
  for (const [cat, kws] of Object.entries(CATEGORY_KEYWORDS)) {
    if (kws.some(k => d.includes(k))) return cat;
  }
  return 'other';
}

async function getExpenseWithSplits(expenseId) {
  const expense = await db.get(`
    SELECT e.*, u.name as paid_by_name, u.avatar_color as paid_by_color
    FROM expenses e JOIN users u ON e.paid_by = u.id WHERE e.id = ?
  `, [expenseId]);
  if (!expense) return null;
  expense.splits = await db.all(`
    SELECT es.user_id, es.amount, u.name as user_name, u.avatar_color
    FROM expense_splits es JOIN users u ON es.user_id = u.id WHERE es.expense_id = ?
  `, [expenseId]);
  return expense;
}

// Get expenses for a group
router.get('/group/:groupId', auth, async (req, res) => {
  if (!await db.get('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?', [req.params.groupId, req.user.id]))
    return res.status(403).json({ error: 'Not a member' });

  const expenses = await db.all(`
    SELECT e.*, u.name as paid_by_name, u.avatar_color as paid_by_color
    FROM expenses e JOIN users u ON e.paid_by = u.id
    WHERE e.group_id = ? ORDER BY e.date DESC, e.created_at DESC
  `, [req.params.groupId]);

  const result = await Promise.all(expenses.map(async e => {
    e.splits = await db.all(`
      SELECT es.user_id, es.amount, u.name as user_name, u.avatar_color
      FROM expense_splits es JOIN users u ON es.user_id = u.id WHERE es.expense_id = ?
    `, [e.id]);
    return e;
  }));

  res.json(result);
});

// Get single expense
router.get('/:id', auth, async (req, res) => {
  const expense = await getExpenseWithSplits(req.params.id);
  if (!expense) return res.status(404).json({ error: 'Not found' });
  if (!await db.get('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?', [expense.group_id, req.user.id]))
    return res.status(403).json({ error: 'Not a member' });
  res.json(expense);
});

// Create expense
router.post('/', auth, async (req, res) => {
  const { group_id, description, amount, currency, paid_by, category, split_type, date, notes, splits } = req.body;

  if (!group_id || !description || !amount || !paid_by || !date)
    return res.status(400).json({ error: 'group_id, description, amount, paid_by and date are required' });

  if (!await db.get('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?', [group_id, req.user.id]))
    return res.status(403).json({ error: 'Not a member of this group' });

  const detectedCategory = category || detectCategory(description);

  const { id: expenseId } = await db.get(
    'INSERT INTO expenses (group_id, description, amount, currency, paid_by, category, split_type, date, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id',
    [group_id, description, parseFloat(amount), currency || 'USD', parseInt(paid_by), detectedCategory, split_type || 'equal', date, notes || '', req.user.id]
  );

  // Process splits
  if (splits && Array.isArray(splits)) {
    for (const s of splits) {
      await db.run('INSERT INTO expense_splits (expense_id, user_id, amount) VALUES (?, ?, ?)',
        [expenseId, s.user_id, parseFloat(s.amount)]);
    }
  } else {
    // Equal split among all group members
    const members = await db.all('SELECT user_id FROM group_members WHERE group_id = ?', [group_id]);
    const share = parseFloat((amount / members.length).toFixed(2));
    for (const m of members) {
      await db.run('INSERT INTO expense_splits (expense_id, user_id, amount) VALUES (?, ?, ?)',
        [expenseId, m.user_id, share]);
    }
  }

  res.status(201).json(await getExpenseWithSplits(expenseId));
});

// Update expense
router.put('/:id', auth, async (req, res) => {
  const existing = await db.get('SELECT * FROM expenses WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  if (existing.created_by !== req.user.id && existing.paid_by !== req.user.id)
    return res.status(403).json({ error: 'Not authorized' });

  const { description, amount, currency, paid_by, category, split_type, date, notes, splits } = req.body;

  if (!description || !amount || !paid_by || !date)
    return res.status(400).json({ error: 'description, amount, paid_by and date are required' });

  const detectedCategory = category || detectCategory(description);

  await db.run(
    'UPDATE expenses SET description = ?, amount = ?, currency = ?, paid_by = ?, category = ?, split_type = ?, date = ?, notes = ? WHERE id = ?',
    [description, parseFloat(amount), currency || 'USD', parseInt(paid_by), detectedCategory, split_type || 'equal', date, notes || '', req.params.id]
  );

  // Re-process splits from scratch
  await db.run('DELETE FROM expense_splits WHERE expense_id = ?', [req.params.id]);

  if (splits && Array.isArray(splits)) {
    for (const s of splits) {
      await db.run('INSERT INTO expense_splits (expense_id, user_id, amount) VALUES (?, ?, ?)',
        [req.params.id, s.user_id, parseFloat(s.amount)]);
    }
  } else {
    const members = await db.all('SELECT user_id FROM group_members WHERE group_id = ?', [existing.group_id]);
    const share = parseFloat((amount / members.length).toFixed(2));
    for (const m of members) {
      await db.run('INSERT INTO expense_splits (expense_id, user_id, amount) VALUES (?, ?, ?)',
        [req.params.id, m.user_id, share]);
    }
  }

  res.json(await getExpenseWithSplits(req.params.id));
});

// Delete expense
router.delete('/:id', auth, async (req, res) => {
  const expense = await db.get('SELECT * FROM expenses WHERE id = ?', [req.params.id]);
  if (!expense) return res.status(404).json({ error: 'Not found' });
  if (expense.created_by !== req.user.id && expense.paid_by !== req.user.id)
    return res.status(403).json({ error: 'Not authorized' });
  await db.run('DELETE FROM expenses WHERE id = ?', [req.params.id]);
  res.json({ message: 'Expense deleted' });
});

// Suggest category for a description
router.get('/suggest/category', auth, (req, res) => {
  res.json({ category: detectCategory(req.query.description || '') });
});

module.exports = router;
