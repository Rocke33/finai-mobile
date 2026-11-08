// --- ENUMS & LITERAL TYPES ---
export type CategoryType = 'expense';
export type PaymentMethod = 'cash' | 'online' | string;

// --- AUTHENTICATION & USER PROFILE ---
export interface UserProfile {
  id: string;
  email: string;
  name: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: UserProfile;
}

// --- CATEGORY TYPES ---
export interface CategoryItem {
  id: string;
  name: string;
  type?: CategoryType;
  color?: string;
  icon?: string;
  created_at?: string;
}

export interface CreateCategoryPayload {
  name: string;
  type?: CategoryType;
  color?: string;
  icon?: string;
}

export interface CategorySummary {
  category: string;
  budget: number;
  spent: number;
  remaining?: number;
  percentage_used?: number;
  color?: string;
}

// --- DASHBOARD METRICS ---
export interface BudgetSummary {
  monthly_income: number;
  total_spent: number;
  total_budget: number;
  total_balance: number;
  categories: CategorySummary[];
}

// --- TRANSACTION TYPES ---
export interface Transaction {
  id: string;
  amount: number;
  category: string;
  description?: string;
  merchant?: string;
  note?: string;
  date: string;
  payment_method?: PaymentMethod;
  payment_source?: string;
  created_at?: string;
}

export interface NewTransactionPayload {
  amount: number;
  category: string;
  description?: string;
  merchant?: string;
  date: string;
  payment_method?: PaymentMethod;
}

// --- AI INSIGHTS & CHATBOT ---
export interface AIInsight {
  title: string;
  description: string;
  type: 'warning' | 'tip' | 'info';
  actionable?: boolean;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  time: string;
}