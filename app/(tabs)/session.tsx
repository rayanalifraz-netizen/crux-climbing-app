import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getProfile, getSessions, getTodayDate, saveSession } from '../../storage';

const V_GRADES = ['VB', 'V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10', 'V11', 'V12'];
const today = getTodayDate();

const HOLD_TYPES = [
  { id: 'crimps', label: 'Crimps', risk: 'A2 Pulley', icon: 'hand-right-outline' },
  { id: 'slopers', label: 'Slopers', risk: 'Shoulder', icon: 'radio-button-off-outline' },
  { id: 'pinches', label: 'Pinches', risk: 'Thumb', icon: 'git-merge-outline' },
  { id: 'pockets', label: 'Pockets', risk: 'Finger Tendons', icon: 'ellipse-outline' },
  { id: 'jugs', label: 'Jugs', risk: 'Low Risk', icon: 'thumbs-up-outline' },
];

const MOVEMENT_TYPES = [
  { id: 'dynos', label: 'Dynos', risk: 'Shoulder', icon: 'arrow-up-outline' },
  { id: 'heelhooks', label: 'Heel Hooks', risk: 'Knee', icon: 'return-down-back-outline' },
  { id: 'toehooks', label: 'Toe Hooks', risk: 'Ankle', icon: 'footsteps-outline' },
  { id: 'compression', label: 'Compression', risk: 'Hip', icon: 'contract-outline' },
  { id: 'mantles', label: 'Mantles', risk: 'Wrist', icon: 'trending-up-outline' },
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
  const [maxGrade, setMaxGrade] = useState('');
  const [alreadySaved, setAlreadySaved] = useState(false);
  const [savedSession, setSavedSession] = useState(null);

  useEffect(() => { loadProfile(); checkTodaySession(); }, []);
  useFocusEffect(useCallback(() => { loadProfile(); checkTodaySession(); }, []));

  const loadProfile = async () => {
    const profile = await getProfile();
    if (profile) setMaxGrade(profile.maxGrade);
  };

  const checkTodaySession = async () => {
    const sessions = await getSessions();
    const todaySession = sessions[today];
    setAlreadySaved(!!todaySession);
    setSavedSession(todaySession || null);
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
    await saveSession({ date: today, gradeCounts, holdTypes, movementTypes, res });
    setAlreadySaved(true);
    setSavedSession({ gradeCounts, holdTypes, movementTypes, res });
    setGradeCounts({});
    setHoldTypes([]);
    setMovementTypes([]);
  };

  const hasGrades = Object.keys(gradeCounts).length > 0;
  const totalAttempts = Object.values(gradeCounts).reduce((a, b) => a + b, 0);
  const res = maxGrade ? calculateRES(gradeCounts, maxGrade, holdTypes) : 0;

  const getResColor = (val) => {
    if (val <= 40) return '#00b4d8';
    if (val <= 70) return '#f4a261';
    return '#e63946';
  };

  const getResBg = (val) => {
    if (val <= 40) return '#001e2e';
    if (val <= 70) return '#2a1800';
    return '#2a0000';
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
          <View>
            <Text style={styles.greeting}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </Text>
            <Text style={styles.title}>Log Session</Text>
          </View>
          {alreadySaved && (
            <View style={styles.savedBadge}>
              <Ionicons name="checkmark" size={14} color="#00b4d8" />
              <Text style={styles.savedBadgeText}>Logged</Text>
            </View>
          )}
        </View>

        {/* Already saved state */}
        {alreadySaved && savedSession && (
          <View style={styles.savedCard}>
            <View style={styles.savedCardTop}>
              <View>
                <Text style={styles.savedCardLabel}>Today's Session</Text>
                <Text style={styles.savedCardSub}>
                  {Object.values(savedSession.gradeCounts || {}).reduce((a, b) => a + b, 0)} attempts logged
                </Text>
              </View>
              <View style={[styles.resBadge, { backgroundColor: getResBg(savedSession.res), borderColor: getResColor(savedSession.res) + '60' }]}>
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
            <Text style={styles.savedHint}>Clear from Settings to re-log today</Text>
          </View>
        )}

        {!alreadySaved && (
          <>
            {/* No profile warning */}
            {!maxGrade && (
              <View style={styles.warningBanner}>
                <Ionicons name="information-circle-outline" size={18} color="#f4a261" />
                <Text style={styles.warningText}>Set your climbing level in the Profile tab for accurate RES</Text>
              </View>
            )}

            {/* Grade Grid */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Ionicons name="trending-up-outline" size={16} color="#888" />
                <Text style={styles.sectionTitle}>Grades Climbed</Text>
                {hasGrades && (
                  <View style={styles.attemptsBadge}>
                    <Text style={styles.attemptsBadgeText}>{totalAttempts} attempts</Text>
                  </View>
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
                        {isActive && (
                          <Text style={styles.countText}>{count}</Text>
                        )}
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
                <View style={styles.resTop}>
                  <View>
                    <Text style={styles.resCardLabel}>Relative Effort Score</Text>
                    <Text style={styles.resCardHint}>{getResLabel(res)}</Text>
                  </View>
                  <View style={[styles.resCircle, { borderColor: getResColor(res) + '60' }]}>
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
              <View style={styles.sectionHeader}>
                <Ionicons name="hand-right-outline" size={16} color="#888" />
                <Text style={styles.sectionTitle}>Hold Types</Text>
                <Text style={styles.sectionAffects}>affects RES</Text>
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
              <View style={styles.sectionHeader}>
                <Ionicons name="body-outline" size={16} color="#888" />
                <Text style={styles.sectionTitle}>Movement Types</Text>
                <Text style={styles.sectionAffects}>injury tracking</Text>
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

            {/* Save Button */}
            {hasGrades && (
              <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
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
  container: { flex: 1, backgroundColor: '#0d0d0f' },
  scrollContent: { padding: 20, paddingBottom: 40 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 16, marginBottom: 24 },
  greeting: { fontSize: 13, color: '#555', fontWeight: '500', letterSpacing: 0.3, marginBottom: 4 },
  title: { fontSize: 30, fontWeight: '800', color: '#ffffff', letterSpacing: -0.5 },
  savedBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#001e2e', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#003d4d' },
  savedBadgeText: { color: '#00b4d8', fontSize: 12, fontWeight: '700' },

  savedCard: { backgroundColor: '#141416', borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#1e1e22' },
  savedCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  savedCardLabel: { color: '#ffffff', fontSize: 16, fontWeight: '700', marginBottom: 2 },
  savedCardSub: { color: '#444', fontSize: 13 },
  resBadge: { alignItems: 'center', borderRadius: 14, padding: 12, borderWidth: 1, minWidth: 56 },
  resBadgeScore: { fontSize: 22, fontWeight: '800' },
  resBadgeLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  savedGrades: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  savedGradeChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#1e1e22', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  savedGradeText: { color: '#00b4d8', fontSize: 13, fontWeight: '700' },
  savedGradeCount: { color: '#444', fontSize: 12 },
  savedHint: { color: '#333', fontSize: 11, textAlign: 'center' },

  warningBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1e1400', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#3a2800' },
  warningText: { color: '#7a5a20', fontSize: 13, flex: 1 },

  sectionCard: { backgroundColor: '#141416', borderRadius: 20, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: '#1e1e22' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  sectionTitle: { color: '#888', fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, flex: 1 },
  sectionHint: { color: '#444', fontSize: 12, marginBottom: 14 },
  sectionAffects: { color: '#333', fontSize: 11, fontWeight: '600' },
  attemptsBadge: { backgroundColor: '#1e1e22', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  attemptsBadgeText: { color: '#555', fontSize: 11, fontWeight: '600' },

  gradeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  gradeCard: { width: '22%', backgroundColor: '#1e1e22', borderRadius: 12, padding: 8, alignItems: 'center', borderWidth: 1, borderColor: '#2a2a2e' },
  gradeCardActive: { borderColor: '#00b4d8', backgroundColor: '#001a24' },
  gradeLabel: { color: '#555', fontSize: 14, fontWeight: '700', marginBottom: 6 },
  gradeLabelActive: { color: '#00b4d8' },
  counter: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  counterBtn: { width: 22, height: 22, backgroundColor: '#2a2a2e', borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  counterBtnActive: { backgroundColor: '#003a4d' },
  counterBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '800', lineHeight: 18 },
  countText: { color: '#ffffff', fontSize: 13, fontWeight: '700', minWidth: 14, textAlign: 'center' },

  resCard: { borderRadius: 20, padding: 20, marginBottom: 12, borderWidth: 1 },
  resTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  resCardLabel: { color: '#666', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  resCardHint: { color: '#888', fontSize: 13, fontWeight: '500' },
  resCircle: { width: 60, height: 60, borderRadius: 30, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  resScore: { fontSize: 22, fontWeight: '800' },
  resBarTrack: { height: 4, backgroundColor: '#ffffff10', borderRadius: 2, overflow: 'hidden' },
  resBarFill: { height: 4, borderRadius: 2 },

  tagGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagCard: { paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#1e1e22', borderRadius: 12, borderWidth: 1, borderColor: '#2a2a2e' },
  tagCardSelected: { backgroundColor: '#001a24', borderColor: '#00b4d8' },
  tagCardMovement: { backgroundColor: '#1a1000', borderColor: '#f4a261' },
  tagLabel: { color: '#666', fontSize: 14, fontWeight: '600' },
  tagLabelSelected: { color: '#00b4d8' },
  tagLabelMovement: { color: '#f4a261' },
  tagRisk: { color: '#333', fontSize: 11, marginTop: 2 },
  tagRiskSelected: { color: '#004d66' },
  tagRiskMovement: { color: '#6a4000' },

  saveButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#00b4d8', padding: 18, borderRadius: 16, marginTop: 8 },
  saveText: { color: '#ffffff', fontSize: 17, fontWeight: '700' },
});