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

function getExpenseWithSplits(expenseId) {
  const expense = db.prepare(`
    SELECT e.*, u.name as paid_by_name, u.avatar_color as paid_by_color
    FROM expenses e JOIN users u ON e.paid_by = u.id WHERE e.id = ?
  `).get(expenseId);
  if (!expense) return null;
  expense.splits = db.prepare(`
    SELECT es.user_id, es.amount, u.name as user_name, u.avatar_color
    FROM expense_splits es JOIN users u ON es.user_id = u.id WHERE es.expense_id = ?
  `).all(expenseId);
  return expense;
}

// Get expenses for a group
router.get('/group/:groupId', auth, (req, res) => {
  if (!db.prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?').get(req.params.groupId, req.user.id))
    return res.status(403).json({ error: 'Not a member' });

  const expenses = db.prepare(`
    SELECT e.*, u.name as paid_by_name, u.avatar_color as paid_by_color
    FROM expenses e JOIN users u ON e.paid_by = u.id
    WHERE e.group_id = ? ORDER BY e.date DESC, e.created_at DESC
  `).all(req.params.groupId);

  const result = expenses.map(e => {
    e.splits = db.prepare(`
      SELECT es.user_id, es.amount, u.name as user_name, u.avatar_color
      FROM expense_splits es JOIN users u ON es.user_id = u.id WHERE es.expense_id = ?
    `).all(e.id);
    return e;
  });

  res.json(result);
});

// Get single expense
router.get('/:id', auth, (req, res) => {
  const expense = getExpenseWithSplits(req.params.id);
  if (!expense) return res.status(404).json({ error: 'Not found' });
  if (!db.prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?').get(expense.group_id, req.user.id))
    return res.status(403).json({ error: 'Not a member' });
  res.json(expense);
});

// Create expense
router.post('/', auth, (req, res) => {
  const { group_id, description, amount, paid_by, category, split_type, date, notes, splits } = req.body;

  if (!group_id || !description || !amount || !paid_by || !date)
    return res.status(400).json({ error: 'group_id, description, amount, paid_by and date are required' });

  if (!db.prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?').get(group_id, req.user.id))
    return res.status(403).json({ error: 'Not a member of this group' });

  const detectedCategory = category || detectCategory(description);

  const { lastInsertRowid: expenseId } = db.prepare(
    'INSERT INTO expenses (group_id, description, amount, paid_by, category, split_type, date, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(group_id, description, parseFloat(amount), parseInt(paid_by), detectedCategory, split_type || 'equal', date, notes || '', req.user.id);

  // Process splits
  if (splits && Array.isArray(splits)) {
    for (const s of splits) {
      db.prepare('INSERT INTO expense_splits (expense_id, user_id, amount) VALUES (?, ?, ?)')
        .run(expenseId, s.user_id, parseFloat(s.amount));
    }
  } else {
    // Equal split among all group members
    const members = db.prepare('SELECT user_id FROM group_members WHERE group_id = ?').all(group_id);
    const share = parseFloat((amount / members.length).toFixed(2));
    for (const m of members) {
      db.prepare('INSERT INTO expense_splits (expense_id, user_id, amount) VALUES (?, ?, ?)')
        .run(expenseId, m.user_id, share);
    }
  }

  res.status(201).json(getExpenseWithSplits(expenseId));
});

// Delete expense
router.delete('/:id', auth, (req, res) => {
  const expense = db.prepare('SELECT * FROM expenses WHERE id = ?').get(req.params.id);
  if (!expense) return res.status(404).json({ error: 'Not found' });
  if (expense.created_by !== req.user.id && expense.paid_by !== req.user.id)
    return res.status(403).json({ error: 'Not authorized' });
  db.prepare('DELETE FROM expenses WHERE id = ?').run(req.params.id);
  res.json({ message: 'Expense deleted' });
});

// Suggest category for a description
router.get('/suggest/category', auth, (req, res) => {
  res.json({ category: detectCategory(req.query.description || '') });
});

module.exports = router;
