import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Pencil, TrendingUp, TrendingDown, Sparkles } from 'lucide-react-native';
import { BudgetSummary } from '../types/finance';

interface HeroBalanceCardProps {
  summary: BudgetSummary | null;
  userName: string;
  totalBalance: number;
  avatarUri?: string | null;
  onEditIncome: () => void;
  onPressAvatar?: () => void;
}

export const HeroBalanceCard: React.FC<HeroBalanceCardProps> = ({
  summary,
  userName,
  totalBalance,
  avatarUri,
  onEditIncome,
  onPressAvatar,
}) => {
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning ☀️';
    if (hour < 18) return 'Good Afternoon 🌤️';
    return 'Good Evening 🌙';
  };

  const getInitials = (name: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const monthlyIncome = summary?.monthly_income ?? 0;
  const totalSpent = summary?.total_spent ?? 0;

  return (
    <View style={styles.cardContainer}>
      {/* Top Greeting & User Bar */}
      <View style={styles.topRow}>
        <View style={styles.userInfoLeft}>
          <TouchableOpacity onPress={onPressAvatar} activeOpacity={0.7} disabled={!onPressAvatar}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatarInitialBox}>
                <Text style={styles.avatarInitialText}>{getInitials(userName)}</Text>
              </View>
            )}
          </TouchableOpacity>
          <View>
            <Text style={styles.greetingText}>{getGreeting()}</Text>
            <Text style={styles.userNameText}>{userName}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.setIncomeBtn}
          onPress={onEditIncome}
          activeOpacity={0.8}
        >
          <Pencil size={12} color="#0F382C" />
          <Text style={styles.setIncomeBtnText}>Set Income</Text>
        </TouchableOpacity>
      </View>

      {/* Primary Balance Section */}
      <View style={styles.balanceSection}>
        <View style={styles.balanceHeaderRow}>
          <Text style={styles.balanceLabel}>TOTAL BALANCE</Text>
          <Sparkles size={12} color="#A7F3D0" />
        </View>
        <Text style={styles.balanceValue}>
          ৳ {totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
      </View>

      {/* Metrics Split Bar: Monthly Income & Total Spent */}
      <View style={styles.metricsRow}>
        <View style={styles.metricItem}>
          <View style={[styles.metricIconBox, { backgroundColor: '#064E3B' }]}>
            <TrendingUp size={14} color="#34D399" />
          </View>
          <View>
            <Text style={styles.metricLabel}>Monthly Income</Text>
            <Text style={styles.metricNumber}>
              ৳ {monthlyIncome.toLocaleString('en-US', { minimumFractionDigits: 0 })}
            </Text>
          </View>
        </View>

        <View style={styles.metricDivider} />

        <View style={styles.metricItem}>
          <View style={[styles.metricIconBox, { backgroundColor: '#451A03' }]}>
            <TrendingDown size={14} color="#F87171" />
          </View>
          <View>
            <Text style={styles.metricLabel}>Total Spent</Text>
            <Text style={styles.metricNumber}>
              ৳ {totalSpent.toLocaleString('en-US', { minimumFractionDigits: 0 })}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#07241A',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#0D382B',
    shadowColor: '#07241A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  userInfoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarImg: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    borderColor: '#10B981',
  },
  avatarInitialBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#0F382C',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#134E3A',
  },
  avatarInitialText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#34D399',
  },
  greetingText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#A7F3D0',
  },
  userNameText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 1,
  },
  setIncomeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  setIncomeBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F382C',
  },
  balanceSection: {
    marginBottom: 20,
  },
  balanceHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  balanceLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6EE7B7',
    letterSpacing: 0.6,
  },
  balanceValue: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  metricItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  metricIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  metricNumber: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 1,
  },
  metricDivider: {
    width: 1,
    height: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginHorizontal: 10,
  },
});