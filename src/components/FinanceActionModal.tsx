import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { X, Check, Plus, Tag, Calendar as CalendarIcon, FileText, ChevronDown, ChevronUp } from 'lucide-react-native';
import { getCategoriesApi, createCategoryApi } from '../services/api';
import { CategoryItem } from '../types/finance';
import { filterExpenseCategories, DEFAULT_EXPENSE_CATEGORIES, isAllowedExpenseCategory } from '../utils/categories';

export type ActionModalType = 'expense' | 'income' | null;

interface FinanceActionModalProps {
  type: ActionModalType;
  onClose: () => void;
  onSaveExpense: (
    amount: number,
    category: string,
    merchant: string,
    date: string
  ) => Promise<void>;
  onSaveIncome: (amount: number) => Promise<void>;
}

const formatDateToISO = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const FinanceActionModal: React.FC<FinanceActionModalProps> = ({
  type,
  onClose,
  onSaveExpense,
  onSaveIncome,
}) => {
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);

  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [fetchingCategories, setFetchingCategories] = useState(false);

  // Dropdown & Inline Creation State
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categorySubmitting, setCategorySubmitting] = useState(false);

  useEffect(() => {
    if (type === 'expense') {
      fetchLiveCategories();
      setSelectedDate(new Date());
      setIsDropdownOpen(false);
      setIsCreatingCategory(false);
      setShowDatePicker(false);
    }
  }, [type]);

  const fetchLiveCategories = async () => {
    setFetchingCategories(true);
    try {
      const fetched: CategoryItem[] = await getCategoriesApi();

      // Centralized Expense-Only Category Filter
      const expenseCats = filterExpenseCategories(fetched).map((c) => c.name.trim());

      if (expenseCats.length > 0) {
        setCategories(expenseCats);
        setSelectedCategory(expenseCats[0]);
      } else {
        setCategories(DEFAULT_EXPENSE_CATEGORIES);
        setSelectedCategory(DEFAULT_EXPENSE_CATEGORIES[0] || 'Food');
      }
    } catch (err) {
      console.error('Failed to fetch categories:', err);
      setCategories(DEFAULT_EXPENSE_CATEGORIES);
      setSelectedCategory(DEFAULT_EXPENSE_CATEGORIES[0] || 'Food');
    } finally {
      setFetchingCategories(false);
    }
  };

  const handleCreateCategory = async () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) {
      Alert.alert('Required', 'Please enter a category name.');
      return;
    }

    if (!isAllowedExpenseCategory(trimmed, 'expense')) {
      Alert.alert('Invalid Category', 'Savings and Income categories are not permitted. Please specify an expense category.');
      return;
    }

    setCategorySubmitting(true);
    try {
      const created = await createCategoryApi({ name: trimmed, type: 'expense' });
      const updatedList = [created.name.trim(), ...categories.filter((c) => c !== created.name.trim())];
      setCategories(updatedList);
      setSelectedCategory(created.name.trim());
      setNewCategoryName('');
      setIsCreatingCategory(false);
      setIsDropdownOpen(false);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not create category.');
    } finally {
      setCategorySubmitting(false);
    }
  };

  const handleDateChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (event.type === 'set' && date) {
      setSelectedDate(date);
    }
  };

  if (!type) return null;

  const handleSubmit = async () => {
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter an amount greater than 0.');
      return;
    }

    setLoading(true);
    try {
      if (type === 'expense') {
        const finalCategory = selectedCategory || (categories[0] ?? 'Other');
        const finalMerchant = merchant.trim() || finalCategory;
        const finalDate = formatDateToISO(selectedDate);
        await onSaveExpense(parsedAmount, finalCategory, finalMerchant, finalDate);
      } else if (type === 'income') {
        await onSaveIncome(parsedAmount);
      }
      handleModalClose();
    } catch (err: any) {
      Alert.alert('Operation Failed', err.message || 'Unable to save record.');
    } finally {
      setLoading(false);
    }
  };

  const handleModalClose = () => {
    setAmount('');
    setMerchant('');
    setIsDropdownOpen(false);
    setIsCreatingCategory(false);
    setShowDatePicker(false);
    setNewCategoryName('');
    onClose();
  };

  return (
    <Modal visible={!!type} animationType="fade" transparent onRequestClose={handleModalClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={styles.sheetContainer}>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>
                {type === 'expense' ? 'Add New Expense' : 'Update Monthly Income'}
              </Text>
              <TouchableOpacity onPress={handleModalClose} style={styles.closeBtn}>
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Amount Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>AMOUNT (৳)</Text>
              <TextInput
                style={styles.amountInput}
                keyboardType="numeric"
                placeholder="0.00"
                placeholderTextColor="#94A3B8"
                value={amount}
                onChangeText={setAmount}
                autoFocus
              />
            </View>

            {type === 'expense' && (
              <>
                {/* Category Dropdown Section */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>CATEGORY</Text>

                  {/* Dropdown Toggle Button */}
                  <TouchableOpacity
                    style={[styles.dropdownButton, isDropdownOpen && styles.dropdownButtonActive]}
                    onPress={() => {
                      setIsDropdownOpen(!isDropdownOpen);
                      setIsCreatingCategory(false);
                    }}
                    activeOpacity={0.8}
                    disabled={fetchingCategories}
                  >
                    <View style={styles.dropdownLeft}>
                      <Tag size={16} color="#E5484D" />
                      <Text style={styles.dropdownSelectedText}>
                        {fetchingCategories
                          ? 'Loading categories...'
                          : selectedCategory || 'Select Category'}
                      </Text>
                    </View>
                    {isDropdownOpen ? (
                      <ChevronUp size={18} color="#64748B" />
                    ) : (
                      <ChevronDown size={18} color="#64748B" />
                    )}
                  </TouchableOpacity>

                  {/* Expanded Dropdown Menu */}
                  {isDropdownOpen && (
                    <View style={styles.dropdownMenu}>
                      {/* Inline Add Category Trigger / Input */}
                      {isCreatingCategory ? (
                        <View style={styles.inlineCreateBox}>
                          <TextInput
                            style={styles.inlineCategoryInput}
                            placeholder="New category name..."
                            placeholderTextColor="#94A3B8"
                            value={newCategoryName}
                            onChangeText={setNewCategoryName}
                            autoFocus
                          />
                          <TouchableOpacity
                            style={[
                              styles.inlineCreateBtn,
                              categorySubmitting && styles.btnDisabled,
                            ]}
                            onPress={handleCreateCategory}
                            disabled={categorySubmitting}
                          >
                            {categorySubmitting ? (
                              <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                              <Text style={styles.inlineCreateBtnText}>Save</Text>
                            )}
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={styles.addCategoryRow}
                          onPress={() => setIsCreatingCategory(true)}
                        >
                          <Plus size={15} color="#E5484D" />
                          <Text style={styles.addCategoryRowText}>Create New Category</Text>
                        </TouchableOpacity>
                      )}

                      <View style={styles.menuDivider} />

                      {/* Vertical Category Items */}
                      <ScrollView
                        nestedScrollEnabled
                        style={styles.dropdownScroll}
                        showsVerticalScrollIndicator={true}
                      >
                        {categories.map((cat, idx) => {
                          const isSelected = selectedCategory === cat;
                          return (
                            <TouchableOpacity
                              key={`${cat}-${idx}`}
                              style={[
                                styles.dropdownItem,
                                isSelected && styles.dropdownItemSelected,
                              ]}
                              onPress={() => {
                                setSelectedCategory(cat);
                                setIsDropdownOpen(false);
                              }}
                              activeOpacity={0.7}
                            >
                              <Text
                                style={[
                                  styles.dropdownItemText,
                                  isSelected && styles.dropdownItemTextSelected,
                                ]}
                              >
                                {cat}
                              </Text>
                              {isSelected && <Check size={16} color="#0F382C" />}
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>
                  )}
                </View>

                {/* Native Date Picker Selector */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>TRANSACTION DATE</Text>
                  <TouchableOpacity
                    style={styles.dateSelectorBtn}
                    onPress={() => setShowDatePicker(true)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.dateSelectorLeft}>
                      <CalendarIcon size={16} color="#64748B" />
                      <Text style={styles.dateSelectorText}>
                        {formatDateToISO(selectedDate)}
                      </Text>
                    </View>
                    <Text style={styles.dateChangeAction}>Change</Text>
                  </TouchableOpacity>

                  {showDatePicker && (
                    <DateTimePicker
                      value={selectedDate}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      maximumDate={new Date()}
                      onChange={handleDateChange}
                    />
                  )}
                </View>

                {/* Optional Description / Note */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>NOTE / DESCRIPTION (OPTIONAL)</Text>
                  <View style={styles.inputWithIcon}>
                    <FileText size={16} color="#64748B" />
                    <TextInput
                      style={styles.textInputWithIcon}
                      placeholder="e.g. Lunch with friends, Fuel bill"
                      placeholderTextColor="#94A3B8"
                      value={merchant}
                      onChangeText={setMerchant}
                    />
                  </View>
                </View>
              </>
            )}

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.saveBtn, loading && styles.btnDisabled]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <View style={styles.btnRow}>
                  <Check size={18} color="#FFFFFF" />
                  <Text style={styles.saveBtnText}>
                    {type === 'expense' ? 'Record Expense' : 'Save Income'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    padding: 16,
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    maxHeight: '88%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  closeBtn: {
    padding: 6,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  inputGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  amountInput: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    borderBottomWidth: 2,
    borderBottomColor: '#E5484D',
    paddingVertical: 4,
  },
  dropdownButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
  },
  dropdownButtonActive: {
    borderColor: '#0F382C',
    backgroundColor: '#FFFFFF',
  },
  dropdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dropdownSelectedText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  dropdownMenu: {
    marginTop: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  dropdownScroll: {
    maxHeight: 180,
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  dropdownItemSelected: {
    backgroundColor: '#F0FDF4',
  },
  dropdownItemText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  dropdownItemTextSelected: {
    color: '#0F382C',
    fontWeight: '800',
  },
  addCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#FEF2F2',
  },
  addCategoryRowText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#E5484D',
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  inlineCreateBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    backgroundColor: '#F8FAFC',
  },
  inlineCategoryInput: {
    flex: 1,
    height: 38,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 10,
    fontSize: 13,
    backgroundColor: '#FFFFFF',
    color: '#0F172A',
  },
  inlineCreateBtn: {
    backgroundColor: '#E5484D',
    paddingHorizontal: 14,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineCreateBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  dateSelectorBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    backgroundColor: '#F8FAFC',
  },
  dateSelectorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dateSelectorText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  dateChangeAction: {
    fontSize: 12,
    fontWeight: '700',
    color: '#E5484D',
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
    backgroundColor: '#F8FAFC',
    gap: 10,
  },
  textInputWithIcon: {
    flex: 1,
    height: '100%',
    fontSize: 13,
    color: '#0F172A',
  },
  saveBtn: {
    backgroundColor: '#E5484D',
    borderRadius: 14,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});