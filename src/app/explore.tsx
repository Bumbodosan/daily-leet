import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ApiError,
  FriendRelationships,
  getFriendRelationships,
  getImages,
  getMe,
  ImageRecord,
  User,
} from '@/lib/api';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const emptyRelationships: FriendRelationships = {
  incomingRequests: [],
  outgoingRequests: [],
  friends: [],
};

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message;
  }

  return 'Request failed';
}

export default function ProfileScreen() {
  const theme = useTheme();
  const safeAreaInsets = useSafeAreaInsets();
  const [me, setMe] = useState<User | null>(null);
  const [relationships, setRelationships] = useState(emptyRelationships);
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setError('');

    try {
      const [{ user }, friendRelationships, imageRecords] = await Promise.all([
        getMe(),
        getFriendRelationships(),
        getImages(),
      ]);
      setMe(user);
      setRelationships(friendRelationships);
      setImages(imageRecords.images);
    } catch (caughtError) {
      if (caughtError instanceof ApiError && caughtError.status === 401) {
        setMe(null);
        setRelationships(emptyRelationships);
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

  const contentPlatformStyle = Platform.select({
    android: {
      paddingTop: safeAreaInsets.top + Spacing.three,
      paddingLeft: safeAreaInsets.left + Spacing.three,
      paddingRight: safeAreaInsets.right + Spacing.three,
      paddingBottom: safeAreaInsets.bottom + BottomTabInset + Spacing.three,
    },
    ios: {
      paddingTop: Spacing.three,
      paddingBottom: BottomTabInset + Spacing.three,
    },
    web: {
      paddingTop: Spacing.five,
      paddingBottom: Spacing.four,
    },
  });

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
      contentContainerStyle={[styles.contentContainer, contentPlatformStyle]}>
      <ThemedView style={styles.container}>
        <View style={styles.header}>
          <ThemedText type="small" themeColor="textSecondary">
            leet
          </ThemedText>
          <ThemedText type="subtitle">Profile</ThemedText>
          {me ? (
            <ThemedText type="small" themeColor="textSecondary" selectable>
              {me.email}
            </ThemedText>
          ) : (
            <ThemedText type="small" themeColor="textSecondary">
              signed out
            </ThemedText>
          )}
        </View>

        {error ? (
          <View style={styles.status}>
            <ThemedText type="small" selectable style={styles.errorText}>
              {error}
            </ThemedText>
          </View>
        ) : null}

        <View style={styles.moment}>
          <ThemedText style={styles.momentTime}>13:37</ThemedText>
          <ThemedText type="small" style={styles.momentText}>
            daily leet
          </ThemedText>
        </View>

        <View style={styles.grid}>
          <Stat label="friends" value={relationships.friends.length} />
          <Stat label="requests" value={relationships.incomingRequests.length} />
          <Stat label="checks" value={images.length} />
        </View>

        <View style={[styles.panel, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="smallBold">Latest</ThemedText>
          {images[0] ? (
            <>
              <ThemedText type="small" selectable>
                {images[0].original_filename}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" selectable>
                {images[0].created_at}
              </ThemedText>
            </>
          ) : (
            <ThemedText type="small" themeColor="textSecondary">
              no check-ins
            </ThemedText>
          )}
        </View>
      </ThemedView>
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
  header: {
    gap: Spacing.one,
  },
  status: {
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    backgroundColor: 'rgba(179, 91, 62, 0.14)',
  },
  errorText: {
    color: '#b35b3e',
  },
  moment: {
    minHeight: 240,
    borderRadius: 8,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
  },
  momentTime: {
    color: '#f7f7f4',
    fontSize: 72,
    lineHeight: 76,
    fontWeight: '700',
    letterSpacing: 0,
  },
  momentText: {
    color: '#d8d8d1',
    textTransform: 'uppercase',
  },
  grid: {
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
  panel: {
    borderRadius: 8,
    padding: Spacing.three,
    gap: Spacing.one,
  },
});
