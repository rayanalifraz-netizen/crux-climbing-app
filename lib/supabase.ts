import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY!;

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// ─── Group Session ────────────────────────────────────────────────────────────

const GRADE_LIST = ['VB','V0','V1','V2','V3','V4','V5','V6','V7','V8','V9','V10','V11','V12','V13+'];

export function gradeToPoints(grade: string, attempts: number, isFlash: boolean): number {
  const base = Math.max(1, GRADE_LIST.indexOf(grade) + 1);
  const multiplier = isFlash ? 2 : attempts <= 4 ? 1.5 : 1;
  return Math.round(base * multiplier);
}

function generateJoinCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export type GroupSession = { id: string; join_code: string; host_user_id: string; host_name: string; date: string; is_ended: boolean };
export type LeaderboardEntry = { user_id: string; display_name: string; points: number };

export async function getOrCreateMyGroupSession(displayName: string): Promise<GroupSession | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const today = new Date().toISOString().slice(0, 10);
  const { data: existing } = await supabase.from('group_sessions').select('*').eq('host_user_id', user.id).eq('date', today).maybeSingle();
  if (existing) return existing as GroupSession;
  for (let i = 0; i < 5; i++) {
    const { data, error } = await supabase.from('group_sessions')
      .insert({ join_code: generateJoinCode(), host_user_id: user.id, host_name: displayName, date: today })
      .select().single();
    if (!error && data) {
      await supabase.from('group_session_members').insert({ session_id: data.id, user_id: user.id, display_name: displayName });
      return data as GroupSession;
    }
    if (error?.code !== '23505') break;
  }
  return null;
}

export async function joinGroupSessionByCode(code: string, displayName: string): Promise<GroupSession | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const today = new Date().toISOString().slice(0, 10);
  const { data: session } = await supabase.from('group_sessions').select('*').eq('join_code', code.toUpperCase().trim()).eq('date', today).eq('is_ended', false).maybeSingle();
  if (!session) return null;
  await supabase.from('group_session_members').upsert(
    { session_id: session.id, user_id: user.id, display_name: displayName },
    { onConflict: 'session_id,user_id' }
  );
  return session as GroupSession;
}

export async function getGroupLeaderboard(sessionId: string): Promise<LeaderboardEntry[]> {
  const [{ data: members }, { data: climbs }] = await Promise.all([
    supabase.from('group_session_members').select('user_id, display_name').eq('session_id', sessionId),
    supabase.from('group_session_climbs').select('user_id, points').eq('session_id', sessionId),
  ]);
  const pts: Record<string, number> = {};
  (climbs || []).forEach(c => { pts[c.user_id] = (pts[c.user_id] || 0) + c.points; });
  return (members || [])
    .map(m => ({ user_id: m.user_id, display_name: m.display_name, points: pts[m.user_id] || 0 }))
    .sort((a, b) => b.points - a.points);
}

export async function addClimbToGroupSession(sessionId: string, grade: string, points: number): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  await supabase.from('group_session_climbs').insert({ session_id: sessionId, user_id: user.id, grade, points });
}

export async function removeClimbFromGroupSession(sessionId: string, grade: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  // Remove the most recent matching climb
  const { data } = await supabase.from('group_session_climbs').select('id').eq('session_id', sessionId).eq('user_id', user.id).eq('grade', grade).order('logged_at', { ascending: false }).limit(1);
  if (data?.[0]) await supabase.from('group_session_climbs').delete().eq('id', data[0].id);
}

export type GroupResultEntry = { user_id: string; display_name: string; points: number; climbs: { grade: string; points: number }[] };
export type GroupResult = { id: string; date: string; host_user_id: string; host_name: string; entries: GroupResultEntry[] };

// All ended group sessions the current user was part of, keyed by date.
// Returns null when signed out or on error so callers can keep their local cache.
export async function fetchMyGroupResults(): Promise<Record<string, GroupResult[]> | null> {
  try {
    const user = await getCurrentUser();
    if (!user) return null;
    const { data: memberships } = await supabase.from('group_session_members').select('session_id').eq('user_id', user.id);
    const ids = (memberships || []).map(m => m.session_id);
    if (ids.length === 0) return {};
    const { data: sessions } = await supabase.from('group_sessions').select('*').in('id', ids).eq('is_ended', true);
    if (!sessions?.length) return {};
    const endedIds = sessions.map(s => s.id);
    const [{ data: members }, { data: climbs }] = await Promise.all([
      supabase.from('group_session_members').select('session_id, user_id, display_name').in('session_id', endedIds),
      supabase.from('group_session_climbs').select('session_id, user_id, grade, points').in('session_id', endedIds),
    ]);
    const byDate: Record<string, GroupResult[]> = {};
    sessions.forEach(s => {
      const sClimbs = (climbs || []).filter(c => c.session_id === s.id);
      const entries: GroupResultEntry[] = (members || [])
        .filter(m => m.session_id === s.id)
        .map(m => {
          const mine = sClimbs.filter(c => c.user_id === m.user_id);
          return {
            user_id: m.user_id,
            display_name: m.display_name,
            points: mine.reduce((sum, c) => sum + c.points, 0),
            climbs: mine.map(c => ({ grade: c.grade, points: c.points })),
          };
        })
        .sort((a, b) => b.points - a.points);
      if (entries.length > 1) {
        (byDate[s.date] = byDate[s.date] || []).push({
          id: s.id, date: s.date, host_user_id: s.host_user_id, host_name: s.host_name, entries,
        });
      }
    });
    return byDate;
  } catch (e) {
    console.error('fetchMyGroupResults error', e);
    return null;
  }
}

export async function leaveGroupSession(sessionId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  await supabase.from('group_session_members').delete().eq('session_id', sessionId).eq('user_id', user.id);
}

export async function endGroupSession(sessionId: string): Promise<void> {
  await supabase.from('group_sessions').update({ is_ended: true }).eq('id', sessionId);
}

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
