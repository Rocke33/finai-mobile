import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Eye, Camera, Image as ImageIcon, Trash2, X } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { PhotoEditorModal } from './PhotoEditorModal';

interface ProfilePhotoActionModalProps {
  visible: boolean;
  avatarUri: string | null;
  userName: string;
  onClose: () => void;
  onSelectPhoto: (uri: string) => void;
  onRemovePhoto?: () => void;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const VIEWER_SIZE = Math.min(SCREEN_WIDTH - 40, SCREEN_HEIGHT * 0.45, 340);

export const ProfilePhotoActionModal: React.FC<ProfilePhotoActionModalProps> = ({
  visible,
  avatarUri,
  userName,
  onClose,
  onSelectPhoto,
  onRemovePhoto,
}) => {
  const [isViewerVisible, setIsViewerVisible] = useState(false);
  const [isChangeMenuVisible, setIsChangeMenuVisible] = useState(false);
  const [selectedForEditUri, setSelectedForEditUri] = useState<string | null>(null);

  const getInitials = (name: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const handleLaunchPicker = async (useCamera: boolean) => {
    setIsChangeMenuVisible(false);
    try {
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Camera Access Required',
            'Please enable camera permissions in your device settings to take a profile picture.'
          );
          return;
        }

        const result = await ImagePicker.launchCameraAsync({
          allowsEditing: false,
          quality: 0.9,
        });

        if (!result.canceled && result.assets && result.assets[0]?.uri) {
          setSelectedForEditUri(result.assets[0].uri);
        }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Gallery Access Required',
            'Please enable media library access in your device settings to select a profile picture.'
          );
          return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
          allowsEditing: false,
          quality: 0.9,
        });

        if (!result.canceled && result.assets && result.assets[0]?.uri) {
          setSelectedForEditUri(result.assets[0].uri);
        }
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Unable to open image source.');
    }
  };

  const handleConfirmEdit = (finalUri: string) => {
    setSelectedForEditUri(null);
    onSelectPhoto(finalUri);
    onClose();
  };

  const handleCancelEdit = () => {
    setSelectedForEditUri(null);
  };

  return (
    <>
      {/* 1. Main Options Bottom Modal: View Photo / Change Photo */}
      <Modal
        visible={visible && !isViewerVisible && !isChangeMenuVisible && !selectedForEditUri}
        transparent
        animationType="fade"
        onRequestClose={onClose}
      >
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
          <TouchableOpacity activeOpacity={1} style={styles.optionsCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.optionsTitle}>Profile Photo</Text>
                <Text style={styles.optionsSubtitle}>{userName}</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* View Photo Option */}
            <TouchableOpacity
              style={styles.optionRow}
              onPress={() => {
                if (!avatarUri) {
                  Alert.alert(
                    'No Photo Uploaded',
                    'You currently have no custom profile photo. Would you like to set one now?',
                    [
                      { text: 'Set Photo', onPress: () => setIsChangeMenuVisible(true) },
                      { text: 'Cancel', style: 'cancel' },
                    ]
                  );
                  return;
                }
                setIsViewerVisible(true);
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.iconBox, { backgroundColor: '#EFF6FF' }]}>
                <Eye size={20} color="#2563EB" />
              </View>
              <View style={styles.optionTextContainer}>
                <Text style={styles.optionTitle}>View Photo</Text>
                <Text style={styles.optionDescription}>
                  {avatarUri ? 'Preview your current profile picture' : 'No photo uploaded'}
                </Text>
              </View>
            </TouchableOpacity>

            <View style={styles.rowDivider} />

            {/* Change Photo Option */}
            <TouchableOpacity
              style={styles.optionRow}
              onPress={() => setIsChangeMenuVisible(true)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconBox, { backgroundColor: '#ECFDF5' }]}>
                <Camera size={20} color="#0F382C" />
              </View>
              <View style={styles.optionTextContainer}>
                <Text style={styles.optionTitle}>Change Photo</Text>
                <Text style={styles.optionDescription}>Choose from camera or device gallery</Text>
              </View>
            </TouchableOpacity>

            {avatarUri && onRemovePhoto ? (
              <>
                <View style={styles.rowDivider} />
                <TouchableOpacity
                  style={styles.optionRow}
                  onPress={() => {
                    Alert.alert(
                      'Remove Profile Photo',
                      'Are you sure you want to remove your profile photo?',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Remove',
                          style: 'destructive',
                          onPress: () => {
                            onRemovePhoto();
                            onClose();
                          },
                        },
                      ]
                    );
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.iconBox, { backgroundColor: '#FEF2F2' }]}>
                    <Trash2 size={20} color="#DC2626" />
                  </View>
                  <View style={styles.optionTextContainer}>
                    <Text style={[styles.optionTitle, { color: '#DC2626' }]}>Remove Photo</Text>
                    <Text style={styles.optionDescription}>Reset to default name initials</Text>
                  </View>
                </TouchableOpacity>
              </>
            ) : null}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* 2. Choose Source Modal: Camera or Gallery */}
      <Modal
        visible={isChangeMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsChangeMenuVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsChangeMenuVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.optionsCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.optionsTitle}>Change Profile Photo</Text>
                <Text style={styles.optionsSubtitle}>Select image source</Text>
              </View>
              <TouchableOpacity onPress={() => setIsChangeMenuVisible(false)} style={styles.closeBtn}>
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.optionRow}
              onPress={() => handleLaunchPicker(true)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconBox, { backgroundColor: '#F0FDF4' }]}>
                <Camera size={20} color="#16A34A" />
              </View>
              <View style={styles.optionTextContainer}>
                <Text style={styles.optionTitle}>Take Photo</Text>
                <Text style={styles.optionDescription}>Use device camera</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.rowDivider} />

            <TouchableOpacity
              style={styles.optionRow}
              onPress={() => handleLaunchPicker(false)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconBox, { backgroundColor: '#EFF6FF' }]}>
                <ImageIcon size={20} color="#2563EB" />
              </View>
              <View style={styles.optionTextContainer}>
                <Text style={styles.optionTitle}>Choose from Gallery</Text>
                <Text style={styles.optionDescription}>Select an existing image from device</Text>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* 3. Larger Preview Viewer Modal */}
      <Modal
        visible={isViewerVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setIsViewerVisible(false)}
      >
        <View style={styles.viewerOverlay}>
          <SafeAreaView style={styles.viewerSafeArea}>
            <View style={styles.viewerHeader}>
              <Text style={styles.viewerName}>{userName}</Text>
              <TouchableOpacity
                onPress={() => setIsViewerVisible(false)}
                style={styles.viewerCloseBtn}
              >
                <X size={22} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <View style={styles.viewerContent}>
              {avatarUri ? (
                <View style={styles.viewerImageWrapper}>
                  <Image source={{ uri: avatarUri }} style={styles.viewerImage} resizeMode="cover" />
                </View>
              ) : (
                <View style={[styles.viewerImageWrapper, styles.viewerInitialsBox]}>
                  <Text style={styles.viewerInitialsText}>{getInitials(userName)}</Text>
                </View>
              )}
            </View>

            <View style={styles.viewerFooter}>
              <TouchableOpacity
                style={styles.viewerChangeBtn}
                onPress={() => {
                  setIsViewerVisible(false);
                  setIsChangeMenuVisible(true);
                }}
                activeOpacity={0.8}
              >
                <Camera size={16} color="#FFFFFF" />
                <Text style={styles.viewerChangeBtnText}>Change Photo</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      {/* 4. Photo Editor Modal (Crop, Rotate, Done/OK) */}
      <PhotoEditorModal
        visible={!!selectedForEditUri}
        imageUri={selectedForEditUri}
        onCancel={handleCancelEdit}
        onConfirm={handleConfirmEdit}
      />
    </>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
    padding: 16,
  },
  optionsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
    marginBottom: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  optionsTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  optionsSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 14,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  optionDescription: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  rowDivider: {
    height: 1,
    backgroundColor: '#F8FAFC',
    marginVertical: 4,
  },
  // Viewer styles
  viewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 15, 26, 0.95)',
  },
  viewerSafeArea: {
    flex: 1,
    justifyContent: 'space-between',
  },
  viewerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  viewerName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  viewerCloseBtn: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  viewerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  viewerImageWrapper: {
    width: VIEWER_SIZE,
    height: VIEWER_SIZE,
    borderRadius: VIEWER_SIZE / 2,
    overflow: 'hidden',
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 12,
  },
  viewerImage: {
    width: '100%',
    height: '100%',
  },
  viewerInitialsBox: {
    backgroundColor: '#0F382C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerInitialsText: {
    fontSize: 72,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  viewerFooter: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    alignItems: 'center',
  },
  viewerChangeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0F382C',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  viewerChangeBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
