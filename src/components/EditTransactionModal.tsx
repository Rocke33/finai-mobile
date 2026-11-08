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
import { X, Check, Tag, Calendar as CalendarIcon, FileText } from 'lucide-react-native';
import { Transaction, CategoryItem } from '../types/finance';
import { getCategoriesApi } from '../services/api';
import { filterExpenseCategories, DEFAULT_EXPENSE_CATEGORIES } from '../utils/categories';

interface EditTransactionModalProps {
  transaction: Transaction | null;
  visible: boolean;
  onClose: () => void;
  onUpdate: (
    id: string,
    amount: number,
    category: string,
    merchant: string,
    date: string
  ) => Promise<void>;
}

const formatDateToISO = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const EditTransactionModal: React.FC<EditTransactionModalProps> = ({
  transaction,
  visible,
  onClose,
  onUpdate,
}) => {
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [category, setCategory] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (transaction) {
      setAmount(String(transaction.amount));
      setMerchant(transaction.merchant || transaction.description || transaction.note || '');
      setCategory(transaction.category || 'Food');

      if (transaction.date) {
        const parsed = new Date(transaction.date);
        setSelectedDate(isNaN(parsed.getTime()) ? new Date() : parsed);
      } else {
        setSelectedDate(new Date());
      }

      loadCategories();
    }
  }, [transaction]);

  const loadCategories = async () => {
    try {
      const fetched: CategoryItem[] = await getCategoriesApi();
      const expenseCats = filterExpenseCategories(fetched).map((c) => c.name.trim());
      if (expenseCats.length > 0) {
        setCategories(expenseCats);
      } else {
        setCategories(DEFAULT_EXPENSE_CATEGORIES);
      }
    } catch {
      setCategories(DEFAULT_EXPENSE_CATEGORIES);
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

  const handleSave = async () => {
    if (!transaction) return;

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount.');
      return;
    }

    setSaving(true);
    try {
      await onUpdate(
        transaction.id,
        parsedAmount,
        category.trim() || 'Food',
        merchant.trim() || category.trim(),
        formatDateToISO(selectedDate)
      );
      onClose();
    } catch (err: any) {
      Alert.alert('Update Failed', err.message || 'Could not update transaction.');
    } finally {
      setSaving(false);
    }
  };

  if (!visible || !transaction) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={styles.sheetContainer}>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Edit Expense</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Amount Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>AMOUNT (৳)</Text>
              <TextInput
                style={styles.amountInput}
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
              />
            </View>

            {/* Category Selector Chips */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>CATEGORY</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
                {categories.map((cat) => {
                  const isSelected = category.toLowerCase() === cat.toLowerCase();
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.categoryChip, isSelected && styles.categoryChipSelected]}
                      onPress={() => setCategory(cat)}
                      activeOpacity={0.7}
                    >
                      <Tag size={12} color={isSelected ? '#FFFFFF' : '#64748B'} />
                      <Text style={[styles.categoryChipText, isSelected && styles.categoryChipTextSelected]}>
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Merchant / Description */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>MERCHANT / DESCRIPTION</Text>
              <View style={styles.inputWrapper}>
                <FileText size={16} color="#64748B" />
                <TextInput
                  style={styles.textInput}
                  value={merchant}
                  onChangeText={setMerchant}
                  placeholder="e.g. Grocery, Lunch"
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </View>

            {/* Date Picker */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>TRANSACTION DATE</Text>
              <TouchableOpacity
                style={styles.dateSelectorBtn}
                onPress={() => setShowDatePicker(true)}
                activeOpacity={0.7}
              >
                <View style={styles.dateSelectorLeft}>
                  <CalendarIcon size={16} color="#64748B" />
                  <Text style={styles.dateSelectorText}>{formatDateToISO(selectedDate)}</Text>
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

            {/* Save Button */}
            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.btnDisabled]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <View style={styles.btnRow}>
                  <Check size={18} color="#FFFFFF" />
                  <Text style={styles.saveBtnText}>Update Transaction</Text>
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
    maxHeight: '85%',
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
    fontSize: 10,
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
  categoryRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  categoryChipSelected: {
    backgroundColor: '#0F382C',
    borderColor: '#0F382C',
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  categoryChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  inputWrapper: {
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
  textInput: {
    flex: 1,
    height: '100%',
    fontSize: 13,
    color: '#0F172A',
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
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  dateChangeAction: {
    fontSize: 12,
    fontWeight: '700',
    color: '#E5484D',
  },
  saveBtn: {
    backgroundColor: '#0F382C',
    borderRadius: 14,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
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