import AsyncStorage from '@react-native-async-storage/async-storage';

export type Session = {
  date: string;
  gradeCounts: Record<string, number>;
  holdTypes: string[];
  movementTypes: string[];
  res: number;
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
};

export const saveSession = async (session: Session) => {
  try {
    const existing = await getSessions();
    const updated = { ...existing, [session.date]: session };
    await AsyncStorage.setItem('sessions', JSON.stringify(updated));
  } catch (e) {
    console.error('Error saving session', e);
  }
};

export const getSessions = async (): Promise<Record<string, Session>> => {
  try {
    const data = await AsyncStorage.getItem('sessions');
    return data ? JSON.parse(data) : {};
  } catch (e) {
    return {};
  }
};

export const saveCheckIn = async (checkIn: CheckIn) => {
  try {
    const existing = await getCheckIns();
    const updated = { ...existing, [checkIn.date]: checkIn };
    await AsyncStorage.setItem('checkins', JSON.stringify(updated));
  } catch (e) {
    console.error('Error saving checkin', e);
  }
};

export const getCheckIns = async (): Promise<Record<string, CheckIn>> => {
  try {
    const data = await AsyncStorage.getItem('checkins');
    return data ? JSON.parse(data) : {};
  } catch (e) {
    return {};
  }
};

export const saveProfile = async (profile: UserProfile) => {
  try {
    await AsyncStorage.setItem('profile', JSON.stringify(profile));
  } catch (e) {
    console.error('Error saving profile', e);
  }
};

export const getProfile = async (): Promise<UserProfile | null> => {
  try {
    const data = await AsyncStorage.getItem('profile');
    return data ? JSON.parse(data) : null;
  } catch (e) {
    return null;
  }
};

export const getTodayDate = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export type BodyPartCounts = Record<string, number>;

export type BodyAlert = {
  partId: string;
  partName: string;
  count: number;
  threshold: number;
  suggestion: string;
};

const ID_TO_PART: Record<string, { id: string; name: string }> = {
  crimps: { id: 'finger', name: 'Fingers / A2 Pulley' },
  pockets: { id: 'finger', name: 'Fingers / A2 Pulley' },
  pinches: { id: 'thumb', name: 'Thumb' },
  slopers: { id: 'shoulder', name: 'Shoulder' },
  jugs: { id: 'low', name: 'Low risk / General' },
  dynos: { id: 'shoulder', name: 'Shoulder' },
  heelhooks: { id: 'knee', name: 'Knee' },
  toehooks: { id: 'ankle', name: 'Ankle' },
  compression: { id: 'hip', name: 'Hip' },
  mantles: { id: 'wrist', name: 'Wrist' },
};

const DEFAULT_THRESHOLDS: Record<string, number> = {
  finger: 6,
  shoulder: 8,
  thumb: 6,
  knee: 8,
  ankle: 8,
  hip: 8,
  wrist: 8,
  low: 12,
};

export const computeBodyLoads = (sessions: Record<string, Session>, windowDays = 14): BodyPartCounts => {
  const counts: BodyPartCounts = {};
  const today = new Date();

  Object.entries(sessions).forEach(([dateStr, sess]) => {
    const d = new Date(dateStr);
    const diffDays = Math.floor((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0 || diffDays >= windowDays) return;

    sess.holdTypes?.forEach((hid) => {
      const map = ID_TO_PART[hid];
      const key = map ? map.id : 'low';
      counts[key] = (counts[key] || 0) + 1;
    });
    sess.movementTypes?.forEach((mid) => {
      const map = ID_TO_PART[mid];
      const key = map ? map.id : 'low';
      counts[key] = (counts[key] || 0) + 1;
    });
  });

  return counts;
};

export const getInjuryAlerts = async (windowDays = 14): Promise<BodyAlert[]> => {
  try {
    const sessions = await getSessions();
    const counts = computeBodyLoads(sessions, windowDays);
    const alerts: BodyAlert[] = [];

    Object.entries(counts).forEach(([partId, count]) => {
      const threshold = DEFAULT_THRESHOLDS[partId] ?? 10;
      if (count >= threshold) {
        const partName = Object.values(ID_TO_PART).find(p => p.id === partId)?.name || partId;
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