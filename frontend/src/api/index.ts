import client from './client';
import type { Group, Expense, Settlement, GroupBalances, MonthlyData, CategoryData, DashboardBalance, ActivityItem } from '../types';

// Auth
export const authApi = {
  register: (data: { name: string; email: string; password: string }) =>
    client.post('/auth/register', data).then(r => r.data),
  login: (data: { email: string; password: string }) =>
    client.post('/auth/login', data).then(r => r.data),
  me: () => client.get('/auth/me').then(r => r.data),
  verifyEmail: (token: string) =>
    client.get(`/auth/verify-email?token=${token}`).then(r => r.data),
  resendVerification: () =>
    client.post('/auth/resend-verification').then(r => r.data),
};

// Users
export const usersApi = {
  search: (q: string) => client.get(`/users/search?q=${q}`).then(r => r.data),
  dashboard: () => client.get<DashboardBalance>('/users/dashboard').then(r => r.data),
};

// Groups
export const groupsApi = {
  list: () => client.get<Group[]>('/groups').then(r => r.data),
  get: (id: number) => client.get<Group>(`/groups/${id}`).then(r => r.data),
  create: (data: Partial<Group> & { member_emails?: string[] }) =>
    client.post<Group>('/groups', data).then(r => r.data),
  addMember: (groupId: number, email: string) =>
    client.post(`/groups/${groupId}/members`, { email }).then(r => r.data),
  removeMember: (groupId: number, userId: number) =>
    client.delete(`/groups/${groupId}/members/${userId}`).then(r => r.data),
  leave: (groupId: number) =>
    client.delete(`/groups/${groupId}/leave`).then(r => r.data),
  balances: (id: number) => client.get<GroupBalances>(`/groups/${id}/balances`).then(r => r.data),
  delete: (id: number) => client.delete(`/groups/${id}`).then(r => r.data),
};

// Expenses
export const expensesApi = {
  byGroup: (groupId: number) =>
    client.get<Expense[]>(`/expenses/group/${groupId}`).then(r => r.data),
  create: (data: Omit<Partial<Expense>, 'splits'> & { splits?: { user_id: number; amount: number }[] }) =>
    client.post<Expense>('/expenses', data).then(r => r.data),
  update: (id: number, data: Omit<Partial<Expense>, 'splits'> & { splits?: { user_id: number; amount: number }[] }) =>
    client.put<Expense>(`/expenses/${id}`, data).then(r => r.data),
  delete: (id: number) => client.delete(`/expenses/${id}`).then(r => r.data),
  suggestCategory: (description: string) =>
    client.get<{ category: string }>(`/expenses/suggest/category?description=${encodeURIComponent(description)}`).then(r => r.data),
};

// Settlements
export const settlementsApi = {
  byGroup: (groupId: number) =>
    client.get<Settlement[]>(`/settlements/group/${groupId}`).then(r => r.data),
  create: (data: { group_id?: number; paid_to: number; amount: number; date: string; note?: string }) =>
    client.post<Settlement>('/settlements', data).then(r => r.data),
  delete: (id: number) => client.delete(`/settlements/${id}`).then(r => r.data),
};

// Analytics
export const analyticsApi = {
  monthly: () => client.get<MonthlyData[]>('/analytics/monthly').then(r => r.data),
  categories: () => client.get<CategoryData[]>('/analytics/categories').then(r => r.data),
  groupMonthly: (id: number) =>
    client.get<MonthlyData[]>(`/analytics/group/${id}/monthly`).then(r => r.data),
  groupMembers: (id: number) =>
    client.get(`/analytics/group/${id}/members`).then(r => r.data),
  recent: () => client.get<ActivityItem[]>('/analytics/recent').then(r => r.data),
};
