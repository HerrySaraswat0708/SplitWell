const db = require('../database');

async function calculateGroupBalances(groupId) {
  const members = await db.all(`
    SELECT u.id, u.name, u.email, u.avatar_color
    FROM users u JOIN group_members gm ON u.id = gm.user_id
    WHERE gm.group_id = ?
  `, [groupId]);

  const memberMap = {};
  const net = {};
  for (const m of members) {
    memberMap[m.id] = m;
    net[m.id] = 0;
  }

  const splits = await db.all(`
    SELECT es.user_id, es.amount as share, e.paid_by
    FROM expense_splits es JOIN expenses e ON es.expense_id = e.id
    WHERE e.group_id = ?
  `, [groupId]);

  for (const s of splits) {
    net[s.user_id] = (net[s.user_id] || 0) - s.share;
    net[s.paid_by] = (net[s.paid_by] || 0) + s.share;
  }

  const settlements = await db.all(
    'SELECT paid_by, paid_to, amount FROM settlements WHERE group_id = ?', [groupId]
  );

  for (const s of settlements) {
    net[s.paid_by] = (net[s.paid_by] || 0) + s.amount;
    net[s.paid_to] = (net[s.paid_to] || 0) - s.amount;
  }

  const netBalances = Object.entries(net).map(([userId, balance]) => ({
    user: memberMap[userId],
    balance: Math.round(balance * 100) / 100
  }));

  const transactions = simplifyDebts(net, memberMap);
  return { netBalances, transactions };
}

function simplifyDebts(net, memberMap) {
  const creditors = [];
  const debtors = [];

  for (const [uid, bal] of Object.entries(net)) {
    if (bal > 0.01) creditors.push({ userId: parseInt(uid), amount: bal });
    else if (bal < -0.01) debtors.push({ userId: parseInt(uid), amount: -bal });
  }

  const txns = [];
  let i = 0, j = 0;
  while (i < creditors.length && j < debtors.length) {
    const amt = Math.min(creditors[i].amount, debtors[j].amount);
    txns.push({
      from: memberMap[debtors[j].userId],
      to: memberMap[creditors[i].userId],
      amount: Math.round(amt * 100) / 100
    });
    creditors[i].amount -= amt;
    debtors[j].amount -= amt;
    if (creditors[i].amount < 0.01) i++;
    if (debtors[j].amount < 0.01) j++;
  }
  return txns;
}

async function getUserNetBalance(userId) {
  const groups = await db.all(`
    SELECT group_id FROM group_members WHERE user_id = ?
  `, [userId]);

  let totalOwed = 0;
  let totalOwing = 0;

  for (const { group_id } of groups) {
    const { netBalances } = await calculateGroupBalances(group_id);
    const myBalance = netBalances.find(b => b.user.id === userId);
    if (myBalance) {
      if (myBalance.balance > 0) totalOwed += myBalance.balance;
      else totalOwing += Math.abs(myBalance.balance);
    }
  }

  return {
    owed: Math.round(totalOwed * 100) / 100,
    owing: Math.round(totalOwing * 100) / 100,
    net: Math.round((totalOwed - totalOwing) * 100) / 100
  };
}

module.exports = { calculateGroupBalances, getUserNetBalance };
