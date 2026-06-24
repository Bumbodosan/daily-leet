import { Image } from 'expo-image';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import {
  ApiError,
  getImageFileUrl,
  getMe,
  getUserProfile,
  ImageRecord,
  requestMagicLink,
  User,
} from '@/lib/api';
import { AuthPanel } from '@/components/auth-panel';
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

export default function ProfileScreen() {
  const theme = useTheme();
  const [user, setUser] = useState<User | null>(null);
  const [friendCount, setFriendCount] = useState(0);
  const [imageCount, setImageCount] = useState(0);
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setError('');

    try {
      const { user: currentUser } = await getMe();
      const profile = await getUserProfile(currentUser.id);
      setUser(profile.user);
      setFriendCount(profile.stats.friendCount);
      setImageCount(profile.stats.imageCount);
      setImages(profile.images);
    } catch (caughtError) {
      if (caughtError instanceof ApiError && caughtError.status === 401) {
        setUser(null);
        setImages([]);
        return;
      }

      setError(getErrorMessage(caughtError));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleLogin(email: string) {
    await requestMagicLink(email);
    setMessage('Link sent. Open it, then come back.');
  }

  if (isLoading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator color={theme.text} />
      </ThemedView>
    );
  }

  if (!user) {
    return <AuthPanel error={error} message={message} onSubmit={handleLogin} onRefresh={refresh} />;
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.contentContainer}>
      <View style={styles.container}>
        <View style={styles.identity}>
          <View style={styles.avatar}>
            <ThemedText style={styles.avatarText}>{user.email.slice(0, 1).toUpperCase()}</ThemedText>
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
          {images.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              no images yet
            </ThemedText>
          ) : (
            images.map((image) => <ProfileImage key={image.id} image={image} />)
          )}
        </View>
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

function ProfileImage({ image }: { image: ImageRecord }) {
  return (
    <View style={styles.imageCell}>
      <Image source={{ uri: getImageFileUrl(image.id) }} style={styles.image} contentFit="cover" />
      <ThemedText type="small" themeColor="textSecondary" selectable numberOfLines={1}>
        {image.created_at}
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
});
