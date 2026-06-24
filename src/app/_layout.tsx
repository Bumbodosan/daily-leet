import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { scheduleDailyReminderNotification } from '@/notifications/daily-reminder';

export default function TabLayout() {
  const colorScheme = useColorScheme();

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
