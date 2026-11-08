import React, { useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LayoutDashboard, PieChart, MessageSquareText, Settings } from 'lucide-react-native';

import { DashboardScreen } from '../screens/DashboardScreen';
import { AnalyticsScreen } from '../screens/AnalyticsScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { CategorySettingsScreen } from '../screens/CategorySettingsScreen';
import { TransactionHistoryScreen } from '../screens/TransactionHistoryScreen';
import { updateTransactionApi } from '../services/api';
import { UserProfile } from '../types/finance';

interface AppNavigatorProps {
  currentUser: UserProfile;
  onLogout: () => void;
  onSwitchUser: (user: UserProfile) => void;
}

const Tab = createBottomTabNavigator();

export const AppNavigator: React.FC<AppNavigatorProps> = ({ currentUser, onLogout, onSwitchUser }) => {
  const [settingsSubScreen, setSettingsSubScreen] = useState<'root' | 'categories'>('root');
  const [currentView, setCurrentView] = useState<'main' | 'history'>('main');
  const insets = useSafeAreaInsets();

  if (currentView === 'history') {
    return (
      <TransactionHistoryScreen
        onBack={() => setCurrentView('main')}
        onUpdateTransaction={async (id, amount, category, merchant, date) => {
          await updateTransactionApi(id, {
            amount,
            category,
            merchant,
            description: merchant,
            date,
          });
        }}
      />
    );
  }

  return (
    <NavigationContainer key={currentUser.id}>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#0F382C',
          tabBarInactiveTintColor: '#94A3B8',
          tabBarStyle: {
            backgroundColor: '#FFFFFF',
            borderTopColor: '#F1F5F9',
            borderTopWidth: 1,
            height: 60 + insets.bottom,
            paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
            paddingTop: 8,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '700',
          },
        }}
      >
        <Tab.Screen
          name="Dashboard"
          options={{
            tabBarLabel: 'Overview',
            tabBarIcon: ({ color, size }) => <LayoutDashboard size={size} color={color} />,
          }}
          listeners={{
            tabPress: () => {
              setSettingsSubScreen('root');
            },
          }}
        >
          {() => (
            <DashboardScreen
              currentUser={currentUser}
              onLogout={onLogout}
              onNavigateHistory={() => setCurrentView('history')}
            />
          )}
        </Tab.Screen>

        <Tab.Screen
          name="Analytics"
          options={{
            tabBarLabel: 'Analytics',
            tabBarIcon: ({ color, size }) => <PieChart size={size} color={color} />,
          }}
          listeners={{
            tabPress: () => {
              setSettingsSubScreen('root');
            },
          }}
        >
          {() => <AnalyticsScreen currentUser={currentUser} />}
        </Tab.Screen>

        <Tab.Screen
          name="FinAIChat"
          options={{
            tabBarLabel: 'FinAI Advisor',
            tabBarIcon: ({ color, size }) => <MessageSquareText size={size} color={color} />,
          }}
          listeners={{
            tabPress: () => {
              setSettingsSubScreen('root');
            },
          }}
        >
          {() => <ChatScreen currentUser={currentUser} />}
        </Tab.Screen>

        <Tab.Screen
          name="SettingsTab"
          options={{
            tabBarLabel: 'Settings',
            tabBarIcon: ({ color, size }) => <Settings size={size} color={color} />,
          }}
          listeners={{
            tabPress: () => {
              setSettingsSubScreen('root');
            },
          }}
        >
          {() =>
            settingsSubScreen === 'categories' ? (
              <CategorySettingsScreen onBack={() => setSettingsSubScreen('root')} />
            ) : (
              <SettingsScreen
                currentUser={currentUser}
                onNavigateCategories={() => setSettingsSubScreen('categories')}
                onSwitchToAccount={(acc) => {
                  setSettingsSubScreen('root');
                  onSwitchUser(acc.user);
                }}
                onAddNewAccount={onLogout}
                onLogout={onLogout}
              />
            )
          }
        </Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  );
};