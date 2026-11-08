import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { WifiOff, CheckCircle2 } from 'lucide-react-native';
import { subscribeQueueChanges, drainOfflineQueue } from '../services/syncQueue';

export const NetworkStatusBanner: React.FC = () => {
  const [isOffline, setIsOffline] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [justSynced, setJustSynced] = useState(false);

  useEffect(() => {
    const unsubQueue = subscribeQueueChanges((count, syncing) => {
      setPendingCount(count);
      setIsSyncing(syncing);
      if (count === 0 && syncing === false && isOffline === false) {
        setJustSynced(true);
        const timer = setTimeout(() => setJustSynced(false), 2500);
        return () => clearTimeout(timer);
      }
    });

    const unsubNet = NetInfo.addEventListener((state) => {
      const offline = state.isConnected === false || state.isInternetReachable === false;
      setIsOffline(offline);

      if (!offline) {
        drainOfflineQueue();
      }
    });

    return () => {
      unsubQueue();
      unsubNet();
    };
  }, [isOffline]);

  if (isOffline) {
    return (
      <View style={[styles.banner, styles.offlineBanner]}>
        <WifiOff size={14} color="#FFFFFF" />
        <Text style={styles.bannerText}>
          Offline Mode {pendingCount > 0 ? `(${pendingCount} pending to sync)` : ''}
        </Text>
      </View>
    );
  }

  if (isSyncing) {
    return (
      <View style={[styles.banner, styles.syncingBanner]}>
        <ActivityIndicator size="small" color="#FFFFFF" />
        <Text style={styles.bannerText}>
          Syncing {pendingCount} offline transaction{pendingCount > 1 ? 's' : ''}...
        </Text>
      </View>
    );
  }

  if (justSynced && pendingCount === 0) {
    return (
      <View style={[styles.banner, styles.syncedBanner]}>
        <CheckCircle2 size={14} color="#FFFFFF" />
        <Text style={styles.bannerText}>All offline transactions synchronized!</Text>
      </View>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  banner: {
    paddingVertical: 7,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    zIndex: 9999,
  },
  offlineBanner: {
    backgroundColor: '#DC2626',
  },
  syncingBanner: {
    backgroundColor: '#0F382C',
  },
  syncedBanner: {
    backgroundColor: '#10B981',
  },
  bannerText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});