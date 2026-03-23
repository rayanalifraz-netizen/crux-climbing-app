import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import { editStore } from '../../lib/editStore';
import { useCallback, useMemo, useState } from 'react';
import { Image, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ShareCardModal from '../../components/ShareCardModal';
import { cancelStreakProtection, rescheduleReminderForTomorrow, scheduleStreakProtection } from '../../notifications';
import { copyMediaToStorage, deleteSessionsByKey, getAlertSettings, getCheckIns, getInjuryAlerts, getSessions, getTodayDate, saveCheckIn } from '../../storage';
import { useTheme } from '../../context/ThemeContext';

function Card({ label, labelColor, accentColor, bgColor, children, style }: {
  label?: string; labelColor?: string; accentColor?: string; bgColor?: string; children?: any; style?: any;
}) {
  const { C } = useTheme();
  const hasAccent = !!accentColor;
  return (
    <View style={[{
      backgroundColor: bgColor || C.surface,
      borderRadius: 20,
      marginHorizontal: 16,
      marginBottom: 14,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.07,
      shadowRadius: 12,
      elevation: 3,
      overflow: 'hidden',
    }, style]}>
      {hasAccent && (
        <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: accentColor, borderTopLeftRadius: 20, borderBottomLeftRadius: 20 }} />
      )}
      {label && (
        <Text style={{
          fontSize: 10,
          fontWeight: '700',
          color: labelColor || C.dust,
          letterSpacing: 1,
          textTransform: 'uppercase',
          paddingHorizontal: hasAccent ? 24 : 20,
          paddingTop: 18,
          paddingBottom: 2,
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

function calculateDRS(soreness, painAreas, affectedFingers, recentSessions, isRestDay = false) {
  if (isRestDay) return 100;
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
  return Math.min(Math.max(score, 0), 100);
}

function getDRSVerdict(C, score) {
  if (score >= 70) return { label: 'Train Hard', color: C.terra, bg: C.terraBg, border: C.terraBorder };
  if (score >= 40) return { label: 'Take it Easy', color: C.amber, bg: C.amberBg, border: C.amberBorder };
  return { label: 'Rest Day', color: C.red, bg: C.redBg, border: C.redBorder };
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

function getSorenessColor(C, level) {
  const num = parseInt(level);
  if (num <= 3) return C.terra;
  if (num <= 6) return C.amber;
  return C.red;
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
  const [injuryAlerts, setInjuryAlerts] = useState([]);
  const [alertSettings, setAlertSettings] = useState({ injuryOverload: true });
  const [mediaUris, setMediaUris] = useState<string[]>([]);
  const [pendingMedia, setPendingMedia] = useState<string[]>([]);
  const [showShareCard, setShowShareCard] = useState(false);
  const [streak, setStreak] = useState<{ current: number; last7: boolean[] }>({ current: 0, last7: Array(7).fill(false) });

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
    setRecentSessions(last7);
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
      setDrs(calculateDRS(ci.soreness, ci.painAreas, ci.affectedFingers, last7, ci.isRestDay));
    } else {
      setAlreadyCheckedIn(false);
      setSoreness(null);
      setAffectedFingers([]);
      setPainAreas([]);
      setIsRestDay(false);
      setMediaUris([]);
      setPendingMedia([]);
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
    await saveCheckIn({ date: targetDate, soreness, affectedFingers, painAreas, isRestDay, mediaUris: mergedUris });
    if (!isEditing) {
      cancelStreakProtection().catch(() => {});
      rescheduleReminderForTomorrow().catch(() => {});
    }
    setMediaUris(mergedUris);
    setPendingMedia([]);
    const score = calculateDRS(soreness, painAreas, affectedFingers, recentSessions, isRestDay);
    setDrs(score);
    setAlreadyCheckedIn(true);
    if (isEditing) router.navigate('/(tabs)/calendar');
  };

  const handleRestDay = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await Promise.all([
      saveCheckIn({ date: targetDate, soreness: '0', affectedFingers: [], painAreas: [], isRestDay: true }),
      deleteSessionsByKey(targetDate),
    ]);
    if (!isEditing) {
      cancelStreakProtection().catch(() => {});
      rescheduleReminderForTomorrow().catch(() => {});
    }
    setIsRestDay(true);
    setDrs(100);
    setMediaUris([]);
    setPendingMedia([]);
    setAlreadyCheckedIn(true);
    if (isEditing) router.navigate('/(tabs)/calendar');
  };

  const verdict = drs !== null ? getDRSVerdict(C, drs) : null;
  const liveScore = !locked && soreness
    ? calculateDRS(soreness, painAreas, affectedFingers, recentSessions, false)
    : null;
  const liveVerdict = liveScore !== null ? getDRSVerdict(C, liveScore) : null;
  const displayVerdict = locked ? verdict : liveVerdict;
  const displayScore = locked ? drs : liveScore;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, (soreness || (isEditing && alreadyCheckedIn)) && !locked && { paddingBottom: 88 }]}>

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
          <Card
            label="⚠ Overload Warning"
            accentColor={C.red}
            bgColor={C.redBg}
            labelColor={C.red}
            style={{ marginTop: 0 }}
          >
            <View style={styles.alertInner}>
              {injuryAlerts.map(alert => (
                <Text key={alert.partId} style={styles.alertText}>
                  · {alert.partName} — {alert.suggestion}
                </Text>
              ))}
            </View>
          </Card>
        )}

        {/* Rest Day Button — hidden when editing an existing non-rest check-in */}
        {!locked && !(isEditing && alreadyCheckedIn && !isRestDay) && (
          <Card
            label="Rest Day"
            accentColor={C.green}
            bgColor={C.greenBg}
            labelColor={C.green}
          >
            <TouchableOpacity style={styles.restDayBtn} onPress={handleRestDay}>
              <View style={styles.restDayBtnLeft}>
                <Text style={styles.restDayBtnTitle}>Log Rest Day</Text>
                <Text style={styles.restDayBtnSub}>Skip the session and recover</Text>
              </View>
              <Text style={[styles.restDayBtnArrow, { color: C.green }]}>→</Text>
            </TouchableOpacity>
          </Card>
        )}

        {/* Rest Day Confirmed */}
        {isRestDay && locked ? (
          <Card
            label="Today"
            accentColor={C.green}
            bgColor={C.greenBg}
            labelColor={C.green}
          >
            <View style={styles.restDayConfirmed}>
              <Text style={styles.restDayConfirmedTitle}>Rest Day</Text>
              <Text style={styles.restDayConfirmedSub}>Recovery mode — your body is thanking you</Text>
              <View style={styles.restDayDRS}>
                <Text style={styles.restDayDRSLabel}>Status</Text>
                <Text style={styles.restDayDRSScore}>Recovering</Text>
              </View>
            </View>
          </Card>
        ) : (
          <>
            {/* Soreness */}
            <Card label="Overall Soreness">
              <View style={styles.sectionInner}>
                <View style={styles.sorenessRow}>
                  {SORENESS_LEVELS.map((level) => {
                    const selected = soreness === level;
                    const color = getSorenessColor(C, level);
                    return (
                      <TouchableOpacity
                        key={level}
                        style={[styles.sorenessBtn, selected && { backgroundColor: color, borderColor: color }]}
                        onPress={() => { if (!locked) { Haptics.selectionAsync(); setSoreness(level); if (isRestDay) setIsRestDay(false); } }}
                      >
                        <Text style={[styles.sorenessBtnText, selected && { color: '#fff' }]}>{level}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {soreness && (
                  <Text style={styles.sorenessHint}>
                    {parseInt(soreness) <= 3 ? '→ Feeling good' :
                     parseInt(soreness) <= 6 ? '→ Some fatigue present' :
                     '→ High soreness — consider resting'}
                  </Text>
                )}
              </View>
            </Card>

            {/* Finger Condition */}
            <Card label="Finger Condition">
              <View style={styles.sectionInner}>
                <Text style={styles.sectionHint}>Tap any fingers that feel sore or tweaked</Text>
                <View style={styles.fingerTable}>
                  {FINGER_ZONES.map((finger) => (
                    <View key={finger.id} style={styles.fingerRow}>
                      <Text style={styles.fingerLabel}>{finger.label}</Text>
                      <View style={styles.fingerSides}>
                        {SIDES.map((side) => {
                          const id = `${side}_${finger.id}`;
                          const selected = affectedFingers.includes(id);
                          return (
                            <TouchableOpacity
                              key={side}
                              style={[styles.sideChip, selected && { backgroundColor: C.redBg, borderColor: C.redBorder }]}
                              onPress={() => toggleFinger(id)}
                            >
                              <Text style={[styles.sideChipText, selected && { color: C.red }]}>{side}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            </Card>

            {/* Pain Areas */}
            <Card label="Pain or Strain">
              <View style={styles.sectionInner}>
                <Text style={styles.sectionHint}>Select all areas that feel off today</Text>
                <View style={styles.chipRow}>
                  {PAIN_AREAS.map((area) => {
                    const selected = painAreas.includes(area.id);
                    return (
                      <TouchableOpacity
                        key={area.id}
                        style={[styles.chip, selected && { backgroundColor: C.redBg, borderColor: C.redBorder }]}
                        onPress={() => togglePain(area.id)}
                      >
                        <Text style={[styles.chipText, selected && { color: C.red }]}>
                          {area.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </Card>

            {/* Photos */}
            <Card label="Photos · optional" accentColor={C.dust} bgColor={C.surface} labelColor={C.dust}>
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
              <Card
                label={locked ? 'Daily Readiness Score' : 'Readiness Preview'}
                accentColor={displayVerdict.color}
                bgColor={displayVerdict.bg}
                labelColor={displayVerdict.color}
              >
                <View style={styles.drsInner}>
                  <View style={styles.drsTopRow}>
                    <Text style={[styles.drsVerdict, { color: displayVerdict.color }]}>
                      {displayVerdict.label}
                    </Text>
                    <View style={[styles.drsScoreBox, { borderColor: displayVerdict.border }]}>
                      <Text style={[styles.drsScoreNum, { color: displayVerdict.color }]}>{displayScore}</Text>
                    </View>
                  </View>

                  {locked && (
                    <View style={[styles.drsBreakdown, { borderTopColor: displayVerdict.border + '60' }]}>
                      {[
                        { label: 'Soreness', val: `${soreness}/10` },
                        { label: 'Pain Areas', val: painAreas.length },
                        { label: '7d Sessions', val: recentSessions.filter(s => s !== null).length },
                      ].map((item, i, arr) => (
                        <View key={item.label} style={styles.drsBreakdownGroup}>
                          <Text style={[styles.drsBreakdownLabel, { color: displayVerdict.color + 'aa' }]}>
                            {item.label}
                          </Text>
                          <Text style={[styles.drsBreakdownVal, { color: displayVerdict.color }]}>
                            {item.val}
                          </Text>
                          {i < arr.length - 1 && (
                            <View style={[styles.drsBreakdownTick, { backgroundColor: displayVerdict.border + '40' }]} />
                          )}
                        </View>
                      ))}
                    </View>
                  )}

                  {!locked && (
                    <Text style={[styles.drsHint, { color: displayVerdict.color + 'aa' }]}>
                      → Save check-in to confirm
                    </Text>
                  )}
                </View>
              </Card>
            )}

          {/* Share button after check-in saved */}
          {alreadyCheckedIn && !isRestDay && (
            <TouchableOpacity style={styles.shareCardBtn} onPress={() => setShowShareCard(true)}>
              <Text style={styles.shareCardBtnText}>Share Recovery Card</Text>
            </TouchableOpacity>
          )}

          </>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>

      {(soreness || (isEditing && alreadyCheckedIn)) && !locked && (
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
    </SafeAreaView>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    scrollContent: { paddingBottom: 60 },

    header: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 20 },
    greeting: { fontSize: 11, color: C.dust, fontWeight: '600', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    title: { fontSize: 38, fontWeight: '800', color: C.ink, letterSpacing: -1.5, lineHeight: 42 },
    doneBadge: { backgroundColor: C.greenBg, borderWidth: 1, borderColor: C.greenBorder, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, marginTop: 4 },
    doneBadgeText: { color: C.green, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },

    alertInner: { padding: 14, paddingLeft: 24, gap: 4 },
    alertText: { color: C.red, fontSize: 12, lineHeight: 18 },

    restDayBtn: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingLeft: 24, gap: 12 },
    restDayBtnLeft: { flex: 1 },
    restDayBtnTitle: { color: C.green, fontSize: 14, fontWeight: '800' },
    restDayBtnSub: { color: C.sand, fontSize: 12, marginTop: 2 },
    restDayBtnArrow: { fontSize: 18, fontWeight: '700' },

    restDayConfirmed: { padding: 24, alignItems: 'center', gap: 6 },
    restDayConfirmedTitle: { fontSize: 32, fontWeight: '800', color: C.green, letterSpacing: -1 },
    restDayConfirmedSub: { color: C.sand, fontSize: 12, textAlign: 'center' },
    restDayDRS: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 8 },
    restDayDRSLabel: { fontSize: 10, fontWeight: '800', color: C.green, letterSpacing: 2, textTransform: 'uppercase' },
    restDayDRSScore: { fontSize: 16, fontWeight: '800', color: C.green, letterSpacing: 0.5 },

    sectionInner: { padding: 16, paddingTop: 14 },
    sectionHint: { color: C.dust, fontSize: 12, marginBottom: 12 },

    sorenessRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
    sorenessBtn: { width: 44, height: 44, backgroundColor: C.surfaceAlt, borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.borderLight },
    sorenessBtnText: { color: C.sand, fontSize: 13, fontWeight: '800' },
    sorenessHint: { color: C.sand, fontSize: 11, marginTop: 12, fontWeight: '600' },

    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
    chip: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: C.surfaceAlt, borderRadius: 10, borderWidth: 1, borderColor: C.borderLight },
    chipText: { color: C.sand, fontSize: 12, fontWeight: '700' },

    fingerTable: { gap: 8 },
    fingerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    fingerLabel: { color: C.inkLight, fontSize: 13, fontWeight: '700', width: 60 },
    fingerSides: { flexDirection: 'row', gap: 8, flex: 1 },
    sideChip: { flex: 1, paddingVertical: 8, backgroundColor: C.surfaceAlt, borderRadius: 10, borderWidth: 1, borderColor: C.borderLight, alignItems: 'center' },
    sideChipText: { color: C.sand, fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },

    drsInner: { padding: 18, paddingTop: 14, paddingLeft: 24 },
    drsTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    drsVerdict: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
    drsScoreBox: { width: 56, height: 56, borderWidth: 1.5, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    drsScoreNum: { fontSize: 22, fontWeight: '800' },
    drsBreakdown: { flexDirection: 'row', paddingTop: 14, borderTopWidth: 1 },
    drsBreakdownGroup: { flex: 1, alignItems: 'center', position: 'relative' },
    drsBreakdownLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
    drsBreakdownVal: { fontSize: 18, fontWeight: '800' },
    drsBreakdownTick: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 1 },
    drsHint: { fontSize: 11, fontWeight: '600' },

    shareCardBtn: { marginHorizontal: 16, marginBottom: 14, borderWidth: 1, borderColor: C.borderLight, borderRadius: 12, padding: 14, alignItems: 'center' },
    shareCardBtnText: { fontSize: 12, fontWeight: '700', color: C.sand, letterSpacing: 0.3 },

    mediaThumbnailWrap: { position: 'relative' },
    mediaThumbnail: { width: 88, height: 88, borderRadius: 10, backgroundColor: C.borderLight },
    mediaRemove: { position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center' },
    mediaRemoveText: { color: '#fff', fontSize: 10, fontWeight: '800' },
    mediaAddBtn: { borderWidth: 1.5, borderColor: C.borderLight, borderRadius: 10, borderStyle: 'dashed', padding: 12, alignItems: 'center' },
    mediaAddText: { color: C.dust, fontSize: 12, fontWeight: '700' },

    stickyFooter: { paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 16, backgroundColor: C.bg, borderTopWidth: 1, borderTopColor: C.borderLight },
    saveBtn: { backgroundColor: C.ink, padding: 16, borderRadius: 12, alignItems: 'center' },
    saveBtnText: { color: C.surface, fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },
  });
}
