import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';
import { Transaction } from '../types/finance';

export async function exportTransactionsToCsv(transactions: Transaction[]): Promise<void> {
  if (!transactions || transactions.length === 0) {
    Alert.alert('No Data', 'There are no transactions available to export.');
    return;
  }

  // 1. Build CSV Header and Rows
  const headers = ['ID', 'Date', 'Category', 'Description/Merchant', 'Amount (BDT)', 'Payment Method'];
  const rows = transactions.map((t) => [
    `"${t.id}"`,
    `"${t.date ? t.date.split('T')[0] : ''}"`,
    `"${(t.category || '').replace(/"/g, '""')}"`,
    `"${(t.merchant || t.description || t.note || '').replace(/"/g, '""')}"`,
    `"${Number(t.amount).toFixed(2)}"`,
    `"${t.payment_method || 'cash'}"`,
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

  // 2. Write to Cache Directory
  const fileName = `FinAI_Transactions_${new Date().toISOString().split('T')[0]}.csv`;
  const fileUri = `${FileSystem.cacheDirectory}${fileName}`;

  try {
    await FileSystem.writeAsStringAsync(fileUri, csvContent, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    // 3. Launch Native Sharing / Save Dialog
    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/csv',
        dialogTitle: 'Export Transaction Records',
        UTI: 'public.comma-separated-values-text',
      });
    } else {
      Alert.alert('Notice', 'Sharing is not supported on this device.');
    }
  } catch (error: any) {
    console.error('CSV Export Error:', error);
    Alert.alert('Export Failed', error.message || 'Could not export CSV file.');
  }
}