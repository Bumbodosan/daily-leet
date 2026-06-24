import { Link } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import {
  acceptFriendRequest,
  ApiError,
  FriendRelationships,
  getFriendRelationships,
  getMe,
  requestMagicLink,
  sendFriendRequest,
  User,
} from '@/lib/api';
import { AuthPanel } from '@/components/auth-panel';
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

export default function FriendsScreen() {
  const theme = useTheme();
  const [user, setUser] = useState<User | null>(null);
  const [relationships, setRelationships] = useState(emptyRelationships);
  const [friendEmail, setFriendEmail] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [acceptingUserId, setAcceptingUserId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setError('');

    try {
      const [{ user: currentUser }, friendRelationships] = await Promise.all([
        getMe(),
        getFriendRelationships(),
      ]);
      setUser(currentUser);
      setRelationships(friendRelationships);
    } catch (caughtError) {
      if (caughtError instanceof ApiError && caughtError.status === 401) {
        setUser(null);
        setRelationships(emptyRelationships);
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

  async function handleAddFriend() {
    setIsSending(true);
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
      setIsSending(false);
    }
  }

  async function handleAccept(userId: string) {
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
        <View style={styles.addPanel}>
          <ThemedText type="smallBold">Add friend</ThemedText>
          <View style={styles.formRow}>
            <TextInput
              value={friendEmail}
              onChangeText={setFriendEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder="friend@example.com"
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
            />
            <ActionButton
              label={isSending ? 'Adding' : 'Add'}
              disabled={!friendEmail || isSending}
              onPress={handleAddFriend}
            />
          </View>
          {error || message ? (
            <ThemedText type="small" selectable style={error ? styles.errorText : styles.okText}>
              {error || message}
            </ThemedText>
          ) : null}
        </View>

        {relationships.incomingRequests.length > 0 ? (
          <View style={styles.section}>
            <ThemedText type="smallBold">Requests</ThemedText>
            {relationships.incomingRequests.map((person) => (
              <PersonRow
                key={person.id}
                person={person}
                actionLabel={acceptingUserId === person.id ? 'Adding' : 'Add back'}
                disabled={acceptingUserId === person.id}
                onAction={() => handleAccept(person.id)}
              />
            ))}
          </View>
        ) : null}

        <View style={styles.section}>
          <ThemedText type="smallBold">Friends</ThemedText>
          {relationships.friends.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              no friends yet
            </ThemedText>
          ) : (
            relationships.friends.map((friend) => <PersonRow key={friend.id} person={friend} linked />)
          )}
        </View>

        {relationships.outgoingRequests.length > 0 ? (
          <View style={styles.section}>
            <ThemedText type="smallBold">Sent</ThemedText>
            {relationships.outgoingRequests.map((person) => (
              <PersonRow key={person.id} person={person} note="pending" muted />
            ))}
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

function ActionButton({
  label,
  disabled,
  onPress,
}: {
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: theme.text, opacity: disabled ? 0.42 : pressed ? 0.75 : 1 },
      ]}>
      <ThemedText type="smallBold" style={{ color: theme.background }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function PersonRow({
  person,
  note,
  muted,
  linked,
  actionLabel,
  disabled,
  onAction,
}: {
  person: User;
  note?: string;
  muted?: boolean;
  linked?: boolean;
  actionLabel?: string;
  disabled?: boolean;
  onAction?: () => void;
}) {
  const theme = useTheme();
  const content = (
    <View style={[styles.personRow, { backgroundColor: theme.backgroundElement }, muted && styles.muted]}>
      <View style={styles.avatar}>
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
        <ActionButton label={actionLabel} disabled={disabled} onPress={onAction} />
      ) : null}
    </View>
  );

  if (!linked) {
    return content;
  }

  return (
    <Link href={`/users/${person.id}`} asChild>
      <Pressable>{content}</Pressable>
    </Link>
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
  addPanel: {
    gap: Spacing.three,
  },
  formRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  input: {
    flex: 1,
    minHeight: 48,
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  button: {
    minHeight: 48,
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    gap: Spacing.two,
  },
  personRow: {
    minHeight: 60,
    borderRadius: 8,
    padding: Spacing.two,
    gap: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
  },
  muted: {
    opacity: 0.65,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#f7f7f4',
  },
  personText: {
    flex: 1,
    minWidth: 0,
  },
  errorText: {
    color: '#b35b3e',
  },
  okText: {
    color: '#53745c',
  },
});
