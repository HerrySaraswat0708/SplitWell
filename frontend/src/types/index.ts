export interface User {
  id: number;
  name: string;
  email: string;
  avatar_color: string;
  email_verified: boolean;
  created_at: string;
}

export interface GroupMember extends User {
  role: 'admin' | 'member';
}

export interface Group {
  id: number;
  name: string;
  description: string;
  category: string;
  cover_color: string;
  created_by: number;
  created_by_name: string;
  member_count: number;
  total_spent: number;
  members: GroupMember[];
  created_at: string;
}

export interface ExpenseSplit {
  user_id: number;
  user_name: string;
  avatar_color: string;
  amount: number;
}

export interface Expense {
  id: number;
  group_id: number;
  description: string;
  amount: number;
  currency: string;
  paid_by: number;
  paid_by_name: string;
  paid_by_color: string;
  category: string;
  split_type: 'equal' | 'percentage' | 'exact';
  date: string;
  notes: string;
  created_by: number;
  created_at: string;
  splits: ExpenseSplit[];
}

export interface Settlement {
  id: number;
  group_id: number;
  paid_by: number;
  paid_by_name: string;
  paid_by_color: string;
  paid_to: number;
  paid_to_name: string;
  paid_to_color: string;
  amount: number;
  date: string;
  note: string;
  created_at: string;
}

export interface Balance {
  user: User;
  balance: number;
}

export interface DebtTransaction {
  from: User;
  to: User;
  amount: number;
}

export interface GroupBalances {
  netBalances: Balance[];
  transactions: DebtTransaction[];
}

export interface MonthlyData {
  month: string;
  label: string;
  amount: number;
}

export interface CategoryData {
  category: string;
  label: string;
  amount: number;
  color: string;
}

export interface DashboardBalance {
  owed: number;
  owing: number;
  net: number;
}

export interface ActivityItem {
  id: number;
  type: 'expense' | 'settlement';
  description?: string;
  amount: number;
  category?: string;
  date: string;
  group_id: number;
  group_name: string;
  paid_by_name: string;
  paid_by_color: string;
  paid_to_name?: string;
}
