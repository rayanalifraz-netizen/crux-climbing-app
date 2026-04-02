import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { editStore } from '../../lib/editStore';
import { Image, KeyboardAvoidingView, Modal, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import ShareCardModal from '../../components/ShareCardModal';
import { scheduleRecoveryReminder } from '../../notifications';
import { copyMediaToStorage, getCheckIns, getProfile, getSessions, getTodayDate, saveSession, type ClimbEntry, type GradeEntry } from '../../storage';
import { gradeColor, gradeColorBg, toDisplayGrade, useTheme } from '../../context/ThemeContext';

const V_GRADES = ['VB', 'V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10', 'V11', 'V12', 'V13+'];
const ATTEMPT_OPTIONS = ['Flash', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10+'];

function entryLabel(grade: string, entry: GradeEntry, gradeSystem: string): string {
  const g = toDisplayGrade(grade, gradeSystem);
  if (entry.attempts === 1 && entry.sends === 1) return `${g} · Flash`;
  if (entry.sends >= 1) return `${g} · ${entry.attempts} att · Sent ✓`;
  return `${g} · ${entry.attempts} att`;
}
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

const HOLD_TYPES = [
  { id: 'crimps', label: 'Crimps', risk: 'A2 Pulley' },
  { id: 'slopers', label: 'Slopers', risk: 'Shoulder' },
  { id: 'pinches', label: 'Pinches', risk: 'Thumb' },
  { id: 'pockets', label: 'Pockets', risk: 'Finger Tendons' },
  { id: 'jugs', label: 'Jugs', risk: 'Low Risk' },
];

const MOVEMENT_TYPES = [
  { id: 'dynos', label: 'Dynos', risk: 'Shoulder' },
  { id: 'heelhooks', label: 'Heel Hooks', risk: 'Knee' },
  { id: 'toehooks', label: 'Toe Hooks', risk: 'Ankle' },
  { id: 'compression', label: 'Compression', risk: 'Hip' },
  { id: 'mantles', label: 'Mantles', risk: 'Wrist' },
];

const HOLD_INJURY_WEIGHT = {
  crimps: 1.3, slopers: 1.1, pinches: 1.2, pockets: 1.4, jugs: 0.8,
};

function calculateRES(gradeData: Record<string, GradeEntry>, maxGrade: string, selectedHolds: string[]) {
  const entries = Object.entries(gradeData).filter(([, e]) => e.attempts > 0);
  if (entries.length === 0) return 0;
  const maxIndex = V_GRADES.indexOf(maxGrade);
  if (maxIndex <= 0) return 100;
  let totalIntensity = 0, totalAttempts = 0;
  entries.forEach(([grade, e]) => {
    const gradeIndex = V_GRADES.indexOf(grade);
    const intensity = gradeIndex / maxIndex;
    const gradesAboveMax = gradeIndex - maxIndex;
    const reachMultiplier = gradesAboveMax > 2 ? 1 + (gradesAboveMax - 2) * 0.25 : 1.0;
    totalIntensity += intensity * reachMultiplier * e.attempts;
    totalAttempts += e.attempts;
  });
  const avgIntensity = totalIntensity / totalAttempts;
  const volumeScore = Math.min(totalAttempts / 15, 1.0);
  const baseRes = avgIntensity * volumeScore;
  let holdMultiplier = 1.0;
  if (selectedHolds.length > 0)
    holdMultiplier = selectedHolds.reduce((sum, h) => sum + (HOLD_INJURY_WEIGHT[h] || 1.0), 0) / selectedHolds.length;
  return Math.min(Math.max(Math.round(baseRes * holdMultiplier * 100), 0), 100);
}

export default function SessionScreen() {
  const { C, gradeSystem } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [targetDate, setTargetDate] = useState(getTodayDate());
  const [isEditing, setIsEditing] = useState(false);
  const [climbs, setClimbs] = useState<ClimbEntry[]>([]);
  const hasUnsavedProgress = useRef(false);
  const [holdTypes, setHoldTypes] = useState([]);
  const [movementTypes, setMovementTypes] = useState([]);
  const [notes, setNotes] = useState('');
  const [savedMedia, setSavedMedia] = useState<string[]>([]);
  const [pendingMedia, setPendingMedia] = useState<string[]>([]);
  const [maxGrade, setMaxGrade] = useState('');
  const [alreadySaved, setAlreadySaved] = useState(false);
  const [savedSession, setSavedSession] = useState(null);
  const [isRestDay, setIsRestDay] = useState(false);
  const [showShareCard, setShowShareCard] = useState(false);
  const [draftGrade, setDraftGrade] = useState('V4');
  const [draftAttempts, setDraftAttempts] = useState('Flash');
  const [draftSent, setDraftSent] = useState(false);
  const [showGradePicker, setShowGradePicker] = useState(false);
  const [showAttemptsPicker, setShowAttemptsPicker] = useState(false);

  useFocusEffect(useCallback(() => {
    const editDate = editStore.sessionDate;
    editStore.sessionDate = null;
    const date = editDate || getTodayDate();
    const editing = !!editDate;
    // Preserve in-progress unsaved work when switching tabs
    if (!editDate && hasUnsavedProgress.current) return;
    setTargetDate(date);
    setIsEditing(editing);
    loadProfile();
    loadSession(date);
  }, []));

  const loadProfile = async () => {
    const profile = await getProfile();
    if (profile) setMaxGrade(profile.maxGrade);
  };

  const loadSession = async (date: string) => {
    const [sessions, checkIns] = await Promise.all([getSessions(), getCheckIns()]);
    const existing = sessions[date];
    const checkIn = checkIns[date];
    setAlreadySaved(!!existing);
    setSavedSession(existing || null);
    if (existing) {
      // restore climbs — fall back to gradeData for older sessions
      const restored: ClimbEntry[] = existing.climbs ||
        Object.entries(existing.gradeData || {})
          .filter(([, e]) => e.attempts > 0)
          .map(([grade, e]) => ({ id: grade, grade, attempts: e.attempts, sends: e.sends }));
      setClimbs(restored);
      setHoldTypes(existing.holdTypes || []);
      setMovementTypes(existing.movementTypes || []);
      setNotes(existing.notes || '');
      setSavedMedia(existing.mediaUris || []);
    } else {
      setClimbs([]);
      setHoldTypes([]);
      setMovementTypes([]);
      setNotes('');
      setSavedMedia([]);
    }
    setPendingMedia([]);
    setIsRestDay(checkIn?.isRestDay || false);
  };

  const addGradeEntry = () => {
    Haptics.selectionAsync();
    hasUnsavedProgress.current = true;
    const attNum = draftAttempts === 'Flash' ? 1 : draftAttempts === '10+' ? 10 : parseInt(draftAttempts);
    const sends = draftAttempts === 'Flash' ? 1 : draftSent ? 1 : 0;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setClimbs(prev => [...prev, { id, grade: draftGrade, attempts: attNum, sends }]);
  };

  const removeClimbEntry = (id: string) => {
    Haptics.selectionAsync();
    hasUnsavedProgress.current = true;
    setClimbs(prev => prev.filter(c => c.id !== id));
  };

  const toggleHold = (id) => {
    Haptics.selectionAsync();
    setHoldTypes(prev => prev.includes(id) ? prev.filter(h => h !== id) : [...prev, id]);
  };

  const toggleMovement = (id) => {
    Haptics.selectionAsync();
    setMovementTypes(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]);
  };

  const pickMedia = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      quality: 0.8,
      videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
    });
    if (!result.canceled) {
      setPendingMedia(prev => [...prev, ...result.assets.map(a => a.uri)]);
    }
  };

  const removeMedia = (uri: string) => {
    setSavedMedia(prev => prev.filter(u => u !== uri));
    setPendingMedia(prev => prev.filter(u => u !== uri));
  };

  const handleSave = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    hasUnsavedProgress.current = false;
    const persistedUris = await Promise.all(pendingMedia.map(uri => copyMediaToStorage(uri)));
    const mergedMedia = [...savedMedia, ...persistedUris];
    await saveSession({ date: targetDate, gradeData, climbs, holdTypes, movementTypes, res, notes: notes.trim(), mediaUris: mergedMedia });
    if (!isEditing) scheduleRecoveryReminder(res).catch(() => {});
    setAlreadySaved(true);
    setSavedSession({ gradeData, climbs, holdTypes, movementTypes, res, notes: notes.trim(), mediaUris: mergedMedia });
    setSavedMedia(mergedMedia);
    setPendingMedia([]);
    if (isEditing) router.navigate('/(tabs)/calendar');
  };

  const locked = alreadySaved && !isEditing;
  const hasGrades = climbs.length > 0;
  const totalAttempts = climbs.reduce((a, c) => a + c.attempts, 0);
  const totalSends = climbs.reduce((a, c) => a + c.sends, 0);
  // aggregate climbs into gradeData for RES calculation
  const gradeData = climbs.reduce((acc, c) => {
    const ex = acc[c.grade] || { attempts: 0, sends: 0 };
    return { ...acc, [c.grade]: { attempts: ex.attempts + c.attempts, sends: ex.sends + c.sends } };
  }, {} as Record<string, GradeEntry>);
  const res = maxGrade ? calculateRES(gradeData, maxGrade, holdTypes) : 0;

  const getResColor = (val) => val <= 40 ? C.terra : val <= 70 ? C.amber : C.red;
  const getResBg = (val) => val <= 40 ? C.terraBg : val <= 70 ? C.amberBg : C.redBg;
  const getResBorder = (val) => val <= 40 ? C.terraBorder : val <= 70 ? C.amberBorder : C.redBorder;
  const getResLabel = (val) => val <= 40 ? 'Light — minimal recovery needed' : val <= 70 ? 'Moderate — rest tomorrow if sore' : 'Hard — prioritize recovery tonight';

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, hasGrades && !locked && !isRestDay && { paddingBottom: 88 }]} keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>
            {isEditing
              ? new Date(targetDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
              : new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </Text>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{isEditing ? 'Edit Session' : 'Log Session'}</Text>
            {locked && (
              <View style={[styles.statusBadge, { borderColor: C.terraBorder, backgroundColor: C.terraBg }]}>
                <Text style={[styles.statusBadgeText, { color: C.terra }]}>✓ Logged</Text>
              </View>
            )}
            {isRestDay && !alreadySaved && (
              <View style={[styles.statusBadge, { borderColor: C.greenBorder, backgroundColor: C.greenBg }]}>
                <Text style={[styles.statusBadgeText, { color: C.green }]}>Rest Day</Text>
              </View>
            )}
          </View>
        </View>

        {/* Rest Day Block */}
        {isRestDay && !locked && (
          <Card label={isEditing ? new Date(targetDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Today'} accentColor={C.green} bgColor={C.greenBg} labelColor={C.green}>
            <View style={styles.restDayInner}>
              <Text style={styles.restDayTitle}>Rest Day</Text>
              <Text style={styles.restDayText}>
                You logged a rest day — no session can be recorded.{'\n'}Clear your check-in from Settings to override.
              </Text>
            </View>
          </Card>
        )}

        {/* Already Saved */}
        {locked && savedSession && (
          <Card label={isEditing ? 'Session' : "Today's Session"} accentColor={C.terra} bgColor={C.terraBg} labelColor={C.terra}>
            <View style={styles.savedInner}>
              <View style={styles.savedTopRow}>
                <Text style={styles.savedAttempts}>
                  {Object.values(savedSession.gradeData || {}).reduce((a, e) => a + e.attempts, 0)} attempts · {Object.values(savedSession.gradeData || {}).reduce((a, e) => a + e.sends, 0)} sends
                </Text>
                <View style={[styles.resBox, { borderColor: getResBorder(savedSession.res) }]}>
                  <Text style={[styles.resBoxNum, { color: getResColor(savedSession.res) }]}>{savedSession.res}</Text>
                  <Text style={[styles.resBoxLabel, { color: getResColor(savedSession.res) }]}>RES</Text>
                </View>
              </View>
              {(() => {
                const entries: ClimbEntry[] = savedSession.climbs ||
                  Object.entries(savedSession.gradeData || {})
                    .filter(([, e]) => e.attempts > 0)
                    .map(([grade, e]) => ({ id: grade, grade, attempts: e.attempts, sends: e.sends }));
                return entries.length > 0 ? (
                  <View style={styles.savedGrades}>
                    {entries.map(c => (
                      <View key={c.id} style={[styles.savedGradeChip, { backgroundColor: gradeColorBg(c.grade), borderColor: gradeColor(c.grade) + '40' }]}>
                        <Text style={[styles.savedGradeText, { color: gradeColor(c.grade) }]}>
                          {entryLabel(c.grade, c, gradeSystem)}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null;
              })()}
              {savedSession.notes ? (
                <View style={styles.savedNotesBox}>
                  <Text style={styles.savedNotesText}>{savedSession.notes}</Text>
                </View>
              ) : null}
              <Text style={styles.savedHint}>Go to Calendar → Edit Session to make changes</Text>
              <TouchableOpacity
                style={[styles.shareCardBtn, { borderColor: getResBorder(savedSession.res) }]}
                onPress={() => setShowShareCard(true)}
              >
                <Text style={[styles.shareCardBtnText, { color: getResColor(savedSession.res) }]}>↑ Share Session</Text>
              </TouchableOpacity>
            </View>
          </Card>
        )}

        {/* Main Form */}
        {!locked && !isRestDay && (
          <>
            {!maxGrade && (
              <Card label="Notice" accentColor={C.amber} bgColor={C.amberBg} labelColor={C.amber}>
                <View style={styles.noticeInner}>
                  <Text style={styles.noticeText}>Set your climbing level in Profile for accurate RES</Text>
                </View>
              </Card>
            )}

            {/* Grades */}
            <Card label={hasGrades ? `Grades · ${totalAttempts} att · ${totalSends} sends` : 'Grades Climbed'}>
              <View style={styles.sectionInner}>
                {/* Picker row */}
                <View style={styles.pickerRow}>
                  <TouchableOpacity style={styles.pickerBtn} onPress={() => { Haptics.selectionAsync(); setShowGradePicker(true); }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pickerBtnLabel}>Grade</Text>
                      <Text style={[styles.pickerBtnValue, { color: gradeColor(draftGrade) }]}>{toDisplayGrade(draftGrade, gradeSystem)}</Text>
                    </View>
                    <Text style={styles.pickerBtnChevron}>▾</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.pickerBtn} onPress={() => { Haptics.selectionAsync(); setShowAttemptsPicker(true); }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pickerBtnLabel}>Attempts</Text>
                      <Text style={styles.pickerBtnValue}>{draftAttempts}</Text>
                    </View>
                    <Text style={styles.pickerBtnChevron}>▾</Text>
                  </TouchableOpacity>
                </View>

                {/* Sent toggle */}
                {draftAttempts !== 'Flash' && (
                  <TouchableOpacity style={styles.sentToggle} onPress={() => { Haptics.selectionAsync(); setDraftSent(v => !v); }}>
                    <View style={[styles.sentCheckbox, draftSent && { backgroundColor: C.terra, borderColor: C.terra }]}>
                      {draftSent && <Text style={styles.sentCheckmark}>✓</Text>}
                    </View>
                    <Text style={styles.sentLabel}>Sent it</Text>
                  </TouchableOpacity>
                )}

                {/* Add button */}
                <TouchableOpacity style={styles.addEntryBtn} onPress={addGradeEntry}>
                  <Text style={styles.addEntryBtnText}>+ Add</Text>
                </TouchableOpacity>

                {/* Entry list */}
                {hasGrades && (
                  <View style={styles.entryList}>
                    {climbs.map(climb => {
                      const color = gradeColor(climb.grade);
                      return (
                        <View key={climb.id} style={[styles.entryRow, { borderLeftColor: color }]}>
                          <Text style={[styles.entryText, { color }]}>{entryLabel(climb.grade, climb, gradeSystem)}</Text>
                          <TouchableOpacity onPress={() => removeClimbEntry(climb.id)} style={styles.entryRemoveBtn}>
                            <Text style={styles.entryRemoveText}>✕</Text>
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            </Card>

            {/* Live RES */}
            {hasGrades && (
              <Card
                label="Relative Effort Score"
                accentColor={getResColor(res)}
                bgColor={getResBg(res)}
                labelColor={getResColor(res)}
              >
                <View style={styles.resInner}>
                  <View style={styles.resTopRow}>
                    <Text style={[styles.resVerdict, { color: getResColor(res) }]}>{getResLabel(res)}</Text>
                    <View style={[styles.resScoreBox, { borderColor: getResBorder(res) }]}>
                      <Text style={[styles.resScoreNum, { color: getResColor(res) }]}>{res}</Text>
                    </View>
                  </View>
                  <View style={styles.resTrack}>
                    <View style={[styles.resFill, { width: `${res}%`, backgroundColor: getResColor(res) }]} />
                  </View>
                </View>
              </Card>
            )}

            {/* Hold Types */}
            <Card label="Hold Types · affects RES">
              <View style={styles.sectionInner}>
                <View style={styles.tagGrid}>
                  {HOLD_TYPES.map((hold) => {
                    const selected = holdTypes.includes(hold.id);
                    return (
                      <TouchableOpacity
                        key={hold.id}
                        style={[styles.tagChip, selected && { backgroundColor: C.terraBg, borderColor: C.terraBorder }]}
                        onPress={() => toggleHold(hold.id)}
                      >
                        <Text style={[styles.tagLabel, selected && { color: C.terra }]}>{hold.label}</Text>
                        <Text style={[styles.tagRisk, selected && { color: C.terraDark }]}>{hold.risk}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </Card>

            {/* Movement Types */}
            <Card label="Movement Types · injury tracking">
              <View style={styles.sectionInner}>
                <View style={styles.tagGrid}>
                  {MOVEMENT_TYPES.map((move) => {
                    const selected = movementTypes.includes(move.id);
                    return (
                      <TouchableOpacity
                        key={move.id}
                        style={[styles.tagChip, selected && { backgroundColor: C.amberBg, borderColor: C.amberBorder }]}
                        onPress={() => toggleMovement(move.id)}
                      >
                        <Text style={[styles.tagLabel, selected && { color: C.amber }]}>{move.label}</Text>
                        <Text style={[styles.tagRisk, selected && { color: C.amber }]}>{move.risk}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </Card>

            {/* Notes */}
            <Card label="Session Notes · optional">
              <View style={styles.sectionInner}>
                <TextInput
                  style={styles.notesInput}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="How did it go? Any wins or tweaks to note..."
                  placeholderTextColor={C.dust}
                  multiline
                  numberOfLines={3}
                  maxLength={300}
                  textAlignVertical="top"
                />
                {notes.length > 0 && (
                  <Text style={styles.notesCount}>{notes.length}/300</Text>
                )}
              </View>
            </Card>

            {/* Media */}
            <Card label="Photos & Videos · optional">
              <View style={styles.sectionInner}>
                {(savedMedia.length > 0 || pendingMedia.length > 0) && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {[...savedMedia, ...pendingMedia].map(uri => (
                        <View key={uri} style={styles.mediaThumbnailWrap}>
                          <Image source={{ uri }} style={styles.mediaThumbnail} />
                          <TouchableOpacity style={styles.mediaRemoveBtn} onPress={() => removeMedia(uri)}>
                            <Text style={styles.mediaRemoveText}>✕</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                )}
                <TouchableOpacity style={styles.mediaAddBtn} onPress={pickMedia}>
                  <Text style={styles.mediaAddText}>+ Add photos / videos</Text>
                </TouchableOpacity>
              </View>
            </Card>

          </>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
      </KeyboardAvoidingView>

      {hasGrades && !locked && !isRestDay && (
        <View style={styles.stickyFooter}>
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
            <Text style={styles.saveBtnText}>Save Session →</Text>
          </TouchableOpacity>
        </View>
      )}

      {locked && savedSession && (
        <ShareCardModal
          visible={showShareCard}
          onClose={() => setShowShareCard(false)}
          type="session"
          session={savedSession}
          date={targetDate}
        />
      )}

      {/* Grade Picker Modal */}
      <Modal visible={showGradePicker} transparent animationType="slide" onRequestClose={() => setShowGradePicker(false)}>
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowGradePicker(false)}>
          <View style={styles.pickerSheet}>
            <View style={styles.pickerSheetHandle} />
            <Text style={styles.pickerSheetTitle}>Select Grade</Text>
            <ScrollView style={{ maxHeight: 340 }}>
              {V_GRADES.map(grade => (
                <TouchableOpacity
                  key={grade}
                  style={[styles.pickerOption, draftGrade === grade && styles.pickerOptionSelected]}
                  onPress={() => { Haptics.selectionAsync(); setDraftGrade(grade); setShowGradePicker(false); }}
                >
                  <Text style={[styles.pickerOptionText, { color: gradeColor(grade) }, draftGrade === grade && styles.pickerOptionTextSelected]}>
                    {toDisplayGrade(grade, gradeSystem)}
                  </Text>
                  {draftGrade === grade && <Text style={styles.pickerCheckmark}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Attempts Picker Modal */}
      <Modal visible={showAttemptsPicker} transparent animationType="slide" onRequestClose={() => setShowAttemptsPicker(false)}>
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowAttemptsPicker(false)}>
          <View style={styles.pickerSheet}>
            <View style={styles.pickerSheetHandle} />
            <Text style={styles.pickerSheetTitle}>Attempts</Text>
            <ScrollView style={{ maxHeight: 340 }}>
              {ATTEMPT_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt}
                  style={[styles.pickerOption, draftAttempts === opt && styles.pickerOptionSelected]}
                  onPress={() => { Haptics.selectionAsync(); setDraftAttempts(opt); if (opt === 'Flash') setDraftSent(false); setShowAttemptsPicker(false); }}
                >
                  <Text style={[styles.pickerOptionText, draftAttempts === opt && styles.pickerOptionTextSelected]}>
                    {opt === 'Flash' ? 'Flash' : opt === '1' ? '1 attempt' : `${opt} attempts`}
                  </Text>
                  {draftAttempts === opt && <Text style={styles.pickerCheckmark}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    scrollContent: { paddingBottom: 60 },

    header: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 20 },
    greeting: { fontSize: 11, color: C.dust, fontWeight: '600', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
    title: { fontSize: 38, fontWeight: '800', color: C.ink, letterSpacing: -1.5, lineHeight: 42 },
    statusBadge: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, marginTop: 4 },
    statusBadgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },

    restDayInner: { padding: 24, paddingLeft: 24, alignItems: 'center', gap: 8 },
    restDayTitle: { fontSize: 28, fontWeight: '800', color: C.green, letterSpacing: -1 },
    restDayText: { color: C.sand, fontSize: 12, textAlign: 'center', lineHeight: 18 },

    savedInner: { padding: 18, paddingLeft: 24 },
    savedTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
    savedAttempts: { color: C.sand, fontSize: 13 },
    resBox: { alignItems: 'center', borderWidth: 1.5, borderRadius: 12, padding: 10, minWidth: 52 },
    resBoxNum: { fontSize: 20, fontWeight: '800' },
    resBoxLabel: { fontSize: 8, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase' },
    savedGrades: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
    savedGradeChip: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: C.surface, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 4, borderWidth: 1, borderColor: C.borderLight },
    savedGradeText: { color: C.terra, fontSize: 12, fontWeight: '800' },
    savedGradeCount: { color: C.dust, fontSize: 11 },
    savedNotesBox: { backgroundColor: C.surface, borderRadius: 12, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: C.borderLight },
    savedNotesText: { color: C.sand, fontSize: 12, lineHeight: 18 },
    savedHint: { color: C.dust, fontSize: 10, textAlign: 'center', marginBottom: 12 },
    shareCardBtn: { borderWidth: 1.5, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
    shareCardBtnText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.3 },

    mediaThumbnailWrap: { position: 'relative' },
    mediaThumbnail: { width: 90, height: 90, borderRadius: 10, backgroundColor: C.borderLight },
    mediaRemoveBtn: { position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center' },
    mediaRemoveText: { color: '#fff', fontSize: 10, fontWeight: '800' },
    mediaAddBtn: { borderWidth: 1.5, borderColor: C.borderLight, borderStyle: 'dashed', borderRadius: 10, padding: 14, alignItems: 'center' },
    mediaAddText: { color: C.sand, fontSize: 13, fontWeight: '600' },

    noticeInner: { padding: 14, paddingLeft: 24 },
    noticeText: { color: C.amber, fontSize: 12, fontWeight: '600' },

    sectionInner: { padding: 16, paddingTop: 14 },
    sectionHint: { color: C.dust, fontSize: 11, marginBottom: 12 },

    pickerRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
    pickerBtn: { flex: 1, backgroundColor: C.surfaceAlt, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C.borderLight, flexDirection: 'row', alignItems: 'center' },
    pickerBtnLabel: { fontSize: 9, color: C.dust, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', flex: 1 },
    pickerBtnValue: { fontSize: 15, fontWeight: '800', color: C.ink, marginRight: 4 },
    pickerBtnChevron: { fontSize: 11, color: C.dust },
    sentToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    sentCheckbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: C.borderLight, justifyContent: 'center', alignItems: 'center' },
    sentCheckmark: { color: '#fff', fontSize: 11, fontWeight: '800' },
    sentLabel: { color: C.sand, fontSize: 13, fontWeight: '600' },
    addEntryBtn: { backgroundColor: C.ink, borderRadius: 10, padding: 12, alignItems: 'center', marginBottom: 14 },
    addEntryBtnText: { color: C.surface, fontSize: 13, fontWeight: '800', letterSpacing: 0.3 },
    entryList: { gap: 8 },
    entryRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surfaceAlt, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderLeftWidth: 3 },
    entryText: { fontSize: 14, fontWeight: '700', flex: 1 },
    entryRemoveBtn: { width: 28, height: 28, justifyContent: 'center', alignItems: 'center' },
    entryRemoveText: { color: C.dust, fontSize: 13, fontWeight: '800' },
    pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    pickerSheet: { backgroundColor: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 40 },
    pickerSheetHandle: { width: 36, height: 4, backgroundColor: C.borderLight, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 8 },
    pickerSheetTitle: { fontSize: 13, fontWeight: '800', color: C.ink, letterSpacing: 0.3, paddingHorizontal: 20, paddingTop: 4, paddingBottom: 10 },
    pickerOption: { paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: C.borderLight },
    pickerOptionSelected: { backgroundColor: C.surfaceAlt },
    pickerOptionText: { fontSize: 15, fontWeight: '700', color: C.sand },
    pickerOptionTextSelected: { color: C.ink },
    pickerCheckmark: { fontSize: 13, color: C.terra, fontWeight: '800' },

    resInner: { padding: 18, paddingLeft: 24 },
    resTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
    resVerdict: { fontSize: 16, fontWeight: '700', flex: 1, lineHeight: 20 },
    resScoreBox: { width: 52, height: 52, borderWidth: 1.5, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    resScoreNum: { fontSize: 20, fontWeight: '800' },
    resTrack: { height: 6, backgroundColor: C.borderLight, borderRadius: 3, overflow: 'hidden' },
    resFill: { height: 6, borderRadius: 3 },

    tagGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
    tagChip: { paddingHorizontal: 13, paddingVertical: 8, backgroundColor: C.surfaceAlt, borderRadius: 10, borderWidth: 1, borderColor: C.borderLight },
    tagLabel: { color: C.sand, fontSize: 13, fontWeight: '700' },
    tagRisk: { color: C.dust, fontSize: 9, marginTop: 2, letterSpacing: 0.3 },

    notesInput: { backgroundColor: C.surfaceAlt, borderRadius: 12, padding: 12, color: C.ink, fontSize: 13, lineHeight: 19, minHeight: 72, borderWidth: 1, borderColor: C.borderLight },
    notesCount: { color: C.dust, fontSize: 10, textAlign: 'right', marginTop: 6 },

    stickyFooter: { paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 16, backgroundColor: C.bg, borderTopWidth: 1, borderTopColor: C.borderLight },
    saveBtn: { backgroundColor: C.ink, padding: 16, borderRadius: 12, alignItems: 'center' },
    saveBtnText: { color: C.surface, fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },
  });
}
