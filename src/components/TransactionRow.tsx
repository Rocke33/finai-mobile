import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Receipt, Calendar, Pencil, Trash2 } from 'lucide-react-native';
import { Transaction } from '../types/finance';

interface TransactionRowProps {
  item: Transaction;
  onEdit?: (item: Transaction) => void;
  onDelete?: (item: Transaction) => void;
  isDeleting?: boolean;
}

const TransactionRowComponent: React.FC<TransactionRowProps> = ({
  item,
  onEdit,
  onDelete,
  isDeleting = false,
}) => {
  const formattedAmount = Number(item.amount || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const displayTitle = item.merchant || item.description || item.note || item.category || 'Expense';
  const displayDate = item.date ? item.date.split('T')[0] : 'Recent';

  return (
    <View style={styles.card}>
      <View style={styles.left}>
        <View style={styles.iconBox}>
          <Receipt size={16} color="#E5484D" />
        </View>
        <View style={styles.details}>
          <Text style={styles.merchant} numberOfLines={1}>
            {displayTitle}
          </Text>
          <View style={styles.metaRow}>
            {item.category && <Text style={styles.category}>{item.category}</Text>}
            {item.category && <Text style={styles.dot}>•</Text>}
            <Calendar size={11} color="#94A3B8" />
            <Text style={styles.date}>{displayDate}</Text>
          </View>
        </View>
      </View>

      <View style={styles.right}>
        <Text style={styles.amount}>-৳ {formattedAmount}</Text>
        {(onEdit || onDelete) && (
          <View style={styles.actions}>
            {onEdit && (
              <TouchableOpacity
                onPress={() => onEdit(item)}
                style={styles.actionBtn}
                activeOpacity={0.7}
              >
                <Pencil size={13} color="#475569" />
              </TouchableOpacity>
            )}
            {onDelete && (
              <TouchableOpacity
                onPress={() => onDelete(item)}
                style={styles.actionBtn}
                disabled={isDeleting}
                activeOpacity={0.7}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#DC2626" />
                ) : (
                  <Trash2 size={13} color="#DC2626" />
                )}
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </View>
  );
};

export const TransactionRow = React.memo(TransactionRowComponent, (prev, next) => {
  return (
    prev.item.id === next.item.id &&
    prev.item.amount === next.item.amount &&
    prev.item.category === next.item.category &&
    prev.item.merchant === next.item.merchant &&
    prev.item.date === next.item.date &&
    prev.isDeleting === next.isDeleting
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 8,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 8,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  details: {
    flex: 1,
  },
  merchant: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  category: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  dot: {
    fontSize: 10,
    color: '#CBD5E1',
  },
  date: {
    fontSize: 11,
    color: '#64748B',
  },
  right: {
    alignItems: 'flex-end',
    gap: 6,
  },
  amount: {
    fontSize: 14,
    fontWeight: '800',
    color: '#E5484D',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
});