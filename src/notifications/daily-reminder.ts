import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const DAILY_REMINDER_NOTIFICATION_ID = 'daily-1337-reminder';
const DAILY_REMINDER_CHANNEL_ID = 'daily-reminders';
const DAILY_REMINDER_HOUR = 13;
const DAILY_REMINDER_MINUTE = 37;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function ensureNotificationPermissions() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(DAILY_REMINDER_CHANNEL_ID, {
      name: 'Daily reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const permissions = await Notifications.getPermissionsAsync();
  if (permissions.granted) {
    return true;
  }

  const requestedPermissions = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: false,
      allowSound: true,
    },
  });

  return (
    requestedPermissions.granted ||
    requestedPermissions.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
}

export async function scheduleDailyReminderNotification() {
  if (Platform.OS === 'web') {
    return;
  }

  const hasPermissions = await ensureNotificationPermissions();
  if (!hasPermissions) {
    return;
  }

  await Notifications.cancelScheduledNotificationAsync(DAILY_REMINDER_NOTIFICATION_ID);
  await Notifications.scheduleNotificationAsync({
    identifier: DAILY_REMINDER_NOTIFICATION_ID,
    content: {
      title: 'Daily reminder',
      body: "It's 13:37.",
      sound: 'default',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      channelId: DAILY_REMINDER_CHANNEL_ID,
      hour: DAILY_REMINDER_HOUR,
      minute: DAILY_REMINDER_MINUTE,
    },
  });
}
