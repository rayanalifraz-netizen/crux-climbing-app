import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import { editStore } from '../../lib/editStore';
import { useCallback, useMemo, useState } from 'react';
import { Image, Modal, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import ShareCardModal from '../../components/ShareCardModal';
import { cancelRecoveryReminder, cancelStreakProtection, rescheduleReminderForTomorrow, scheduleStreakProtection } from '../../notifications';
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
          color: labelColor || C.terra,
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
  const [notes, setNotes] = useState('');
  const [mediaUris, setMediaUris] = useState<string[]>([]);
  const [pendingMedia, setPendingMedia] = useState<string[]>([]);
  const [showShareCard, setShowShareCard] = useState(false);
  const [showSorenessPicker, setShowSorenessPicker] = useState(false);
  const [showFingerPicker, setShowFingerPicker] = useState(false);
  const [showPainPicker, setShowPainPicker] = useState(false);
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
      setNotes(ci.notes || '');
      setDrs(calculateDRS(ci.soreness, ci.painAreas, ci.affectedFingers, last7, ci.isRestDay));
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
      rescheduleReminderForTomorrow().catch(() => {});
    }
    setMediaUris(mergedUris);
    setPendingMedia([]);
    const score = calculateDRS(soreness, painAreas, affectedFingers, recentSessions, isRestDay);
    setDrs(score);
    setAlreadyCheckedIn(true);

    // Streak milestone celebration
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
    ? calculateDRS(soreness, painAreas, affectedFingers, recentSessions, isRestDay)
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

        {/* Rest Day Toggle */}
        <Card
          label="Rest Day"
          accentColor={isRestDay ? C.green : undefined}
          bgColor={isRestDay ? C.greenBg : undefined}
          labelColor={isRestDay ? C.green : undefined}
        >
          {locked ? (
            <View style={styles.restDayConfirmed}>
              <Text style={[styles.restDayConfirmedTitle, { color: isRestDay ? C.green : C.dust }]}>
                {isRestDay ? 'Rest Day' : 'Training Day'}
              </Text>
              <Text style={styles.restDayConfirmedSub}>
                {isRestDay ? 'Recovery mode — your body is thanking you' : 'Session logged for this day'}
              </Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.restDayBtn} onPress={toggleRestDay} activeOpacity={0.7}>
              <View style={styles.restDayBtnLeft}>
                <Text style={[styles.restDayBtnTitle, { color: isRestDay ? C.green : C.ink }]}>
                  {isRestDay ? 'Rest Day — ON' : 'Mark as Rest Day'}
                </Text>
                <Text style={styles.restDayBtnSub}>
                  {isRestDay ? 'Tap to remove rest day' : 'No session today — still log how you feel below'}
                </Text>
              </View>
              <View style={{ width: 44, height: 26, borderRadius: 13, backgroundColor: isRestDay ? C.green : C.borderLight, padding: 3, justifyContent: 'center' }}>
                <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: C.surface, transform: [{ translateX: isRestDay ? 18 : 0 }] }} />
              </View>
            </TouchableOpacity>
          )}
        </Card>

        {/* Soreness */}
        <Card label="Overall Soreness">
          <View style={styles.sectionInner}>
            {locked ? (
              soreness ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={[styles.sorenessTagBox, { borderColor: getSorenessColor(C, soreness) + '60', backgroundColor: getSorenessColor(C, soreness) + '18' }]}>
                    <Text style={[styles.sorenessTagNum, { color: getSorenessColor(C, soreness) }]}>{soreness}</Text>
                    <Text style={[styles.sorenessTagDen, { color: getSorenessColor(C, soreness) + 'aa' }]}>/10</Text>
                  </View>
                  <Text style={[styles.sorenessTagHint, { color: getSorenessColor(C, soreness) }]}>
                    {parseInt(soreness) <= 3 ? 'Feeling good' :
                     parseInt(soreness) <= 6 ? 'Some fatigue present' :
                     'High soreness — consider resting'}
                  </Text>
                </View>
              ) : (
                <Text style={styles.pickerNone}>Not logged</Text>
              )
            ) : (
              <TouchableOpacity style={styles.pickerBtn} onPress={() => { Haptics.selectionAsync(); setShowSorenessPicker(true); }}>
                <Text style={[styles.pickerBtnValue, { color: soreness ? getSorenessColor(C, soreness) : C.dust }]}>
                  {soreness ? `${soreness} / 10 — ${parseInt(soreness) <= 3 ? 'Feeling good' : parseInt(soreness) <= 6 ? 'Some fatigue' : 'High soreness'}` : 'Select level'}
                </Text>
                <Text style={styles.pickerBtnChevron}>▾</Text>
              </TouchableOpacity>
            )}
          </View>
        </Card>

        {/* Finger Condition */}
        <Card label="Finger Condition">
          <View style={styles.sectionInner}>
            {locked ? (
              affectedFingers.length > 0 ? (
                <View style={styles.pickerTagRow}>
                  {affectedFingers.map(id => (
                    <View key={id} style={[styles.pickerTag, { borderColor: C.redBorder, backgroundColor: C.redBg }]}>
                      <Text style={[styles.pickerTagText, { color: C.red }]}>{id.replace('_', ' ')}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.pickerNone}>No fingers affected</Text>
              )
            ) : (
              <TouchableOpacity style={styles.pickerBtn} onPress={() => { Haptics.selectionAsync(); setShowFingerPicker(true); }}>
                <Text style={[styles.pickerBtnValue, { color: affectedFingers.length > 0 ? C.red : C.dust }]} numberOfLines={1}>
                  {affectedFingers.length === 0 ? 'None affected' : affectedFingers.map(id => id.replace('_', ' ')).join(' · ')}
                </Text>
                <Text style={styles.pickerBtnChevron}>▾</Text>
              </TouchableOpacity>
            )}
          </View>
        </Card>

        {/* Pain Areas */}
        <Card label="Pain or Strain">
          <View style={styles.sectionInner}>
            {locked ? (
              painAreas.length > 0 ? (
                <View style={styles.pickerTagRow}>
                  {painAreas.map(id => (
                    <View key={id} style={[styles.pickerTag, { borderColor: C.redBorder, backgroundColor: C.redBg }]}>
                      <Text style={[styles.pickerTagText, { color: C.red }]}>{PAIN_AREAS.find(a => a.id === id)?.label}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.pickerNone}>No pain areas</Text>
              )
            ) : (
              <TouchableOpacity style={styles.pickerBtn} onPress={() => { Haptics.selectionAsync(); setShowPainPicker(true); }}>
                <Text style={[styles.pickerBtnValue, { color: painAreas.length > 0 ? C.red : C.dust }]} numberOfLines={1}>
                  {painAreas.length === 0 ? 'None today' : painAreas.map(id => PAIN_AREAS.find(a => a.id === id)?.label).join(' · ')}
                </Text>
                <Text style={styles.pickerBtnChevron}>▾</Text>
              </TouchableOpacity>
            )}
          </View>
        </Card>

            {/* Notes */}
            <Card label="Notes · optional" accentColor={C.dust} bgColor={C.surface} labelColor={C.dust}>
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

      {/* Soreness Picker Modal */}
      <Modal visible={showSorenessPicker} transparent animationType="slide" onRequestClose={() => setShowSorenessPicker(false)}>
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowSorenessPicker(false)} />
        <View style={styles.pickerSheet}>
          <View style={styles.pickerSheetHandle} />
          <Text style={styles.pickerSheetTitle}>Overall Soreness</Text>
          <Text style={styles.pickerSheetSub}>1 = no soreness · 10 = extreme</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {SORENESS_LEVELS.map(level => {
              const active = soreness === level;
              const color = getSorenessColor(C, level);
              const hint = parseInt(level) <= 3 ? 'Feeling good' : parseInt(level) <= 6 ? 'Some fatigue' : 'High soreness';
              return (
                <TouchableOpacity
                  key={level}
                  style={[styles.sorenessPickerRow, active && { backgroundColor: color + '18' }]}
                  onPress={() => { Haptics.selectionAsync(); setSoreness(level); setShowSorenessPicker(false); }}
                >
                  <View style={[styles.sorenessPickerNum, { borderColor: active ? color : C.borderLight, backgroundColor: active ? color : C.surfaceAlt }]}>
                    <Text style={[styles.sorenessPickerNumText, { color: active ? '#fff' : C.sand }]}>{level}</Text>
                  </View>
                  <Text style={[styles.sorenessPickerHint, active && { color, fontWeight: '800' }]}>{hint}</Text>
                  {active && <Text style={{ color, fontSize: 16, fontWeight: '800' }}>✓</Text>}
                </TouchableOpacity>
              );
            })}
            <View style={{ height: 30 }} />
          </ScrollView>
        </View>
      </Modal>

      {/* Finger Picker Modal */}
      <Modal visible={showFingerPicker} transparent animationType="slide" onRequestClose={() => setShowFingerPicker(false)}>
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowFingerPicker(false)} />
        <View style={styles.pickerSheet}>
          <View style={styles.pickerSheetHandle} />
          <Text style={styles.pickerSheetTitle}>Finger Condition</Text>
          <Text style={styles.pickerSheetSub}>Select affected fingers</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {FINGER_ZONES.map(finger => (
              <View key={finger.id} style={styles.fingerPickerRow}>
                <Text style={styles.fingerPickerLabel}>{finger.label}</Text>
                <View style={styles.fingerPickerSides}>
                  {SIDES.map(side => {
                    const id = `${side}_${finger.id}`;
                    const active = affectedFingers.includes(id);
                    return (
                      <TouchableOpacity
                        key={side}
                        style={[styles.fingerSideBtn, active && { backgroundColor: C.redBg, borderColor: C.redBorder }]}
                        onPress={() => { Haptics.selectionAsync(); toggleFinger(id); }}
                      >
                        <Text style={[styles.fingerSideBtnText, active && { color: C.red }]}>{side}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}
            <TouchableOpacity
              style={styles.pickerDoneBtn}
              onPress={() => setShowFingerPicker(false)}
            >
              <Text style={styles.pickerDoneBtnText}>Done</Text>
            </TouchableOpacity>
            <View style={{ height: 20 }} />
          </ScrollView>
        </View>
      </Modal>

      {/* Pain Picker Modal */}
      <Modal visible={showPainPicker} transparent animationType="slide" onRequestClose={() => setShowPainPicker(false)}>
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowPainPicker(false)} />
        <View style={styles.pickerSheet}>
          <View style={styles.pickerSheetHandle} />
          <Text style={styles.pickerSheetTitle}>Pain or Strain</Text>
          <Text style={styles.pickerSheetSub}>Select all areas that apply</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {PAIN_AREAS.map(area => {
              const active = painAreas.includes(area.id);
              return (
                <TouchableOpacity
                  key={area.id}
                  style={[styles.painPickerRow, active && { backgroundColor: C.redBg }]}
                  onPress={() => { Haptics.selectionAsync(); togglePain(area.id); }}
                >
                  <Text style={[styles.painPickerLabel, active && { color: C.red, fontWeight: '800' }]}>{area.label}</Text>
                  {active && <Text style={[styles.painPickerCheck, { color: C.red }]}>✓</Text>}
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={styles.pickerDoneBtn}
              onPress={() => setShowPainPicker(false)}
            >
              <Text style={styles.pickerDoneBtnText}>Done</Text>
            </TouchableOpacity>
            <View style={{ height: 20 }} />
          </ScrollView>
        </View>
      </Modal>

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

    // Locked soreness display
    sorenessTagBox: { flexDirection: 'row', alignItems: 'baseline', borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8, gap: 2 },
    sorenessTagNum: { fontSize: 28, fontWeight: '900', letterSpacing: -1 },
    sorenessTagDen: { fontSize: 13, fontWeight: '700' },
    sorenessTagHint: { fontSize: 13, fontWeight: '700', flex: 1 },

    // Soreness picker sheet rows
    sorenessPickerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: C.borderLight, borderRadius: 8, gap: 14 },
    sorenessPickerNum: { width: 40, height: 40, borderRadius: 10, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
    sorenessPickerNumText: { fontSize: 15, fontWeight: '800' },
    sorenessPickerHint: { flex: 1, fontSize: 14, color: C.inkLight, fontWeight: '600' },

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

    notesInput: { color: C.ink, fontSize: 13, lineHeight: 20, minHeight: 72, textAlignVertical: 'top', paddingTop: 2 },
    notesText: { color: C.inkLight, fontSize: 13, lineHeight: 20 },
    notesPlaceholder: { color: C.dust, fontSize: 12, fontStyle: 'italic' },

    mediaThumbnailWrap: { position: 'relative' },
    mediaThumbnail: { width: 88, height: 88, borderRadius: 10, backgroundColor: C.borderLight },
    mediaRemove: { position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center' },
    mediaRemoveText: { color: '#fff', fontSize: 10, fontWeight: '800' },
    mediaAddBtn: { borderWidth: 1.5, borderColor: C.borderLight, borderRadius: 10, borderStyle: 'dashed', padding: 12, alignItems: 'center' },
    mediaAddText: { color: C.dust, fontSize: 12, fontWeight: '700' },

    celebOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 32 },
    celebCard: { backgroundColor: C.surface, borderRadius: 28, padding: 32, alignItems: 'center', width: '100%', gap: 8 },
    celebEmoji: { fontSize: 52, marginBottom: 4 },
    celebNum: { fontSize: 72, fontWeight: '900', color: C.terra, letterSpacing: -3, lineHeight: 76 },
    celebUnit: { fontSize: 16, fontWeight: '700', color: C.dust, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
    celebMsg: { fontSize: 15, color: C.inkLight, textAlign: 'center', lineHeight: 22, marginBottom: 12 },
    celebBtn: { backgroundColor: C.ink, paddingVertical: 14, paddingHorizontal: 32, borderRadius: 14, marginTop: 4 },
    celebBtnText: { color: C.surface, fontSize: 14, fontWeight: '800', letterSpacing: 0.3 },

    stickyFooter: { paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 90, backgroundColor: C.bg, borderTopWidth: 1, borderTopColor: C.borderLight },
    saveBtn: { backgroundColor: C.ink, padding: 16, borderRadius: 12, alignItems: 'center' },
    saveBtnText: { color: C.surface, fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },

    // Picker button (in card)
    pickerBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surfaceAlt, borderRadius: 12, borderWidth: 1, borderColor: C.borderLight, paddingHorizontal: 14, paddingVertical: 13 },
    pickerBtnValue: { flex: 1, color: C.ink, fontSize: 13, fontWeight: '600' },
    pickerBtnChevron: { color: C.dust, fontSize: 14, marginLeft: 8 },

    // Locked tag row
    pickerTagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
    pickerTag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
    pickerTagText: { fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
    pickerNone: { color: C.dust, fontSize: 12, fontStyle: 'italic' },

    // Bottom sheet
    pickerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' },
    pickerSheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 14, maxHeight: '75%' },
    pickerSheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: C.borderLight, alignSelf: 'center', marginBottom: 16 },
    pickerSheetTitle: { fontSize: 18, fontWeight: '800', color: C.ink, letterSpacing: -0.5, marginBottom: 2 },
    pickerSheetSub: { fontSize: 12, color: C.dust, fontWeight: '600', marginBottom: 16 },

    // Finger picker rows
    fingerPickerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.borderLight },
    fingerPickerLabel: { fontSize: 14, fontWeight: '700', color: C.ink, width: 70 },
    fingerPickerSides: { flexDirection: 'row', gap: 10, flex: 1 },
    fingerSideBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: C.borderLight, backgroundColor: C.surfaceAlt, alignItems: 'center' },
    fingerSideBtnText: { fontSize: 13, fontWeight: '800', color: C.sand, letterSpacing: 0.5 },

    // Pain picker rows
    painPickerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: C.borderLight, borderRadius: 8 },
    painPickerLabel: { flex: 1, fontSize: 15, color: C.ink, fontWeight: '600' },
    painPickerCheck: { fontSize: 16, fontWeight: '800' },

    // Done button inside sheet
    pickerDoneBtn: { backgroundColor: C.ink, padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 20, marginBottom: 4 },
    pickerDoneBtnText: { color: C.surface, fontSize: 14, fontWeight: '800', letterSpacing: 0.3 },
  });
}
