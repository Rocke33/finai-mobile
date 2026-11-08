import * as SecureStore from 'expo-secure-store';
import NetInfo from '@react-native-community/netinfo';
import { createTransaction } from './api';

const OFFLINE_QUEUE_KEY = 'finai_offline_actions_queue';

export interface PendingExpense {
  id: string;
  amount: number;
  category: string;
  description: string;
  date?: string;
  payment_method?: 'cash' | 'card' | 'bank' | 'other';
  createdAt: number;
}

let isSyncing = false;
type QueueChangeCallback = (count: number, isSyncing: boolean) => void;
const listeners: QueueChangeCallback[] = [];

export function subscribeQueueChanges(cb: QueueChangeCallback) {
  listeners.push(cb);
  getQueueCount().then((count) => cb(count, isSyncing));
  return () => {
    const idx = listeners.indexOf(cb);
    if (idx !== -1) listeners.splice(idx, 1);
  };
}

function notifyListeners(count: number) {
  listeners.forEach((cb) => cb(count, isSyncing));
}

export async function getPendingQueue(): Promise<PendingExpense[]> {
  try {
    const raw = await SecureStore.getItemAsync(OFFLINE_QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function getQueueCount(): Promise<number> {
  const queue = await getPendingQueue();
  return queue.length;
}

export async function enqueueOfflineExpense(expense: Omit<PendingExpense, 'id' | 'createdAt'>): Promise<void> {
  const currentQueue = await getPendingQueue();
  const newItem: PendingExpense = {
    ...expense,
    id: `queue-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    createdAt: Date.now(),
  };

  const updatedQueue = [...currentQueue, newItem];
  await SecureStore.setItemAsync(OFFLINE_QUEUE_KEY, JSON.stringify(updatedQueue));
  notifyListeners(updatedQueue.length);
}

export async function drainOfflineQueue(onSuccessItem?: () => Promise<void>): Promise<void> {
  if (isSyncing) return;

  const state = await NetInfo.fetch();
  if (!state.isConnected || state.isInternetReachable === false) return;

  const queue = await getPendingQueue();
  if (queue.length === 0) return;

  isSyncing = true;
  notifyListeners(queue.length);

  const remaining: PendingExpense[] = [];

  for (const item of queue) {
    try {
      await createTransaction({
        amount: item.amount,
        category: item.category,
        description: item.description,
        date: item.date,
        payment_method: item.payment_method,
      });
      if (onSuccessItem) {
        await onSuccessItem().catch(() => {});
      }
    } catch (err: any) {
      // If still network/server unavailable, retain item in queue
      console.warn('Failed to replay offline item, holding in queue:', item.id, err);
      remaining.push(item);
    }
  }

  await SecureStore.setItemAsync(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
  isSyncing = false;
  notifyListeners(remaining.length);
}