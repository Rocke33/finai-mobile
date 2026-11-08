import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Send, Bot, Sparkles, User as UserIcon, RotateCcw, Square } from 'lucide-react-native';
import { sendChatMessageStream, getDashboardSummaryCached } from '../services/api';
import { ChatMessage, UserProfile, BudgetSummary } from '../types/finance';

interface ChatScreenProps {
  currentUser: UserProfile;
}

export const ChatScreen: React.FC<ChatScreenProps> = ({ currentUser }) => {
  const [summary, setSummary] = useState<BudgetSummary | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeBotId, setActiveBotId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const abortStreamRef = useRef<(() => void) | null>(null);
  const isUserScrolledUpRef = useRef<boolean>(false);

  // Initialize fresh chat session whenever user changes
  const initChat = useCallback(async () => {
    if (abortStreamRef.current) {
      abortStreamRef.current();
      abortStreamRef.current = null;
    }
    setIsStreaming(false);
    setActiveBotId(null);

    try {
      const sum = await getDashboardSummaryCached(currentUser.id).catch(() => null);
      setSummary(sum);

      const balance =
        sum?.total_balance ??
        Math.max(0, (sum?.monthly_income ?? 0) - (sum?.total_spent ?? 0));

      const firstName = currentUser.name.split(' ')[0] || 'there';
      const welcomeText = sum
        ? `Hello ${firstName}! 👋 Your current balance is ৳ ${balance.toLocaleString('en-US')}. How can I assist with your expenses, daily budget, or spending trends today?`
        : `Hello ${firstName}! 👋 I'm your FinAI personal finance advisor. Ask me anything about your budget, spending trends, or expense habits.`;

      setMessages([
        {
          id: `welcome-${Date.now()}`,
          sender: 'bot',
          text: welcomeText,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch {
      setMessages([
        {
          id: `welcome-${Date.now()}`,
          sender: 'bot',
          text: `Hello ${currentUser.name.split(' ')[0]}! 👋 How can I help optimize your finances today?`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }
  }, [currentUser]);

  useEffect(() => {
    initChat();
    return () => {
      if (abortStreamRef.current) {
        abortStreamRef.current();
      }
    };
  }, [initChat]);

  const handleResetChat = () => {
    Alert.alert('Reset Chat', 'Clear chat history and start a fresh session?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: async () => {
          setRefreshing(true);
          await initChat();
          setRefreshing(false);
        },
      },
    ]);
  };

  const handleStopStreaming = () => {
    if (abortStreamRef.current) {
      abortStreamRef.current();
      abortStreamRef.current = null;
    }
    setIsStreaming(false);
    setActiveBotId(null);
  };

  const handleSend = async (messageToSend?: string) => {
    const text = (messageToSend || inputText).trim();
    if (!text || isStreaming) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text,
      time: timeStr,
    };

    const botMessageId = `bot-${Date.now() + 1}`;
    const initialBotMessage: ChatMessage = {
      id: botMessageId,
      sender: 'bot',
      text: '',
      time: timeStr,
    };

    setMessages((prev) => [...prev, userMessage, initialBotMessage]);
    setInputText('');
    setIsStreaming(true);
    setActiveBotId(botMessageId);
    isUserScrolledUpRef.current = false;

    // Smooth scroll down to new user query
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 60);

    const cancelStream = sendChatMessageStream(
      text,
      (chunk) => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === botMessageId ? { ...msg, text: msg.text + chunk } : msg
          )
        );

        // Only auto-scroll if the user hasn't scrolled up to read earlier history
        if (!isUserScrolledUpRef.current) {
          flatListRef.current?.scrollToEnd({ animated: false });
        }
      },
      (fullText) => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === botMessageId
              ? {
                  ...msg,
                  text: fullText.trim() || 'I reviewed your request, but received no specific recommendation.',
                }
              : msg
          )
        );
        setIsStreaming(false);
        setActiveBotId(null);
        abortStreamRef.current = null;
      },
      (error) => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === botMessageId
              ? {
                  ...msg,
                  text:
                    msg.text ||
                    error.message ||
                    'Sorry, I encountered an issue connecting to FinAI. Please try again.',
                }
              : msg
          )
        );
        setIsStreaming(false);
        setActiveBotId(null);
        abortStreamRef.current = null;
      }
    );

    abortStreamRef.current = cancelStream;
  };

  // Scroll listener to detect if the user scrolled upward
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - (layoutMeasurement.height + contentOffset.y);
    // User is considered scrolled up if they are more than 60px away from bottom
    isUserScrolledUpRef.current = distanceFromBottom > 60;
  };

  // Context-aware dynamic suggested prompts based on actual live data
  const dynamicPrompts = React.useMemo(() => {
    const prompts = [
      'How can I save more this month?',
      'Suggest 3 ways to reduce utility bills',
    ];

    if (summary && summary.categories && summary.categories.length > 0) {
      const topCat = summary.categories[0]?.category;
      if (topCat) {
        prompts.unshift(`How can I cut spending on ${topCat}?`);
      }
    }

    if (summary && summary.total_spent > (summary.monthly_income || 0) * 0.8) {
      prompts.push('Am I at risk of overspending?');
    } else {
      prompts.push('What is my recommended daily budget?');
    }

    return prompts.slice(0, 4);
  }, [summary]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.botAvatar}>
            <Sparkles size={18} color="#10B981" />
          </View>
          <View>
            <Text style={styles.headerTitle}>FinAI Advisor</Text>
            <View style={styles.statusRow}>
              <View style={[styles.onlineDot, isStreaming && styles.onlineDotStreaming]} />
              <Text style={styles.statusText}>
                {isStreaming ? 'Streaming advice...' : 'Active Intelligence'}
              </Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={styles.resetBtn}
          onPress={handleResetChat}
          disabled={refreshing || isStreaming}
          activeOpacity={0.7}
        >
          {refreshing ? (
            <ActivityIndicator size="small" color="#0F382C" />
          ) : (
            <RotateCcw size={16} color="#64748B" />
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          renderItem={({ item }) => {
            const isBot = item.sender === 'bot';
            const isThisStreaming = isStreaming && activeBotId === item.id;
            const isWaitingFirstToken = isThisStreaming && !item.text;

            return (
              <View
                style={[
                  styles.messageRow,
                  isBot ? styles.botMessageRow : styles.userMessageRow,
                ]}
              >
                {isBot && (
                  <View style={styles.botIconMini}>
                    <Bot size={14} color="#0F382C" />
                  </View>
                )}

                <View
                  style={[
                    styles.bubble,
                    isBot ? styles.botBubble : styles.userBubble,
                  ]}
                >
                  {isWaitingFirstToken ? (
                    <View style={styles.typingContainer}>
                      <ActivityIndicator size="small" color="#0F382C" />
                      <Text style={styles.typingText}>FinAI is analyzing your finances...</Text>
                    </View>
                  ) : (
                    <>
                      <Text
                        style={[
                          styles.messageText,
                          isBot ? styles.botMessageText : styles.userMessageText,
                        ]}
                      >
                        {item.text}
                        {isThisStreaming ? <Text style={styles.cursorText}> ▋</Text> : null}
                      </Text>
                      <Text
                        style={[
                          styles.timestampText,
                          isBot ? styles.botTimestamp : styles.userTimestamp,
                        ]}
                      >
                        {item.time}
                      </Text>
                    </>
                  )}
                </View>

                {!isBot && (
                  <View style={styles.userIconMini}>
                    <UserIcon size={14} color="#FFFFFF" />
                  </View>
                )}
              </View>
            );
          }}
        />

        {/* Suggestion Chips */}
        {messages.length <= 2 && !isStreaming && (
          <View style={styles.promptsContainer}>
            <Text style={styles.promptsLabel}>SUGGESTED QUESTIONS</Text>
            <View style={styles.promptsWrap}>
              {dynamicPrompts.map((prompt, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.promptChip}
                  onPress={() => handleSend(prompt)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.promptChipText}>{prompt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Bottom Input Field & Streaming Controls */}
        <View style={styles.inputArea}>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textInput}
              placeholder={isStreaming ? 'FinAI is answering...' : 'Ask FinAI about your budget...'}
              placeholderTextColor="#94A3B8"
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={500}
              editable={!isStreaming}
            />

            {isStreaming ? (
              <TouchableOpacity
                style={styles.stopBtn}
                onPress={handleStopStreaming}
                activeOpacity={0.8}
              >
                <Square size={14} fill="#DC2626" color="#DC2626" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[
                  styles.sendBtn,
                  !inputText.trim() && styles.sendBtnDisabled,
                ]}
                onPress={() => handleSend()}
                disabled={!inputText.trim()}
                activeOpacity={0.8}
              >
                <Send size={16} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  container: {
    flex: 1,
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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  resetBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  botAvatar: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#07241A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  onlineDotStreaming: {
    backgroundColor: '#3B82F6',
  },
  statusText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  messageRow: {
    flexDirection: 'row',
    marginVertical: 6,
    alignItems: 'flex-end',
    gap: 8,
  },
  botMessageRow: {
    justifyContent: 'flex-start',
  },
  userMessageRow: {
    justifyContent: 'flex-end',
  },
  botIconMini: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  userIconMini: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#0F382C',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  botBubble: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  userBubble: {
    backgroundColor: '#0F382C',
    borderBottomRightRadius: 4,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  botMessageText: {
    color: '#0F172A',
  },
  userMessageText: {
    color: '#FFFFFF',
  },
  cursorText: {
    color: '#10B981',
    fontWeight: '900',
  },
  timestampText: {
    fontSize: 10,
    marginTop: 4,
    textAlign: 'right',
  },
  botTimestamp: {
    color: '#94A3B8',
  },
  userTimestamp: {
    color: '#A7F3D0',
  },
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  typingText: {
    fontSize: 12,
    color: '#64748B',
    fontStyle: 'italic',
  },
  promptsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  promptsLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  promptsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  promptChip: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  promptChipText: {
    fontSize: 12,
    color: '#0F172A',
    fontWeight: '600',
  },
  inputArea: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 4,
    minHeight: 46,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    maxHeight: 100,
    paddingVertical: 6,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0F382C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#E2E8F0',
  },
  stopBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
