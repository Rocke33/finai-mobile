import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ShieldCheck, AlertCircle, TrendingUp, Sparkles, Award } from 'lucide-react-native';
import { BudgetSummary } from '../types/finance';

interface FinancialHealthCardProps {
  summary: BudgetSummary | null;
}

export const FinancialHealthCard: React.FC<FinancialHealthCardProps> = ({ summary }) => {
  const analysis = useMemo(() => {
    const income = summary?.monthly_income ?? 0;
    const spent = summary?.total_spent ?? 0;

    if (income <= 0) {
      return {
        score: 50,
        grade: 'Neutral',
        color: '#64748B',
        bgColor: '#F1F5F9',
        tip: 'Set your monthly income to unlock personalized financial health ratings.',
      };
    }

    const savings = Math.max(0, income - spent);
    const savingsRate = (savings / income) * 100;
    const burnRate = (spent / income) * 100;

    let score = 100;

    // Deduct points based on spending ratio
    if (burnRate > 100) {
      score = Math.max(20, Math.round(100 - (burnRate - 100) * 1.5 - 30));
    } else if (burnRate > 80) {
      score = Math.round(85 - (burnRate - 80) * 2);
    } else if (burnRate > 50) {
      score = Math.round(95 - (burnRate - 50) * 0.4);
    }

    if (score >= 85) {
      return {
        score,
        grade: 'Excellent',
        color: '#10B981',
        bgColor: '#ECFDF5',
        tip: `You have saved ${Math.round(savingsRate)}% of your income this month. Top-tier discipline!`,
      };
    } else if (score >= 70) {
      return {
        score,
        grade: 'Good',
        color: '#3B82F6',
        bgColor: '#EFF6FF',
        tip: `Your burn rate is manageable (${Math.round(burnRate)}%). Try funneling extra cash into savings.`,
      };
    } else if (score >= 50) {
      return {
        score,
        grade: 'Fair',
        color: '#F59E0B',
        bgColor: '#FFFBEB',
        tip: `You have consumed ${Math.round(burnRate)}% of your budget. Review discretionary expenses.`,
      };
    } else {
      return {
        score,
        grade: 'Needs Attention',
        color: '#EF4444',
        bgColor: '#FEF2F2',
        tip: 'Monthly spending exceeds your recorded income. Immediate budget adjustments recommended.',
      };
    }
  }, [summary]);

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.badgeRow}>
          <View style={[styles.iconBox, { backgroundColor: analysis.bgColor }]}>
            <Award size={16} color={analysis.color} />
          </View>
          <Text style={styles.cardHeading}>FINANCIAL HEALTH SCORE</Text>
        </View>

        <View style={[styles.statusBadge, { backgroundColor: analysis.bgColor }]}>
          <Text style={[styles.statusBadgeText, { color: analysis.color }]}>
            {analysis.grade}
          </Text>
        </View>
      </View>

      <View style={styles.scoreRow}>
        <View style={styles.scoreContainer}>
          <Text style={[styles.scoreValue, { color: analysis.color }]}>{analysis.score}</Text>
          <Text style={styles.scoreMax}>/100</Text>
        </View>

        <View style={styles.meterContainer}>
          <View style={styles.meterTrack}>
            <View
              style={[
                styles.meterFill,
                { width: `${analysis.score}%`, backgroundColor: analysis.color },
              ]}
            />
          </View>
        </View>
      </View>

      <View style={styles.tipBox}>
        <Sparkles size={14} color="#64748B" style={styles.tipIcon} />
        <Text style={styles.tipText}>{analysis.tip}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeading: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.6,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  scoreValue: {
    fontSize: 28,
    fontWeight: '900',
  },
  scoreMax: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    marginLeft: 2,
  },
  meterContainer: {
    flex: 1,
  },
  meterTrack: {
    height: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    overflow: 'hidden',
  },
  meterFill: {
    height: '100%',
    borderRadius: 4,
  },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    gap: 8,
  },
  tipIcon: {
    flexShrink: 0,
  },
  tipText: {
    flex: 1,
    fontSize: 11,
    color: '#475569',
    lineHeight: 15,
  },
});