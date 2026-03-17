import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ReminderSettings = {
  enabled: boolean;
  hour: number;    // 0–23
  minute: number;
};

const DEFAULT_REMINDER: ReminderSettings = {
  enabled: false,
  hour: 8,
  minute: 0,
};

// ─── Persistence ──────────────────────────────────────────────────────────────

export const getReminderSettings = async (): Promise<ReminderSettings> => {
  try {
    const data = await AsyncStorage.getItem('reminderSettings');
    return data ? { ...DEFAULT_REMINDER, ...JSON.parse(data) } : DEFAULT_REMINDER;
  } catch {
    return DEFAULT_REMINDER;
  }
};

export const saveReminderSettings = async (settings: ReminderSettings): Promise<void> => {
  await AsyncStorage.setItem('reminderSettings', JSON.stringify(settings));
};

// ─── Permissions ──────────────────────────────────────────────────────────────

export const requestNotificationPermissions = async (): Promise<boolean> => {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
};

// ─── Configure notification handler (call once at app start) ─────────────────

export const configureNotifications = () => {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
};

// ─── Daily check-in reminder ──────────────────────────────────────────────────

export const scheduleDailyReminder = async (hour: number, minute: number): Promise<void> => {
  await Notifications.cancelScheduledNotificationAsync('daily-reminder').catch(() => {});
  await Notifications.scheduleNotificationAsync({
    identifier: 'daily-reminder',
    content: {
      title: 'Morning Check-in',
      body: 'How is your body feeling today? A quick check-in keeps your recovery on track.',
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
};

export const cancelDailyReminder = async (): Promise<void> => {
  await Notifications.cancelScheduledNotificationAsync('daily-reminder').catch(() => {});
};

// ─── Streak protection (fires at 8pm if no check-in yet today) ───────────────

export const scheduleStreakProtection = async (): Promise<void> => {
  await Notifications.cancelScheduledNotificationAsync('streak-protection').catch(() => {});
  const now = new Date();
  const fireAt = new Date(now);
  fireAt.setHours(20, 0, 0, 0);
  if (fireAt <= now) return; // already past 8pm

  await Notifications.scheduleNotificationAsync({
    identifier: 'streak-protection',
    content: {
      title: 'Keep your streak alive',
      body: "You haven't logged your check-in yet today — don't break the streak.",
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: fireAt,
    },
  });
};

export const cancelStreakProtection = async (): Promise<void> => {
  await Notifications.cancelScheduledNotificationAsync('streak-protection').catch(() => {});
};

// ─── Recovery reminder (next morning after a session) ────────────────────────

export const scheduleRecoveryReminder = async (res: number): Promise<void> => {
  if (res <= 40) return; // light session — no reminder needed

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(8, 0, 0, 0);

  const body = res > 70
    ? 'You had a hard session yesterday — check in on your body before climbing again.'
    : 'You trained yesterday — how are you feeling? Log your check-in to track recovery.';

  await Notifications.cancelScheduledNotificationAsync('recovery-reminder').catch(() => {});
  await Notifications.scheduleNotificationAsync({
    identifier: 'recovery-reminder',
    content: {
      title: 'Recovery Check-in',
      body,
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: tomorrow,
    },
  });
};

export const cancelRecoveryReminder = async (): Promise<void> => {
  await Notifications.cancelScheduledNotificationAsync('recovery-reminder').catch(() => {});
};

// ─── Apply full reminder config (call after any settings change) ──────────────

export const applyReminderSettings = async (settings: ReminderSettings): Promise<void> => {
  if (settings.enabled) {
    const granted = await requestNotificationPermissions();
    if (granted) await scheduleDailyReminder(settings.hour, settings.minute);
  } else {
    await cancelDailyReminder();
  }
};
