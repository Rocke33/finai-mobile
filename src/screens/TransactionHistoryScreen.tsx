import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Search,
  X,
  Receipt,
} from 'lucide-react-native';

import { getTransactions, deleteTransactionApi } from '../services/api';
import { Transaction } from '../types/finance';
import { EditTransactionModal } from '../components/EditTransactionModal';
import { TransactionRow } from '../components/TransactionRow';
import { isAllowedExpenseCategory } from '../utils/categories';

interface TransactionHistoryScreenProps {
  onBack: () => void;
  onUpdateTransaction: (
    id: string,
    amount: number,
    category: string,
    merchant: string,
    date: string
  ) => Promise<void>;
}

const PAGE_SIZE = 20;

export const TransactionHistoryScreen: React.FC<TransactionHistoryScreenProps> = ({
  onBack,
  onUpdateTransaction,
}) => {
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [displayLimit, setDisplayLimit] = useState(PAGE_SIZE);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Android Hardware Back button returns to Dashboard
  useEffect(() => {
    const backAction = () => {
      onBack();
      return true;
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => subscription.remove();
  }, [onBack]);

  const fetchTransactions = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await getTransactions();
      setAllTransactions(data || []);
    } catch (err: any) {
      console.error('Failed to load transaction history:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Extract distinct categories (Expense only - Savings/Income excluded)
  const categories = useMemo(() => {
    const set = new Set<string>();
    allTransactions.forEach((t) => {
      if (t.category && isAllowedExpenseCategory(t.category, 'expense')) {
        set.add(t.category);
      }
    });
    return ['All', ...Array.from(set)];
  }, [allTransactions]);

  // Real-time filtering
  const filteredList = useMemo(() => {
    return allTransactions.filter((t) => {
      if (!isAllowedExpenseCategory(t.category, 'expense')) return false;

      const matchesCat =
        selectedCategory === 'All' ||
        (t.category && t.category.toLowerCase() === selectedCategory.toLowerCase());

      const q = searchQuery.trim().toLowerCase();
      if (!q) return matchesCat;

      const merchant = (t.merchant || t.description || t.note || '').toLowerCase();
      const cat = (t.category || '').toLowerCase();
      return matchesCat && (merchant.includes(q) || cat.includes(q));
    });
  }, [allTransactions, selectedCategory, searchQuery]);

  // Paginated slice
  const paginatedList = useMemo(() => {
    return filteredList.slice(0, displayLimit);
  }, [filteredList, displayLimit]);

  const handleLoadMore = useCallback(() => {
    if (displayLimit < filteredList.length) {
      setDisplayLimit((prev) => prev + PAGE_SIZE);
    }
  }, [displayLimit, filteredList.length]);

  const handleDelete = useCallback((tx: Transaction) => {
    Alert.alert(
      'Delete Transaction',
      `Delete "-৳ ${Number(tx.amount).toFixed(2)}" for ${tx.merchant || tx.description || tx.category}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(tx.id);
            try {
              await deleteTransactionApi(tx.id);
              setAllTransactions((prev) => prev.filter((item) => item.id !== tx.id));
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete transaction.');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  }, []);

  const handleEditPress = useCallback((tx: Transaction) => {
    setEditingTransaction(tx);
  }, []);

  const handleDeletePress = useCallback((tx: Transaction) => {
    handleDelete(tx);
  }, [handleDelete]);

  const handleSaveEdit = async (
    id: string,
    amount: number,
    category: string,
    merchant: string,
    date: string
  ) => {
    await onUpdateTransaction(id, amount, category, merchant, date);
    await fetchTransactions(true);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
          <ArrowLeft size={18} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>All Transactions</Text>
        <View style={styles.headerRightBox}>
          <Text style={styles.totalBadge}>{filteredList.length}</Text>
        </View>
      </View>

      {/* Live Search & Filter Bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Search size={16} color="#64748B" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by note, merchant or category..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={(text) => {
              setSearchQuery(text);
              setDisplayLimit(PAGE_SIZE);
            }}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={15} color="#64748B" />
            </TouchableOpacity>
          )}
        </View>

        {/* Horizontal Category Chips */}
        {categories.length > 1 && (
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={categories}
            keyExtractor={(item) => item}
            contentContainerStyle={styles.categoryList}
            renderItem={({ item }) => {
              const isSelected = selectedCategory === item;
              return (
                <TouchableOpacity
                  style={[styles.filterChip, isSelected && styles.filterChipSelected]}
                  onPress={() => {
                    setSelectedCategory(item);
                    setDisplayLimit(PAGE_SIZE);
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      isSelected && styles.filterChipTextSelected,
                    ]}
                  >
                    {item}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>

      {/* Main Paginated List */}
      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#E5484D" />
        </View>
      ) : (
        <FlatList
          data={paginatedList}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          // --- Virtualization Optimization Props ---
          initialNumToRender={12}
          maxToRenderPerBatch={10}
          windowSize={7}
          removeClippedSubviews={true}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchTransactions(true)}
              tintColor="#E5484D"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Receipt size={36} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>No Transactions Found</Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery || selectedCategory !== 'All'
                  ? 'Try searching with different keywords or filter categories.'
                  : 'You have not recorded any transactions yet.'}
              </Text>
            </View>
          }
          ListFooterComponent={
            displayLimit < filteredList.length ? (
              <View style={styles.loadMoreFooter}>
                <ActivityIndicator size="small" color="#64748B" />
                <Text style={styles.loadMoreText}>Loading more transactions...</Text>
              </View>
            ) : undefined
          }
          renderItem={({ item }) => (
            <TransactionRow
              item={item}
              onEdit={handleEditPress}
              onDelete={handleDeletePress}
              isDeleting={deletingId === item.id}
            />
          )}
        />
      )}

      {/* Edit Transaction Modal */}
      <EditTransactionModal
        visible={!!editingTransaction}
        transaction={editingTransaction}
        onClose={() => setEditingTransaction(null)}
        onUpdate={handleSaveEdit}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerRightBox: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#ECFDF5',
  },
  totalBadge: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F382C',
  },
  searchSection: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
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
  categoryList: {
    gap: 6,
    paddingVertical: 2,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
    gap: 10,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 6,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    maxWidth: '75%',
    lineHeight: 18,
  },
  loadMoreFooter: {
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadMoreText: {
    fontSize: 11,
    color: '#64748B',
  },
});