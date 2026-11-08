import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { NavigationBar } from 'expo-navigation-bar';
import * as LocalAuthentication from 'expo-local-authentication';
import { Fingerprint } from 'lucide-react-native';

import { AuthScreen } from './src/screens/AuthScreen';
import { AppNavigator } from './src/navigation/AppNavigator';
import { NetworkStatusBanner } from './src/components/NetworkStatusBanner';
import {
  getStoredUser,
  clearAuthSession,
  isBiometricEnabled,
  setOnAuthFailure,
} from './src/services/api';
import { UserProfile } from './src/types/finance';

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [biometricFailedUser, setBiometricFailedUser] = useState<UserProfile | null>(null);

  // Register global 401 session expiration listener
  useEffect(() => {
    setOnAuthFailure(() => {
      setCurrentUser(null);
      setBiometricFailedUser(null);
      Alert.alert(
        'Session Expired',
        'Your security session has expired. Please sign in again to continue.'
      );
    });

    return () => {
      setOnAuthFailure(null);
    };
  }, []);

  const authenticateWithBiometrics = async (user: UserProfile) => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (hasHardware && isEnrolled) {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Unlock FinAI',
          fallbackLabel: 'Use Password',
          cancelLabel: 'Cancel',
        });

        if (result.success) {
          setCurrentUser(user);
          setBiometricFailedUser(null);
        } else {
          setBiometricFailedUser(user);
        }
      } else {
        setCurrentUser(user);
        setBiometricFailedUser(null);
      }
    } catch (err) {
      console.error('Biometric authentication error:', err);
      setBiometricFailedUser(user);
    }
  };

  useEffect(() => {
    async function restoreSession() {
      try {
        const [user, bioEnabled] = await Promise.all([
          getStoredUser(),
          isBiometricEnabled(),
        ]);

        if (user) {
          if (bioEnabled) {
            await authenticateWithBiometrics(user);
          } else {
            setCurrentUser(user);
          }
        }
      } catch (err) {
        console.error('Session restore failed:', err);
      } finally {
        setIsInitializing(false);
      }
    }

    restoreSession();
  }, []);

  const handleLogout = async () => {
    try {
      await clearAuthSession();
      setCurrentUser(null);
      setBiometricFailedUser(null);
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  if (isInitializing) {
    return (
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <NavigationBar style="light" />
        <NetworkStatusBanner />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#E5484D" />
        </View>
      </SafeAreaProvider>
    );
  }

  if (!currentUser && biometricFailedUser) {
    return (
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <NavigationBar style="light" />
        <NetworkStatusBanner />
        <View style={styles.lockContainer}>
          <View style={styles.lockIconBox}>
            <Fingerprint size={48} color="#0F382C" />
          </View>
          <Text style={styles.lockTitle}>FinAI is Locked</Text>
          <Text style={styles.lockSubtitle}>
            Authenticate with biometrics to access your account for {biometricFailedUser.email}
          </Text>

          <TouchableOpacity
            style={styles.unlockBtn}
            onPress={() => authenticateWithBiometrics(biometricFailedUser)}
            activeOpacity={0.8}
          >
            <Text style={styles.unlockBtnText}>Unlock with Biometrics</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.switchAuthBtn}
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <Text style={styles.switchAuthBtnText}>Log In with Password Instead</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <NavigationBar style="light" />
      <NetworkStatusBanner />

      {!currentUser ? (
        <AuthScreen onAuthSuccess={(user) => setCurrentUser(user)} />
      ) : (
        <AppNavigator
          key={currentUser.id}
          currentUser={currentUser}
          onLogout={handleLogout}
          onSwitchUser={(user) => setCurrentUser(user)}
        />
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  lockContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#F8FAFC',
  },
  lockIconBox: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  lockTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
  },
  lockSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 28,
  },
  unlockBtn: {
    backgroundColor: '#0F382C',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  unlockBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  switchAuthBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  switchAuthBtnText: {
    color: '#E5484D',
    fontSize: 13,
    fontWeight: '600',
  },
});