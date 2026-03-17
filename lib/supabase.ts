import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

const SUPABASE_URL = 'https://kfheoistdhwnpmggoqpu.supabase.co';
const SUPABASE_KEY = 'sb_publishable_KhLHp-V277YyR55_B-pQcQ_MBcJojIj';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// ─── Auth helpers ─────────────────────────────────────────────────────────────

export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

export const signOut = async () => {
  await supabase.auth.signOut();
};

// ─── Sync helpers ─────────────────────────────────────────────────────────────

export const syncProfile = async (profile: {
  name?: string;
  maxGrade: string;
  projectGrade: string;
  sendsToUnlock?: number;
}) => {
  const user = await getCurrentUser();
  if (!user) return;
  await supabase.from('profiles').upsert({
    id: user.id,
    name: profile.name,
    max_grade: profile.maxGrade,
    project_grade: profile.projectGrade,
    sends_to_unlock: profile.sendsToUnlock ?? 10,
    updated_at: new Date().toISOString(),
  });
};

export const syncSession = async (date: string, data: object) => {
  const user = await getCurrentUser();
  if (!user) return;
  await supabase.from('sessions').upsert(
    { user_id: user.id, date, data, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,date' }
  );
};

export const syncCheckIn = async (date: string, data: object) => {
  const user = await getCurrentUser();
  if (!user) return;
  await supabase.from('checkins').upsert(
    { user_id: user.id, date, data, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,date' }
  );
};

// ─── Restore all data from Supabase to AsyncStorage ──────────────────────────

export const restoreFromSupabase = async (): Promise<boolean> => {
  try {
    const user = await getCurrentUser();
    if (!user) return false;

    const [profileRes, sessionsRes, checkInsRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('sessions').select('*').eq('user_id', user.id),
      supabase.from('checkins').select('*').eq('user_id', user.id),
    ]);

    // Restore profile
    if (profileRes.data) {
      const p = profileRes.data;
      await AsyncStorage.setItem('profile', JSON.stringify({
        name: p.name,
        maxGrade: p.max_grade,
        projectGrade: p.project_grade,
        sendsToUnlock: p.sends_to_unlock,
      }));
      await AsyncStorage.setItem('onboardingComplete', 'true');
    }

    // Restore sessions
    if (sessionsRes.data?.length) {
      const sessions: Record<string, object> = {};
      sessionsRes.data.forEach(row => { sessions[row.date] = row.data; });
      await AsyncStorage.setItem('sessions', JSON.stringify(sessions));
    }

    // Restore check-ins
    if (checkInsRes.data?.length) {
      const checkins: Record<string, object> = {};
      checkInsRes.data.forEach(row => { checkins[row.date] = row.data; });
      await AsyncStorage.setItem('checkins', JSON.stringify(checkins));
    }

    return !!(profileRes.data);
  } catch (e) {
    console.error('restoreFromSupabase error', e);
    return false;
  }
};
