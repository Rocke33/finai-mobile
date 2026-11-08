import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  PieChart as PieChartIcon,
  Target,
  Layers,
  ChevronRight,
  ChevronLeft,
  X,
  Receipt,
  Calendar,
  BarChart3,
} from 'lucide-react-native';
import { PieChart, BarChart } from 'react-native-gifted-charts';

import { getDashboardSummaryCached, getTransactionsCached } from '../services/api';
import { isAllowedExpenseCategory } from '../utils/categories';
import { BudgetSummary, Transaction, UserProfile } from '../types/finance';

interface AnalyticsScreenProps {
  currentUser: UserProfile;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const PALETTE = [
  '#F97316', // Orange
  '#3B82F6', // Blue
  '#10B981', // Green
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#F59E0B', // Amber
  '#64748B', // Slate
];

export const AnalyticsScreen: React.FC<AnalyticsScreenProps> = ({ currentUser }) => {
  const [summary, setSummary] = useState<BudgetSummary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [monthOffset, setMonthOffset] = useState<number>(0);
  const [selectedCategoryName, setSelectedCategoryName] = useState<string | null>(null);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [sumRes, txRes] = await Promise.all([
        getDashboardSummaryCached(currentUser.id).catch(() => null),
        getTransactionsCached(currentUser.id).catch(() => []),
      ]);
      setSummary(sumRes);
      setTransactions(txRes || []);
    } catch (err) {
      console.error('Failed to load analytics data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUser.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Date Boundaries
  const { currentMonthLabel, selectedYear, selectedMonth } = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - monthOffset);
    return {
      currentMonthLabel: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      selectedYear: d.getFullYear(),
      selectedMonth: d.getMonth(),
    };
  }, [monthOffset]);

  // Current selected month's transactions (Expenses only)
  const filteredMonthTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (!t.date) return false;
      if (!isAllowedExpenseCategory(t.category, 'expense')) return false;
      const txDate = new Date(t.date);
      return (
        txDate.getFullYear() === selectedYear &&
        txDate.getMonth() === selectedMonth
      );
    });
  }, [transactions, selectedYear, selectedMonth]);

  // Dynamic Effective Total Spent
  const effectiveTotalSpent = useMemo(() => {
    return filteredMonthTransactions.reduce((acc, t) => acc + Number(t.amount || 0), 0);
  }, [filteredMonthTransactions]);

  const monthlyIncome = summary?.monthly_income ?? 0;
  const overallSpentPercent =
    monthlyIncome > 0 ? Math.min(100, Math.round((effectiveTotalSpent / monthlyIncome) * 100)) : 0;

  // Aggregate Category Breakdown for Selected Month
  const computedCategories = useMemo(() => {
    const catMap: Record<string, number> = {};
    filteredMonthTransactions.forEach((t) => {
      const name = (t.category || 'General').trim();
      catMap[name] = (catMap[name] || 0) + Number(t.amount || 0);
    });

    return Object.entries(catMap)
      .map(([name, spent], idx) => ({
        category: name,
        spent,
        color: PALETTE[idx % PALETTE.length],
      }))
      .sort((a, b) => b.spent - a.spent);
  }, [filteredMonthTransactions]);

  // 1. Data Formatter for Pie Chart
  const pieChartData = useMemo(() => {
    if (computedCategories.length === 0 || effectiveTotalSpent <= 0) {
      return [{ value: 1, color: '#E2E8F0', text: '' }];
    }

    return computedCategories.map((c) => {
      const pct = Math.round((c.spent / effectiveTotalSpent) * 100);
      return {
        value: Number(c.spent),
        color: c.color,
        text: pct >= 8 ? `${pct}%` : '',
        textColor: '#FFFFFF',
        textSize: 11,
        fontWeight: 'bold',
      };
    });
  }, [computedCategories, effectiveTotalSpent]);

  // 2. Data Formatter for 4-Week Bar Chart with Headroom Calculation
  const { weeklyBarData, maxBarValue } = useMemo(() => {
    const now = new Date();
    const oneDay = 24 * 60 * 60 * 1000;
    const weekTotals = [0, 0, 0, 0];

    transactions.forEach((tx) => {
      if (!tx.date || !isAllowedExpenseCategory(tx.category, 'expense')) return;
      const txDate = new Date(tx.date);
      const diffDays = Math.floor((now.getTime() - txDate.getTime()) / oneDay);

      if (diffDays >= 0 && diffDays < 7) {
        weekTotals[3] += Number(tx.amount || 0);
      } else if (diffDays >= 7 && diffDays < 14) {
        weekTotals[2] += Number(tx.amount || 0);
      } else if (diffDays >= 14 && diffDays < 21) {
        weekTotals[1] += Number(tx.amount || 0);
      } else if (diffDays >= 21 && diffDays < 28) {
        weekTotals[0] += Number(tx.amount || 0);
      }
    });

    const rawMax = Math.max(...weekTotals, 100);
    // 20% ceiling buffer so the highest bar never hits the top edge
    const calculatedMax = Math.ceil(rawMax * 1.20);

    const barData = [
      {
        value: Math.round(weekTotals[0]),
        label: 'W1',
        topLabelComponent: () => (
          <Text style={styles.barTopLabel}>{weekTotals[0] > 0 ? `৳${Math.round(weekTotals[0])}` : ''}</Text>
        ),
        frontColor: '#0F382C',
      },
      {
        value: Math.round(weekTotals[1]),
        label: 'W2',
        topLabelComponent: () => (
          <Text style={styles.barTopLabel}>{weekTotals[1] > 0 ? `৳${Math.round(weekTotals[1])}` : ''}</Text>
        ),
        frontColor: '#0F382C',
      },
      {
        value: Math.round(weekTotals[2]),
        label: 'W3',
        topLabelComponent: () => (
          <Text style={styles.barTopLabel}>{weekTotals[2] > 0 ? `৳${Math.round(weekTotals[2])}` : ''}</Text>
        ),
        frontColor: '#0F382C',
      },
      {
        value: Math.round(weekTotals[3]),
        label: 'W4 (Now)',
        topLabelComponent: () => (
          <Text style={styles.barTopLabel}>{weekTotals[3] > 0 ? `৳${Math.round(weekTotals[3])}` : ''}</Text>
        ),
        frontColor: '#E5484D',
      },
    ];

    return {
      weeklyBarData: barData,
      maxBarValue: calculatedMax,
    };
  }, [transactions]);

  // Drilldown modal transactions
  const modalTransactions = useMemo(() => {
    if (!selectedCategoryName) return [];
    return filteredMonthTransactions.filter(
      (t) => (t.category || '').trim().toLowerCase() === selectedCategoryName.trim().toLowerCase()
    );
  }, [filteredMonthTransactions, selectedCategoryName]);

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#E5484D" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.headerIconBox}>
            <PieChartIcon size={18} color="#0F382C" />
          </View>
          <Text style={styles.headerTitle}>Spending Analytics</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadData(true)}
            tintColor="#E5484D"
          />
        }
      >
        {/* Month Selector Bar */}
        <View style={styles.monthSelector}>
          <TouchableOpacity
            style={styles.monthNavBtn}
            onPress={() => setMonthOffset((prev) => prev + 1)}
            activeOpacity={0.7}
          >
            <ChevronLeft size={16} color="#0F172A" />
          </TouchableOpacity>

          <View style={styles.monthTitleWrapper}>
            <Calendar size={13} color="#E5484D" />
            <Text style={styles.monthTitleText}>{currentMonthLabel}</Text>
          </View>

          <TouchableOpacity
            style={[styles.monthNavBtn, monthOffset === 0 && styles.monthNavBtnDisabled]}
            onPress={() => setMonthOffset((prev) => Math.max(0, prev - 1))}
            disabled={monthOffset === 0}
            activeOpacity={0.7}
          >
            <ChevronRight size={16} color={monthOffset === 0 ? '#CBD5E1' : '#0F172A'} />
          </TouchableOpacity>
        </View>

        {/* Master Budget Usage Card */}
        <View style={styles.overviewCard}>
          <View style={styles.overviewTopRow}>
            <View>
              <Text style={styles.overviewLabel}>MONTHLY USAGE RATIO</Text>
              <Text style={styles.overviewPercent}>{overallSpentPercent}%</Text>
            </View>
            <View style={styles.badgeTarget}>
              <Target size={14} color="#10B981" />
              <Text style={styles.badgeTargetText}>
                {monthOffset === 0 ? 'Active Period' : 'Archived Month'}
              </Text>
            </View>
          </View>

          <View style={styles.progressBarTrack}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${overallSpentPercent}%`,
                  backgroundColor:
                    overallSpentPercent >= 90
                      ? '#DC2626'
                      : overallSpentPercent >= 75
                      ? '#F59E0B'
                      : '#10B981',
                },
              ]}
            />
          </View>

          <View style={styles.metricsSplit}>
            <View style={styles.metricItem}>
              <View style={[styles.metricDot, { backgroundColor: '#10B981' }]} />
              <View>
                <Text style={styles.metricLabel}>Income Target</Text>
                <Text style={styles.metricVal}>৳ {monthlyIncome.toLocaleString('en-US')}</Text>
              </View>
            </View>

            <View style={styles.splitDivider} />

            <View style={styles.metricItem}>
              <View style={[styles.metricDot, { backgroundColor: '#EF4444' }]} />
              <View>
                <Text style={styles.metricLabel}>Month Spent</Text>
                <Text style={styles.metricVal}>
                  ৳ {Number(effectiveTotalSpent).toLocaleString('en-US', { minimumFractionDigits: 1 })}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* SECTION 1: Category Expense Pie Chart */}
        <View style={styles.chartCard}>
          <View style={styles.chartTitleRow}>
            <PieChartIcon size={16} color="#0F172A" />
            <Text style={styles.chartCardTitle}>Category Expense Share</Text>
          </View>

          {computedCategories.length === 0 || effectiveTotalSpent <= 0 ? (
            <View style={styles.chartEmpty}>
              <Text style={styles.chartEmptyText}>No expenses logged for {currentMonthLabel}.</Text>
            </View>
          ) : (
            <View style={styles.pieContainer}>
              <View style={styles.pieWrapper}>
                <PieChart
                  data={pieChartData}
                  donut
                  radius={75}
                  innerRadius={50}
                  innerCircleColor={'#FFFFFF'}
                  centerLabelComponent={() => (
                    <View style={styles.donutCenter}>
                      <Text style={styles.donutCenterValue}>
                        ৳{Math.round(effectiveTotalSpent).toLocaleString('en-US')}
                      </Text>
                      <Text style={styles.donutCenterLabel}>Spent</Text>
                    </View>
                  )}
                />
              </View>

              {/* Pie Legends */}
              <View style={styles.pieLegendsList}>
                {computedCategories.map((item) => {
                  const pct = Math.round((item.spent / effectiveTotalSpent) * 100);
                  return (
                    <TouchableOpacity
                      key={item.category}
                      style={styles.legendRow}
                      onPress={() => setSelectedCategoryName(item.category)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                      <Text style={styles.legendName} numberOfLines={1}>
                        {item.category}
                      </Text>
                      <Text style={styles.legendPct}>{pct}%</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
        </View>

        {/* SECTION 2: 4-Week Comparison Bar Chart */}
        <View style={styles.chartCard}>
          <View style={styles.chartHeaderSpace}>
            <View style={styles.chartTitleRow}>
              <BarChart3 size={16} color="#0F172A" />
              <Text style={styles.chartCardTitle}>Last 4 Weeks Comparison</Text>
            </View>
            <Text style={styles.chartSubBadge}>Cost (BDT) / Week</Text>
          </View>

          <View style={styles.barContainer}>
            <BarChart
              data={weeklyBarData}
              barWidth={36}
              noOfSections={4}
              maxValue={maxBarValue}
              barBorderRadius={6}
              frontColor="#0F382C"
              yAxisThickness={0}
              xAxisThickness={1}
              xAxisColor="#E2E8F0"
              yAxisTextStyle={styles.axisLabel}
              xAxisLabelTextStyle={styles.axisLabel}
              hideRules
              isAnimated
              height={140}
              width={SCREEN_WIDTH - 120}
              spacing={28}
              topLabelContainerStyle={{ marginBottom: 4 }}
            />
          </View>
        </View>

        {/* SECTION 3: Detailed Category Breakdown List */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Layers size={16} color="#0F172A" />
            <Text style={styles.sectionTitle}>Category Breakdown</Text>
          </View>
          <Text style={styles.sectionCount}>{computedCategories.length} categories</Text>
        </View>

        {computedCategories.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No spending recorded for this period.</Text>
          </View>
        ) : (
          computedCategories.map((rawCat, idx) => {
            const spentAmount = Number(rawCat.spent || 0);
            const percent =
              effectiveTotalSpent > 0 ? Math.round((spentAmount / effectiveTotalSpent) * 100) : 0;

            return (
              <TouchableOpacity
                key={`${rawCat.category}-${idx}`}
                style={styles.categoryCard}
                onPress={() => setSelectedCategoryName(rawCat.category)}
                activeOpacity={0.7}
              >
                <View style={styles.catCardTop}>
                  <View style={styles.catNameRow}>
                    <View style={[styles.catColorIndicator, { backgroundColor: rawCat.color }]} />
                    <Text style={styles.catName}>{rawCat.category}</Text>
                  </View>
                  <View style={styles.catRightCol}>
                    <Text style={styles.catSpent}>
                      ৳ {spentAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </Text>
                    <ChevronRight size={14} color="#94A3B8" />
                  </View>
                </View>

                {/* Progress Bar */}
                <View style={styles.catProgressTrack}>
                  <View
                    style={[
                      styles.catProgressFill,
                      {
                        width: `${Math.min(100, percent)}%`,
                        backgroundColor: rawCat.color,
                      },
                    ]}
                  />
                </View>

                <View style={styles.catCardBottom}>
                  <Text style={styles.catBudgetLabel}>Share of month total</Text>
                  <Text style={styles.catPercent}>{percent}%</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Drilldown Modal Sheet */}
      <Modal
        visible={!!selectedCategoryName}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedCategoryName(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{selectedCategoryName}</Text>
                <Text style={styles.modalSubtitle}>
                  {modalTransactions.length} recorded expense
                  {modalTransactions.length === 1 ? '' : 's'} in {currentMonthLabel}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setSelectedCategoryName(null)}
                style={styles.modalCloseBtn}
              >
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalTxList} showsVerticalScrollIndicator={false}>
              {modalTransactions.length === 0 ? (
                <View style={styles.modalEmptyBox}>
                  <Text style={styles.modalEmptyText}>
                    No individual transactions found for this category in this month.
                  </Text>
                </View>
              ) : (
                modalTransactions.map((tx) => (
                  <View key={tx.id} style={styles.modalTxItem}>
                    <View style={styles.modalTxLeft}>
                      <View style={styles.modalTxIcon}>
                        <Receipt size={14} color="#E5484D" />
                      </View>
                      <View style={styles.modalTxInfo}>
                        <Text style={styles.modalTxMerchant} numberOfLines={1}>
                          {tx.merchant || tx.description || tx.note || selectedCategoryName}
                        </Text>
                        <View style={styles.modalTxDateRow}>
                          <Calendar size={11} color="#94A3B8" />
                          <Text style={styles.modalTxDate}>
                            {tx.date ? tx.date.split('T')[0] : 'Recent'}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <Text style={styles.modalTxAmount}>
                      -৳ {Number(tx.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  scrollContent: {
    padding: 20,
    gap: 16,
    paddingBottom: 40,
  },
  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  monthNavBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  monthNavBtnDisabled: {
    opacity: 0.4,
  },
  monthTitleWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  monthTitleText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  overviewCard: {
    backgroundColor: '#07241A',
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: '#0D382B',
  },
  overviewTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  overviewLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6EE7B7',
    letterSpacing: 0.6,
  },
  overviewPercent: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 2,
  },
  badgeTarget: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  badgeTargetText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#A7F3D0',
  },
  progressBarTrack: {
    height: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 5,
  },
  metricsSplit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metricDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  metricLabel: {
    fontSize: 10,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  metricVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 1,
  },
  splitDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'visible',
  },
  chartTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  chartHeaderSpace: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  chartCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  chartSubBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  chartEmpty: {
    paddingVertical: 30,
    alignItems: 'center',
  },
  chartEmptyText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  pieContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 8,
  },
  pieWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutCenterValue: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
  },
  donutCenterLabel: {
    fontSize: 9,
    color: '#64748B',
    fontWeight: '700',
  },
  pieLegendsList: {
    flex: 1,
    marginLeft: 16,
    gap: 8,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  legendName: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  legendPct: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
    marginLeft: 4,
  },
  barContainer: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 4,
    overflow: 'visible',
  },
  barTopLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0F172A',
  },
  axisLabel: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  sectionCount: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyText: {
    fontSize: 13,
    color: '#64748B',
  },
  categoryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  catCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  catNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  catColorIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  catName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  catRightCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  catSpent: {
    fontSize: 14,
    fontWeight: '800',
    color: '#E5484D',
  },
  catProgressTrack: {
    height: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 3,
    overflow: 'hidden',
  },
  catProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  catCardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  catBudgetLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  catPercent: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
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
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 6,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  modalTxList: {
    maxHeight: 340,
  },
  modalEmptyBox: {
    padding: 24,
    alignItems: 'center',
  },
  modalEmptyText: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
  },
  modalTxItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTxLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 10,
  },
  modalTxIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTxInfo: {
    flex: 1,
  },
  modalTxMerchant: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalTxDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  modalTxDate: {
    fontSize: 11,
    color: '#64748B',
  },
  modalTxAmount: {
    fontSize: 13,
    fontWeight: '800',
    color: '#E5484D',
  },
});