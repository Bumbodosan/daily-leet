import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function AuthPanel({
  error,
  message,
  onSubmit,
  onRefresh,
}: {
  error: string;
  message: string;
  onSubmit: (email: string) => Promise<void>;
  onRefresh: () => void;
}) {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [isSending, setIsSending] = useState(false);

  async function handleSubmit() {
    setIsSending(true);

    try {
      await onSubmit(email);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <ThemedView style={styles.root}>
      <View style={styles.panel}>
        <View>
          <ThemedText type="small" themeColor="textSecondary">
            leet
          </ThemedText>
          <ThemedText style={styles.time}>13:37</ThemedText>
          <ThemedText type="default" themeColor="textSecondary">
            friends only. one minute.
          </ThemedText>
        </View>

        <View style={[styles.form, { backgroundColor: theme.text }]}>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder="you@example.com"
            placeholderTextColor="#8a8a84"
            style={[styles.input, { color: theme.background }]}
          />
          <Pressable
            disabled={!email || isSending}
            onPress={handleSubmit}
            style={({ pressed }) => [
              styles.button,
              { opacity: !email || isSending ? 0.45 : pressed ? 0.75 : 1 },
            ]}>
            <ThemedText type="smallBold" style={styles.buttonText}>
              {isSending ? 'Sending' : 'Send link'}
            </ThemedText>
          </Pressable>
          <Pressable onPress={onRefresh}>
            <ThemedText type="small" style={styles.refreshText}>
              refresh session
            </ThemedText>
          </Pressable>
          {error || message ? (
            <ThemedText
              type="small"
              selectable
              style={{ color: error ? '#ffb199' : '#d9ead7' }}>
              {error || message}
            </ThemedText>
          ) : null}
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.three,
  },
  panel: {
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: Spacing.five,
  },
  time: {
    fontSize: 80,
    lineHeight: 84,
    fontWeight: '700',
    letterSpacing: 0,
  },
  form: {
    borderRadius: 8,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  input: {
    minHeight: 52,
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    backgroundColor: '#2f2f2d',
    fontSize: 16,
  },
  button: {
    minHeight: 52,
    borderRadius: 8,
    backgroundColor: '#f7f7f4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#111111',
  },
  refreshText: {
    color: '#d8d8d1',
  },
});
