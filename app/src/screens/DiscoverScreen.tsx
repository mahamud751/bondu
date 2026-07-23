import React, { useCallback, useState } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, apiErrorMessage } from '../api/client';
import { Avatar, EmptyState, usePhotoSource } from '../components/UI';

const { width } = Dimensions.get('window');

const FILTERS = [
  { key: 'all', name: 'All', icon: 'grid-outline' },
  { key: 'popular', name: 'Popular', icon: 'flame-outline' },
  { key: 'nearby', name: 'Nearby', icon: 'location-outline' },
  { key: 'new', name: 'New', icon: 'sparkles-outline' },
  { key: 'Music', name: 'Music', icon: 'musical-notes-outline' },
  { key: 'Gaming', name: 'Gaming', icon: 'game-controller-outline' },
  { key: 'Talk', name: 'Talk', icon: 'chatbubbles-outline' },
] as const;

function discoverParams(filter: string, country?: string) {
  if (filter === 'popular') return { sort: 'popular' };
  if (filter === 'nearby') return country ? { sort: 'nearby', country } : {};
  if (filter === 'new') return { sort: 'new' };
  if (filter !== 'all') return { interest: filter };
  return {};
}

function formatViewers(count?: number) {
  if (!count) return '0';
  if (count >= 1000) return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(count);
}

function CreatorTile({ item, onPress }: { item: any; onPress: () => void }) {
  const profile = item.user.profile;
  const rating = Number(item.averageRating || 0);
  const photo = usePhotoSource(profile.avatarUrl);
  const featured = rating >= 4.7;
  return (
    <Pressable style={styles.creatorCard} onPress={onPress}>
      {photo ? (
        <Image source={photo} style={styles.creatorImage} />
      ) : (
        <View style={[styles.creatorImage, styles.creatorImageFallback]}>
          <Avatar name={profile.displayName} size={64} />
        </View>
      )}

      <View style={styles.creatorBadgesRow}>
        {item.availableForCall ? (
          <View style={styles.onlineBadge}>
            <View style={styles.dot} />
            <Text style={styles.badgeText}>Online</Text>
          </View>
        ) : (
          <View />
        )}
        {featured ? (
          <View style={styles.crownContainer}>
            <MaterialIcon name="crown" size={14} color="#B599FF" />
          </View>
        ) : (
          <View />
        )}
      </View>

      <LinearGradient
        colors={['transparent', 'rgba(11, 9, 20, 0.95)']}
        style={styles.creatorDetailsOverlay}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={styles.creatorName} numberOfLines={1}>
            {profile.displayName}
          </Text>
          {profile.isVerified ? (
            <MaterialIcon name="check-circle" size={14} color="#FF2A7A" style={{ marginLeft: 4 }} />
          ) : null}
        </View>
        <Text style={styles.creatorUsername} numberOfLines={1}>
          @{profile.username}{profile.country ? ` • ${profile.country}` : ''}
        </Text>

        <View style={styles.ratingRow}>
          <View style={styles.starRating}>
            <Icon name="star" size={12} color="#FFD066" />
            <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
          </View>
          <Text style={styles.rateText}>{item.voiceRatePerMinute} pts / min</Text>
        </View>

        <Pressable style={styles.callBtn} onPress={onPress}>
          <Icon name="call" size={18} color="#FFF" />
        </Pressable>
      </LinearGradient>
    </Pressable>
  );
}

function LiveTile({ item, onPress }: { item: any; onPress: () => void }) {
  const photo = usePhotoSource(item.host?.avatarUrl);
  return (
    <Pressable style={styles.liveCard} onPress={onPress}>
      {photo ? (
        <Image source={photo} style={styles.liveImage} />
      ) : (
        <View style={[styles.liveImage, styles.creatorImageFallback]}>
          <Avatar name={item.host?.displayName} size={56} />
        </View>
      )}

      <View style={styles.liveTopBadges}>
        <View style={styles.liveTag}>
          <Text style={styles.liveTagText}>LIVE</Text>
        </View>
        {item.category ? (
          <View style={styles.viewerTag}>
            <Text style={styles.viewerText}>{String(item.category)}</Text>
          </View>
        ) : null}
        <View style={styles.viewerTag}>
          <Icon name="eye-outline" size={12} color="#FFF" />
          <Text style={styles.viewerText}>{formatViewers(item.viewerCount)}</Text>
        </View>
      </View>

      <LinearGradient colors={['transparent', 'rgba(11, 9, 20, 0.95)']} style={styles.liveDetails}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={styles.liveName} numberOfLines={1}>
            {item.host?.displayName ?? 'Live'}
          </Text>
          {item.host?.isVerified ? (
            <MaterialIcon name="check-circle" size={12} color="#FF2A7A" style={{ marginLeft: 4 }} />
          ) : null}
        </View>
        {item.title ? (
          <View style={styles.liveWaveRow}>
            <Text style={styles.liveTagline} numberOfLines={1}>
              {item.title}
            </Text>
            <MaterialIcon name="waveform" size={14} color="#A020F0" />
          </View>
        ) : null}
      </LinearGradient>
    </Pressable>
  );
}

export function DiscoverScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const topPad =
    (insets.top || (Platform.OS === 'android' ? StatusBar.currentHeight ?? 24 : 20)) + 16;
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [creators, setCreators] = useState<any[]>([]);
  const [wallet, setWallet] = useState<any>();
  const [unreadCount, setUnreadCount] = useState(0);
  const [me, setMe] = useState<any>();
  const [requests, setRequests] = useState<any[]>([]);
  const [reward, setReward] = useState<any>();
  const [claimingReward, setClaimingReward] = useState(false);
  const [liveSessions, setLiveSessions] = useState<any[]>([]);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const load = useCallback((activeFilter: string, country?: string) => {
    setLoading(true);
    Promise.allSettled([
      api.get('/wallet'),
      api.get('/notifications/unread-count'),
      api.get('/users/me'),
      api.get('/social/connections/requests'),
      api.get('/rewards/daily'),
      api.get('/live'),
      api.get('/vendors/discover', { params: discoverParams(activeFilter, country) }),
    ])
      .then(([w, n, u, r, rw, l, c]) => {
        if (w.status === 'fulfilled') setWallet(w.value.data);
        if (n.status === 'fulfilled') setUnreadCount(n.value.data.count);
        if (u.status === 'fulfilled') setMe(u.value.data);
        if (r.status === 'fulfilled') setRequests(r.value.data);
        if (rw.status === 'fulfilled') setReward(rw.value.data);
        if (l.status === 'fulfilled') setLiveSessions(l.value.data);
        if (c.status === 'fulfilled') setCreators(c.value.data);
      })
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(filter, me?.profile?.country);
    }, [filter, load, me?.profile?.country]),
  );

  const changeFilter = (key: string) => {
    setFilter(key);
    load(key, me?.profile?.country);
  };

  const claimReward = async () => {
    if (!reward?.claimable) return;
    try {
      setClaimingReward(true);
      const { data } = await api.post('/rewards/daily/claim');
      setReward({
        claimable: false,
        amount: data.amount,
        nextClaimAt: new Date(Date.now() + 86400000).toISOString(),
      });
      setWallet((w: any) => (w ? { ...w, promotional: w.promotional + data.amount } : w));
      Alert.alert('Reward claimed', `+${data.amount} points added to your wallet.`);
    } catch (error: unknown) {
      Alert.alert('Could not claim reward', apiErrorMessage(error, 'Try again'));
    } finally {
      setClaimingReward(false);
    }
  };

  const points = wallet ? wallet.purchased + wallet.promotional - wallet.reserved : 0;
  const showSafetyBanner = me && !me.profile?.isVerified && !bannerDismissed;

  const requestAvatars = requests.slice(0, 4);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0B0914" translucent={Platform.OS === 'android'} />

      <View style={[styles.header, { paddingTop: topPad }]}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={styles.headerBrand}>
            SOCIAL<Text style={{ color: '#A020F0' }}>CONNECT</Text>
          </Text>
          <Text style={styles.headerTitle}>Discover</Text>
          <Text style={styles.headerSubtitle}>Meet verified creators who match your vibe</Text>
        </View>

        <View style={[styles.headerActions, { marginTop: 2 }]}>
          <Pressable style={styles.coinPill} onPress={() => navigation.navigate('AddMoney')}>
            <View style={styles.coinCircle}>
              <Text style={styles.coinText}>$</Text>
            </View>
            <View style={{ marginRight: 8 }}>
              <Text style={styles.coinAmount}>{points.toLocaleString()}</Text>
              <Text style={styles.coinLabel}>My Points</Text>
            </View>
            <View style={styles.coinAddBtn}>
              <Icon name="add" size={14} color="#FFF" />
            </View>
          </Pressable>

          <Pressable style={styles.iconCircleBtn} onPress={() => navigation.navigate('Notifications')}>
            <Icon name="notifications-outline" size={22} color="#FFF" />
            {unreadCount > 0 ? <View style={styles.notificationDot} /> : null}
          </Pressable>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => load(filter, me?.profile?.country)}
            tintColor="#A020F0"
          />
        }
      >
        <View style={styles.searchContainer}>
          <Pressable style={styles.searchBar} onPress={() => navigation.navigate('Search')}>
            <Icon name="search" size={20} color="#6C6A84" style={{ marginRight: 10 }} />
            <Text style={styles.searchPlaceholder}>Search people, language or interests</Text>
          </Pressable>
          <Pressable style={styles.filterBtn} onPress={() => navigation.navigate('Search')}>
            <Icon
              name="options-outline"
              size={20}
              color="#FFF"
              style={{ transform: [{ rotate: '90deg' }] }}
            />
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.promoRow}
          contentContainerStyle={{ paddingHorizontal: 16 }}
        >
          <Pressable onPress={() => navigation.navigate('Connections')}>
            <LinearGradient colors={['#27195E', '#171135']} style={styles.promoCard}>
              <View style={[styles.promoIconContainer, { backgroundColor: '#38228F' }]}>
                <Icon name="people-outline" size={20} color="#B599FF" />
              </View>
              <View style={styles.promoTitleRow}>
                <View>
                  <Text style={styles.promoTitle}>Connections</Text>
                  <Text style={styles.promoSubtitle}>
                    {requests.length ? `${requests.length} waiting` : 'People waiting'}
                  </Text>
                </View>
                <View style={styles.promoArrowBtn}>
                  <Icon name="arrow-forward" size={14} color="#FFF" />
                </View>
              </View>
              <View style={styles.avatarStack}>
                {requestAvatars.map((item: any, index: number) => (
                  <View
                    key={item.id}
                    style={[styles.stackAvatarWrap, { marginLeft: index === 0 ? 0 : -8 }]}
                  >
                    <Avatar name={item.requester?.profile?.displayName} size={24} />
                  </View>
                ))}
                <View style={styles.stackCount}>
                  <Text style={styles.stackCountText}>
                    +{Math.max(requests.length, 28)}
                  </Text>
                </View>
              </View>
            </LinearGradient>
          </Pressable>

          <Pressable onPress={() => navigation.navigate('Packages')}>
            <LinearGradient colors={['#4D1440', '#1C0D26']} style={styles.promoCard}>
              <View style={[styles.promoIconContainer, { backgroundColor: '#6B1857' }]}>
                <Icon name="flash-outline" size={20} color="#FF7EE2" />
              </View>
              <Text style={[styles.promoTitle, { marginTop: 12 }]}>Boost Time</Text>
              <Text style={styles.promoSubtitle}>Get more visibility</Text>
              <View style={[styles.exploreBtn, { borderColor: '#FF7EE2', borderWidth: 1 }]}>
                <Text style={styles.exploreBtnText}>Explore</Text>
                <Icon name="chevron-forward" size={12} color="#FF7EE2" />
              </View>
            </LinearGradient>
          </Pressable>

          <Pressable onPress={claimReward} disabled={!reward?.claimable || claimingReward}>
            <LinearGradient colors={['#463615', '#1F190E']} style={styles.promoCard}>
              <View style={[styles.promoIconContainer, { backgroundColor: '#69501B' }]}>
                <Icon name="gift-outline" size={20} color="#FFD066" />
              </View>
              <Text style={[styles.promoTitle, { marginTop: 12 }]}>Daily Rewards</Text>
              <Text style={styles.promoSubtitle}>
                {reward?.claimable ? `Claim ${reward.amount} points` : 'Claim free points'}
              </Text>
              <View style={styles.claimBtn}>
                <Text style={styles.claimBtnText}>
                  {reward?.claimable
                    ? claimingReward
                      ? 'Claiming…'
                      : 'Claim Now'
                    : 'Claimed'}
                </Text>
                <Icon name="chevron-forward" size={12} color="#FFD066" />
              </View>
            </LinearGradient>
          </Pressable>
        </ScrollView>

        {showSafetyBanner ? (
          <LinearGradient
            colors={['#161245', '#0D0826']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.safetyBanner}
          >
            <View style={styles.safetyLeft}>
              <View style={styles.shieldContainer}>
                <Icon name="shield-checkmark" size={32} color="#7F66FF" />
              </View>
              <View style={{ flex: 1, marginLeft: 12, marginRight: 8 }}>
                <Text style={styles.safetyTitle}>Your Safety, Our Priority</Text>
                <Text style={styles.safetySubtitle}>
                  Verify your account to build trust and get more matches
                </Text>
              </View>
            </View>
            <Pressable style={styles.verifyBtn} onPress={() => navigation.navigate('Support')}>
              <Text style={styles.verifyText}>Verify Now</Text>
              <Icon name="chevron-forward" size={14} color="#FFF" style={{ marginLeft: 4 }} />
            </Pressable>
            <Pressable style={styles.closeBannerBtn} onPress={() => setBannerDismissed(true)} hitSlop={10}>
              <Icon name="close" size={16} color="#6C6A84" />
            </Pressable>
          </LinearGradient>
        ) : null}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Top Creators For You</Text>
          <Pressable onPress={() => navigation.navigate('Search')}>
            <Text style={styles.seeAllText}>See all</Text>
          </Pressable>
        </View>

        {creators.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
            {creators.map((item: any) => (
              <CreatorTile
                key={item.id}
                item={item}
                onPress={() => navigation.navigate('Vendor', { vendor: item })}
              />
            ))}
          </ScrollView>
        ) : !loading ? (
          <View style={{ paddingHorizontal: 16 }}>
            <EmptyState
              icon="♡"
              title="New faces are joining"
              body="Pull to refresh — verified creators will appear here soon."
            />
          </View>
        ) : null}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipRow}
          contentContainerStyle={{ paddingHorizontal: 16 }}
        >
          {FILTERS.map((chip) => {
            const active = filter === chip.key;
            return (
              <Pressable
                key={chip.key}
                style={[styles.chip, active && styles.activeChip]}
                onPress={() => changeFilter(chip.key)}
              >
                <Icon name={chip.icon} size={16} color={active ? '#FFF' : '#6C6A84'} />
                <Text style={[styles.chipText, active && styles.activeChipText]}>{chip.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {liveSessions.length ? (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Popular Live Now</Text>
              <Pressable onPress={() => navigation.navigate('Search')}>
                <Text style={styles.seeAllText}>See all</Text>
              </Pressable>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
              {liveSessions.map((item: any) => (
                <LiveTile
                  key={item.id}
                  item={item}
                  onPress={() => navigation.navigate('LiveView', { liveId: item.id })}
                />
              ))}
            </ScrollView>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0914',
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerBrand: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 2,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: 2,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#6C6A84',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  coinPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C152E',
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginRight: 10,
  },
  coinCircle: {
    backgroundColor: '#FFA500',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  coinText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  coinAmount: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  coinLabel: {
    color: '#6C6A84',
    fontSize: 8,
  },
  coinAddBtn: {
    backgroundColor: '#5A20F0',
    borderRadius: 10,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconCircleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1C152E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationDot: {
    position: 'absolute',
    top: 10,
    right: 12,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF2A7A',
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 16,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#151226',
    borderRadius: 25,
    paddingHorizontal: 16,
    height: 46,
  },
  searchPlaceholder: {
    flex: 1,
    color: '#6C6A84',
    fontSize: 14,
  },
  filterBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#1C152E',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  promoRow: {
    marginTop: 20,
  },
  promoCard: {
    width: 140,
    borderRadius: 20,
    padding: 12,
    marginRight: 12,
    justifyContent: 'space-between',
    minHeight: 150,
  },
  promoIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  promoTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 12,
  },
  promoTitle: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  promoSubtitle: {
    color: '#6C6A84',
    fontSize: 10,
    marginTop: 2,
  },
  promoArrowBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  stackAvatarWrap: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#171135',
  },
  stackCount: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#27195E',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -8,
    borderWidth: 1.5,
    borderColor: '#171135',
  },
  stackCountText: {
    color: '#B599FF',
    fontSize: 8,
    fontWeight: 'bold',
  },
  exploreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,126,226,0.1)',
    borderRadius: 15,
    paddingVertical: 6,
    marginTop: 10,
  },
  exploreBtnText: {
    color: '#FF7EE2',
    fontSize: 11,
    fontWeight: 'bold',
    marginRight: 4,
  },
  claimBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#543D0A',
    borderRadius: 15,
    paddingVertical: 6,
    marginTop: 10,
  },
  claimBtnText: {
    color: '#FFD066',
    fontSize: 11,
    fontWeight: 'bold',
    marginRight: 4,
  },
  safetyBanner: {
    marginHorizontal: 16,
    marginTop: 20,
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
  },
  safetyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 8,
  },
  shieldContainer: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: 'rgba(127,102,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  safetyTitle: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  safetySubtitle: {
    color: '#6C6A84',
    fontSize: 11,
    marginTop: 2,
  },
  verifyBtn: {
    backgroundColor: '#5A20F0',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  verifyText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  closeBannerBtn: {
    position: 'absolute',
    top: 10,
    right: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 24,
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  seeAllText: {
    color: '#A020F0',
    fontSize: 14,
  },
  creatorCard: {
    width: width * 0.42,
    height: 250,
    borderRadius: 24,
    overflow: 'hidden',
    marginRight: 12,
    position: 'relative',
    backgroundColor: '#151226',
  },
  creatorImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  creatorImageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  creatorBadgesRow: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00FF0033',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00FF00',
    marginRight: 4,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: 'bold',
  },
  crownContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  creatorDetailsOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
    paddingTop: 30,
  },
  creatorName: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
    flexShrink: 1,
  },
  creatorUsername: {
    color: '#B599FF',
    fontSize: 10,
    marginTop: 2,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  starRating: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,208,102,0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  ratingText: {
    color: '#FFD066',
    fontSize: 10,
    fontWeight: 'bold',
    marginLeft: 2,
  },
  rateText: {
    color: '#FFF',
    fontSize: 10,
    marginLeft: 6,
    opacity: 0.8,
  },
  callBtn: {
    backgroundColor: '#5A20F0',
    width: '100%',
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  chipRow: {
    marginTop: 20,
    marginBottom: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#151226',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#221B3D',
  },
  activeChip: {
    backgroundColor: '#5A20F0',
    borderColor: '#5A20F0',
  },
  chipText: {
    color: '#6C6A84',
    fontSize: 12,
    marginLeft: 6,
    fontWeight: '600',
  },
  activeChipText: {
    color: '#FFF',
  },
  liveCard: {
    width: width * 0.38,
    height: 180,
    borderRadius: 20,
    overflow: 'hidden',
    marginRight: 12,
    position: 'relative',
    backgroundColor: '#151226',
  },
  liveImage: {
    width: '100%',
    height: '100%',
  },
  liveTopBadges: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  liveTag: {
    backgroundColor: '#FF2A7A',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  liveTagText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: 'bold',
  },
  viewerTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  viewerText: {
    color: '#FFF',
    fontSize: 9,
    marginLeft: 4,
  },
  liveDetails: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 10,
  },
  liveName: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
    flexShrink: 1,
  },
  liveWaveRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  liveTagline: {
    color: '#6C6A84',
    fontSize: 10,
    flex: 1,
    marginRight: 4,
  },
});
