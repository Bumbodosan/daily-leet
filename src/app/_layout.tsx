import * as Notifications from 'expo-notifications';
import { DarkTheme, DefaultTheme, router, ThemeProvider } from 'expo-router';
import { useEffect } from 'react';
import { Platform, useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
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
      <AnimatedSplashOverlay />
      <AppTabs />
    </ThemeProvider>
  );
}
