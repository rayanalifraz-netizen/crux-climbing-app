import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { getCheckIns, getProfile, getSessions, getTodayDate, saveSession } from '../../storage';

const V_GRADES = ['VB', 'V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10', 'V11', 'V12'];
const today = getTodayDate();

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  bg:         '#1a1510',
  surface:    '#221e18',
  surfaceAlt: '#2a2420',
  border:     '#36302a',
  chalk:      '#f0ebe3',
  sand:       '#a89880',
  dust:       '#6a5e52',
  terra:      '#c4734a',
  terraLight: '#d4896a',
  terraBg:    '#2a1e16',
  amber:      '#d4943a',
  amberBg:    '#261e10',
  red:        '#c44a3a',
  redBg:      '#241410',
  green:      '#6a9a5a',
  greenBg:    '#16201a',
};

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

  let totalIntensity = 0;
  let totalAttempts = 0;
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
  if (selectedHolds.length > 0) {
    holdMultiplier = selectedHolds.reduce((sum, h) => sum + (HOLD_INJURY_WEIGHT[h] || 1.0), 0) / selectedHolds.length;
  }

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

  const getResColor = (val) => {
    if (val <= 40) return C.terra;
    if (val <= 70) return C.amber;
    return C.red;
  };

  const getResBg = (val) => {
    if (val <= 40) return C.terraBg;
    if (val <= 70) return C.amberBg;
    return C.redBg;
  };

  const getResLabel = (val) => {
    if (val <= 40) return 'Light — minimal recovery needed';
    if (val <= 70) return 'Moderate — rest tomorrow if sore';
    return 'Hard — prioritize recovery tonight';
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </Text>
            <Text style={styles.title}>Log Session</Text>
            <View style={styles.headerRule} />
          </View>
          {alreadySaved && (
            <View style={styles.savedBadge}>
              <Ionicons name="checkmark" size={12} color={C.terra} />
              <Text style={styles.savedBadgeText}>Logged</Text>
            </View>
          )}
          {isRestDay && !alreadySaved && (
            <View style={styles.restBadge}>
              <Ionicons name="bed-outline" size={12} color={C.green} />
              <Text style={styles.restBadgeText}>Rest Day</Text>
            </View>
          )}
        </View>

        {/* Rest day block */}
        {isRestDay && !alreadySaved && (
          <View style={styles.restDayBlock}>
            <View style={styles.restDayBlockIcon}>
              <Ionicons name="bed-outline" size={26} color={C.green} />
            </View>
            <Text style={styles.restDayBlockEyebrow}>Today</Text>
            <Text style={styles.restDayBlockTitle}>Rest Day</Text>
            <Text style={styles.restDayBlockText}>
              You logged a rest day — no session can be recorded. Clear your check-in from Settings to override.
            </Text>
          </View>
        )}

        {/* Already saved state */}
        {alreadySaved && savedSession && (
          <View style={styles.savedCard}>
            <Text style={styles.savedCardEyebrow}>Today's Session</Text>
            <View style={styles.savedCardTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.savedCardAttempts}>
                  {Object.values(savedSession.gradeCounts || {}).reduce((a, b) => a + b, 0)} attempts logged
                </Text>
              </View>
              <View style={[styles.resBadge, { backgroundColor: getResBg(savedSession.res), borderColor: getResColor(savedSession.res) + '50' }]}>
                <Text style={[styles.resBadgeScore, { color: getResColor(savedSession.res) }]}>{savedSession.res}</Text>
                <Text style={[styles.resBadgeLabel, { color: getResColor(savedSession.res) + 'aa' }]}>RES</Text>
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
              <View style={styles.savedNotes}>
                <Ionicons name="document-text-outline" size={12} color={C.dust} />
                <Text style={styles.savedNotesText}>{savedSession.notes}</Text>
              </View>
            ) : null}
            <Text style={styles.savedHint}>— Clear from Settings to re-log today —</Text>
          </View>
        )}

        {/* Main form */}
        {!alreadySaved && !isRestDay && (
          <>
            {!maxGrade && (
              <View style={styles.warningBanner}>
                <Ionicons name="information-circle-outline" size={16} color={C.amber} />
                <Text style={styles.warningText}>Set your climbing level in Profile for accurate RES</Text>
              </View>
            )}

            {/* Grade Grid */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionTop}>
                <Text style={styles.sectionEyebrow}>Grades Climbed</Text>
                {hasGrades && (
                  <Text style={styles.attemptsLabel}>{totalAttempts} attempts</Text>
                )}
              </View>
              <Text style={styles.sectionHint}>Tap + to log attempts at each grade</Text>
              <View style={styles.gradeGrid}>
                {V_GRADES.map((grade) => {
                  const count = gradeCounts[grade] || 0;
                  const isActive = count > 0;
                  return (
                    <View key={grade} style={[styles.gradeCard, isActive && styles.gradeCardActive]}>
                      <Text style={[styles.gradeLabel, isActive && styles.gradeLabelActive]}>{grade}</Text>
                      <View style={styles.counter}>
                        {isActive && (
                          <TouchableOpacity onPress={() => decrementGrade(grade)} style={styles.counterBtn}>
                            <Text style={styles.counterBtnText}>−</Text>
                          </TouchableOpacity>
                        )}
                        {isActive && <Text style={styles.countText}>{count}</Text>}
                        <TouchableOpacity
                          onPress={() => incrementGrade(grade)}
                          style={[styles.counterBtn, isActive && styles.counterBtnActive]}
                        >
                          <Text style={styles.counterBtnText}>+</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Live RES */}
            {hasGrades && (
              <View style={[styles.resCard, { backgroundColor: getResBg(res), borderColor: getResColor(res) + '40' }]}>
                <Text style={styles.resEyebrow}>Relative Effort Score</Text>
                <View style={styles.resTop}>
                  <Text style={[styles.resVerdict, { color: getResColor(res) }]}>{getResLabel(res)}</Text>
                  <View style={[styles.resCircle, { borderColor: getResColor(res) + '50' }]}>
                    <Text style={[styles.resScore, { color: getResColor(res) }]}>{res}</Text>
                  </View>
                </View>
                <View style={styles.resBarTrack}>
                  <View style={[styles.resBarFill, { width: `${res}%`, backgroundColor: getResColor(res) }]} />
                </View>
              </View>
            )}

            {/* Hold Types */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionTop}>
                <Text style={styles.sectionEyebrow}>Hold Types</Text>
                <Text style={styles.sectionTag}>affects RES</Text>
              </View>
              <View style={styles.tagGrid}>
                {HOLD_TYPES.map((hold) => {
                  const selected = holdTypes.includes(hold.id);
                  return (
                    <TouchableOpacity
                      key={hold.id}
                      style={[styles.tagCard, selected && styles.tagCardSelected]}
                      onPress={() => toggleHold(hold.id)}
                    >
                      <Text style={[styles.tagLabel, selected && styles.tagLabelSelected]}>{hold.label}</Text>
                      <Text style={[styles.tagRisk, selected && styles.tagRiskSelected]}>{hold.risk}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Movement Types */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionTop}>
                <Text style={styles.sectionEyebrow}>Movement Types</Text>
                <Text style={styles.sectionTag}>injury tracking</Text>
              </View>
              <View style={styles.tagGrid}>
                {MOVEMENT_TYPES.map((move) => {
                  const selected = movementTypes.includes(move.id);
                  return (
                    <TouchableOpacity
                      key={move.id}
                      style={[styles.tagCard, selected && styles.tagCardMovement]}
                      onPress={() => toggleMovement(move.id)}
                    >
                      <Text style={[styles.tagLabel, selected && styles.tagLabelMovement]}>{move.label}</Text>
                      <Text style={[styles.tagRisk, selected && styles.tagRiskMovement]}>{move.risk}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Session Notes */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionTop}>
                <Text style={styles.sectionEyebrow}>Session Notes</Text>
                <Text style={styles.sectionTag}>optional</Text>
              </View>
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

            {/* Save Button */}
            {hasGrades && (
              <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                <Text style={styles.saveText}>Save Session</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scrollContent: { padding: 20, paddingBottom: 48 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 16, marginBottom: 24 },
  greeting: { fontSize: 12, color: C.dust, fontWeight: '600', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 },
  title: { fontSize: 36, fontWeight: '800', color: C.chalk, letterSpacing: -1, lineHeight: 40 },
  headerRule: { height: 1, backgroundColor: C.border, marginTop: 14 },
  savedBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.terraBg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: C.terra + '40', marginTop: 8 },
  savedBadgeText: { color: C.terra, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  restBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.greenBg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: C.green + '40', marginTop: 8 },
  restBadgeText: { color: C.green, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },

  restDayBlock: { backgroundColor: C.greenBg, borderRadius: 14, padding: 28, alignItems: 'center', borderWidth: 1, borderColor: C.green + '30', marginBottom: 12, gap: 6 },
  restDayBlockIcon: { width: 52, height: 52, borderRadius: 14, backgroundColor: C.green + '20', justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  restDayBlockEyebrow: { fontSize: 10, fontWeight: '700', color: C.dust, letterSpacing: 2, textTransform: 'uppercase' },
  restDayBlockTitle: { color: C.green, fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  restDayBlockText: { color: C.dust, fontSize: 12, textAlign: 'center', lineHeight: 18, marginTop: 4 },

  savedCard: { backgroundColor: C.surface, borderRadius: 14, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  savedCardEyebrow: { fontSize: 10, fontWeight: '700', color: C.dust, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14 },
  savedCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  savedCardAttempts: { color: C.sand, fontSize: 14 },
  resBadge: { alignItems: 'center', borderRadius: 12, padding: 12, borderWidth: 1, minWidth: 56 },
  resBadgeScore: { fontSize: 22, fontWeight: '800' },
  resBadgeLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase' },
  savedGrades: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  savedGradeChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.surfaceAlt, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: C.border },
  savedGradeText: { color: C.terra, fontSize: 12, fontWeight: '700' },
  savedGradeCount: { color: C.dust, fontSize: 11 },
  savedNotes: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: C.surfaceAlt, borderRadius: 8, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  savedNotesText: { color: C.sand, fontSize: 13, flex: 1, lineHeight: 18 },
  savedHint: { color: C.dust, fontSize: 10, textAlign: 'center', letterSpacing: 0.5 },

  warningBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.amberBg, borderRadius: 10, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.amber + '30' },
  warningText: { color: C.amber + 'cc', fontSize: 13, flex: 1 },

  sectionCard: { backgroundColor: C.surface, borderRadius: 14, padding: 18, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  sectionTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  sectionEyebrow: { fontSize: 10, fontWeight: '700', color: C.dust, letterSpacing: 2, textTransform: 'uppercase' },
  sectionHint: { color: C.dust, fontSize: 12, marginBottom: 14, marginTop: 4 },
  sectionTag: { fontSize: 9, fontWeight: '700', color: C.dust, letterSpacing: 1, textTransform: 'uppercase', opacity: 0.6 },
  attemptsLabel: { fontSize: 10, fontWeight: '700', color: C.terra, letterSpacing: 1 },

  gradeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 10 },
  gradeCard: { width: '22%', backgroundColor: C.surfaceAlt, borderRadius: 10, padding: 8, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  gradeCardActive: { borderColor: C.terra + '80', backgroundColor: C.terraBg },
  gradeLabel: { color: C.dust, fontSize: 13, fontWeight: '700', marginBottom: 6 },
  gradeLabelActive: { color: C.terra },
  counter: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  counterBtn: { width: 20, height: 20, backgroundColor: C.border, borderRadius: 5, justifyContent: 'center', alignItems: 'center' },
  counterBtnActive: { backgroundColor: C.terraDark },
  counterBtnText: { color: C.chalk, fontSize: 13, fontWeight: '800', lineHeight: 17 },
  countText: { color: C.chalk, fontSize: 12, fontWeight: '700', minWidth: 12, textAlign: 'center' },

  resCard: { borderRadius: 14, padding: 18, marginBottom: 10, borderWidth: 1 },
  resEyebrow: { fontSize: 10, fontWeight: '700', color: C.dust, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 },
  resTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  resVerdict: { fontSize: 18, fontWeight: '700', flex: 1, lineHeight: 22 },
  resCircle: { width: 56, height: 56, borderRadius: 28, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  resScore: { fontSize: 20, fontWeight: '800' },
  resBarTrack: { height: 2, backgroundColor: C.border, borderRadius: 1, overflow: 'hidden' },
  resBarFill: { height: 2, borderRadius: 1 },

  tagGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 10 },
  tagCard: { paddingHorizontal: 14, paddingVertical: 9, backgroundColor: C.surfaceAlt, borderRadius: 8, borderWidth: 1, borderColor: C.border },
  tagCardSelected: { backgroundColor: C.terraBg, borderColor: C.terra + '60' },
  tagCardMovement: { backgroundColor: C.amberBg, borderColor: C.amber + '50' },
  tagLabel: { color: C.dust, fontSize: 13, fontWeight: '600' },
  tagLabelSelected: { color: C.terra },
  tagLabelMovement: { color: C.amber },
  tagRisk: { color: C.dust, fontSize: 10, marginTop: 2, opacity: 0.6 },
  tagRiskSelected: { color: C.terraDark, opacity: 1 },
  tagRiskMovement: { color: C.amber, opacity: 0.6 },

  notesInput: { backgroundColor: C.surfaceAlt, borderRadius: 10, padding: 14, color: C.chalk, fontSize: 14, lineHeight: 20, minHeight: 80, borderWidth: 1, borderColor: C.border, marginTop: 10 },
  notesCount: { color: C.dust, fontSize: 10, textAlign: 'right', marginTop: 6 },

  saveButton: { backgroundColor: C.terra, padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  saveText: { color: C.chalk, fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
});

const C_terraDark = '#8a4a2a';