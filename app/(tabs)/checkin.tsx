import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import { editStore } from '../../lib/editStore';
import { useCallback, useMemo, useState } from 'react';
import { Image, Modal, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import ShareCardModal from '../../components/ShareCardModal';
import { cancelDailyReminder, cancelRecoveryReminder, cancelStreakProtection, rescheduleReminderForTomorrow, scheduleStreakProtection } from '../../notifications';
import { copyMediaToStorage, deleteSessionsByKey, getAlertSettings, getCheckIns, getInjuryAlerts, getSessions, getTodayDate, saveCheckIn } from '../../storage';
import { useTheme } from '../../context/ThemeContext';

function Card({ label, labelColor, bgColor, children, style }: {
  label?: string; labelColor?: string; bgColor?: string; children?: any; style?: any;
}) {
  const { C } = useTheme();
  return (
    <View style={[{
      backgroundColor: bgColor || C.surface,
      borderRadius: 24,
      marginHorizontal: 16,
      marginBottom: 14,
      shadowColor: '#2B2118',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 14,
      elevation: 3,
      overflow: 'hidden',
    }, style]}>
      {label && (
        <Text style={{
          fontSize: 11, fontWeight: '700', color: labelColor || C.dust,
          letterSpacing: 1.5, textTransform: 'uppercase',
          paddingHorizontal: 18, paddingTop: 18, paddingBottom: 2,
        }}>{label}</Text>
      )}
      {children}
    </View>
  );
}

const SORENESS_LEVELS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

const FINGER_ZONES = [
  { id: 'index', label: 'Index' },
  { id: 'middle', label: 'Middle' },
  { id: 'ring', label: 'Ring' },
  { id: 'pinky', label: 'Pinky' },
  { id: 'thumb', label: 'Thumb' },
];

const SIDES = ['L', 'R'] as const;
type Side = typeof SIDES[number];

const PAIN_AREAS = [
  { id: 'shoulder', label: 'Shoulder' },
  { id: 'elbow', label: 'Elbow' },
  { id: 'wrist', label: 'Wrist' },
  { id: 'back', label: 'Back' },
  { id: 'knee', label: 'Knee' },
  { id: 'hip', label: 'Hip' },
];

function computeStreak(checkIns: Record<string, any>) {
  const t = new Date();
  const todayStr = t.toISOString().split('T')[0];
  const startOffset = checkIns[todayStr] ? 0 : 1;
  let current = 0;
  for (let i = startOffset; i < 365; i++) {
    const d = new Date(t); d.setDate(d.getDate() - i);
    if (checkIns[d.toISOString().split('T')[0]]) current++;
    else break;
  }
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(t); d.setDate(d.getDate() - (6 - i));
    return !!checkIns[d.toISOString().split('T')[0]];
  });
  return { current, last7 };
}

function calculateDRS(soreness, painAreas, affectedFingers, recentSessions, recentCheckIns = []) {
  let score = 100;
  const sorenessNum = parseInt(soreness || '0');
  if (sorenessNum >= 8) score -= 40;
  else if (sorenessNum >= 6) score -= 25;
  else if (sorenessNum >= 4) score -= 10;
  if (painAreas.length >= 3) score -= 30;
  else if (painAreas.length >= 2) score -= 20;
  else if (painAreas.length >= 1) score -= 10;
  if (affectedFingers.length >= 3) score -= 20;
  else if (affectedFingers.length >= 1) score -= 10;
  const last3Days = recentSessions.slice(0, 3);
  const consecutiveHardDays = last3Days.filter(s => s && s.res >= 70).length;
  const consecutiveDays = last3Days.filter(s => s !== null).length;
  if (consecutiveHardDays >= 3) score -= 30;
  else if (consecutiveHardDays >= 2) score -= 15;
  if (consecutiveDays >= 3) score -= 15;
  else if (consecutiveDays >= 2) score -= 5;
  const recentRestCount = recentCheckIns.slice(0, 3).filter(ci => ci?.isRestDay).length;
  if (recentRestCount >= 2) score = Math.min(score + 15, 100);
  else if (recentRestCount >= 1) score = Math.min(score + 10, 100);
  return Math.min(Math.max(score, 0), 100);
}

function getDRSVerdict(C, score) {
  if (score >= 70) return { label: 'Train Hard', color: C.terra, bg: C.terraBg, textColor: C.accentText };
  if (score >= 40) return { label: 'Take it Easy', color: C.amber, bg: C.amberBg, textColor: C.amberText };
  return { label: 'Rest Day', color: C.red, bg: C.redBg, textColor: C.clayText };
}

function getLast7Days() {
  const dates = [];
  for (let i = 1; i <= 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

function getSorenessHint(level: string) {
  const num = parseInt(level);
  if (num <= 3) return 'Feeling good';
  if (num <= 6) return 'Some fatigue present';
  return 'High soreness — consider resting';
}

export default function CheckInScreen() {
  const { C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [targetDate, setTargetDate] = useState(getTodayDate());
  const [isEditing, setIsEditing] = useState(false);

  const [soreness, setSoreness] = useState(null);
  const [affectedFingers, setAffectedFingers] = useState([]);
  const [painAreas, setPainAreas] = useState([]);
  const [alreadyCheckedIn, setAlreadyCheckedIn] = useState(false);
  const locked = alreadyCheckedIn && !isEditing;
  const [isRestDay, setIsRestDay] = useState(false);
  const [drs, setDrs] = useState(null);
  const [recentSessions, setRecentSessions] = useState([]);
  const [recentCheckIns, setRecentCheckIns] = useState([]);
  const [injuryAlerts, setInjuryAlerts] = useState([]);
  const [alertSettings, setAlertSettings] = useState({ injuryOverload: true });
  const [notes, setNotes] = useState('');
  const [mediaUris, setMediaUris] = useState<string[]>([]);
  const [pendingMedia, setPendingMedia] = useState<string[]>([]);
  const [showShareCard, setShowShareCard] = useState(false);
  const [streak, setStreak] = useState<{ current: number; last7: boolean[] }>({ current: 0, last7: Array(7).fill(false) });
  const [celebrationStreak, setCelebrationStreak] = useState<number | null>(null);

  useFocusEffect(useCallback(() => {
    const editDate = editStore.checkinDate;
    editStore.checkinDate = null;
    const date = editDate || getTodayDate();
    const editing = !!editDate;
    setTargetDate(date);
    setIsEditing(editing);
    loadData(date);
  }, []));

  const loadData = async (date = targetDate) => {
    const [checkIns, sessions, alerts, alertPrefs] = await Promise.all([
      getCheckIns(), getSessions(), getInjuryAlerts(), getAlertSettings(),
    ]);
    const last7 = getLast7Days().map(date => sessions[date] || null);
    const last7CheckIns = getLast7Days().map(d => checkIns[d] || null);
    setRecentSessions(last7);
    setRecentCheckIns(last7CheckIns);
    setInjuryAlerts(alerts);
    setAlertSettings(alertPrefs);
    setStreak(computeStreak(checkIns));

    if (checkIns[date]) {
      setAlreadyCheckedIn(true);
      const ci = checkIns[date];
      setSoreness(ci.soreness);
      setAffectedFingers(ci.affectedFingers || []);
      setPainAreas(ci.painAreas || []);
      setIsRestDay(ci.isRestDay || false);
      setMediaUris(ci.mediaUris || []);
      setNotes(ci.notes || '');
      setDrs(calculateDRS(ci.soreness, ci.painAreas, ci.affectedFingers, last7, last7CheckIns));
    } else {
      setAlreadyCheckedIn(false);
      setSoreness(null);
      setAffectedFingers([]);
      setPainAreas([]);
      setIsRestDay(false);
      setMediaUris([]);
      setPendingMedia([]);
      setNotes('');
      setDrs(null);
    }
  };

  const toggleFinger = (id) => {
    if (locked) return;
    Haptics.selectionAsync();
    setAffectedFingers(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]);
  };

  const pickMedia = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (!result.canceled) {
      setPendingMedia(prev => [...prev, ...result.assets.map(a => a.uri)]);
    }
  };

  const removeMedia = (uri: string) => {
    setMediaUris(prev => prev.filter(u => u !== uri));
    setPendingMedia(prev => prev.filter(u => u !== uri));
  };

  const togglePain = (id) => {
    if (locked) return;
    Haptics.selectionAsync();
    setPainAreas(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  const handleSave = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const persistedUris = await Promise.all(pendingMedia.map(copyMediaToStorage));
    const mergedUris = [...mediaUris, ...persistedUris];
    if (isRestDay) await deleteSessionsByKey(targetDate);
    await saveCheckIn({ date: targetDate, soreness, affectedFingers, painAreas, isRestDay, mediaUris: mergedUris, notes: notes.trim() || undefined });
    if (!isEditing) {
      cancelStreakProtection().catch(() => {});
      cancelRecoveryReminder().catch(() => {});
      cancelDailyReminder().catch(() => {});
      rescheduleReminderForTomorrow().catch(() => {});
    }
    setMediaUris(mergedUris);
    setPendingMedia([]);
    const score = calculateDRS(soreness, painAreas, affectedFingers, recentSessions, recentCheckIns);
    setDrs(score);
    setAlreadyCheckedIn(true);

    if (!isEditing) {
      const updatedCheckIns = await getCheckIns();
      const newStreak = computeStreak(updatedCheckIns);
      setStreak(newStreak);
      const MILESTONES = [3, 7, 14, 30, 50, 100];
      if (MILESTONES.includes(newStreak.current)) {
        setCelebrationStreak(newStreak.current);
      }
    }

    if (isEditing) router.navigate('/(tabs)/calendar');
  };

  const toggleRestDay = () => {
    Haptics.selectionAsync();
    setIsRestDay(prev => !prev);
  };

  const verdict = drs !== null ? getDRSVerdict(C, drs) : null;
  const liveScore = !locked && (soreness || isRestDay)
    ? calculateDRS(soreness, painAreas, affectedFingers, recentSessions, recentCheckIns)
    : null;
  const liveVerdict = liveScore !== null ? getDRSVerdict(C, liveScore) : null;
  const displayVerdict = locked ? verdict : liveVerdict;
  const displayScore = locked ? drs : liveScore;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, (isRestDay || soreness || (isEditing && alreadyCheckedIn)) && !locked && { paddingBottom: 88 }]}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>
            {isEditing
              ? new Date(targetDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
              : new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </Text>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{isEditing ? 'Edit Check-in' : 'Check-in'}</Text>
            {locked && (
              <View style={styles.doneBadge}>
                <Text style={styles.doneBadgeText}>✓ Done</Text>
              </View>
            )}
          </View>
        </View>

        {/* Injury Alert */}
        {alertSettings.injuryOverload && injuryAlerts.length > 0 && (
          <Card label="⚠ Overload Warning" bgColor={C.redBg} labelColor={C.red} style={{ marginTop: 0 }}>
            <View style={styles.alertInner}>
              {injuryAlerts.map(alert => (
                <Text key={alert.partId} style={styles.alertText}>
                  · {alert.partName} — {alert.suggestion}
                </Text>
              ))}
            </View>
          </Card>
        )}

        {/* Rest Day Toggle */}
        <Card label="Rest Day" bgColor={isRestDay ? C.greenBg : undefined} labelColor={isRestDay ? C.sageText : undefined}>
          {locked ? (
            <View style={styles.restDayConfirmed}>
              <Text style={[styles.restDayConfirmedTitle, { color: isRestDay ? C.sageText : C.dust }]}>
                {isRestDay ? 'Rest Day' : 'Training Day'}
              </Text>
              <Text style={styles.restDayConfirmedSub}>
                {isRestDay ? 'Recovery mode — your body is thanking you' : 'Session logged for this day'}
              </Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.restDayBtn} onPress={toggleRestDay} activeOpacity={0.7}>
              <View style={styles.restDayBtnLeft}>
                <Text style={[styles.restDayBtnTitle, { color: isRestDay ? C.sageText : C.ink }]}>
                  {isRestDay ? 'Rest Day — ON' : 'Mark as Rest Day'}
                </Text>
                <Text style={styles.restDayBtnSub}>
                  {isRestDay ? 'Tap to remove rest day' : 'No session today — still log how you feel below'}
                </Text>
              </View>
              <View style={{ width: 44, height: 26, borderRadius: 13, backgroundColor: isRestDay ? C.green : C.surfaceAlt, padding: 3, justifyContent: 'center' }}>
                <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: C.surface, transform: [{ translateX: isRestDay ? 18 : 0 }] }} />
              </View>
            </TouchableOpacity>
          )}
        </Card>

        {/* Soreness — inline grid */}
        <Card label="Overall Soreness">
          <View style={{ padding: 18, paddingTop: 14 }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {SORENESS_LEVELS.map(n => {
                const on = soreness === n;
                return (
                  <TouchableOpacity
                    key={n}
                    onPress={() => { if (locked) return; Haptics.selectionAsync(); setSoreness(n); }}
                    activeOpacity={locked ? 1 : 0.7}
                    style={[styles.sorenessCell, {
                      width: '17%',
                      backgroundColor: on ? C.terra : C.surfaceAlt,
                      shadowColor: on ? C.terra : 'transparent',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: on ? 0.25 : 0,
                      shadowRadius: 6,
                    }]}
                  >
                    <Text style={[styles.sorenessCellText, { color: on ? '#fff' : C.sand }]}>{n}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {soreness && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 12 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: C.amberText }}>
                  {getSorenessHint(soreness)}
                </Text>
              </View>
            )}
          </View>
        </Card>

        {/* Finger Condition — inline L/R table */}
        <Card label="Finger Condition">
          <View style={{ padding: 18, paddingTop: 12 }}>
            <Text style={{ fontSize: 13, color: C.dust, marginBottom: 14 }}>Tap any fingers that feel sore or tweaked</Text>
            {FINGER_ZONES.map((finger, idx) => (
              <View key={finger.id} style={[styles.fingerRow, idx > 0 && { marginTop: 9 }]}>
                <Text style={styles.fingerLabel}>{finger.label}</Text>
                <View style={styles.fingerSides}>
                  {SIDES.map(side => {
                    const id = `${side}_${finger.id}`;
                    const active = affectedFingers.includes(id);
                    return (
                      <TouchableOpacity
                        key={side}
                        onPress={() => toggleFinger(id)}
                        activeOpacity={locked ? 1 : 0.7}
                        style={[styles.fingerBtn, {
                          backgroundColor: active ? C.claySoft : C.surfaceAlt,
                        }]}
                      >
                        <Text style={[styles.fingerBtnText, { color: active ? C.clayText : C.sand }]}>{side}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        </Card>

        {/* Pain or Strain — inline chips */}
        <Card label="Pain or Strain">
          <View style={{ padding: 18, paddingTop: 12 }}>
            <Text style={{ fontSize: 13, color: C.dust, marginBottom: 12 }}>Select all areas that feel off today</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>
              {PAIN_AREAS.map(area => {
                const active = painAreas.includes(area.id);
                return (
                  <TouchableOpacity
                    key={area.id}
                    onPress={() => togglePain(area.id)}
                    activeOpacity={locked ? 1 : 0.7}
                    style={[styles.painChip, {
                      backgroundColor: active ? C.claySoft : C.surfaceAlt,
                    }]}
                  >
                    <Text style={[styles.painChipText, { color: active ? C.clayText : C.sand }]}>{area.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </Card>

        {/* Notes */}
        <Card label="Notes · optional">
          <View style={styles.sectionInner}>
            {locked ? (
              notes ? (
                <Text style={styles.notesText}>{notes}</Text>
              ) : (
                <Text style={styles.notesPlaceholder}>No notes logged</Text>
              )
            ) : (
              <TextInput
                style={styles.notesInput}
                value={notes}
                onChangeText={setNotes}
                placeholder="How did you feel? Any tweaks, tightness, or wins..."
                placeholderTextColor={C.dust}
                multiline
                numberOfLines={3}
                maxLength={500}
              />
            )}
          </View>
        </Card>

        {/* Photos */}
        <Card label="Photos · optional">
          <View style={styles.sectionInner}>
            {!locked && (
              <Text style={styles.sectionHint}>Skin condition, tape jobs, or injury photos</Text>
            )}
            {(mediaUris.length > 0 || pendingMedia.length > 0) && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {[...mediaUris, ...pendingMedia].map((uri) => (
                    <View key={uri} style={styles.mediaThumbnailWrap}>
                      <Image source={{ uri }} style={styles.mediaThumbnail} />
                      {!locked && (
                        <TouchableOpacity style={styles.mediaRemove} onPress={() => removeMedia(uri)}>
                          <Text style={styles.mediaRemoveText}>✕</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                </View>
              </ScrollView>
            )}
            {!locked && (
              <TouchableOpacity style={styles.mediaAddBtn} onPress={pickMedia}>
                <Text style={styles.mediaAddText}>+ Add Photos</Text>
              </TouchableOpacity>
            )}
          </View>
        </Card>

        {/* DRS */}
        {displayVerdict && displayScore !== null && (
          <View style={[styles.drsPanelWrap, { backgroundColor: displayVerdict.bg }]}>
            <Text style={[styles.drsPanelLabel, { color: displayVerdict.textColor }]}>
              {locked ? 'Daily Readiness Score' : 'Readiness Preview'}
            </Text>
            <View style={styles.drsPanelRow}>
              <Text style={[styles.drsPanelVerdict, { color: displayVerdict.color }]}>{displayVerdict.label}</Text>
              <View style={[styles.drsPanelScoreTile, { backgroundColor: C.surface }]}>
                <Text style={[styles.drsPanelScoreNum, { color: displayVerdict.color }]}>{displayScore}</Text>
              </View>
            </View>
            <View style={{ height: 9, borderRadius: 100, backgroundColor: 'rgba(0,0,0,0.07)', overflow: 'hidden', marginTop: 14 }}>
              <View style={{ width: `${displayScore}%`, height: '100%', borderRadius: 100, backgroundColor: displayVerdict.color }} />
            </View>
            {!locked && (
              <Text style={[styles.drsPanelHint, { color: displayVerdict.textColor }]}>Save check-in to confirm</Text>
            )}
          </View>
        )}

        {/* Share button after check-in saved */}
        {alreadyCheckedIn && !isRestDay && (
          <TouchableOpacity style={styles.shareCardBtn} onPress={() => setShowShareCard(true)}>
            <Text style={styles.shareCardBtnText}>Share Recovery Card</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>

      {(isRestDay || soreness || (isEditing && alreadyCheckedIn)) && !locked && (
        <View style={styles.stickyFooter}>
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
            <Text style={styles.saveBtnText}>{isEditing ? 'Save Changes →' : 'Save Check-in →'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {alreadyCheckedIn && !isRestDay && (
        <ShareCardModal
          visible={showShareCard}
          onClose={() => setShowShareCard(false)}
          type="recovery"
          checkIn={{ date: targetDate, soreness, affectedFingers, painAreas, isRestDay }}
          date={targetDate}
          streak={streak}
        />
      )}

      {/* Streak milestone celebration */}
      <Modal visible={celebrationStreak !== null} transparent animationType="fade" onRequestClose={() => setCelebrationStreak(null)}>
        <View style={styles.celebOverlay}>
          <View style={styles.celebCard}>
            <Text style={styles.celebEmoji}>🔥</Text>
            <Text style={styles.celebNum}>{celebrationStreak}</Text>
            <Text style={styles.celebUnit}>day streak</Text>
            <Text style={styles.celebMsg}>
              {celebrationStreak === 3 ? "3 days in. You're building a habit." :
               celebrationStreak === 7 ? 'One full week of consistency. Keep it going.' :
               celebrationStreak === 14 ? 'Two weeks strong. Your body is tracking.' :
               celebrationStreak === 30 ? '30 days. You\'re a different climber now.' :
               celebrationStreak === 50 ? '50 days of check-ins. That\'s real dedication.' :
               '100 days. Absolutely legendary.'}
            </Text>
            <TouchableOpacity style={styles.celebBtn} onPress={() => setCelebrationStreak(null)}>
              <Text style={styles.celebBtnText}>Keep Going →</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    scrollContent: { paddingBottom: 110 },

    header: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 20 },
    greeting: { fontSize: 12, color: C.dust, fontWeight: '700', letterSpacing: 2.5, textTransform: 'uppercase', marginBottom: 6 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    title: { fontSize: 36, fontWeight: '800', color: C.ink, letterSpacing: -1.5, lineHeight: 40 },
    doneBadge: { backgroundColor: C.sageSoft, borderRadius: 100, paddingHorizontal: 12, paddingVertical: 6, marginTop: 2 },
    doneBadgeText: { color: C.sageText, fontSize: 13, fontWeight: '800' },

    alertInner: { padding: 14, gap: 4 },
    alertText: { color: C.clayText, fontSize: 12, lineHeight: 18 },

    restDayBtn: { flexDirection: 'row', alignItems: 'center', padding: 18, gap: 12 },
    restDayBtnLeft: { flex: 1 },
    restDayBtnTitle: { fontSize: 14, fontWeight: '800', marginBottom: 2 },
    restDayBtnSub: { color: C.sand, fontSize: 12 },

    restDayConfirmed: { padding: 24, alignItems: 'center', gap: 6 },
    restDayConfirmedTitle: { fontSize: 28, fontWeight: '800', letterSpacing: -1 },
    restDayConfirmedSub: { color: C.sand, fontSize: 12, textAlign: 'center' },

    // Soreness grid cell
    sorenessCell: { flex: 1, minWidth: 48, height: 52, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
    sorenessCellText: { fontSize: 18, fontWeight: '800' },

    // Finger table
    fingerRow: { flexDirection: 'row', alignItems: 'center' },
    fingerLabel: { width: 68, fontSize: 15, fontWeight: '700', color: C.ink },
    fingerSides: { flex: 1, flexDirection: 'row', gap: 8 },
    fingerBtn: { flex: 1, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    fingerBtnText: { fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },

    // Pain chips
    painChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 100 },
    painChipText: { fontSize: 14, fontWeight: '800' },

    sectionInner: { padding: 16, paddingTop: 14 },
    sectionHint: { color: C.dust, fontSize: 12, marginBottom: 12 },

    notesInput: { color: C.ink, fontSize: 13, lineHeight: 20, minHeight: 72, textAlignVertical: 'top', paddingTop: 2 },
    notesText: { color: C.sand, fontSize: 13, lineHeight: 20 },
    notesPlaceholder: { color: C.dust, fontSize: 12, fontStyle: 'italic' },

    mediaThumbnailWrap: { position: 'relative' },
    mediaThumbnail: { width: 88, height: 88, borderRadius: 12, backgroundColor: C.surfaceAlt },
    mediaRemove: { position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center' },
    mediaRemoveText: { color: '#fff', fontSize: 10, fontWeight: '800' },
    mediaAddBtn: { borderWidth: 1.5, borderColor: C.borderLight, borderRadius: 12, borderStyle: 'dashed', padding: 12, alignItems: 'center' },
    mediaAddText: { color: C.dust, fontSize: 12, fontWeight: '700' },

    // DRS panel (tonal container, no card wrapper)
    drsPanelWrap: { marginHorizontal: 16, marginBottom: 14, borderRadius: 22, padding: 20 },
    drsPanelLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 14 },
    drsPanelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    drsPanelVerdict: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5, flex: 1 },
    drsPanelScoreTile: { width: 62, height: 62, borderRadius: 16, alignItems: 'center', justifyContent: 'center', shadowColor: '#2B2118', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8 },
    drsPanelScoreNum: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
    drsPanelHint: { fontSize: 12, fontWeight: '600', marginTop: 10 },

    shareCardBtn: { marginHorizontal: 16, marginBottom: 14, backgroundColor: C.surfaceAlt, borderRadius: 16, padding: 14, alignItems: 'center' },
    shareCardBtnText: { fontSize: 13, fontWeight: '700', color: C.sand },

    celebOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 32 },
    celebCard: { backgroundColor: C.surface, borderRadius: 28, padding: 32, alignItems: 'center', width: '100%', gap: 8 },
    celebEmoji: { fontSize: 52, marginBottom: 4 },
    celebNum: { fontSize: 72, fontWeight: '900', color: C.terra, letterSpacing: -3, lineHeight: 76 },
    celebUnit: { fontSize: 16, fontWeight: '700', color: C.dust, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
    celebMsg: { fontSize: 15, color: C.sand, textAlign: 'center', lineHeight: 22, marginBottom: 12 },
    celebBtn: { backgroundColor: C.ink, paddingVertical: 14, paddingHorizontal: 32, borderRadius: 16, marginTop: 4 },
    celebBtnText: { color: C.surface, fontSize: 14, fontWeight: '800', letterSpacing: 0.3 },

    stickyFooter: { paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 90, backgroundColor: C.bg, borderTopWidth: 1, borderTopColor: C.hairline },
    saveBtn: { backgroundColor: C.ink, padding: 16, borderRadius: 16, alignItems: 'center' },
    saveBtnText: { color: C.surface, fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },
  });
}
