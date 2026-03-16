import * as SecureStore from 'expo-secure-store';

export type Session = {
  date: string;
  gradeCounts: Record<string, number>;
  holdTypes: string[];
  movementTypes: string[];
  res: number;
  notes?: string;
};

export type CheckIn = {
  date: string;
  soreness: string;
  affectedFingers: string[];
  painAreas: string[];
  isRestDay?: boolean;
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

const DEFAULT_ALERT_SETTINGS: AlertSettings = {
  weeklyLoad: true,
  injuryOverload: true,
  bodyHighLoad: true,
};

export const getAlertSettings = async (): Promise<AlertSettings> => {
  const data = await secureGet('alertSettings');
  return data ? { ...DEFAULT_ALERT_SETTINGS, ...JSON.parse(data) } : DEFAULT_ALERT_SETTINGS;
};

export const saveAlertSettings = async (settings: AlertSettings): Promise<void> => {
  await secureSet('alertSettings', JSON.stringify(settings));
};

export type BodyAlert = {
  partId: string;
  partName: string;
  count: number;
  threshold: number;
  suggestion: string;
};

// ─── SecureStore helpers (handles >2KB by chunking) ──────────────────────────

const CHUNK_SIZE = 1800;

const secureSetLarge = async (key: string, value: string): Promise<void> => {
  try {
    const chunks = Math.ceil(value.length / CHUNK_SIZE);
    await SecureStore.setItemAsync(`${key}__count`, String(chunks));
    for (let i = 0; i < chunks; i++) {
      await SecureStore.setItemAsync(`${key}__${i}`, value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));
    }
  } catch (e) {
    console.error(`secureSetLarge error [${key}]`, e);
  }
};

const secureGetLarge = async (key: string): Promise<string | null> => {
  try {
    const countStr = await SecureStore.getItemAsync(`${key}__count`);
    if (!countStr) return null;
    const count = parseInt(countStr);
    let result = '';
    for (let i = 0; i < count; i++) {
      const chunk = await SecureStore.getItemAsync(`${key}__${i}`);
      result += chunk || '';
    }
    return result;
  } catch {
    return null;
  }
};

const secureDeleteLarge = async (key: string): Promise<void> => {
  try {
    const countStr = await SecureStore.getItemAsync(`${key}__count`);
    if (!countStr) return;
    const count = parseInt(countStr);
    await SecureStore.deleteItemAsync(`${key}__count`);
    for (let i = 0; i < count; i++) {
      await SecureStore.deleteItemAsync(`${key}__${i}`);
    }
  } catch {}
};

const secureGet = async (key: string): Promise<string | null> => {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
};

const secureSet = async (key: string, value: string): Promise<void> => {
  try {
    await SecureStore.setItemAsync(key, value);
  } catch (e) {
    console.error(`SecureStore set error [${key}]`, e);
  }
};

const secureDelete = async (key: string): Promise<void> => {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {}
};

// ─── Profile (small — direct SecureStore) ────────────────────────────────────

export const saveProfile = async (profile: UserProfile): Promise<void> => {
  await secureSet('profile', JSON.stringify(profile));
};

export const getProfile = async (): Promise<UserProfile | null> => {
  const data = await secureGet('profile');
  return data ? JSON.parse(data) : null;
};

// ─── Sessions (large — chunked SecureStore) ───────────────────────────────────

export const saveSession = async (session: Session): Promise<void> => {
  const existing = await getSessions();
  const updated = { ...existing, [session.date]: session };
  await secureSetLarge('sessions', JSON.stringify(updated));
};

export const getSessions = async (): Promise<Record<string, Session>> => {
  const data = await secureGetLarge('sessions');
  return data ? JSON.parse(data) : {};
};

export const deleteSessionsByKey = async (dateKey: string): Promise<void> => {
  const existing = await getSessions();
  delete existing[dateKey];
  await secureSetLarge('sessions', JSON.stringify(existing));
};

// ─── Check-ins (large — chunked SecureStore) ──────────────────────────────────

export const saveCheckIn = async (checkIn: CheckIn): Promise<void> => {
  const existing = await getCheckIns();
  const updated = { ...existing, [checkIn.date]: checkIn };
  await secureSetLarge('checkins', JSON.stringify(updated));
};

export const getCheckIns = async (): Promise<Record<string, CheckIn>> => {
  const data = await secureGetLarge('checkins');
  return data ? JSON.parse(data) : {};
};

export const deleteCheckInByKey = async (dateKey: string): Promise<void> => {
  const existing = await getCheckIns();
  delete existing[dateKey];
  await secureSetLarge('checkins', JSON.stringify(existing));
};

// ─── Goal Date (small — direct SecureStore) ───────────────────────────────────

export const saveGoalDate = async (dateStr: string): Promise<void> => {
  await secureSet('goalDate', dateStr);
};

export const getGoalDate = async (): Promise<string | null> => {
  return await secureGet('goalDate');
};

export const deleteGoalDate = async (): Promise<void> => {
  await secureDelete('goalDate');
};

// ─── Clear all ────────────────────────────────────────────────────────────────

export const getDarkMode = async (): Promise<boolean> => {
  const val = await secureGet('darkMode');
  return val === 'true';
};

export const saveDarkMode = async (val: boolean): Promise<void> => {
  await secureSet('darkMode', val ? 'true' : 'false');
};

export const clearAllData = async (): Promise<void> => {
  await Promise.all([
    secureDelete('profile'),
    secureDelete('goalDate'),
    secureDelete('darkMode'),
    secureDelete('alertSettings'),
    secureDelete('onboardingComplete'),
    secureDeleteLarge('sessions'),
    secureDeleteLarge('checkins'),
  ]);
};

export const getOnboardingComplete = async (): Promise<boolean> => {
  try { return (await SecureStore.getItemAsync('onboardingComplete')) === 'true'; }
  catch { return false; }
};

export const markOnboardingComplete = async (): Promise<void> => {
  await SecureStore.setItemAsync('onboardingComplete', 'true');
};

// ─── Date helper ──────────────────────────────────────────────────────────────

export const getTodayDate = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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