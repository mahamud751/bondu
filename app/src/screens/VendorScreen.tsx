// @ts-nocheck
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { api, apiErrorMessage } from '../api/client';
import {
  Button,
  Card,
  Metric,
  Pill,
  Screen,
  SectionTitle,
} from '../components/UI';
import { avatarColor, colors, radius, shadow, spacing } from '../theme';

export function VendorScreen({
  route,
  navigation,
}: {
  route: any;
  navigation: any;
}) {
  const vendor = route.params.vendor;
  const profile = vendor.user.profile;
  const [gifts, setGifts] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const heroColor = avatarColor(profile.displayName);

  useEffect(() => {
    Promise.all([
      api.get('/gifts'),
      api.get(`/reviews/vendor/${vendor.id}`),
    ]).then(([g, r]) => {
      setGifts(g.data);
      setReviews(r.data);
    });
  }, [vendor.id]);

  const chat = async () => {
    try {
      const { data } = await api.post('/chat/conversations', {
        userId: vendor.userId,
      });
      navigation.navigate('Chat', {
        conversationId: data.id,
        title: profile.displayName,
      });
    } catch (error: any) {
      Alert.alert('Cannot start chat', apiErrorMessage(error, 'Try again'));
    }
  };

  const call = async (callType: 'VOICE' | 'VIDEO') => {
    try {
      setBusy(true);
      const { data } = await api.post('/calls/request', {
        vendorId: vendor.id,
        callType,
        maximumSeconds: 300,
        idempotencyKey: `mobile-${Date.now()}-${Math.random()}`,
      });
      // Messenger-style: caller enters ringing UI immediately; on accept both
      // open ActiveCall and join the same Agora room together.
      if (data?.status === 'ACCEPTED') {
        navigation.navigate('ActiveCall', {
          callId: data.id,
          title: profile.displayName,
          callType,
        });
      } else {
        navigation.navigate('OutgoingCall', {
          callId: data.id,
          title: profile.displayName,
          callType,
        });
      }
    } catch (error: any) {
      Alert.alert('Cannot call', apiErrorMessage(error, 'Try again'));
    } finally {
      setBusy(false);
    }
  };

  const gift = async (item: any) => {
    try {
      await api.post(`/gifts/${item.id}/send`, {
        receiverId: vendor.userId,
        idempotencyKey: `mobile-${Date.now()}-${Math.random()}`,
      });
      Alert.alert('Gift sent', `${item.name} was delivered.`);
    } catch (error: any) {
      Alert.alert('Gift not sent', apiErrorMessage(error, 'Try again'));
    }
  };

  const report = (review: any) =>
    Alert.alert('Report this review', 'Choose the closest reason', [
      ...['ABUSE', 'SPAM', 'FAKE', 'PERSONAL_INFO'].map((reason) => ({
        text: reason.toLowerCase().replace('_', ' '),
        onPress: () =>
          api
            .post(`/reviews/${review.id}/report`, { reason })
            .then(() =>
              Alert.alert('Report received', 'Trust & Safety will review it.'),
            )
            .catch((error: any) =>
              Alert.alert('Could not report', apiErrorMessage(error, 'Try again')),
            ),
      })),
      { text: 'Cancel', style: 'cancel' },
    ]);

  return (
    <Screen scroll>
      <View style={[styles.hero, { backgroundColor: heroColor }]}>
        <Text style={styles.heroLetter}>
          {(profile.displayName || '?').slice(0, 1).toUpperCase()}
        </Text>
        <View style={styles.heroOverlay}>
          {vendor.availableForCall ? (
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>Available now</Text>
            </View>
          ) : null}
          <View style={styles.nameRow}>
            <Text style={styles.name}>{profile.displayName}</Text>
            {profile.isVerified ? (
              <View style={styles.verified}>
                <Text style={styles.verifiedMark}>✓</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.handle}>
            @{profile.username}
            {profile.city || profile.country
              ? ` · ${profile.city ?? profile.country}`
              : ''}
          </Text>
          <View style={styles.pills}>
            <Pill
              label={vendor.availableForCall ? 'Online' : 'Offline'}
              tone={vendor.availableForCall ? 'success' : 'neutral'}
            />
            <Pill
              label={`★ ${Number(vendor.averageRating ?? 0).toFixed(1)}`}
              tone="gold"
            />
          </View>
        </View>
      </View>

      {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

      <Card style={styles.metrics}>
        <Metric label="Voice / min" value={`${vendor.voiceRatePerMinute}`} />
        <Metric
          label="Video / min"
          value={`${vendor.videoRatePerMinute ?? 40}`}
        />
        <Metric label="Message" value={`${vendor.paidChatRate}`} />
      </Card>

      <Button title="Message" icon="✉" onPress={chat} />
      <View style={styles.actions}>
        <View style={styles.flex}>
          <Button
            title="Voice"
            icon="◉"
            variant="secondary"
            loading={busy}
            disabled={!vendor.availableForCall || vendor.voiceCallEnabled === false}
            onPress={() => void call('VOICE')}
          />
        </View>
        <View style={styles.flex}>
          <Button
            title="Video"
            icon="▣"
            variant="ghost"
            loading={busy}
            disabled={!vendor.availableForCall || vendor.videoCallEnabled === false}
            onPress={() => void call('VIDEO')}
          />
        </View>
      </View>

      <SectionTitle>Send a gift</SectionTitle>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.gifts}
      >
        {gifts.map((item) => (
          <Pressable
            key={item.id}
            style={({ pressed }) => [styles.gift, pressed && { opacity: 0.85 }]}
            onPress={() => gift(item)}
          >
            <Text style={styles.giftIcon}>{item.iconUrl}</Text>
            <Text style={styles.giftName}>{item.name}</Text>
            <Text style={styles.giftPrice}>{item.pointPrice} pts</Text>
          </Pressable>
        ))}
      </ScrollView>

      <SectionTitle>Reviews</SectionTitle>
      {reviews.length ? (
        reviews.slice(0, 5).map((item) => (
          <Card key={item.id}>
            <View style={styles.reviewTop}>
              <Text style={styles.reviewer}>
                {item.reviewer?.profile?.displayName ?? 'Member'}
              </Text>
              <Text style={styles.rating}>★ {item.rating}</Text>
            </View>
            {item.comment ? (
              <Text style={styles.reviewBody}>{item.comment}</Text>
            ) : null}
            <View style={styles.reviewFooter}>
              <Text style={styles.reviewDate}>
                {new Date(item.createdAt).toLocaleDateString()}
              </Text>
              <Pressable onPress={() => report(item)}>
                <Text style={styles.report}>Report</Text>
              </Pressable>
            </View>
          </Card>
        ))
      ) : (
        <Card>
          <Text style={styles.reviewBody}>No reviews yet — be the first.</Text>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    height: 320,
    borderRadius: radius.xxl,
    overflow: 'hidden',
    marginBottom: spacing.lg,
    justifyContent: 'flex-end',
    ...shadow,
  },
  heroLetter: {
    position: 'absolute',
    alignSelf: 'center',
    top: '22%',
    fontSize: 140,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.2)',
  },
  heroOverlay: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 20,
    paddingTop: 36,
    paddingBottom: 20,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    gap: 6,
    marginBottom: 12,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  liveText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    color: colors.white,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  verified: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedMark: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '900',
  },
  handle: {
    color: 'rgba(255,255,255,0.75)',
    marginTop: 4,
    fontSize: 14,
  },
  pills: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  bio: {
    color: colors.textSoft,
    lineHeight: 22,
    fontSize: 15,
    marginBottom: spacing.lg,
  },
  metrics: {
    flexDirection: 'row',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  flex: {
    flex: 1,
  },
  gifts: {
    gap: 12,
    paddingBottom: 8,
  },
  gift: {
    width: 100,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    padding: 16,
  },
  giftIcon: {
    fontSize: 32,
  },
  giftName: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 12,
    marginTop: 10,
  },
  giftPrice: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },
  reviewTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  reviewer: {
    color: colors.text,
    fontWeight: '700',
  },
  rating: {
    color: colors.gold,
    fontWeight: '800',
  },
  reviewBody: {
    color: colors.textSoft,
    lineHeight: 20,
    marginTop: 8,
  },
  reviewFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  reviewDate: {
    color: colors.muted,
    fontSize: 11,
  },
  report: {
    color: colors.danger,
    fontWeight: '700',
    fontSize: 12,
  },
});
