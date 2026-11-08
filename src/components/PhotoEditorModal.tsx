import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RotateCw, Crop, RotateCcw, Check, X } from 'lucide-react-native';
import * as ImageManipulator from 'expo-image-manipulator';

interface PhotoEditorModalProps {
  visible: boolean;
  imageUri: string | null;
  onCancel: () => void;
  onConfirm: (finalUri: string) => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PREVIEW_SIZE = Math.min(SCREEN_WIDTH - 48, 320);

export const PhotoEditorModal: React.FC<PhotoEditorModalProps> = ({
  visible,
  imageUri,
  onCancel,
  onConfirm,
}) => {
  const [rotation, setRotation] = useState<number>(0);
  const [isSquareCropped, setIsSquareCropped] = useState<boolean>(true);
  const [processing, setProcessing] = useState<boolean>(false);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    if (visible && imageUri) {
      setRotation(0);
      setIsSquareCropped(true);
      setProcessing(false);
      Image.getSize(
        imageUri,
        (width, height) => setImageDimensions({ width, height }),
        (err) => console.warn('Could not read image dimensions:', err)
      );
    }
  }, [visible, imageUri]);

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleToggleCrop = () => {
    setIsSquareCropped((prev) => !prev);
  };

  const handleReset = () => {
    setRotation(0);
    setIsSquareCropped(true);
  };

  const handleDone = async () => {
    if (!imageUri) return;
    setProcessing(true);

    try {
      const actions: ImageManipulator.Action[] = [];

      // 1. Rotation action
      if (rotation !== 0) {
        actions.push({ rotate: rotation });
      }

      // 2. Square center crop action
      if (isSquareCropped && imageDimensions) {
        // Account for 90 or 270 degree rotation swapping width & height
        const isSwapped = rotation === 90 || rotation === 270;
        const srcWidth = isSwapped ? imageDimensions.height : imageDimensions.width;
        const srcHeight = isSwapped ? imageDimensions.width : imageDimensions.height;
        const cropSize = Math.min(srcWidth, srcHeight);
        const originX = Math.max(0, Math.floor((srcWidth - cropSize) / 2));
        const originY = Math.max(0, Math.floor((srcHeight - cropSize) / 2));

        actions.push({
          crop: {
            originX,
            originY,
            width: cropSize,
            height: cropSize,
          },
        });
      }

      // 3. Resize to high-density avatar dimensions (max 600x600)
      actions.push({
        resize: { width: 600, height: 600 },
      });

      const manipResult = await ImageManipulator.manipulateAsync(
        imageUri,
        actions,
        {
          compress: 0.85,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );

      onConfirm(manipResult.uri);
    } catch (err: any) {
      console.error('Image manipulation failed:', err);
      Alert.alert(
        'Save Error',
        'Failed to process edited photo. Using original image instead.',
        [
          {
            text: 'Use Original',
            onPress: () => onConfirm(imageUri),
          },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    } finally {
      setProcessing(false);
    }
  };

  if (!imageUri) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onCancel}>
      <SafeAreaView style={styles.container}>
        {/* Top Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onCancel} style={styles.headerBtn} disabled={processing}>
            <X size={22} color="#0F172A" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Profile Photo</Text>
          <View style={styles.headerRightSpacer} />
        </View>

        {/* Image Preview Box */}
        <View style={styles.previewContainer}>
          <View
            style={[
              styles.previewBox,
              isSquareCropped ? styles.previewSquare : styles.previewNatural,
            ]}
          >
            <Image
              source={{ uri: imageUri }}
              style={[
                styles.previewImage,
                {
                  transform: [{ rotate: `${rotation}deg` }],
                },
              ]}
              resizeMode="cover"
            />
          </View>
          <Text style={styles.aspectHint}>
            {isSquareCropped ? 'Square 1:1 Crop Active' : 'Natural Aspect Ratio'}
          </Text>
        </View>

        {/* Editing Tools Bar */}
        <View style={styles.toolsCard}>
          <Text style={styles.toolsLabel}>PHOTO ADJUSTMENTS</Text>
          <View style={styles.toolsRow}>
            {/* Rotate Button */}
            <TouchableOpacity
              style={styles.toolBtn}
              onPress={handleRotate}
              disabled={processing}
              activeOpacity={0.7}
            >
              <View style={styles.toolIconBox}>
                <RotateCw size={20} color="#0F382C" />
              </View>
              <Text style={styles.toolBtnText}>Rotate ({rotation}°)</Text>
            </TouchableOpacity>

            {/* Crop Button */}
            <TouchableOpacity
              style={[styles.toolBtn, isSquareCropped && styles.toolBtnActive]}
              onPress={handleToggleCrop}
              disabled={processing}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.toolIconBox,
                  isSquareCropped && { backgroundColor: '#ECFDF5' },
                ]}
              >
                <Crop size={20} color={isSquareCropped ? '#10B981' : '#0F382C'} />
              </View>
              <Text style={[styles.toolBtnText, isSquareCropped && styles.toolBtnTextActive]}>
                {isSquareCropped ? '1:1 Square' : 'Full Image'}
              </Text>
            </TouchableOpacity>

            {/* Reset Button */}
            <TouchableOpacity
              style={styles.toolBtn}
              onPress={handleReset}
              disabled={processing}
              activeOpacity={0.7}
            >
              <View style={styles.toolIconBox}>
                <RotateCcw size={20} color="#64748B" />
              </View>
              <Text style={styles.toolBtnText}>Reset</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Bottom Actions: Cancel & Done/OK */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={onCancel}
            disabled={processing}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.doneBtn, processing && styles.doneBtnDisabled]}
            onPress={handleDone}
            disabled={processing}
            activeOpacity={0.8}
          >
            {processing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <View style={styles.doneBtnRow}>
                <Check size={18} color="#FFFFFF" />
                <Text style={styles.doneBtnText}>Done / Save Photo</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerRightSpacer: {
    width: 34,
  },
  previewContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
  },
  previewBox: {
    width: PREVIEW_SIZE,
    height: PREVIEW_SIZE,
    overflow: 'hidden',
    backgroundColor: '#E2E8F0',
    borderWidth: 3,
    borderColor: '#0F382C',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  previewSquare: {
    borderRadius: PREVIEW_SIZE / 2,
  },
  previewNatural: {
    borderRadius: 16,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  aspectHint: {
    marginTop: 12,
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  toolsCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  toolsLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  toolsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  toolBtn: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  toolBtnActive: {
    backgroundColor: '#F0FDF4',
  },
  toolIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  toolBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  toolBtnTextActive: {
    color: '#0F382C',
    fontWeight: '800',
  },
  bottomBar: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 12,
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },
  doneBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#0F382C',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F382C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  doneBtnDisabled: {
    opacity: 0.6,
  },
  doneBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  doneBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
