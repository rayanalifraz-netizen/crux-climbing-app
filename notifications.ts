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
  const now = new Date();
  const fireAt = new Date(now);
  fireAt.setHours(hour, minute, 0, 0);
  if (fireAt <= now) fireAt.setDate(fireAt.getDate() + 1); // already passed today — schedule for tomorrow
  await Notifications.scheduleNotificationAsync({
    identifier: 'daily-reminder',
    content: {
      title: 'Morning Check-in',
      body: 'How is your body feeling today? A quick check-in keeps your recovery on track.',
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: fireAt,
    },
  });
};

// Call this after a check-in is saved so the reminder fires tomorrow, not again today
export const rescheduleReminderForTomorrow = async (): Promise<void> => {
  const settings = await getReminderSettings();
  if (!settings.enabled) return;
  await Notifications.cancelScheduledNotificationAsync('daily-reminder').catch(() => {});
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(settings.hour, settings.minute, 0, 0);
  await Notifications.scheduleNotificationAsync({
    identifier: 'daily-reminder',
    content: {
      title: 'Morning Check-in',
      body: 'How is your body feeling today? A quick check-in keeps your recovery on track.',
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: tomorrow,
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

// ─── Smart insight notifications ──────────────────────────────────────────────
// Computes data-driven insights and schedules them as local notifications.
// Call this each time the app loads with fresh CHI + session + check-in data.
// Fires at 2pm today (if still in future) or 2pm tomorrow.

const INSIGHT_PREFIX = 'insight-';
const MAX_INSIGHTS = 3;

export const cancelInsightNotifications = async (): Promise<void> => {
  await Promise.all(
    Array.from({ length: MAX_INSIGHTS }, (_, i) =>
      Notifications.cancelScheduledNotificationAsync(`${INSIGHT_PREFIX}${i}`).catch(() => {})
    )
  );
};

export const scheduleInsightNotifications = async (
  chiData: { chi: number; readiness: number; load: number; injury: number } | null,
  sessions: Record<string, any>,
  checkIns: Record<string, any>,
): Promise<void> => {
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;

  await cancelInsightNotifications();

  if (!chiData) return;

  const insights: { title: string; body: string }[] = [];
  const today = new Date().toISOString().split('T')[0];
  const todayCheckIn = checkIns[today];

  // 1. Critical CHI — body needs full rest
  if (chiData.chi < 45) {
    insights.push({
      title: 'Recovery Mode',
      body: `Your Climber Health Index is ${chiData.chi}/100 — your body needs a full rest day before your next session.`,
    });
  }
  // 2. Moderately low CHI — take it easy
  else if (chiData.chi < 65 && !todayCheckIn?.isRestDay) {
    insights.push({
      title: 'Take It Easy Today',
      body: `CHI is at ${chiData.chi} — your load or recovery is off. Consider a lighter session or rest day.`,
    });
  }

  // 3. No rest day after 4+ sessions in 7 days
  const now = new Date();
  let sessionCount = 0;
  let restCount = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().split('T')[0];
    if (sessions[ds]) sessionCount++;
    if (checkIns[ds]?.isRestDay) restCount++;
  }
  if (sessionCount >= 4 && restCount === 0 && insights.length < MAX_INSIGHTS) {
    insights.push({
      title: 'Rest Day Overdue',
      body: `You've logged ${sessionCount} sessions this week with no rest days. Your body needs a break — schedule one soon.`,
    });
  }

  // 4. High soreness for 2+ consecutive days
  let highSorenessStreak = 0;
  for (let i = 0; i < 4; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const ci = checkIns[d.toISOString().split('T')[0]];
    if (ci && !ci.isRestDay && parseInt(ci.soreness || '0') >= 7) highSorenessStreak++;
    else break;
  }
  if (highSorenessStreak >= 2 && insights.length < MAX_INSIGHTS) {
    insights.push({
      title: 'Soreness Alert',
      body: `Your soreness has been high for ${highSorenessStreak} days in a row. Take a rest day before this becomes an injury.`,
    });
  }

  // 5. Finger overload — crimps/pockets heavy week
  let fingerSessions = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const sess = sessions[d.toISOString().split('T')[0]];
    if (sess?.holdTypes?.some((h: string) => h === 'crimps' || h === 'pockets')) fingerSessions++;
  }
  if (fingerSessions >= 3 && insights.length < MAX_INSIGHTS) {
    insights.push({
      title: 'Finger Load Warning',
      body: `You've done ${fingerSessions} crimp or pocket sessions this week. Go easy on the fingers — or go sloper day.`,
    });
  }

  // 6. Great shape — project send window open
  if (chiData.chi >= 80 && chiData.injury >= 75 && insights.length < MAX_INSIGHTS) {
    insights.push({
      title: 'Green Light',
      body: `CHI is ${chiData.chi}/100 and your body is recovered. If you have a project — today could be the day.`,
    });
  }

  if (insights.length === 0) return;

  // Schedule at 2pm today or 2pm tomorrow if already past
  const fireBase = new Date(now);
  fireBase.setHours(14, 0, 0, 0);
  if (fireBase <= now) fireBase.setDate(fireBase.getDate() + 1);

  for (let i = 0; i < insights.length; i++) {
    const fireAt = new Date(fireBase);
    fireAt.setMinutes(i * 3); // stagger by 3 minutes so they don't stack
    await Notifications.scheduleNotificationAsync({
      identifier: `${INSIGHT_PREFIX}${i}`,
      content: { title: insights[i].title, body: insights[i].body, sound: true },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt },
    });
  }
};
