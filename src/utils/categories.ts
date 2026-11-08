import { CategoryItem } from '../types/finance';

/**
 * Standard expense categories supported across FinAI.
 * Savings and Income categories have been removed entirely.
 */
export const DEFAULT_EXPENSE_CATEGORIES: string[] = [
  'Food',
  'Transport',
  'Bills & Utilities',
  'Shopping',
  'Health',
  'Entertainment',
  'Groceries',
];

export const DEFAULT_EXPENSE_ITEMS: CategoryItem[] = [
  { id: 'cat_exp_1', name: 'Food', type: 'expense', color: '#F97316', icon: 'Utensils' },
  { id: 'cat_exp_2', name: 'Transport', type: 'expense', color: '#3B82F6', icon: 'Car' },
  { id: 'cat_exp_3', name: 'Bills & Utilities', type: 'expense', color: '#8B5CF6', icon: 'Receipt' },
  { id: 'cat_exp_4', name: 'Shopping', type: 'expense', color: '#EC4899', icon: 'ShoppingBag' },
  { id: 'cat_exp_5', name: 'Health', type: 'expense', color: '#EF4444', icon: 'HeartPulse' },
  { id: 'cat_exp_6', name: 'Entertainment', type: 'expense', color: '#10B981', icon: 'Film' },
  { id: 'cat_exp_7', name: 'Groceries', type: 'expense', color: '#14B8A6', icon: 'ShoppingCart' },
];

const DISALLOWED_LOWERCASE_NAMES = new Set([
  'income',
  'savings',
  'saving',
  'salary',
  'freelance',
  'allowance',
  'other income',
  'emergency fund',
  'general savings',
  'investment',
  'business',
  'gift',
]);

/**
 * Validates whether a category name and type represents an expense.
 * Explicitly rejects any Savings or Income categories.
 */
export function isAllowedExpenseCategory(name?: string | null, type?: string | null): boolean {
  if (!name) return false;
  const trimmedLower = name.trim().toLowerCase();

  // Check type
  if (type && (type.toLowerCase() === 'income' || type.toLowerCase() === 'savings')) {
    return false;
  }

  // Check name keywords
  if (trimmedLower.includes('income') || trimmedLower.includes('saving')) {
    return false;
  }

  if (DISALLOWED_LOWERCASE_NAMES.has(trimmedLower)) {
    return false;
  }

  return true;
}

/**
 * Filters an array of CategoryItem objects to include only valid expense categories.
 */
export function filterExpenseCategories(categories: CategoryItem[]): CategoryItem[] {
  if (!Array.isArray(categories)) return [];
  return categories.filter((cat) => isAllowedExpenseCategory(cat.name, cat.type));
}

/**
 * Filters an array of category name strings to include only valid expense categories.
 */
export function filterExpenseCategoryNames(names: string[]): string[] {
  if (!Array.isArray(names)) return [];
  return names.filter((name) => isAllowedExpenseCategory(name, 'expense'));
}
