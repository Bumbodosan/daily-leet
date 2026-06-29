import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  ApiError,
  getImageFileUrl,
  getUserProfile,
  ImageRecord,
} from '@/lib/api';
import { PhotoReactions } from '@/components/photo-reactions';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuthSession } from '@/lib/auth-session';

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message;
  }

  return 'Request failed';
}

export default function ProfileScreen() {
  const theme = useTheme();
  const { user, clearAuth, signOut } = useAuthSession();
  const [friendCount, setFriendCount] = useState(0);
  const [imageCount, setImageCount] = useState(0);
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setError('');

    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      const profile = await getUserProfile(user.id);
      setFriendCount(profile.stats.friendCount);
      setImageCount(profile.stats.imageCount);
      setImages(profile.images);
    } catch (caughtError) {
      if (caughtError instanceof ApiError && caughtError.status === 401) {
        clearAuth();
        setImages([]);
        return;
      }

      setError(getErrorMessage(caughtError));
    } finally {
      setIsLoading(false);
    }
  }, [clearAuth, user]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  async function handleLogout() {
    setIsLoggingOut(true);
    setError('');

    try {
      await signOut();
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
      setIsLoggingOut(false);
      return;
    }

    setFriendCount(0);
    setImageCount(0);
    setImages([]);
    setIsLoggingOut(false);
  }

  if (isLoading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator color={theme.text} />
      </ThemedView>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.contentContainer}>
      <View style={styles.container}>
        {error ? (
          <ThemedText
            type="small"
            selectable
            style={{ color: theme.background === '#000000' ? '#ffb199' : '#9a3f28' }}>
            {error}
          </ThemedText>
        ) : null}

        <View style={styles.identity}>
          <View style={styles.avatar}>
            <ThemedText style={styles.avatarText}>{user.email.slice(0, 1).toUpperCase()}</ThemedText>
          </View>
          <ThemedText type="smallBold" selectable>
            {user.email}
          </ThemedText>
          <Pressable
            disabled={isLoggingOut}
            onPress={handleLogout}
            style={({ pressed }) => [
              styles.logoutButton,
              { opacity: isLoggingOut ? 0.45 : pressed ? 0.72 : 1 },
            ]}>
            <ThemedText type="smallBold" style={styles.logoutText}>
              {isLoggingOut ? 'logging out' : 'log out'}
            </ThemedText>
          </Pressable>
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
            images.map((image) => <ProfileImage key={image.id} image={image} onError={setError} />)
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

function ProfileImage({ image, onError }: { image: ImageRecord; onError: (message: string) => void }) {
  return (
    <View style={styles.imageCell}>
      <Image source={{ uri: getImageFileUrl(image.id) }} style={styles.image} contentFit="contain" />
      <ThemedText type="small" themeColor="textSecondary" selectable numberOfLines={1}>
        {image.created_at}
      </ThemedText>
      <PhotoReactions imageId={image.id} reactions={image.reactions} onError={onError} />
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
  logoutButton: {
    minHeight: 44,
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111111',
  },
  logoutText: {
    color: '#f7f7f4',
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
