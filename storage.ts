import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { signOut as supabaseSignOut, syncCheckIn, syncProfile, syncSession } from './lib/supabase';

export type Session = {
  date: string;
  gradeCounts: Record<string, number>;
  holdTypes: string[];
  movementTypes: string[];
  res: number;
  notes?: string;
  mediaUris?: string[];
};

export type CheckIn = {
  date: string;
  soreness: string;
  affectedFingers: string[];
  painAreas: string[];
  isRestDay?: boolean;
  mediaUris?: string[];
  notes?: string;
};

export type InjuryEntry = {
  id: string;
  partId: string;
  partName: string;
  note: string;
  date: string;
  resolved: boolean;
};

export type UserProfile = {
  maxGrade: string;
  projectGrade: string;
  name?: string;
  sendsToUnlock?: number;
};

export type BodyPartCounts = Record<string, number>;

export type AlertSettings = {
  weeklyLoad: boolean;
  injuryOverload: boolean;
  bodyHighLoad: boolean;
};

export type BodyAlert = {
  partId: string;
  partName: string;
  count: number;
  threshold: number;
  suggestion: string;
};

// ─── Media file helpers ───────────────────────────────────────────────────────

const MEDIA_DIR = FileSystem.documentDirectory + 'crux-media/';

const ensureMediaDir = async () => {
  const info = await FileSystem.getInfoAsync(MEDIA_DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(MEDIA_DIR, { intermediates: true });
};

export const copyMediaToStorage = async (uri: string): Promise<string> => {
  await ensureMediaDir();
  const ext = uri.split('.').pop()?.split('?')[0] || 'jpg';
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const dest = MEDIA_DIR + filename;
  await FileSystem.copyAsync({ from: uri, to: dest });
  return dest;
};

export const deleteMediaFiles = async (uris: string[]): Promise<void> => {
  await Promise.all(uris.map(uri =>
    FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {})
  ));
};

// ─── AsyncStorage helpers ─────────────────────────────────────────────────────

const get = async (key: string): Promise<string | null> => {
  try { return await AsyncStorage.getItem(key); }
  catch { return null; }
};

const set = async (key: string, value: string): Promise<void> => {
  try { await AsyncStorage.setItem(key, value); }
  catch (e) { console.error(`AsyncStorage set error [${key}]`, e); }
};

const remove = async (key: string): Promise<void> => {
  try { await AsyncStorage.removeItem(key); }
  catch {}
};

// ─── Alert Settings ───────────────────────────────────────────────────────────

const DEFAULT_ALERT_SETTINGS: AlertSettings = {
  weeklyLoad: true,
  injuryOverload: true,
  bodyHighLoad: true,
};

export const getAlertSettings = async (): Promise<AlertSettings> => {
  const data = await get('alertSettings');
  return data ? { ...DEFAULT_ALERT_SETTINGS, ...JSON.parse(data) } : DEFAULT_ALERT_SETTINGS;
};

export const saveAlertSettings = async (settings: AlertSettings): Promise<void> => {
  await set('alertSettings', JSON.stringify(settings));
};

// ─── Profile ──────────────────────────────────────────────────────────────────

export const saveProfile = async (profile: UserProfile): Promise<void> => {
  await set('profile', JSON.stringify(profile));
  syncProfile(profile).catch(() => {});
};

export const getProfile = async (): Promise<UserProfile | null> => {
  const data = await get('profile');
  return data ? JSON.parse(data) : null;
};

// ─── Sessions ─────────────────────────────────────────────────────────────────

export const saveSession = async (session: Session): Promise<void> => {
  const existing = await getSessions();
  const updated = { ...existing, [session.date]: session };
  await set('sessions', JSON.stringify(updated));
  syncSession(session.date, session).catch(() => {});
};

export const getSessions = async (): Promise<Record<string, Session>> => {
  const data = await get('sessions');
  return data ? JSON.parse(data) : {};
};

export const deleteSessionsByKey = async (dateKey: string): Promise<void> => {
  const existing = await getSessions();
  delete existing[dateKey];
  await set('sessions', JSON.stringify(existing));
};

// ─── Check-ins ────────────────────────────────────────────────────────────────

export const saveCheckIn = async (checkIn: CheckIn): Promise<void> => {
  const existing = await getCheckIns();
  const updated = { ...existing, [checkIn.date]: checkIn };
  await set('checkins', JSON.stringify(updated));
  syncCheckIn(checkIn.date, checkIn).catch(() => {});
};

export const getCheckIns = async (): Promise<Record<string, CheckIn>> => {
  const data = await get('checkins');
  return data ? JSON.parse(data) : {};
};

export const deleteCheckInByKey = async (dateKey: string): Promise<void> => {
  const existing = await getCheckIns();
  delete existing[dateKey];
  await set('checkins', JSON.stringify(existing));
};

// ─── Goal Date ────────────────────────────────────────────────────────────────

export const saveGoalDate = async (dateStr: string): Promise<void> => {
  await set('goalDate', dateStr);
};

export const getGoalDate = async (): Promise<string | null> => {
  return await get('goalDate');
};

export const deleteGoalDate = async (): Promise<void> => {
  await remove('goalDate');
};

// ─── Dark Mode ────────────────────────────────────────────────────────────────

export const getDarkMode = async (): Promise<boolean> => {
  const val = await get('darkMode');
  return val === 'true';
};

export const saveDarkMode = async (val: boolean): Promise<void> => {
  await set('darkMode', val ? 'true' : 'false');
};

// ─── Grade System ─────────────────────────────────────────────────────────────

export const getGradeSystem = async (): Promise<'V' | 'font'> => {
  const val = await get('gradeSystem');
  return val === 'font' ? 'font' : 'V';
};

export const saveGradeSystem = async (val: 'V' | 'font'): Promise<void> => {
  await set('gradeSystem', val);
};

// ─── Onboarding ───────────────────────────────────────────────────────────────

export const getOnboardingComplete = async (): Promise<boolean> => {
  try { return (await AsyncStorage.getItem('onboardingComplete')) === 'true'; }
  catch { return false; }
};

export const markOnboardingComplete = async (): Promise<void> => {
  await AsyncStorage.setItem('onboardingComplete', 'true');
};

// ─── Clear all ────────────────────────────────────────────────────────────────

export const clearAllData = async (): Promise<void> => {
  await FileSystem.deleteAsync(MEDIA_DIR, { idempotent: true }).catch(() => {});
  await AsyncStorage.multiRemove([
    'profile', 'goalDate', 'darkMode', 'alertSettings',
    'onboardingComplete', 'sessions', 'checkins', 'reminderSettings', 'gradeSystem',
  ]);
  await supabaseSignOut().catch(() => {});
};

// ─── Date helper ──────────────────────────────────────────────────────────────

export const getTodayDate = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const purgeFutureDates = async (): Promise<void> => {
  const today = getTodayDate();
  const [sessions, checkIns] = await Promise.all([getSessions(), getCheckIns()]);
  const futureSessions = Object.keys(sessions).filter(d => d > today);
  const futureCheckIns = Object.keys(checkIns).filter(d => d > today);
  if (futureSessions.length > 0) {
    futureSessions.forEach(d => delete sessions[d]);
    await set('sessions', JSON.stringify(sessions));
  }
  if (futureCheckIns.length > 0) {
    futureCheckIns.forEach(d => delete checkIns[d]);
    await set('checkins', JSON.stringify(checkIns));
  }
};

// ─── Injury tracking ──────────────────────────────────────────────────────────

const ID_TO_PART: Record<string, { id: string; name: string }> = {
  crimps:      { id: 'finger',   name: 'Fingers / A2 Pulley' },
  pockets:     { id: 'finger',   name: 'Fingers / A2 Pulley' },
  pinches:     { id: 'thumb',    name: 'Thumb' },
  slopers:     { id: 'shoulder', name: 'Shoulder' },
  jugs:        { id: 'low',      name: 'Low risk / General' },
  dynos:       { id: 'shoulder', name: 'Shoulder' },
  heelhooks:   { id: 'knee',     name: 'Knee' },
  toehooks:    { id: 'ankle',    name: 'Ankle' },
  compression: { id: 'hip',      name: 'Hip' },
  mantles:     { id: 'wrist',    name: 'Wrist' },
};

const PART_NAMES: Record<string, string> = {
  finger:   'Fingers / A2 Pulley',
  thumb:    'Thumb',
  shoulder: 'Shoulder',
  elbow:    'Elbow',
  wrist:    'Wrist',
  knee:     'Knee',
  hip:      'Hip',
  ankle:    'Ankle',
  low:      'Low risk / General',
};

const DEFAULT_THRESHOLDS: Record<string, number> = {
  finger:   6,
  shoulder: 8,
  thumb:    6,
  elbow:    4,
  knee:     8,
  ankle:    8,
  hip:      8,
  wrist:    8,
  low:      12,
};

const PAIN_AREA_TO_PART: Record<string, string> = {
  shoulder: 'shoulder',
  elbow:    'elbow',
  wrist:    'wrist',
  knee:     'knee',
  hip:      'hip',
};

export const computeBodyLoads = (
  sessions: Record<string, Session>,
  windowDays = 14,
  checkIns: Record<string, CheckIn> = {}
): BodyPartCounts => {
  const counts: BodyPartCounts = {};
  const today = new Date();

  const inWindow = (dateStr: string) => {
    const diff = Math.floor((today.getTime() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
    return diff >= 0 && diff < windowDays;
  };

  Object.entries(sessions).forEach(([dateStr, sess]) => {
    if (!inWindow(dateStr)) return;
    sess.holdTypes?.forEach((hid) => {
      const key = ID_TO_PART[hid]?.id ?? 'low';
      counts[key] = (counts[key] || 0) + 1;
    });
    sess.movementTypes?.forEach((mid) => {
      const key = ID_TO_PART[mid]?.id ?? 'low';
      counts[key] = (counts[key] || 0) + 1;
    });
  });

  Object.entries(checkIns).forEach(([dateStr, ci]) => {
    if (!inWindow(dateStr)) return;
    ci.painAreas?.forEach((area) => {
      const key = PAIN_AREA_TO_PART[area];
      if (key) counts[key] = (counts[key] || 0) + 1;
    });
    ci.affectedFingers?.forEach(() => {
      counts['finger'] = (counts['finger'] || 0) + 1;
    });
  });

  return counts;
};

export const getInjuryAlerts = async (windowDays = 14): Promise<BodyAlert[]> => {
  try {
    const [sessions, checkIns] = await Promise.all([getSessions(), getCheckIns()]);
    const counts = computeBodyLoads(sessions, windowDays, checkIns);
    const alerts: BodyAlert[] = [];

    Object.entries(counts).forEach(([partId, count]) => {
      const threshold = DEFAULT_THRESHOLDS[partId] ?? 10;
      if (count >= threshold) {
        const partName = PART_NAMES[partId] || partId;
        alerts.push({
          partId,
          partName,
          count,
          threshold,
          suggestion: `Consider reducing load on ${partName} and prioritize recovery`,
        });
      }
    });

    return alerts;
  } catch (e) {
    console.error('Error computing injury alerts', e);
    return [];
  }
};

// ─── Injury Log ───────────────────────────────────────────────────────────────

export const getInjuryLog = async (): Promise<InjuryEntry[]> => {
  try {
    const data = await AsyncStorage.getItem('injuryLog');
    return data ? JSON.parse(data) : [];
  } catch { return []; }
};

export const saveInjuryLog = async (log: InjuryEntry[]): Promise<void> => {
  await AsyncStorage.setItem('injuryLog', JSON.stringify(log));
};

export const addInjuryEntry = async (entry: InjuryEntry): Promise<void> => {
  const log = await getInjuryLog();
  await saveInjuryLog([...log, entry]);
};

export const resolveInjuryEntry = async (id: string): Promise<void> => {
  const log = await getInjuryLog();
  await saveInjuryLog(log.map(e => e.id === id ? { ...e, resolved: true } : e));
};
