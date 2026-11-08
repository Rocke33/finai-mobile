import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useScrollToTop } from '@react-navigation/native';
import {
  Plus,
  RefreshCw,
  Receipt,
  Camera,
  Trash2,
  Search,
  X,
  AlertTriangle,
  Download,
  Pencil,
} from 'lucide-react-native';
import { EditTransactionModal } from '../components/EditTransactionModal';
import { exportTransactionsToCsv } from '../utils/exportCsv';
import { HeroBalanceCard } from '../components/HeroBalanceCard';
import { FinancialHealthCard } from '../components/FinancialHealthCard';
import { FinanceActionModal, ActionModalType } from '../components/FinanceActionModal';
import { ReceiptScannerModal } from '../components/ReceiptScannerModal';
import { ProfilePhotoActionModal } from '../components/ProfilePhotoActionModal';
import { isAllowedExpenseCategory } from '../utils/categories';

import {
  getDashboardSummaryCached,
  getTransactionsCached,
  createTransaction,
  deleteTransactionApi,
  updateTransactionApi,
  updateUserIncome,
  getUserAvatarUri,
  saveUserAvatarUri,
  clearUserAvatarUri,
} from '../services/api';
import { enqueueOfflineExpense, drainOfflineQueue } from '../services/syncQueue';
import { BudgetSummary, Transaction, UserProfile } from '../types/finance';

interface DashboardScreenProps {
  currentUser: UserProfile;
  onLogout: () => void;
  onNavigateHistory?: () => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  currentUser,
  onLogout,
  onNavigateHistory,
}) => {
  const [summary, setSummary] = useState<BudgetSummary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [activeModal, setActiveModal] = useState<ActionModalType>(null);
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState<boolean>(false);

  // Scroll to Top Ref typed cleanly to avoid type mismatches
  const scrollRef = useRef<any>(null);
  useScrollToTop(scrollRef);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedFilterCategory, setSelectedFilterCategory] = useState<string>('All');

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [summaryRes, txsRes, savedAvatar] = await Promise.all([
        getDashboardSummaryCached(currentUser.id).catch(() => null),
        getTransactionsCached(currentUser.id).catch(() => []),
        getUserAvatarUri(currentUser.id).catch(() => null),
      ]);

      setSummary(summaryRes);
      setTransactions(txsRes || []);
      setAvatarUri(savedAvatar || null);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUser.id]);

  useEffect(() => {
    loadData();
    drainOfflineQueue(async () => {
      await loadData(true);
    });
  }, [loadData]);

  const handleSaveExpense = async (
    amount: number,
    category: string,
    merchant: string,
    date?: string
  ) => {
    const formattedDate = date || new Date().toISOString().split('T')[0];

    // 1. Create a temporary optimistic transaction
    const tempId = `temp-${Date.now()}`;
    const optimisticTx: Transaction = {
      id: tempId,
      amount,
      category,
      description: merchant,
      merchant,
      date: formattedDate,
      payment_method: 'cash',
    };

    // 2. Immediately update local state
    setTransactions((prev) => [optimisticTx, ...prev]);
    setSummary((prev) => {
      if (!prev) return null;
      const newSpent = (prev.total_spent || 0) + amount;
      const newBalance = Math.max(0, (prev.monthly_income || 0) - newSpent);
      return {
        ...prev,
        total_spent: newSpent,
        total_balance: newBalance,
      };
    });

    try {
      // 3. Persist to API in background
      await createTransaction({
        amount,
        category,
        description: merchant,
        date: formattedDate,
        payment_method: 'cash',
      });
      // 4. Background re-sync to fetch canonical database record
      await loadData(true);
    } catch (err: any) {
      // 5. Instead of discarding, safely enqueue for auto-sync when online
      console.warn('Network unavailable during create. Queuing offline:', err.message);
      await enqueueOfflineExpense({
        amount,
        category,
        description: merchant,
        date: formattedDate,
        payment_method: 'cash',
      });
    }
  };

  const handleSaveIncome = async (income: number) => {
    await updateUserIncome(income);
    await loadData(true);
  };

  const handleReceiptProcessed = async (data: {
    amount: number;
    category: string;
    merchant: string;
    date: string;
  }) => {
    await handleSaveExpense(
      data.amount,
      data.category,
      data.merchant,
      data.date
    );
  };

  const handleUpdateTransaction = async (
    id: string,
    amount: number,
    category: string,
    merchant: string,
    date: string
  ) => {
    await updateTransactionApi(id, {
      amount,
      category,
      description: merchant,
      merchant,
      date,
    });
    await loadData(true);
  };

  const handleDeleteTransaction = (tx: Transaction) => {
    Alert.alert(
      'Delete Transaction',
      `Delete "-৳ ${Number(tx.amount).toFixed(2)}" for ${tx.description || tx.category}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(tx.id);
            try {
              await deleteTransactionApi(tx.id);
              setTransactions((prev) => prev.filter((item) => item.id !== tx.id));
              await loadData(true);
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete transaction.');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  const availableFilterCategories = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach((t) => {
      if (t.category && isAllowedExpenseCategory(t.category, 'expense')) {
        set.add(t.category);
      }
    });
    return ['All', ...Array.from(set)];
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const matchesCategory =
        selectedFilterCategory === 'All' || t.category === selectedFilterCategory;

      const q = searchQuery.trim().toLowerCase();
      if (!q) return matchesCategory;

      const merchantText = (t.merchant || t.description || t.note || '').toLowerCase();
      const categoryText = (t.category || '').toLowerCase();

      const matchesSearch = merchantText.includes(q) || categoryText.includes(q);

      return matchesCategory && matchesSearch;
    });
  }, [transactions, selectedFilterCategory, searchQuery]);

  const effectiveTotalBalance =
    summary?.total_balance ??
    Math.max(0, (summary?.monthly_income ?? 0) - (summary?.total_spent ?? 0));

  const budgetStatus = useMemo(() => {
    const income = summary?.monthly_income ?? 0;
    const spent = summary?.total_spent ?? 0;

    if (income <= 0) return null;

    const ratio = spent / income;
    const percentage = Math.round(ratio * 100);

    if (ratio >= 1.0) {
      return {
        level: 'danger',
        title: 'Budget Exceeded!',
        message: `You have spent ${percentage}% of your monthly income. Consider cutting discretionary spending.`,
      };
    } else if (ratio >= 0.8) {
      return {
        level: 'warning',
        title: 'High Spending Alert',
        message: `You have consumed ${percentage}% of your monthly income. Only ৳ ${(income - spent).toLocaleString('en-US', { minimumFractionDigits: 0 })} remains.`,
      };
    }
    return null;
  }, [summary]);

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#E5484D" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.navHeader}>
        <View style={styles.brandRow}>
          <Text style={styles.brandEmoji}>🐝</Text>
          <Text style={styles.brandTitle}>
            AI<Text style={styles.brandAccent}>Finance</Text>
          </Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => loadData(true)}>
            <RefreshCw size={17} color="#475569" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadData(true)}
            tintColor="#E5484D"
          />
        }
      >
        <HeroBalanceCard
          summary={summary}
          userName={currentUser.name}
          totalBalance={effectiveTotalBalance}
          avatarUri={avatarUri}
          onEditIncome={() => setActiveModal('income')}
          onPressAvatar={() => setIsPhotoModalOpen(true)}
        />

        {budgetStatus && (
          <View
            style={[
              styles.alertCard,
              budgetStatus.level === 'danger' ? styles.alertCardDanger : styles.alertCardWarning,
            ]}
          >
            <View
              style={[
                styles.alertIconBadge,
                budgetStatus.level === 'danger' ? styles.alertIconDanger : styles.alertIconWarning,
              ]}
            >
              <AlertTriangle
                size={16}
                color={budgetStatus.level === 'danger' ? '#DC2626' : '#D97706'}
              />
            </View>
            <View style={styles.alertContent}>
              <Text
                style={[
                  styles.alertTitle,
                  budgetStatus.level === 'danger' ? styles.alertTextDanger : styles.alertTextWarning,
                ]}
              >
                {budgetStatus.title}
              </Text>
              <Text style={styles.alertMessage}>{budgetStatus.message}</Text>
            </View>
          </View>
        )}

        <FinancialHealthCard summary={summary} />

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.addExpenseBtn}
            onPress={() => setActiveModal('expense')}
            activeOpacity={0.8}
          >
            <Plus size={18} color="#FFFFFF" />
            <Text style={styles.actionBtnText}>Add Expense</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.scanReceiptBtn}
            onPress={() => setIsScannerOpen(true)}
            activeOpacity={0.8}
          >
            <Camera size={18} color="#0F382C" />
            <Text style={styles.scanBtnText}>Scan Bill</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.filterSection}>
          <View style={styles.searchBar}>
            <Search size={16} color="#64748B" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search expenses..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchBtn}>
                <X size={14} color="#64748B" />
              </TouchableOpacity>
            )}
          </View>

          {availableFilterCategories.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterChipsRow}
            >
              {availableFilterCategories.map((cat) => {
                const isSelected = selectedFilterCategory === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.filterChip, isSelected && styles.filterChipSelected]}
                    onPress={() => setSelectedFilterCategory(cat)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        isSelected && styles.filterChipTextSelected,
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Recent Transactions</Text>
            <Text style={styles.sectionCount}>
              {filteredTransactions.length} of {transactions.length} items
            </Text>
          </View>

          <View style={styles.headerBtnGroup}>
            {onNavigateHistory && (
              <TouchableOpacity
                style={styles.seeAllBtn}
                onPress={onNavigateHistory}
                activeOpacity={0.7}
              >
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.exportBtn}
              onPress={() => exportTransactionsToCsv(filteredTransactions)}
              activeOpacity={0.7}
            >
              <Download size={13} color="#0F382C" />
              <Text style={styles.exportBtnText}>CSV</Text>
            </TouchableOpacity>
          </View>
        </View>

        {filteredTransactions.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              {searchQuery || selectedFilterCategory !== 'All'
                ? 'No transactions match your search/filter.'
                : 'No recent transactions found.'}
            </Text>
          </View>
        ) : (
          filteredTransactions.slice(0, 15).map((tx) => (
            <View key={tx.id} style={styles.txItem}>
              <View style={styles.txLeft}>
                <View style={styles.txIconBox}>
                  <Receipt size={16} color="#E5484D" />
                </View>
                <View style={styles.txDetails}>
                  <Text style={styles.txMerchant} numberOfLines={1}>
                    {tx.merchant || tx.description || tx.note || tx.category}
                  </Text>
                  <Text style={styles.txCategory}>
                    {tx.category} • {tx.date ? tx.date.split('T')[0] : 'Today'}
                  </Text>
                </View>
              </View>

              <View style={styles.txRight}>
                <Text style={styles.txAmount}>
                  -৳ {Number(tx.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </Text>
                <View style={styles.txActionsGroup}>
                  <TouchableOpacity
                    onPress={() => setEditingTransaction(tx)}
                    style={styles.txActionBtn}
                    activeOpacity={0.7}
                    accessibilityLabel="Edit transaction"
                  >
                    <Pencil size={13} color="#475569" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleDeleteTransaction(tx)}
                    style={styles.txActionBtn}
                    disabled={deletingId === tx.id}
                    activeOpacity={0.7}
                    accessibilityLabel="Delete transaction"
                  >
                    {deletingId === tx.id ? (
                      <ActivityIndicator size="small" color="#DC2626" />
                    ) : (
                      <Trash2 size={13} color="#DC2626" />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <FinanceActionModal
        type={activeModal}
        onClose={() => setActiveModal(null)}
        onSaveExpense={handleSaveExpense}
        onSaveIncome={handleSaveIncome}
      />

      <ReceiptScannerModal
        visible={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onReceiptProcessed={handleReceiptProcessed}
      />

      <EditTransactionModal
        visible={!!editingTransaction}
        transaction={editingTransaction}
        onClose={() => setEditingTransaction(null)}
        onUpdate={handleUpdateTransaction}
      />

      <ProfilePhotoActionModal
        visible={isPhotoModalOpen}
        avatarUri={avatarUri}
        userName={currentUser.name}
        onClose={() => setIsPhotoModalOpen(false)}
        onSelectPhoto={async (newUri) => {
          setAvatarUri(newUri);
          await saveUserAvatarUri(newUri, currentUser.id);
        }}
        onRemovePhoto={async () => {
          setAvatarUri(null);
          await clearUserAvatarUri(currentUser.id);
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  navHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandEmoji: {
    fontSize: 22,
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  brandAccent: {
    color: '#E5484D',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
    gap: 16,
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  alertCardDanger: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  alertCardWarning: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  alertIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertIconDanger: {
    backgroundColor: '#FEE2E2',
  },
  alertIconWarning: {
    backgroundColor: '#FEF3C7',
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 2,
  },
  alertTextDanger: {
    color: '#B91C1C',
  },
  alertTextWarning: {
    color: '#B45309',
  },
  alertMessage: {
    fontSize: 11,
    color: '#475569',
    lineHeight: 15,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  addExpenseBtn: {
    flex: 1.2,
    backgroundColor: '#E5484D',
    borderRadius: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#E5484D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  scanReceiptBtn: {
    flex: 1,
    backgroundColor: '#E6F4EA',
    borderRadius: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  scanBtnText: {
    color: '#0F382C',
    fontSize: 14,
    fontWeight: '700',
  },
  filterSection: {
    gap: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
  },
  clearSearchBtn: {
    padding: 4,
  },
  filterChipsRow: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterChipSelected: {
    backgroundColor: '#0F382C',
    borderColor: '#0F382C',
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  filterChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  sectionCount: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  headerBtnGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  seeAllBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  seeAllText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  exportBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F382C',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyText: {
    fontSize: 13,
    color: '#64748B',
  },
  txItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  txLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 8,
  },
  txIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  txDetails: {
    flex: 1,
  },
  txMerchant: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  txCategory: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  txRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  txAmount: {
    fontSize: 14,
    fontWeight: '800',
    color: '#E5484D',
  },
  txActionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  txActionBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
});