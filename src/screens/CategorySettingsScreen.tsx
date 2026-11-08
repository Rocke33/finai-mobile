import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Plus, Trash2, Tag, DollarSign, X, Check } from 'lucide-react-native';

import {
  getCategoriesApi,
  createCategoryApi,
  deleteCategoryApi,
  updateCategoryBudgetApi,
} from '../services/api';
import { CategoryItem } from '../types/finance';
import { filterExpenseCategories, isAllowedExpenseCategory } from '../utils/categories';

interface CategorySettingsScreenProps {
  onBack: () => void;
}

export const CategorySettingsScreen: React.FC<CategorySettingsScreenProps> = ({ onBack }) => {
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCatName, setNewCatName] = useState('');
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Budget editing state
  const [budgetModalCategory, setBudgetModalCategory] = useState<CategoryItem | null>(null);
  const [budgetInput, setBudgetInput] = useState('');
  const [updatingBudget, setUpdatingBudget] = useState(false);

  // Hardware Back button support: reliably returns to Settings main screen
  useEffect(() => {
    const backAction = () => {
      onBack();
      return true;
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => subscription.remove();
  }, [onBack]);

  const loadCategories = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getCategoriesApi();
      const expenseOnly = filterExpenseCategories(Array.isArray(data) ? data : []);
      setCategories(expenseOnly);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to load categories.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const handleCreateCategory = async () => {
    const trimmed = newCatName.trim();
    if (!trimmed) return;

    if (!isAllowedExpenseCategory(trimmed, 'expense')) {
      Alert.alert(
        'Invalid Category',
        'Savings and Income categories are not permitted. Please enter a valid expense category (e.g., Dining, Groceries, Education).'
      );
      return;
    }

    setCreating(true);
    try {
      await createCategoryApi({
        name: trimmed,
        type: 'expense',
      });
      setNewCatName('');
      await loadCategories();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to add category.');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteCategory = (cat: CategoryItem) => {
    Alert.alert(
      'Delete Category',
      `Are you sure you want to delete the category "${cat.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(cat.id);
            try {
              await deleteCategoryApi(cat.id);
              setCategories((prev) => prev.filter((item) => item.id !== cat.id));
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete category.');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  const handleOpenBudgetModal = (cat: CategoryItem) => {
    setBudgetModalCategory(cat);
    setBudgetInput('');
  };

  const handleSaveBudget = async () => {
    if (!budgetModalCategory) return;
    const parsed = parseFloat(budgetInput);
    if (isNaN(parsed) || parsed < 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid non-negative budget value.');
      return;
    }

    setUpdatingBudget(true);
    try {
      await updateCategoryBudgetApi(budgetModalCategory.id, parsed);
      setBudgetModalCategory(null);
      await loadCategories();
    } catch (err: any) {
      Alert.alert('Update Failed', err.message || 'Could not update category budget.');
    } finally {
      setUpdatingBudget(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
          <ArrowLeft size={18} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Category Settings</Text>
        <View style={styles.headerRightBox} />
      </View>

      <View style={styles.container}>
        {/* Create Input Box */}
        <View style={styles.addCard}>
          <Text style={styles.addCardLabel}>CREATE NEW EXPENSE CATEGORY</Text>
          <View style={styles.addInputRow}>
            <TextInput
              style={styles.input}
              placeholder="e.g. Subscriptions, Fitness..."
              placeholderTextColor="#94A3B8"
              value={newCatName}
              onChangeText={setNewCatName}
            />
            <TouchableOpacity
              style={[styles.addBtn, (!newCatName.trim() || creating) && styles.addBtnDisabled]}
              onPress={handleCreateCategory}
              disabled={!newCatName.trim() || creating}
              activeOpacity={0.8}
            >
              {creating ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Plus size={18} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Categories List */}
        <Text style={styles.sectionTitle}>Manage Active Expense Categories</Text>

        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#0F382C" />
          </View>
        ) : (
          <FlatList
            data={categories}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <View style={styles.catItem}>
                <View style={styles.catLeft}>
                  <View style={styles.catIconBox}>
                    <Tag size={16} color="#0F382C" />
                  </View>
                  <View>
                    <Text style={styles.catName}>{item.name}</Text>
                    <Text style={styles.catType}>Expense Category</Text>
                  </View>
                </View>

                <View style={styles.catActions}>
                  <TouchableOpacity
                    style={styles.budgetActionBtn}
                    onPress={() => handleOpenBudgetModal(item)}
                    activeOpacity={0.7}
                  >
                    <DollarSign size={14} color="#0F382C" />
                    <Text style={styles.budgetBtnText}>Set Budget</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDeleteCategory(item)}
                    disabled={deletingId === item.id}
                    activeOpacity={0.7}
                  >
                    {deletingId === item.id ? (
                      <ActivityIndicator size="small" color="#DC2626" />
                    ) : (
                      <Trash2 size={14} color="#DC2626" />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        )}
      </View>

      {/* Set Category Budget Modal */}
      <Modal
        visible={!!budgetModalCategory}
        transparent
        animationType="fade"
        onRequestClose={() => setBudgetModalCategory(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Set Monthly Limit</Text>
              <TouchableOpacity onPress={() => setBudgetModalCategory(null)}>
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Assign a spending threshold for{' '}
              <Text style={styles.highlightCat}>{budgetModalCategory?.name}</Text>
            </Text>

            <View style={styles.budgetInputContainer}>
              <Text style={styles.currencyPrefix}>৳</Text>
              <TextInput
                style={styles.budgetModalInput}
                placeholder="0.00"
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
                value={budgetInput}
                onChangeText={setBudgetInput}
                autoFocus
              />
            </View>

            <TouchableOpacity
              style={[styles.saveBudgetBtn, updatingBudget && styles.saveBudgetBtnDisabled]}
              onPress={handleSaveBudget}
              disabled={updatingBudget}
              activeOpacity={0.8}
            >
              {updatingBudget ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <View style={styles.saveBudgetRow}>
                  <Check size={16} color="#FFFFFF" />
                  <Text style={styles.saveBudgetText}>Confirm Budget</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
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
    width: 36,
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  addCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  addCardLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  addInputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
  },
  addBtn: {
    backgroundColor: '#0F382C',
    borderRadius: 12,
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnDisabled: {
    opacity: 0.5,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
    marginBottom: 12,
    marginLeft: 4,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingBottom: 24,
  },
  catItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  catLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  catIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  catName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  catType: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  catActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  budgetActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#ECFDF5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  budgetBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F382C',
  },
  deleteBtn: {
    padding: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 16,
  },
  highlightCat: {
    fontWeight: '700',
    color: '#0F172A',
  },
  budgetInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: '#F8FAFC',
    marginBottom: 20,
  },
  currencyPrefix: {
    fontSize: 18,
    fontWeight: '700',
    color: '#64748B',
    marginRight: 8,
  },
  budgetModalInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  saveBudgetBtn: {
    backgroundColor: '#0F382C',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBudgetBtnDisabled: {
    opacity: 0.6,
  },
  saveBudgetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  saveBudgetText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
