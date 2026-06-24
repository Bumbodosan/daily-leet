import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { ApiError, getImageFileUrl, getUserProfile, ImageRecord, User } from '@/lib/api';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message;
  }

  return 'Request failed';
}

export default function FriendProfileScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ userId: string }>();
  const [user, setUser] = useState<User | null>(null);
  const [friendCount, setFriendCount] = useState(0);
  const [imageCount, setImageCount] = useState(0);
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!params.userId) {
      return;
    }

    setError('');

    try {
      const profile = await getUserProfile(params.userId);
      setUser(profile.user);
      setFriendCount(profile.stats.friendCount);
      setImageCount(profile.stats.imageCount);
      setImages(profile.images);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setIsLoading(false);
    }
  }, [params.userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (isLoading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator color={theme.text} />
      </ThemedView>
    );
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.contentContainer}>
      <View style={styles.container}>
        {error || !user ? (
          <ThemedText type="small" selectable style={styles.errorText}>
            {error || 'User not found'}
          </ThemedText>
        ) : (
          <>
            <View style={styles.identity}>
              <View style={styles.avatar}>
                <ThemedText style={styles.avatarText}>
                  {user.email.slice(0, 1).toUpperCase()}
                </ThemedText>
              </View>
              <ThemedText type="smallBold" selectable>
                {user.email}
              </ThemedText>
            </View>

            <View style={styles.stats}>
              <Stat label="friends" value={friendCount} />
              <Stat label="1337s" value={imageCount} />
            </View>

            <View style={styles.grid}>
              {images.map((image) => (
                <View key={image.id} style={styles.imageCell}>
                  <Image
                    source={{ uri: getImageFileUrl(image.id) }}
                    style={styles.image}
                    contentFit="cover"
                  />
                  <ThemedText type="small" themeColor="textSecondary" selectable>
                    {image.created_at}
                  </ThemedText>
                </View>
              ))}
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  const theme = useTheme();

  return (
    <View style={[styles.stat, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText style={styles.statValue}>{value}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.five,
  },
  container: {
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: Spacing.four,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identity: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#f7f7f4',
    fontSize: 44,
    lineHeight: 48,
    fontWeight: '700',
    letterSpacing: 0,
  },
  stats: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  stat: {
    flex: 1,
    borderRadius: 8,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  statValue: {
    fontSize: 36,
    lineHeight: 40,
    fontWeight: '700',
    letterSpacing: 0,
  },
  grid: {
    gap: Spacing.three,
  },
  imageCell: {
    gap: Spacing.one,
  },
  image: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 8,
    backgroundColor: '#111111',
  },
  errorText: {
    color: '#b35b3e',
  },
});
