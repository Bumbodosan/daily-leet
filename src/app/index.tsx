import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Link } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  ApiError,
  getFeedImages,
  getImageFileUrl,
  getMe,
  ImageRecord,
  requestMagicLink,
  uploadImage,
  User,
} from '@/lib/api';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { AuthPanel } from '@/components/auth-panel';

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message;
  }

  return 'Request failed';
}

function isLeetMinute() {
  const now = new Date();
  return now.getHours() === 13 && now.getMinutes() === 37;
}

export default function FeedScreen() {
  const theme = useTheme();
  const [user, setUser] = useState<User | null>(null);
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isWindowOpen, setIsWindowOpen] = useState(isLeetMinute());
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const latestDate = useMemo(() => images[0]?.created_at.slice(0, 10), [images]);
  const latestImages = useMemo(
    () => images.filter((image) => image.created_at.slice(0, 10) === latestDate),
    [images, latestDate]
  );

  const refresh = useCallback(async () => {
    setError('');

    try {
      const [{ user: currentUser }, feed] = await Promise.all([getMe(), getFeedImages()]);
      setUser(currentUser);
      setImages(feed.images);
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

  useEffect(() => {
    const interval = setInterval(() => {
      setIsWindowOpen(isLeetMinute());
    }, 250);

    return () => clearInterval(interval);
  }, []);

  async function handleLogin(email: string) {
    await requestMagicLink(email);
    setMessage('Link sent. Open it, then come back.');
  }

  async function handleTakePhoto() {
    setIsUploading(true);
    setError('');
    setMessage('');

    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();

      if (!permission.granted) {
        setError('Camera permission denied.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [3, 4],
        mediaTypes: ['images'],
        quality: 0.88,
      });

      if (result.canceled) {
        return;
      }

      const asset = result.assets[0];
      const uploaded = await uploadImage({
        uri: asset.uri,
        file: asset.file,
        fileName: asset.fileName,
        mimeType: asset.mimeType,
      });

      setImages((currentImages) => [uploaded.image, ...currentImages]);
      setMessage('Posted.');
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setIsUploading(false);
    }
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
        {isWindowOpen ? (
          <Pressable
            disabled={isUploading}
            onPress={handleTakePhoto}
            style={({ pressed }) => [
              styles.leetBanner,
              { opacity: isUploading ? 0.5 : pressed ? 0.75 : 1 },
            ]}>
            <ThemedText type="smallBold" style={styles.leetBannerText}>
              {isUploading ? 'posting leet photo' : 'take leet photo'}
            </ThemedText>
          </Pressable>
        ) : null}

        {error || message ? (
          <View style={styles.status}>
            <ThemedText type="small" selectable style={error ? styles.errorText : styles.okText}>
              {error || message}
            </ThemedText>
          </View>
        ) : null}

        {latestImages.length === 0 ? (
          <View style={styles.empty}>
            <ThemedText style={styles.emptyTime}>13:37</ThemedText>
            <ThemedText type="small" style={styles.emptyText}>
              no friend photos yet
            </ThemedText>
          </View>
        ) : (
          latestImages.map((image) => (
            <View key={image.id} style={styles.post}>
              <Image
                source={{ uri: getImageFileUrl(image.id) }}
                style={styles.photo}
                contentFit="cover"
              />
              <View style={styles.postMeta}>
                <Link href={`/users/${image.user_id}`} asChild>
                  <Pressable>
                    <ThemedText type="smallBold" selectable>
                      {image.user_email ?? 'friend'}
                    </ThemedText>
                  </Pressable>
                </Link>
                <ThemedText type="small" themeColor="textSecondary" selectable>
                  {image.created_at}
                </ThemedText>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
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
    gap: Spacing.three,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leetBanner: {
    minHeight: 52,
    borderRadius: 8,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leetBannerText: {
    color: '#f7f7f4',
    textTransform: 'uppercase',
  },
  status: {
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    backgroundColor: '#f4f4f1',
  },
  errorText: {
    color: '#9a3f28',
  },
  okText: {
    color: '#53745c',
  },
  empty: {
    minHeight: 420,
    borderRadius: 8,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
  },
  emptyTime: {
    color: '#f7f7f4',
    fontSize: 72,
    lineHeight: 76,
    fontWeight: '700',
    letterSpacing: 0,
  },
  emptyText: {
    color: '#d8d8d1',
  },
  post: {
    gap: Spacing.two,
  },
  photo: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 8,
    backgroundColor: '#111111',
  },
  postMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
});
