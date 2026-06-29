import * as Notifications from 'expo-notifications';
import { DarkTheme, DefaultTheme, router, ThemeProvider, useGlobalSearchParams, usePathname } from 'expo-router';
import { type ReactNode, useEffect } from 'react';
import { ActivityIndicator, Platform, useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { AuthPanel } from '@/components/auth-panel';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { AuthSessionProvider, useAuthSession } from '@/lib/auth-session';
import {
  DAILY_REMINDER_OPEN_CAMERA_ACTION,
  scheduleDailyReminderNotification,
} from '@/notifications/daily-reminder';

function isOpenCameraNotification(notification: Notifications.Notification) {
  return notification.request.content.data?.action === DAILY_REMINDER_OPEN_CAMERA_ACTION;
}

function openCameraFromNotification(notification: Notifications.Notification) {
  if (!isOpenCameraNotification(notification)) {
    return;
  }

  router.replace({
    pathname: '/',
    params: { openCamera: String(notification.date || Date.now()) },
  });
}

function useDailyReminderNotificationObserver() {
  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }

    let isMounted = true;

    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (!isMounted || !response?.notification) {
          return;
        }

        openCameraFromNotification(response.notification);
        return Notifications.clearLastNotificationResponseAsync();
      })
      .catch((error) => {
        console.warn('Failed to handle last notification response', error);
      });

    const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
      openCameraFromNotification(notification);
    });

    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      openCameraFromNotification(response.notification);
      Notifications.clearLastNotificationResponseAsync().catch((error) => {
        console.warn('Failed to clear notification response', error);
      });
    });

    return () => {
      isMounted = false;
      receivedSubscription.remove();
      responseSubscription.remove();
    };
  }, []);
}

function getParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function AuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const params = useGlobalSearchParams<{ authError?: string | string[] }>();
  const theme = useTheme();
  const { user, isLoading, error, message, requestLogin, refreshAuth } = useAuthSession();

  if (pathname === '/auth/callback') {
    return children;
  }

  if (isLoading) {
    return (
      <ThemedView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={theme.text} />
      </ThemedView>
    );
  }

  if (!user) {
    return (
      <AuthPanel
        error={getParamValue(params.authError) ?? error}
        message={message}
        onSubmit={requestLogin}
        onRefresh={() => {
          void refreshAuth();
        }}
      />
    );
  }

  return children;
}

export default function TabLayout() {
  const colorScheme = useColorScheme();

  useDailyReminderNotificationObserver();

  useEffect(() => {
    scheduleDailyReminderNotification().catch((error) => {
      console.warn('Failed to schedule daily reminder notification', error);
    });
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthSessionProvider>
        <AnimatedSplashOverlay />
        <AuthGate>
          <AppTabs />
        </AuthGate>
      </AuthSessionProvider>
    </ThemeProvider>
  );
}
