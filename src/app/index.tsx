import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  acceptFriendRequest,
  ApiError,
  FriendRelationships,
  getFriendRelationships,
  getImages,
  getMe,
  ImageRecord,
  logout,
  requestMagicLink,
  sendFriendRequest,
  uploadImage,
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

const ink = '#111111';
const quiet = '#6f746d';
const moss = '#53745c';
const clay = '#b35b3e';

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message;
  }

  return 'Request failed';
}

function getTodayDateKey() {
  return new Date().toISOString().slice(0, 10);
}

function isTodayImage(image: ImageRecord) {
  return image.created_at.startsWith(getTodayDateKey());
}

function formatByteSize(byteSize: number) {
  if (byteSize < 1024 * 1024) {
    return `${Math.max(1, Math.round(byteSize / 1024))} KB`;
  }

  return `${(byteSize / 1024 / 1024).toFixed(1)} MB`;
}

export default function HomeScreen() {
  const theme = useTheme();
  const safeAreaInsets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [me, setMe] = useState<User | null>(null);
  const [relationships, setRelationships] = useState(emptyRelationships);
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [loginEmail, setLoginEmail] = useState('');
  const [friendEmail, setFriendEmail] = useState('');
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSendingLogin, setIsSendingLogin] = useState(false);
  const [isSendingFriendRequest, setIsSendingFriendRequest] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [acceptingUserId, setAcceptingUserId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const todayImage = useMemo(() => images.find(isTodayImage), [images]);
  const latestImage = images[0];
  const hasRequests = relationships.incomingRequests.length > 0;
  const isCompact = width < 620;

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

  async function handleRequestLogin() {
    setIsSendingLogin(true);
    setError('');
    setMessage('');

    try {
      await requestMagicLink(loginEmail);
      setMessage('Link sent. Open it, then come back.');
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setIsSendingLogin(false);
    }
  }

  async function handleLogout() {
    setError('');
    setMessage('');

    try {
      await logout();
    } catch {
      // Session may already be gone. The local state should still clear.
    }

    setMe(null);
    setRelationships(emptyRelationships);
    setImages([]);
    setSelectedImageUri(null);
  }

  async function handleSendFriendRequest() {
    setIsSendingFriendRequest(true);
    setError('');
    setMessage('');

    try {
      const result = await sendFriendRequest(friendEmail);
      setRelationships(result.friends);
      setFriendEmail('');
      setMessage(result.relationship === 'friends' ? 'Friend added.' : 'Request sent.');
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setIsSendingFriendRequest(false);
    }
  }

  async function handleAcceptFriendRequest(userId: string) {
    setAcceptingUserId(userId);
    setError('');
    setMessage('');

    try {
      const result = await acceptFriendRequest(userId);
      setRelationships(result.friends);
      setMessage('Friend added.');
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setAcceptingUserId(null);
    }
  }

  async function handleTakePhoto() {
    setIsUploading(true);
    setError('');
    setMessage('');

    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();

      if (!permission.granted) {
        setError('Permission denied.');
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
      setSelectedImageUri(asset.uri);

      const uploaded = await uploadImage({
        uri: asset.uri,
        file: asset.file,
        fileName: asset.fileName,
        mimeType: asset.mimeType,
      });

      setImages((currentImages) => [uploaded.image, ...currentImages]);
      setMessage('Checked in.');
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setIsUploading(false);
    }
  }

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
        {me ? (
          <>
            <Header user={me} onLogout={handleLogout} />
            <StatusMessage error={error} message={message} />
            <TodayPanel
              todayImage={todayImage}
              latestImage={latestImage}
              selectedImageUri={selectedImageUri}
              isUploading={isUploading}
              isCompact={isCompact}
              onCamera={handleTakePhoto}
            />
            {hasRequests ? (
              <RequestPanel
                requests={relationships.incomingRequests}
                acceptingUserId={acceptingUserId}
                onAccept={handleAcceptFriendRequest}
              />
            ) : null}
            <AddFriendPanel
              friendEmail={friendEmail}
              isSending={isSendingFriendRequest}
              onChangeFriendEmail={setFriendEmail}
              onSend={handleSendFriendRequest}
            />
            <FriendList
              friends={relationships.friends}
              outgoingRequests={relationships.outgoingRequests}
            />
          </>
        ) : (
          <SignedOut
            email={loginEmail}
            isSending={isSendingLogin}
            message={message}
            error={error}
            onChangeEmail={setLoginEmail}
            onSubmit={handleRequestLogin}
            onRefresh={refresh}
          />
        )}
      </ThemedView>
    </ScrollView>
  );
}

function Header({ user, onLogout }: { user: User; onLogout: () => void }) {
  return (
    <View style={styles.header}>
      <View>
        <ThemedText type="small" themeColor="textSecondary">
          leet
        </ThemedText>
        <ThemedText type="subtitle">Today</ThemedText>
      </View>
      <View style={styles.headerRight}>
        <ThemedText type="small" themeColor="textSecondary" selectable numberOfLines={1}>
          {user.email}
        </ThemedText>
        <Pressable onPress={onLogout} hitSlop={12}>
          <ThemedText type="smallBold">Log out</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

function SignedOut({
  email,
  isSending,
  message,
  error,
  onChangeEmail,
  onSubmit,
  onRefresh,
}: {
  email: string;
  isSending: boolean;
  message: string;
  error: string;
  onChangeEmail: (email: string) => void;
  onSubmit: () => void;
  onRefresh: () => void;
}) {
  const theme = useTheme();

  return (
    <View style={styles.signedOut}>
      <View style={styles.signInBrand}>
        <ThemedText type="small" themeColor="textSecondary">
          leet
        </ThemedText>
        <ThemedText style={styles.signInTitle}>13:37</ThemedText>
        <ThemedText type="default" themeColor="textSecondary" style={styles.signInSubtitle}>
          daily proof, friends only
        </ThemedText>
      </View>

      <View style={[styles.signInPanel, { backgroundColor: theme.text }]}>
        <ThemedText type="smallBold" style={{ color: theme.background }}>
          Email
        </ThemedText>
        <View style={styles.signInRow}>
          <TextInput
            value={email}
            onChangeText={onChangeEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder="you@example.com"
            placeholderTextColor="#8a8a84"
            style={[styles.darkInput, { color: theme.background }]}
          />
          <ActionButton
            label={isSending ? 'Sending' : 'Send'}
            disabled={!email || isSending}
            onPress={onSubmit}
            tone="light"
          />
        </View>
        <View style={styles.loginActions}>
          <ActionButton label="Refresh" onPress={onRefresh} tone="lightQuiet" />
          <StatusMessage error={error} message={message} inverted />
        </View>
      </View>
    </View>
  );
}

function TodayPanel({
  todayImage,
  latestImage,
  selectedImageUri,
  isUploading,
  isCompact,
  onCamera,
}: {
  todayImage?: ImageRecord;
  latestImage?: ImageRecord;
  selectedImageUri: string | null;
  isUploading: boolean;
  isCompact: boolean;
  onCamera: () => void;
}) {
  const theme = useTheme();
  const imageToShow = selectedImageUri;
  const status = todayImage ? 'posted' : 'open';
  const fileLabel = todayImage
    ? `${todayImage.original_filename} · ${formatByteSize(todayImage.byte_size)}`
    : latestImage
      ? `last: ${latestImage.original_filename}`
      : 'no check-in yet';

  return (
    <View style={[styles.todayLayout, isCompact && styles.todayLayoutCompact]}>
      <View style={[styles.photoWell, { backgroundColor: theme.text }]}>
        {imageToShow ? (
          <Image source={{ uri: imageToShow }} style={styles.photoPreview} contentFit="cover" />
        ) : (
          <View style={styles.photoEmpty}>
            <ThemedText style={styles.photoTime}>13:37</ThemedText>
            <ThemedText type="small" style={styles.photoEmptyText}>
              {status}
            </ThemedText>
          </View>
        )}
      </View>

      <View style={styles.todaySide}>
        <View>
          <ThemedText type="small" themeColor="textSecondary">
            leet moment
          </ThemedText>
          <ThemedText type="title" style={styles.todayTitle}>
            {status}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" selectable>
            {fileLabel}
          </ThemedText>
        </View>
        <View style={styles.actionStack}>
          <ActionButton
            label={isUploading ? 'Saving' : 'Take photo'}
            disabled={isUploading}
            onPress={onCamera}
          />
        </View>
      </View>
    </View>
  );
}

function RequestPanel({
  requests,
  acceptingUserId,
  onAccept,
}: {
  requests: User[];
  acceptingUserId: string | null;
  onAccept: (userId: string) => void;
}) {
  const theme = useTheme();

  return (
    <View style={[styles.panel, styles.requestPanel, { backgroundColor: theme.backgroundElement }]}>
      <View style={styles.sectionHeader}>
        <ThemedText type="smallBold">Requests</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {requests.length}
        </ThemedText>
      </View>
      {requests.map((request) => (
        <PersonRow
          key={request.id}
          person={request}
          actionLabel={acceptingUserId === request.id ? 'Adding' : 'Add back'}
          disabled={acceptingUserId === request.id}
          onAction={() => onAccept(request.id)}
        />
      ))}
    </View>
  );
}

function AddFriendPanel({
  friendEmail,
  isSending,
  onChangeFriendEmail,
  onSend,
}: {
  friendEmail: string;
  isSending: boolean;
  onChangeFriendEmail: (email: string) => void;
  onSend: () => void;
}) {
  const theme = useTheme();

  return (
    <View style={styles.panel}>
      <ThemedText type="smallBold">Add friend</ThemedText>
      <View style={styles.formRow}>
        <TextInput
          value={friendEmail}
          onChangeText={onChangeFriendEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          placeholder="friend@example.com"
          placeholderTextColor={theme.textSecondary}
          style={[
            styles.input,
            {
              color: theme.text,
              backgroundColor: theme.backgroundElement,
            },
          ]}
        />
        <ActionButton
          label={isSending ? 'Sending' : 'Add'}
          disabled={!friendEmail || isSending}
          onPress={onSend}
        />
      </View>
    </View>
  );
}

function FriendList({
  friends,
  outgoingRequests,
}: {
  friends: User[];
  outgoingRequests: User[];
}) {
  return (
    <View style={styles.panel}>
      <View style={styles.sectionHeader}>
        <ThemedText type="smallBold">People</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {friends.length} friends
        </ThemedText>
      </View>

      {friends.length === 0 && outgoingRequests.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          Nobody here yet.
        </ThemedText>
      ) : null}

      {friends.map((friend) => (
        <PersonRow key={friend.id} person={friend} note="friend" />
      ))}

      {outgoingRequests.map((request) => (
        <PersonRow key={request.id} person={request} note="sent" muted />
      ))}
    </View>
  );
}

function PersonRow({
  person,
  note,
  muted,
  actionLabel,
  disabled,
  onAction,
}: {
  person: User;
  note?: string;
  muted?: boolean;
  actionLabel?: string;
  disabled?: boolean;
  onAction?: () => void;
}) {
  const theme = useTheme();

  return (
    <View style={[styles.personRow, { backgroundColor: theme.backgroundElement }, muted && styles.mutedRow]}>
      <View style={[styles.avatar, muted && styles.mutedAvatar]}>
        <ThemedText type="smallBold" style={styles.avatarText}>
          {person.email.slice(0, 1).toUpperCase()}
        </ThemedText>
      </View>
      <View style={styles.personText}>
        <ThemedText type="smallBold" selectable numberOfLines={1}>
          {person.email}
        </ThemedText>
        {note ? (
          <ThemedText type="small" themeColor="textSecondary">
            {note}
          </ThemedText>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <ActionButton label={actionLabel} disabled={disabled} onPress={onAction} tone="small" />
      ) : null}
    </View>
  );
}

function StatusMessage({
  error,
  message,
  inverted,
}: {
  error: string;
  message: string;
  inverted?: boolean;
}) {
  const text = error || message;

  if (!text) {
    return null;
  }

  return (
    <View
      style={[
        styles.status,
        {
          backgroundColor: error ? 'rgba(179, 91, 62, 0.14)' : 'rgba(83, 116, 92, 0.16)',
        },
      ]}>
      <ThemedText
        type="small"
        selectable
        style={{ color: inverted ? '#f7f7f4' : error ? clay : moss }}>
        {text}
      </ThemedText>
    </View>
  );
}

function ActionButton({
  label,
  disabled,
  onPress,
  tone = 'primary',
}: {
  label: string;
  disabled?: boolean;
  onPress: () => void;
  tone?: 'primary' | 'quiet' | 'light' | 'lightQuiet' | 'small';
}) {
  const theme = useTheme();
  const isLight = tone === 'light' || tone === 'lightQuiet';
  const isQuiet = tone === 'quiet' || tone === 'lightQuiet';
  const isSmall = tone === 'small';

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        isSmall && styles.smallButton,
        {
          backgroundColor: isLight
            ? isQuiet
              ? '#2f2f2d'
              : '#f7f7f4'
            : isQuiet
              ? theme.backgroundElement
              : theme.text,
          opacity: disabled ? 0.42 : pressed ? 0.72 : 1,
        },
      ]}>
      <ThemedText
        type="smallBold"
        numberOfLines={1}
        style={{
          color: isLight ? (isQuiet ? '#f7f7f4' : ink) : isQuiet ? theme.text : theme.background,
        }}>
        {label}
      </ThemedText>
    </Pressable>
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
  signedOut: {
    minHeight: 620,
    justifyContent: 'space-between',
    gap: Spacing.five,
  },
  signInBrand: {
    paddingTop: Spacing.five,
    gap: Spacing.two,
  },
  signInTitle: {
    fontSize: 80,
    lineHeight: 84,
    fontWeight: '700',
    letterSpacing: 0,
  },
  signInSubtitle: {
    maxWidth: 260,
  },
  signInPanel: {
    borderRadius: 8,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  signInRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'center',
  },
  loginActions: {
    gap: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  headerRight: {
    alignItems: 'flex-end',
    gap: Spacing.one,
    maxWidth: '55%',
  },
  todayLayout: {
    flexDirection: 'row',
    gap: Spacing.three,
    alignItems: 'stretch',
  },
  todayLayoutCompact: {
    flexDirection: 'column',
  },
  photoWell: {
    flex: 1.15,
    aspectRatio: 3 / 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  photoPreview: {
    width: '100%',
    height: '100%',
  },
  photoEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
  },
  photoTime: {
    color: '#f7f7f4',
    fontSize: 44,
    lineHeight: 48,
    fontWeight: '700',
    letterSpacing: 0,
  },
  photoEmptyText: {
    color: '#d8d8d1',
    textTransform: 'uppercase',
  },
  todaySide: {
    flex: 0.85,
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  todayTitle: {
    textTransform: 'lowercase',
  },
  actionStack: {
    gap: Spacing.two,
  },
  panel: {
    gap: Spacing.three,
  },
  requestPanel: {
    borderRadius: 8,
    padding: Spacing.three,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  formRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'center',
  },
  input: {
    minHeight: 48,
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
    flex: 1,
  },
  darkInput: {
    minHeight: 48,
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
    flex: 1,
    backgroundColor: '#2f2f2d',
  },
  button: {
    minHeight: 48,
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallButton: {
    minHeight: 40,
    paddingHorizontal: Spacing.two,
  },
  personRow: {
    minHeight: 60,
    borderRadius: 8,
    padding: Spacing.two,
    gap: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
  },
  mutedRow: {
    opacity: 0.68,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mutedAvatar: {
    backgroundColor: quiet,
  },
  avatarText: {
    color: '#f7f7f4',
  },
  personText: {
    flex: 1,
    minWidth: 0,
  },
  status: {
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
});
