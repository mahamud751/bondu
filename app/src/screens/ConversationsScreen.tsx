import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { api } from '../api/client';
import {
  Avatar,
  EmptyState,
  Eyebrow,
  Screen,
  Title,
} from '../components/UI';
import { colors, spacing } from '../theme';

export function ConversationsScreen() {
  const [data, setData] = useState<any[]>([]);
  const nav = useNavigation<any>();
  const load = useCallback(() => {
    api
      .get('/chat/conversations')
      .then((r) => setData(r.data))
      .catch(() => setData([]));
  }, []);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <Screen>
      <Eyebrow>Inbox</Eyebrow>
      <Title subtitle="Private chats with people you connect with">
        Messages
      </Title>
      <FlatList
        data={data}
        keyExtractor={(x) => x.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListEmptyComponent={
          <EmptyState
            icon="✉"
            title="No messages yet"
            body="Discover someone and start a conversation."
          />
        }
        renderItem={({ item }) => {
          const other =
            item.userOne?.profile?.displayName ??
            item.userTwo?.profile?.displayName ??
            'Conversation';
          const last = item.messages?.[0];
          return (
            <Pressable
              onPress={() =>
                nav.navigate('Chat', {
                  conversationId: item.id,
                  title: other,
                })
              }
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
            >
              <Avatar name={other} size={56} />
              <View style={styles.info}>
                <Text style={styles.name}>{other}</Text>
                <Text numberOfLines={1} style={styles.preview}>
                  {last?.content ?? 'Say hello…'}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  info: {
    flex: 1,
    marginLeft: spacing.md,
  },
  name: {
    fontWeight: '700',
    color: colors.text,
    fontSize: 16,
    letterSpacing: -0.2,
  },
  preview: {
    color: colors.muted,
    marginTop: 4,
    fontSize: 14,
  },
  chevron: {
    color: colors.muted,
    fontSize: 22,
    opacity: 0.35,
  },
});
