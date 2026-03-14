import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { getCheckIns, getProfile, getSessions, getTodayDate, saveSession } from '../../storage';

const V_GRADES = ['VB', 'V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10', 'V11', 'V12'];
const today = getTodayDate();

const C = {
  bg:         '#e8e0d0',
  surface:    '#f5f0e8',
  surfaceAlt: '#ede8dc',
  border:     '#8a7a6a',
  borderLight:'#c8bfaa',
  ink:        '#2a2018',
  sand:       '#7a6e60',
  dust:       '#a89880',
  terra:      '#c4734a',
  terraBg:    '#faf0e8',
  terraBorder:'#c4734a',
  terraDark:  '#9a5535',
  amber:      '#c4843a',
  amberBg:    '#fef8ee',
  amberBorder:'#c4843a',
  red:        '#c44a3a',
  redBg:      '#fef5f4',
  redBorder:  '#c44a3a',
  green:      '#5a8a4a',
  greenBg:    '#f4faf0',
  greenBorder:'#5a8a4a',
};

function WindowBox({ label, labelColor, borderColor, bgColor, children, style }) {
  return (
    <View style={[{
      borderWidth: 1.5,
      borderColor: borderColor || C.border,
      backgroundColor: bgColor || C.surface,
      borderRadius: 4,
      marginHorizontal: 16,
      marginBottom: 12,
    }, style]}>
      {label && (
        <View style={{
          position: 'absolute',
          top: -10,
          left: 12,
          backgroundColor: bgColor || C.surface,
          paddingHorizontal: 6,
        }}>
          <Text style={{
            fontSize: 9,
            fontWeight: '800',
            color: labelColor || C.sand,
            letterSpacing: 1.5,
            textTransform: 'uppercase',
          }}>{label}</Text>
        </View>
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

function calculateRES(gradeCounts, maxGrade, selectedHolds) {
  const entries = Object.entries(gradeCounts).filter(([_, count]) => count > 0);
  if (entries.length === 0) return 0;
  const maxIndex = V_GRADES.indexOf(maxGrade);
  if (maxIndex <= 0) return 100;
  let totalIntensity = 0, totalAttempts = 0;
  entries.forEach(([grade, count]) => {
    const gradeIndex = V_GRADES.indexOf(grade);
    const intensity = gradeIndex / maxIndex;
    const gradesAboveMax = gradeIndex - maxIndex;
    const reachMultiplier = gradesAboveMax > 2 ? 1 + (gradesAboveMax - 2) * 0.25 : 1.0;
    totalIntensity += intensity * reachMultiplier * count;
    totalAttempts += count;
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
  const [gradeCounts, setGradeCounts] = useState({});
  const [holdTypes, setHoldTypes] = useState([]);
  const [movementTypes, setMovementTypes] = useState([]);
  const [notes, setNotes] = useState('');
  const [maxGrade, setMaxGrade] = useState('');
  const [alreadySaved, setAlreadySaved] = useState(false);
  const [savedSession, setSavedSession] = useState(null);
  const [isRestDay, setIsRestDay] = useState(false);

  useEffect(() => { loadProfile(); checkTodaySession(); }, []);
  useFocusEffect(useCallback(() => { loadProfile(); checkTodaySession(); }, []));

  const loadProfile = async () => {
    const profile = await getProfile();
    if (profile) setMaxGrade(profile.maxGrade);
  };

  const checkTodaySession = async () => {
    const [sessions, checkIns] = await Promise.all([getSessions(), getCheckIns()]);
    const todaySession = sessions[today];
    const todayCheckIn = checkIns[today];
    setAlreadySaved(!!todaySession);
    setSavedSession(todaySession || null);
    setIsRestDay(todayCheckIn?.isRestDay || false);
  };

  const incrementGrade = (grade) =>
    setGradeCounts(prev => ({ ...prev, [grade]: (prev[grade] || 0) + 1 }));

  const decrementGrade = (grade) =>
    setGradeCounts(prev => {
      const current = prev[grade] || 0;
      if (current <= 1) { const u = { ...prev }; delete u[grade]; return u; }
      return { ...prev, [grade]: current - 1 };
    });

  const toggleHold = (id) =>
    setHoldTypes(prev => prev.includes(id) ? prev.filter(h => h !== id) : [...prev, id]);

  const toggleMovement = (id) =>
    setMovementTypes(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]);

  const handleSave = async () => {
    await saveSession({ date: today, gradeCounts, holdTypes, movementTypes, res, notes: notes.trim() });
    setAlreadySaved(true);
    setSavedSession({ gradeCounts, holdTypes, movementTypes, res, notes: notes.trim() });
    setGradeCounts({});
    setHoldTypes([]);
    setMovementTypes([]);
    setNotes('');
  };

  const hasGrades = Object.keys(gradeCounts).length > 0;
  const totalAttempts = Object.values(gradeCounts).reduce((a, b) => a + b, 0);
  const res = maxGrade ? calculateRES(gradeCounts, maxGrade, holdTypes) : 0;

  const getResColor = (val) => val <= 40 ? C.terra : val <= 70 ? C.amber : C.red;
  const getResBg = (val) => val <= 40 ? C.terraBg : val <= 70 ? C.amberBg : C.redBg;
  const getResBorder = (val) => val <= 40 ? C.terraBorder : val <= 70 ? C.amberBorder : C.redBorder;
  const getResLabel = (val) => val <= 40 ? 'Light — minimal recovery needed' : val <= 70 ? 'Moderate — rest tomorrow if sore' : 'Hard — prioritize recovery tonight';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </Text>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Log Session</Text>
            {alreadySaved && (
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
        {isRestDay && !alreadySaved && (
          <WindowBox label="Today" borderColor={C.greenBorder} bgColor={C.greenBg} labelColor={C.green}>
            <View style={styles.restDayInner}>
              <Text style={styles.restDayTitle}>Rest Day</Text>
              <Text style={styles.restDayText}>
                You logged a rest day — no session can be recorded.{'\n'}Clear your check-in from Settings to override.
              </Text>
            </View>
          </WindowBox>
        )}

        {/* Already Saved */}
        {alreadySaved && savedSession && (
          <WindowBox label="Today's Session" borderColor={C.terraBorder} bgColor={C.terraBg} labelColor={C.terra}>
            <View style={styles.savedInner}>
              <View style={styles.savedTopRow}>
                <Text style={styles.savedAttempts}>
                  {Object.values(savedSession.gradeCounts || {}).reduce((a, b) => a + b, 0)} attempts logged
                </Text>
                <View style={[styles.resBox, { borderColor: getResBorder(savedSession.res) }]}>
                  <Text style={[styles.resBoxNum, { color: getResColor(savedSession.res) }]}>{savedSession.res}</Text>
                  <Text style={[styles.resBoxLabel, { color: getResColor(savedSession.res) }]}>RES</Text>
                </View>
              </View>
              {savedSession.gradeCounts && Object.keys(savedSession.gradeCounts).length > 0 && (
                <View style={styles.savedGrades}>
                  {Object.entries(savedSession.gradeCounts).map(([grade, count]) => (
                    <View key={grade} style={styles.savedGradeChip}>
                      <Text style={styles.savedGradeText}>{grade}</Text>
                      <Text style={styles.savedGradeCount}>×{count}</Text>
                    </View>
                  ))}
                </View>
              )}
              {savedSession.notes ? (
                <View style={styles.savedNotesBox}>
                  <Text style={styles.savedNotesText}>{savedSession.notes}</Text>
                </View>
              ) : null}
              <Text style={styles.savedHint}>Clear from Settings to re-log today</Text>
            </View>
          </WindowBox>
        )}

        {/* Main Form */}
        {!alreadySaved && !isRestDay && (
          <>
            {!maxGrade && (
              <WindowBox label="Notice" borderColor={C.amberBorder} bgColor={C.amberBg} labelColor={C.amber}>
                <View style={styles.noticeInner}>
                  <Text style={styles.noticeText}>Set your climbing level in Profile for accurate RES</Text>
                </View>
              </WindowBox>
            )}

            {/* Grades */}
            <WindowBox label={hasGrades ? `Grades Climbed · ${totalAttempts} attempts` : 'Grades Climbed'}>
              <View style={styles.sectionInner}>
                <Text style={styles.sectionHint}>Tap + to log attempts at each grade</Text>
                <View style={styles.gradeGrid}>
                  {V_GRADES.map((grade) => {
                    const count = gradeCounts[grade] || 0;
                    const isActive = count > 0;
                    return (
                      <View key={grade} style={[
                        styles.gradeCell,
                        isActive && { borderColor: C.terraBorder, backgroundColor: C.terraBg }
                      ]}>
                        <Text style={[styles.gradeLabel, isActive && { color: C.terra }]}>{grade}</Text>
                        <View style={styles.counter}>
                          {isActive && (
                            <TouchableOpacity onPress={() => decrementGrade(grade)} style={styles.counterBtn}>
                              <Text style={styles.counterBtnText}>−</Text>
                            </TouchableOpacity>
                          )}
                          {isActive && <Text style={styles.countText}>{count}</Text>}
                          <TouchableOpacity
                            onPress={() => incrementGrade(grade)}
                            style={[styles.counterBtn, isActive && { backgroundColor: C.terraDark }]}
                          >
                            <Text style={[styles.counterBtnText, { color: isActive ? '#fff' : C.sand }]}>+</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            </WindowBox>

            {/* Live RES */}
            {hasGrades && (
              <WindowBox
                label="Relative Effort Score"
                borderColor={getResBorder(res)}
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
              </WindowBox>
            )}

            {/* Hold Types */}
            <WindowBox label="Hold Types · affects RES">
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
            </WindowBox>

            {/* Movement Types */}
            <WindowBox label="Movement Types · injury tracking">
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
            </WindowBox>

            {/* Notes */}
            <WindowBox label="Session Notes · optional">
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
            </WindowBox>

            {/* Save */}
            {hasGrades && (
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                <Text style={styles.saveBtnText}>Save Session →</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scrollContent: { paddingBottom: 48 },

  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 20 },
  greeting: { fontSize: 11, color: C.dust, fontWeight: '600', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  title: { fontSize: 38, fontWeight: '800', color: C.ink, letterSpacing: -1.5, lineHeight: 42 },
  statusBadge: { borderWidth: 1.5, borderRadius: 4, paddingHorizontal: 10, paddingVertical: 4, marginTop: 4 },
  statusBadgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },

  restDayInner: { padding: 24, alignItems: 'center', gap: 8 },
  restDayTitle: { fontSize: 28, fontWeight: '800', color: C.green, letterSpacing: -1 },
  restDayText: { color: C.sand, fontSize: 12, textAlign: 'center', lineHeight: 18 },

  savedInner: { padding: 18, paddingTop: 22 },
  savedTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  savedAttempts: { color: C.sand, fontSize: 13 },
  resBox: { alignItems: 'center', borderWidth: 1.5, borderRadius: 4, padding: 10, minWidth: 52 },
  resBoxNum: { fontSize: 20, fontWeight: '800' },
  resBoxLabel: { fontSize: 8, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase' },
  savedGrades: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  savedGradeChip: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: C.surface, borderRadius: 4, paddingHorizontal: 9, paddingVertical: 4, borderWidth: 1, borderColor: C.borderLight },
  savedGradeText: { color: C.terra, fontSize: 12, fontWeight: '800' },
  savedGradeCount: { color: C.dust, fontSize: 11 },
  savedNotesBox: { backgroundColor: C.surface, borderRadius: 4, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: C.borderLight },
  savedNotesText: { color: C.sand, fontSize: 12, lineHeight: 18 },
  savedHint: { color: C.dust, fontSize: 10, textAlign: 'center' },

  noticeInner: { padding: 14 },
  noticeText: { color: C.amber, fontSize: 12, fontWeight: '600' },

  sectionInner: { padding: 16, paddingTop: 20 },
  sectionHint: { color: C.dust, fontSize: 11, marginBottom: 12 },

  gradeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  gradeCell: { width: '22%', backgroundColor: C.surfaceAlt, borderRadius: 4, padding: 8, alignItems: 'center', borderWidth: 1, borderColor: C.borderLight },
  gradeLabel: { color: C.sand, fontSize: 13, fontWeight: '800', marginBottom: 6 },
  counter: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  counterBtn: { width: 20, height: 20, backgroundColor: C.borderLight, borderRadius: 3, justifyContent: 'center', alignItems: 'center' },
  counterBtnText: { color: C.sand, fontSize: 13, fontWeight: '800', lineHeight: 17 },
  countText: { color: C.ink, fontSize: 12, fontWeight: '800', minWidth: 12, textAlign: 'center' },

  resInner: { padding: 18, paddingTop: 22 },
  resTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  resVerdict: { fontSize: 16, fontWeight: '700', flex: 1, lineHeight: 20 },
  resScoreBox: { width: 52, height: 52, borderWidth: 1.5, borderRadius: 4, justifyContent: 'center', alignItems: 'center' },
  resScoreNum: { fontSize: 20, fontWeight: '800' },
  resTrack: { height: 3, backgroundColor: C.borderLight, borderRadius: 1, overflow: 'hidden' },
  resFill: { height: 3, borderRadius: 1 },

  tagGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  tagChip: { paddingHorizontal: 13, paddingVertical: 8, backgroundColor: C.surfaceAlt, borderRadius: 4, borderWidth: 1, borderColor: C.borderLight },
  tagLabel: { color: C.sand, fontSize: 13, fontWeight: '700' },
  tagRisk: { color: C.dust, fontSize: 9, marginTop: 2, letterSpacing: 0.3 },

  notesInput: { backgroundColor: C.surfaceAlt, borderRadius: 4, padding: 12, color: C.ink, fontSize: 13, lineHeight: 19, minHeight: 72, borderWidth: 1, borderColor: C.borderLight },
  notesCount: { color: C.dust, fontSize: 10, textAlign: 'right', marginTop: 6 },

  saveBtn: { marginHorizontal: 16, backgroundColor: C.ink, padding: 16, borderRadius: 4, alignItems: 'center', marginTop: 4 },
  saveBtnText: { color: C.surface, fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },
});