import React, { useState, useEffect, useCallback } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Alert,
  Image,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Mail,
  Tags,
  LogOut,
  ChevronRight,
  Shield,
  Users,
  Check,
  X,
  Trash2,
  Camera,
  Fingerprint,
  UserPlus,
} from 'lucide-react-native';
import { UserProfile } from '../types/finance';
import {
  getSavedAccounts,
  SavedAccount,
  removeSavedAccount,
  saveUserAvatarUri,
  getUserAvatarUri,
  clearUserAvatarUri,
  switchAuthAccount,
  setBiometricEnabled,
  isBiometricEnabled,
} from '../services/api';
import { ProfilePhotoActionModal } from '../components/ProfilePhotoActionModal';

interface SettingsScreenProps {
  currentUser: UserProfile;
  onBack?: () => void;
  onNavigateCategories: () => void;
  onSwitchToAccount: (account: SavedAccount) => void;
  onAddNewAccount: () => void;
  onLogout: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  currentUser,
  onBack,
  onNavigateCategories,
  onSwitchToAccount,
  onAddNewAccount,
  onLogout,
}) => {
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const [isAccountsModalOpen, setIsAccountsModalOpen] = useState(false);
  const [isPhotoActionModalOpen, setIsPhotoActionModalOpen] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [biometricsActive, setBiometricsActive] = useState(false);
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);

  const loadAccounts = useCallback(async () => {
    const list = await getSavedAccounts();
    setSavedAccounts(list);
  }, []);

  const loadAvatar = useCallback(async () => {
    const saved = await getUserAvatarUri(currentUser.id);
    setAvatarUri(saved || null);
  }, [currentUser.id]);

  const checkBiometrics = useCallback(async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const securityLevel = await LocalAuthentication.getEnrolledLevelAsync();
      const available = hasHardware || securityLevel > 0;
      setBiometricsAvailable(available);

      if (available) {
        const enabled = await isBiometricEnabled();
        setBiometricsActive(enabled);
      }
    } catch (error) {
      console.error('Biometric availability check failed:', error);
      setBiometricsAvailable(true);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
    loadAvatar();
    checkBiometrics();
  }, [currentUser.id, loadAccounts, loadAvatar, checkBiometrics]);

  const getInitials = (name: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const handleSelectAccount = async (acc: SavedAccount) => {
    if (acc.user.email === currentUser.email) {
      setIsAccountsModalOpen(false);
      return;
    }
    await switchAuthAccount(acc);
    setIsAccountsModalOpen(false);
    onSwitchToAccount(acc);
  };

  const handleRemoveAccount = (email: string) => {
    Alert.alert('Remove Account', `Remove ${email} from saved accounts on this device?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await removeSavedAccount(email);
          const updated = await getSavedAccounts();
          setSavedAccounts(updated);
          if (email === currentUser.email) {
            onLogout();
          }
        },
      },
    ]);
  };

  const handleLogoutConfirm = () => {
    Alert.alert('Sign Out', 'Are you sure you want to log out of FinAI?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: onLogout },
    ]);
  };

  const handleToggleBiometrics = async (value: boolean) => {
    try {
      if (value) {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Verify identity to enable biometric sign-in',
          fallbackLabel: 'Use device PIN / Pattern',
          disableDeviceFallback: false,
          cancelLabel: 'Cancel',
        });

        if (result.success) {
          setBiometricsActive(true);
          await setBiometricEnabled(true);
          Alert.alert('Security Updated', 'Biometric sign-in has been enabled successfully.');
        } else {
          setBiometricsActive(false);
          await setBiometricEnabled(false);
        }
      } else {
        setBiometricsActive(false);
        await setBiometricEnabled(false);
        Alert.alert('Security Updated', 'Biometric sign-in has been disabled.');
      }
    } catch (err: any) {
      console.error('Biometric toggle error:', err);
      Alert.alert('Authentication Error', err.message || 'Could not verify biometric credentials.');
      setBiometricsActive(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Top Header */}
      <View style={styles.header}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
            <ArrowLeft size={18} color="#0F172A" />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerRightPlaceholder} />
        )}
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.headerRightPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Profile Card with Tap to View/Change */}
        <View style={styles.profileCard}>
          <TouchableOpacity
            style={styles.avatarTouchable}
            onPress={() => setIsPhotoActionModalOpen(true)}
            activeOpacity={0.8}
          >
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>{getInitials(currentUser.name)}</Text>
              </View>
            )}
            <View style={styles.cameraBadge}>
              <Camera size={12} color="#FFFFFF" />
            </View>
          </TouchableOpacity>

          <Text style={styles.profileName}>{currentUser.name}</Text>
          <View style={styles.emailRow}>
            <Mail size={13} color="#64748B" />
            <Text style={styles.profileEmail}>{currentUser.email}</Text>
          </View>
        </View>

        {/* Section: Preferences & Security */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>PREFERENCES & SECURITY</Text>

          <View style={styles.cardGroup}>
            {/* Category Settings */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={onNavigateCategories}
              activeOpacity={0.7}
            >
              <View style={styles.menuLeft}>
                <View style={[styles.menuIconBox, { backgroundColor: '#FEE2E2' }]}>
                  <Tags size={16} color="#E5484D" />
                </View>

                <View>
                  <Text style={styles.menuTitle}>Category Settings</Text>
                  <Text style={styles.menuSubtitle}>
                    Add, view, or remove expense categories
                  </Text>
                </View>
              </View>

              <ChevronRight size={18} color="#94A3B8" />
            </TouchableOpacity>

            <View style={styles.itemDivider} />

            {/* Biometric Lock */}
            <View style={styles.menuItem}>
              <View style={styles.menuLeft}>
                <View style={[styles.menuIconBox, { backgroundColor: '#ECFDF5' }]}>
                  <Fingerprint size={16} color="#10B981" />
                </View>

                <View>
                  <Text style={styles.menuTitle}>Biometric Lock</Text>
                  <Text style={styles.menuSubtitle}>
                    Fast sign-in with fingerprint / face
                  </Text>
                </View>
              </View>

              <Switch
                value={biometricsActive}
                onValueChange={handleToggleBiometrics}
                trackColor={{
                  false: '#E2E8F0',
                  true: '#0F382C',
                }}
                thumbColor={biometricsActive ? '#10B981' : '#F8FAFC'}
              />
            </View>
          </View>
        </View>

        {/* Section: Accounts (Simplified to Two Main Buttons) */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ACCOUNTS</Text>
          <View style={styles.cardGroup}>
            {/* 1. Manage Accounts */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                loadAccounts();
                setIsAccountsModalOpen(true);
              }}
              activeOpacity={0.7}
            >
              <View style={styles.menuLeft}>
                <View style={[styles.menuIconBox, { backgroundColor: '#EFF6FF' }]}>
                  <Users size={16} color="#2563EB" />
                </View>
                <View>
                  <Text style={styles.menuTitle}>Manage Accounts</Text>
                  <Text style={styles.menuSubtitle}>
                    {savedAccounts.length} saved {savedAccounts.length === 1 ? 'profile' : 'profiles'} • Switch or add accounts
                  </Text>
                </View>
              </View>
              <ChevronRight size={18} color="#94A3B8" />
            </TouchableOpacity>

            <View style={styles.itemDivider} />

            {/* 2. Sign Out */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleLogoutConfirm}
              activeOpacity={0.7}
            >
              <View style={styles.menuLeft}>
                <View style={[styles.menuIconBox, { backgroundColor: '#FEF2F2' }]}>
                  <LogOut size={16} color="#DC2626" />
                </View>
                <View>
                  <Text style={[styles.menuTitle, { color: '#DC2626' }]}>Sign Out</Text>
                  <Text style={styles.menuSubtitle}>End current active session securely</Text>
                </View>
              </View>
              <ChevronRight size={18} color="#94A3B8" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Footer Meta */}
        <View style={styles.footer}>
          <View style={styles.securityTag}>
            <Shield size={12} color="#10B981" />
            <Text style={styles.securityText}>FastAPI • Encrypted Multi-Account Vault</Text>
          </View>
          <Text style={styles.versionText}>FinAI Mobile v1.0.0 (Expo SDK 58)</Text>
        </View>
      </ScrollView>

      {/* Switch Accounts Bottom Modal */}
      <Modal
        visible={isAccountsModalOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setIsAccountsModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Manage Accounts</Text>
              <TouchableOpacity
                onPress={() => setIsAccountsModalOpen(false)}
                style={styles.modalCloseBtn}
              >
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.accountsList} showsVerticalScrollIndicator={false}>
              {savedAccounts.map((item) => {
                const isCurrent = item.user.email === currentUser.email;
                return (
                  <View key={item.user.email} style={styles.accountRowContainer}>
                    <TouchableOpacity
                      style={styles.accountItem}
                      onPress={() => handleSelectAccount(item)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.accountAvatar}>
                        <Text style={styles.accountAvatarText}>
                          {getInitials(item.user.name)}
                        </Text>
                      </View>
                      <View style={styles.accountDetails}>
                        <Text style={styles.accountName}>{item.user.name}</Text>
                        <Text style={styles.accountEmail}>{item.user.email}</Text>
                      </View>
                      {isCurrent && (
                        <View style={styles.activeBadge}>
                          <Check size={14} color="#16A34A" />
                        </View>
                      )}
                    </TouchableOpacity>

                    {!isCurrent && (
                      <TouchableOpacity
                        onPress={() => handleRemoveAccount(item.user.email)}
                        style={styles.removeAccountBtn}
                      >
                        <Trash2 size={15} color="#DC2626" />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={styles.modalAddBtn}
              onPress={() => {
                setIsAccountsModalOpen(false);
                onAddNewAccount();
              }}
              activeOpacity={0.8}
            >
              <UserPlus size={16} color="#FFFFFF" />
              <Text style={styles.modalAddBtnText}>Add Another Account</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Profile Photo Action Modal (View, Change, Rotate, Crop, Done/OK) */}
      <ProfilePhotoActionModal
        visible={isPhotoActionModalOpen}
        avatarUri={avatarUri}
        userName={currentUser.name}
        onClose={() => setIsPhotoActionModalOpen(false)}
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
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  backBtn: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  headerRightPlaceholder: {
    width: 36,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  profileCard: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 20,
  },
  avatarTouchable: {
    position: 'relative',
    marginBottom: 12,
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: '#0F382C',
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#0F382C',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#10B981',
  },
  avatarText: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#0F382C',
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  profileName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  profileEmail: {
    fontSize: 13,
    color: '#64748B',
  },
  section: {
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  cardGroup: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  menuIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  menuSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  itemDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginLeft: 62,
  },
  footer: {
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 20,
  },
  securityTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  securityText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F382C',
  },
  versionText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalCloseBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  accountsList: {
    maxHeight: 260,
  },
  accountRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  accountItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  accountAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0F382C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountAvatarText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  accountDetails: {
    flex: 1,
  },
  accountName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  accountEmail: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  activeBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeAccountBtn: {
    padding: 10,
    marginLeft: 8,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
  },
  modalAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0F382C',
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 12,
  },
  modalAddBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
