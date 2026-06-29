import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { completeMagicLinkLogin } from '@/lib/api';
import { useAuthSession } from '@/lib/auth-session';

export default function AuthCallbackScreen() {
  const theme = useTheme();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const { refreshAuth } = useAuthSession();
  const handledTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!token || handledTokenRef.current === token) {
      return;
    }

    handledTokenRef.current = token;

    completeMagicLinkLogin(token)
      .then(async () => {
        await refreshAuth();
        router.replace({
          pathname: '/',
          params: { auth: String(Date.now()) },
        });
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : 'Login failed';
        console.warn('Failed to complete magic link login', error);
        router.replace({
          pathname: '/',
          params: { authError: message },
        });
      });
  }, [refreshAuth, token]);

  return (
    <ThemedView style={styles.container}>
      <ActivityIndicator color={theme.text} />
      <ThemedText type="small" themeColor="textSecondary">
        signing you in…
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
});
