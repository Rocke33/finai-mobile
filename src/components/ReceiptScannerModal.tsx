import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  TextInput,
  ScrollView,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Camera, Image as ImageIcon, X, Check, Calendar as CalendarIcon, RefreshCw, Tag, DollarSign, Store } from 'lucide-react-native';
import { scanReceiptWithGemini } from '../services/api';
import { compressReceiptImage } from '../utils/imageCompressor';

interface ReceiptScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onReceiptProcessed: (data: {
    amount: number;
    category: string;
    merchant: string;
    date: string;
  }) => Promise<void>;
}

const formatDateToISO = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const ReceiptScannerModal: React.FC<ReceiptScannerModalProps> = ({
  visible,
  onClose,
  onReceiptProcessed,
}) => {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  // Parsed Form Fields
  const [merchant, setMerchant] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const [isReviewed, setIsReviewed] = useState<boolean>(false);

  const resetState = () => {
    setImageUri(null);
    setAnalyzing(false);
    setSaving(false);
    setMerchant('');
    setAmount('');
    setCategory('');
    setSelectedDate(new Date());
    setShowDatePicker(false);
    setIsReviewed(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const pickImage = async (useCamera: boolean) => {
    try {
      let result;
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Camera permission is required.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          quality: 0.8,
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Gallery permission is required.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          quality: 0.8,
        });
      }

      if (!result.canceled && result.assets && result.assets[0].uri) {
        const rawUri = result.assets[0].uri;
        // Fast downscale & compress to save bandwidth & speed up OCR
        const optimizedUri = await compressReceiptImage(rawUri);
        setImageUri(optimizedUri);
        processReceipt(optimizedUri);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Image selection failed.');
    }
  };

  const processReceipt = async (uri: string) => {
    setAnalyzing(true);
    try {
      const res = await scanReceiptWithGemini(uri);
      
      const parsedAmount = res.amount ? String(res.amount) : '';
      const parsedMerchant = res.merchant || res.store_name || '';
      const parsedCategory = res.category || 'Food';

      setAmount(parsedAmount);
      setMerchant(parsedMerchant);
      setCategory(parsedCategory);

      if (res.date) {
        const d = new Date(res.date);
        if (!isNaN(d.getTime())) {
          setSelectedDate(d);
        } else {
          setSelectedDate(new Date());
        }
      } else {
        setSelectedDate(new Date());
      }

      setIsReviewed(true);
    } catch (err: any) {
      Alert.alert(
        'Scan Failed',
        err.message || 'Gemini Vision could not parse this receipt. You can enter details manually.',
        [{ text: 'OK', onPress: () => setIsReviewed(true) }]
      );
    } finally {
      setAnalyzing(false);
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

  const handleConfirmSave = async () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please provide a valid expense amount.');
      return;
    }

    setSaving(true);
    try {
      await onReceiptProcessed({
        amount: numAmount,
        category: category.trim() || 'Food',
        merchant: merchant.trim() || 'Receipt Expense',
        date: formatDateToISO(selectedDate),
      });
      handleClose();
    } catch (err: any) {
      Alert.alert('Save Failed', err.message || 'Could not record expense.');
    } finally {
      setSaving(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Scan Receipt / Bill</Text>
              <Text style={styles.headerSubtitle}>Powered by Gemini Vision OCR</Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
              <X size={18} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Step 1: Image Capture / Select */}
            {!imageUri && (
              <View style={styles.selectBox}>
                <Text style={styles.selectPrompt}>Choose receipt capture source</Text>
                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    style={[styles.sourceBtn, styles.cameraBtn]}
                    onPress={() => pickImage(true)}
                    activeOpacity={0.8}
                  >
                    <Camera size={22} color="#FFFFFF" />
                    <Text style={styles.sourceBtnTextLight}>Camera</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.sourceBtn, styles.galleryBtn]}
                    onPress={() => pickImage(false)}
                    activeOpacity={0.8}
                  >
                    <ImageIcon size={22} color="#0F382C" />
                    <Text style={styles.sourceBtnTextDark}>Gallery</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Analyzing State */}
            {analyzing && (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color="#E5484D" />
                <Text style={styles.loadingText}>Reading receipt with Gemini Vision...</Text>
                <Text style={styles.loadingSubtext}>Extracting merchant, items, date & totals</Text>
              </View>
            )}

            {/* Step 2: Verification Form */}
            {isReviewed && !analyzing && (
              <View style={styles.reviewForm}>
                {imageUri && (
                  <View style={styles.previewRow}>
                    <Image source={{ uri: imageUri }} style={styles.previewThumb} />
                    <TouchableOpacity
                      style={styles.retakeBtn}
                      onPress={() => pickImage(true)}
                    >
                      <RefreshCw size={13} color="#E5484D" />
                      <Text style={styles.retakeText}>Retake Photo</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Amount */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>TOTAL AMOUNT (৳)</Text>
                  <View style={styles.inputWrapper}>
                    <DollarSign size={16} color="#64748B" />
                    <TextInput
                      style={styles.textInput}
                      keyboardType="numeric"
                      placeholder="0.00"
                      placeholderTextColor="#94A3B8"
                      value={amount}
                      onChangeText={setAmount}
                    />
                  </View>
                </View>

                {/* Merchant / Description */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>MERCHANT / STORE</Text>
                  <View style={styles.inputWrapper}>
                    <Store size={16} color="#64748B" />
                    <TextInput
                      style={styles.textInput}
                      placeholder="e.g. Shwapno, Agora, Fuel station"
                      placeholderTextColor="#94A3B8"
                      value={merchant}
                      onChangeText={setMerchant}
                    />
                  </View>
                </View>

                {/* Category */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>CATEGORY</Text>
                  <View style={styles.inputWrapper}>
                    <Tag size={16} color="#64748B" />
                    <TextInput
                      style={styles.textInput}
                      placeholder="e.g. Food, Groceries, Utilities"
                      placeholderTextColor="#94A3B8"
                      value={category}
                      onChangeText={setCategory}
                    />
                  </View>
                </View>

                {/* Detected / Custom Date Selector */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>RECEIPT DATE</Text>
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

                {/* Save Button */}
                <TouchableOpacity
                  style={[styles.confirmBtn, saving && styles.btnDisabled]}
                  onPress={handleConfirmSave}
                  disabled={saving}
                  activeOpacity={0.8}
                >
                  {saving ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <View style={styles.btnRow}>
                      <Check size={18} color="#FFFFFF" />
                      <Text style={styles.confirmBtnText}>Save Expense</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  scrollContent: {
    paddingBottom: 20,
  },
  selectBox: {
    paddingVertical: 24,
    alignItems: 'center',
    gap: 16,
  },
  selectPrompt: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  sourceBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  cameraBtn: {
    backgroundColor: '#E5484D',
  },
  galleryBtn: {
    backgroundColor: '#E6F4EA',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  sourceBtnTextLight: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  sourceBtnTextDark: {
    color: '#0F382C',
    fontSize: 13,
    fontWeight: '700',
  },
  loadingBox: {
    paddingVertical: 36,
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  loadingSubtext: {
    fontSize: 12,
    color: '#64748B',
  },
  reviewForm: {
    gap: 12,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 4,
  },
  previewThumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
  },
  retakeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
  },
  retakeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#E5484D',
  },
  inputGroup: {
    gap: 5,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
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
    paddingHorizontal: 12,
    height: 44,
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
    fontSize: 11,
    fontWeight: '700',
    color: '#E5484D',
  },
  confirmBtn: {
    backgroundColor: '#0F382C',
    borderRadius: 14,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});