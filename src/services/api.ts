import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system/legacy';

import {
  AuthResponse,
  UserProfile,
  BudgetSummary,
  Transaction,
  NewTransactionPayload,
  CategoryItem,
  CreateCategoryPayload,
  AIInsight,
} from '../types/finance';
import {
  DEFAULT_EXPENSE_ITEMS,
  filterExpenseCategories,
  isAllowedExpenseCategory,
} from '../utils/categories';

// Live Render Backend URL
export const API_BASE_URL = 'https://finance-8vcg.onrender.com';

const TOKEN_KEY = 'finai_auth_token';
const USER_KEY = 'finai_auth_user';
const ACCOUNTS_REGISTRY_KEY = 'finai_saved_accounts';
const BIOMETRIC_ENABLED_KEY = 'finai_biometric_enabled';

// User-partitioned key helpers to prevent cross-account data leakage
const AVATAR_KEY_PREFIX = 'finai_user_avatar_uri_';
const DASHBOARD_CACHE_PREFIX = 'finai_cache_dashboard_';
const TRANSACTIONS_CACHE_PREFIX = 'finai_cache_transactions_';

// --- IN-MEMORY SESSION CACHE ---
let cachedToken: string | null = null;
let cachedUserId: string | null = null;
const userAvatarMemoryCache: Map<string, string> = new Map();

// --- AUTH FAILURE LISTENER ---
type AuthFailureCallback = () => void;
let onAuthFailureCallback: AuthFailureCallback | null = null;

export function setOnAuthFailure(callback: AuthFailureCallback | null) {
  onAuthFailureCallback = callback;
}

// --- AUTH TOKEN & USER STORAGE ---

export interface SavedAccount {
  user: UserProfile;
  token: string;
}

// Get all saved accounts from the encrypted SecureStore registry.
export async function getSavedAccounts(): Promise<SavedAccount[]> {
  const raw = await SecureStore.getItemAsync(ACCOUNTS_REGISTRY_KEY);
  if (!raw) return [];

  try {
    return JSON.parse(raw) as SavedAccount[];
  } catch {
    return [];
  }
}

// Register a new account or update the existing account with the same email.
export async function registerSavedAccount(
  token: string,
  user: UserProfile
): Promise<void> {
  const accounts = await getSavedAccounts();
  const existingIndex = accounts.findIndex(
    (account) => account.user.email === user.email
  );

  if (existingIndex >= 0) {
    accounts[existingIndex] = { user, token };
  } else {
    accounts.push({ user, token });
  }

  await SecureStore.setItemAsync(
    ACCOUNTS_REGISTRY_KEY,
    JSON.stringify(accounts)
  );
}

// Remove one saved account by email and clear its isolated caches.
export async function removeSavedAccount(email: string): Promise<void> {
  const accounts = await getSavedAccounts();
  const target = accounts.find((a) => a.user.email === email);
  const filtered = accounts.filter(
    (account) => account.user.email !== email
  );

  await SecureStore.setItemAsync(
    ACCOUNTS_REGISTRY_KEY,
    JSON.stringify(filtered)
  );

  if (target?.user.id) {
    await clearUserCache(target.user.id);
  }
}

export async function saveAuthSession(
  token: string,
  user: UserProfile
): Promise<void> {
  cachedToken = token;
  cachedUserId = user.id;
  await Promise.all([
    SecureStore.setItemAsync(TOKEN_KEY, token),
    SecureStore.setItemAsync(USER_KEY, JSON.stringify(user)),
    registerSavedAccount(token, user),
  ]);
}

/**
 * Switch directly to a saved account.
 * Immediately resets active in-memory session to isolate user data.
 */
export async function switchAuthAccount(account: SavedAccount): Promise<void> {
  cachedToken = account.token;
  cachedUserId = account.user.id;
  await Promise.all([
    SecureStore.setItemAsync(TOKEN_KEY, account.token),
    SecureStore.setItemAsync(USER_KEY, JSON.stringify(account.user)),
  ]);
}

export async function getAuthToken(): Promise<string | null> {
  if (cachedToken) return cachedToken;
  cachedToken = await SecureStore.getItemAsync(TOKEN_KEY);
  return cachedToken;
}

export async function getStoredUser(): Promise<UserProfile | null> {
  const raw = await SecureStore.getItemAsync(USER_KEY);
  if (!raw) return null;

  try {
    const user = JSON.parse(raw) as UserProfile;
    cachedUserId = user.id;
    return user;
  } catch {
    return null;
  }
}

export async function clearAuthSession(): Promise<void> {
  cachedToken = null;
  cachedUserId = null;
  await Promise.all([
    SecureStore.deleteItemAsync(TOKEN_KEY),
    SecureStore.deleteItemAsync(USER_KEY),
  ]);
}

export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, enabled ? 'true' : 'false');
}

export async function isBiometricEnabled(): Promise<boolean> {
  const result = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
  return result === 'true';
}

// --- USER-ISOLATED AVATAR STORAGE ---

function getAvatarKeyForUser(userId?: string): string {
  const resolvedId = userId || cachedUserId || 'default';
  return `${AVATAR_KEY_PREFIX}${resolvedId}`;
}

export async function saveUserAvatarUri(uri: string, userId?: string): Promise<void> {
  const key = getAvatarKeyForUser(userId);
  const resolvedId = userId || cachedUserId || 'default';
  userAvatarMemoryCache.set(resolvedId, uri);
  await SecureStore.setItemAsync(key, uri);
}

export async function getUserAvatarUri(userId?: string): Promise<string | null> {
  const resolvedId = userId || cachedUserId || 'default';
  if (userAvatarMemoryCache.has(resolvedId)) {
    return userAvatarMemoryCache.get(resolvedId) || null;
  }
  const key = getAvatarKeyForUser(userId);
  const saved = await SecureStore.getItemAsync(key);
  if (saved) {
    userAvatarMemoryCache.set(resolvedId, saved);
  }
  return saved;
}

export async function clearUserAvatarUri(userId?: string): Promise<void> {
  const resolvedId = userId || cachedUserId || 'default';
  userAvatarMemoryCache.delete(resolvedId);
  const key = getAvatarKeyForUser(userId);
  await SecureStore.deleteItemAsync(key);
}

// --- USER-ISOLATED CACHES ---

export async function clearUserCache(userId: string): Promise<void> {
  userAvatarMemoryCache.delete(userId);
  await Promise.all([
    SecureStore.deleteItemAsync(`${AVATAR_KEY_PREFIX}${userId}`).catch(() => {}),
    SecureStore.deleteItemAsync(`${DASHBOARD_CACHE_PREFIX}${userId}`).catch(() => {}),
    SecureStore.deleteItemAsync(`${TRANSACTIONS_CACHE_PREFIX}${userId}`).catch(() => {}),
  ]);
}

// --- STANDARDIZED AUTHENTICATED FETCH WRAPPER ---

export async function authenticatedFetch(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getAuthToken();

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Ensure Content-Type is application/json unless body is FormData (e.g. receipt image)
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  // AbortController for network timeout (20s)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Handle expired/invalid session
    if (response.status === 401) {
      console.warn(`[401 Unauthorized] Session expired on endpoint: ${endpoint}`);
      await clearAuthSession();
      if (onAuthFailureCallback) {
        onAuthFailureCallback();
      }
    }

    return response;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timed out. Please check your internet connection.');
    }
    throw error;
  }
}

// --- AUTHENTICATION APIS ---

export async function loginUser(
  email: string,
  password: string
): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const rawText = await res.text();
  let data: any;

  try {
    data = JSON.parse(rawText);
  } catch {
    throw new Error(
      `Server error (${res.status}): ${rawText.slice(0, 80)}`
    );
  }

  if (!res.ok) {
    const errorMsg = Array.isArray(data.detail)
      ? data.detail.map((e: any) => e.msg).join(', ')
      : data.detail || 'Login failed. Please check your credentials.';

    throw new Error(errorMsg);
  }

  await saveAuthSession(data.access_token, data.user);
  return data;
}

export async function registerUser(
  name: string,
  email: string,
  password: string
): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      email,
      password,
      income: 0.0,
    }),
  });

  const rawText = await res.text();
  let data: any;

  try {
    data = JSON.parse(rawText);
  } catch {
    throw new Error(
      `Server error (${res.status}): ${rawText.slice(0, 80)}`
    );
  }

  if (!res.ok) {
    const errorMsg = Array.isArray(data.detail)
      ? data.detail.map((e: any) => e.msg).join(', ')
      : data.detail || 'Registration failed.';

    throw new Error(errorMsg);
  }

  await saveAuthSession(data.access_token, data.user);
  return data;
}



export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/`, {
      method: 'GET',
    });

    return res.ok;
  } catch {
    return false;
  }
}

// --- FINANCIAL DATA APIS & USER-ISOLATED CACHES ---

export async function getDashboardSummary(): Promise<BudgetSummary> {
  const response = await authenticatedFetch('/api/dashboard');

  if (!response.ok) {
    throw new Error('Failed to fetch dashboard summary.');
  }

  return await response.json();
}

export async function getDashboardSummaryCached(userId?: string): Promise<BudgetSummary | null> {
  const cacheKey = `${DASHBOARD_CACHE_PREFIX}${userId || cachedUserId || 'default'}`;
  try {
    const summary = await getDashboardSummary();
    await SecureStore.setItemAsync(cacheKey, JSON.stringify(summary));
    return summary;
  } catch (err) {
    const cached = await SecureStore.getItemAsync(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        return null;
      }
    }
    throw err;
  }
}

export async function getTransactions(): Promise<Transaction[]> {
  const response = await authenticatedFetch('/api/transactions');

  if (!response.ok) {
    throw new Error('Failed to fetch transactions.');
  }

  return await response.json();
}

export async function getTransactionsCached(userId?: string): Promise<Transaction[]> {
  const cacheKey = `${TRANSACTIONS_CACHE_PREFIX}${userId || cachedUserId || 'default'}`;
  try {
    const txs = await getTransactions();
    await SecureStore.setItemAsync(cacheKey, JSON.stringify(txs));
    return txs;
  } catch (err) {
    const cached = await SecureStore.getItemAsync(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        return [];
      }
    }
    throw err;
  }
}

export async function createTransaction(payload: {
  amount: number;
  category: string;
  description: string;
  date?: string;
  payment_method?: 'cash' | 'card' | 'bank' | 'other';
}): Promise<Transaction> {
  const backendPayload = {
    merchant: payload.description || 'General Expense',
    category: payload.category,
    amount: payload.amount,
    date: payload.date,
    payment_source: payload.payment_method || 'cash',
  };

  const response = await authenticatedFetch('/api/transactions', {
    method: 'POST',
    body: JSON.stringify(backendPayload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let parsedMsg = 'Failed to create transaction.';
    try {
      const errJson = JSON.parse(errorText);
      parsedMsg = errJson.detail || errJson.message || parsedMsg;
    } catch {
      if (errorText) parsedMsg = errorText;
    }
    throw new Error(parsedMsg);
  }

  return await response.json();
}

export async function deleteTransactionApi(id: string): Promise<boolean> {
  const response = await authenticatedFetch(`/api/transactions/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('Failed to delete transaction.');
  }

  return true;
}

export async function updateTransactionApi(
  id: string,
  payload: {
    amount?: number;
    category?: string;
    description?: string;
    merchant?: string;
    date?: string;
    payment_method?: string;
  }
): Promise<Transaction> {
  const formattedPayload = {
    amount: payload.amount,
    category: payload.category,
    description: payload.description || payload.merchant,
    date: payload.date,
    payment_method: payload.payment_method || 'cash',
  };

  try {
    const patchRes = await authenticatedFetch(`/api/transactions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(formattedPayload),
    });

    if (patchRes.ok) {
      return await patchRes.json();
    }
  } catch (e) {
    // Fallback to delete and recreate if PATCH fails
  }

  await deleteTransactionApi(id);

  const created = await createTransaction({
    amount: payload.amount ?? 0,
    category: payload.category ?? 'Food',
    description: payload.description || payload.merchant || 'Expense',
    date: payload.date || new Date().toISOString().split('T')[0],
    payment_method: (payload.payment_method as any) || 'cash',
  });

  return created;
}

export async function updateUserIncome(monthlyIncome: number): Promise<UserProfile> {
  const response = await authenticatedFetch('/api/user/income', {
    method: 'PUT',
    body: JSON.stringify({ income: monthlyIncome }),
  });

  if (!response.ok) {
    throw new Error('Failed to update income.');
  }

  return await response.json();
}

export async function setCategoryBudget(
  category: string,
  budgetLimit: number
): Promise<void> {
  const response = await authenticatedFetch('/api/budgets', {
    method: 'POST',
    body: JSON.stringify({
      category,
      monthly_limit: budgetLimit,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to set category budget.');
  }
}

// --- CATEGORY MANAGEMENT APIS (EXPENSE ONLY) ---

export async function getCategoriesApi(): Promise<CategoryItem[]> {
  const response = await authenticatedFetch('/api/categories');

  if (!response.ok) return DEFAULT_EXPENSE_ITEMS;

  const rawData: CategoryItem[] = await response.json();
  const filtered = filterExpenseCategories(rawData);
  return filtered.length > 0 ? filtered : DEFAULT_EXPENSE_ITEMS;
}

export async function createCategoryApi(
  payload: CreateCategoryPayload
): Promise<CategoryItem> {
  if (!isAllowedExpenseCategory(payload.name, 'expense')) {
    throw new Error('Savings and Income categories are not permitted. Please specify an expense category.');
  }

  const response = await authenticatedFetch('/api/categories', {
    method: 'POST',
    body: JSON.stringify({
      name: payload.name.trim(),
      type: 'expense',
      color: payload.color || '#E5484D',
      icon: payload.icon || 'tag',
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));

    const errorMsg = Array.isArray(err.detail)
      ? err.detail.map((e: any) => e.msg).join(', ')
      : err.detail || 'Failed to create category.';

    throw new Error(errorMsg);
  }

  return await response.json();
}

export async function updateCategoryBudgetApi(
  categoryId: string,
  budget: number
): Promise<CategoryItem> {
  const response = await authenticatedFetch(`/api/categories/${categoryId}`, {
    method: 'PATCH',
    body: JSON.stringify({ budget }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let parsedMsg = 'Failed to update category budget.';
    try {
      const errJson = JSON.parse(errorText);
      parsedMsg = errJson.detail || errJson.message || parsedMsg;
    } catch {
      if (errorText) parsedMsg = errorText;
    }
    throw new Error(parsedMsg);
  }

  return await response.json();
}

export async function deleteCategoryApi(
  categoryId: string
): Promise<void> {
  const response = await authenticatedFetch(`/api/categories/${categoryId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));

    const errorMsg = Array.isArray(err.detail)
      ? err.detail.map((e: any) => e.msg).join(', ')
      : err.detail || 'Failed to delete category.';

    throw new Error(errorMsg);
  }
}

// --- AI INSIGHTS API ---

export async function getAIInsights(): Promise<AIInsight[]> {
  const response = await authenticatedFetch('/api/insights');

  if (!response.ok) return [];

  const data = await response.json();
  return data.insights || [];
}

// --- GEMINI VISION OCR ---

export async function scanReceiptWithGemini(
  imageUri: string
): Promise<any> {
  const token = await getAuthToken();

  const filename = imageUri.split(/[\\/]/).pop() || 'receipt.jpg';
  const match = /\.(\w+)$/.exec(filename);
  const ext = match ? match[1].toLowerCase() : 'jpg';

  const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
  const uploadUrl = `${API_BASE_URL}/api/upload-receipt`;

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await FileSystem.uploadAsync(
    uploadUrl,
    imageUri,
    {
      httpMethod: 'POST',
      uploadType: (FileSystem.FileSystemUploadType?.MULTIPART ?? 1) as any,
      fieldName: 'file',
      mimeType,
      headers,
    }
  );

  let result: any;

  try {
    result = JSON.parse(response.body);
  } catch {
    throw new Error('Invalid server response. Please try again.');
  }

  if (response.status === 401) {
    await clearAuthSession();
    if (onAuthFailureCallback) {
      onAuthFailureCallback();
    }
    throw new Error('Session expired or unauthorized. Please log in again.');
  }

  if (response.status !== 200) {
    const errorMsg = Array.isArray(result.detail)
      ? result.detail.map((e: any) => e.msg).join(', ')
      : result.detail || 'Receipt parsing failed.';

    throw new Error(errorMsg);
  }

  return result;
}

// --- FINAI CHATBOT APIS (UNARY & STREAMING) ---

export async function sendChatMessage(message: string): Promise<string> {
  const response = await authenticatedFetch('/api/chat', {
    method: 'POST',
    body: JSON.stringify({
      message: message,
      prompt: message,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to get advice from FinAI.');
  }

  const responseText = await response.text();
  try {
    const data = JSON.parse(responseText);
    if (typeof data === 'string') return data;
    return data.reply || data.response || data.message || data.text || responseText;
  } catch {
    return responseText;
  }
}

/**
 * Streams AI chat response token by token using Server-Sent Events (SSE).
 * Progressively calls onChunk with each new segment.
 * Calls onComplete when streaming completes.
 * Returns an abort function to cancel streaming at any time.
 */
export function sendChatMessageStream(
  message: string,
  onChunk: (chunk: string) => void,
  onComplete: (fullText: string) => void,
  onError: (error: Error) => void
): () => void {
  let aborted = false;
  let completed = false;
  let fullAccumulated = '';
  let lastIndex = 0;
  let xhr: XMLHttpRequest | null = new XMLHttpRequest();

  getAuthToken().then((token) => {
    if (aborted || !xhr) return;

    xhr.open('POST', `${API_BASE_URL}/api/chat/stream`, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Accept', 'text/event-stream, application/json');
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }

    xhr.onprogress = () => {
      if (aborted || !xhr) return;
      const currentText = xhr.responseText;
      const newChunk = currentText.slice(lastIndex);
      lastIndex = currentText.length;

      const lines = newChunk.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data:')) {
          const dataContent = trimmed.slice(5).trim();
          if (dataContent === '[DONE]') {
            if (!completed) {
              completed = true;
              onComplete(fullAccumulated);
            }
            return;
          }
          try {
            const parsed = JSON.parse(dataContent);
            if (parsed.text) {
              fullAccumulated += parsed.text;
              onChunk(parsed.text);
            } else if (parsed.error) {
              if (!completed) {
                completed = true;
                onError(new Error(parsed.error));
              }
              return;
            }
          } catch {
            if (dataContent && dataContent !== '[DONE]') {
              fullAccumulated += dataContent;
              onChunk(dataContent);
            }
          }
        }
      }
    };

    xhr.onload = async () => {
      if (aborted) return;

      // If streaming endpoint returned 404 or not implemented yet, fallback smoothly to unary chat
      if (xhr && (xhr.status === 404 || xhr.status === 405 || xhr.status === 501)) {
        try {
          const reply = await sendChatMessage(message);
          if (!completed) {
            completed = true;
            onChunk(reply);
            onComplete(reply);
          }
        } catch (err: any) {
          if (!completed) {
            completed = true;
            onError(err);
          }
        }
        return;
      }

      if (xhr && xhr.status >= 200 && xhr.status < 300) {
        if (!completed) {
          completed = true;
          onComplete(fullAccumulated);
        }
      } else {
        if (!completed) {
          completed = true;
          onError(new Error(`Server response error (${xhr?.status || 'unknown'})`));
        }
      }
    };

    xhr.onerror = () => {
      if (!aborted && !completed) {
        completed = true;
        onError(new Error('Network connection error while streaming from FinAI.'));
      }
    };

    xhr.ontimeout = () => {
      if (!aborted && !completed) {
        completed = true;
        onError(new Error('FinAI AI stream timed out. Please try again.'));
      }
    };

    xhr.send(JSON.stringify({ message, prompt: message }));
  }).catch((err) => {
    if (!aborted && !completed) {
      completed = true;
      onError(err);
    }
  });

  return () => {
    aborted = true;
    if (xhr) {
      try {
        xhr.abort();
      } catch {}
      xhr = null;
    }
  };
}