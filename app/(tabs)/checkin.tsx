import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getCheckIns, getInjuryAlerts, getSessions, getTodayDate, saveCheckIn } from '../../storage';

const today = getTodayDate();

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  bg:         '#1a1510',
  surface:    '#221e18',
  surfaceAlt: '#2a2420',
  border:     '#36302a',
  borderFaint:'#2a2520',
  chalk:      '#f0ebe3',
  sand:       '#a89880',
  dust:       '#6a5e52',
  terra:      '#c4734a',
  terraLight: '#d4896a',
  terraDark:  '#8a4a2a',
  terraBg:    '#2a1e16',
  amber:      '#d4943a',
  amberBg:    '#261e10',
  red:        '#c44a3a',
  redBg:      '#241410',
  green:      '#6a9a5a',
  greenBg:    '#16201a',
};

const SORENESS_LEVELS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

const FINGER_ZONES = [
  { id: 'index', label: 'Index' },
  { id: 'middle', label: 'Middle' },
  { id: 'ring', label: 'Ring' },
  { id: 'pinky', label: 'Pinky' },
  { id: 'thumb', label: 'Thumb' },
];

const PAIN_AREAS = [
  { id: 'shoulder', label: 'Shoulder' },
  { id: 'elbow', label: 'Elbow' },
  { id: 'wrist', label: 'Wrist' },
  { id: 'knee', label: 'Knee' },
  { id: 'hip', label: 'Hip' },
];

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

function getDRSVerdict(score) {
  if (score >= 70) return { label: 'Train Hard', color: C.terra, bg: C.terraBg };
  if (score >= 40) return { label: 'Take it Easy', color: C.amber, bg: C.amberBg };
  return { label: 'Rest Day', color: C.red, bg: C.redBg };
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

function getSorenessColor(level) {
  const num = parseInt(level);
  if (num <= 3) return C.terra;
  if (num <= 6) return C.amber;
  return C.red;
}

export default function CheckInScreen() {
  const [soreness, setSoreness] = useState(null);
  const [affectedFingers, setAffectedFingers] = useState([]);
  const [painAreas, setPainAreas] = useState([]);
  const [alreadyCheckedIn, setAlreadyCheckedIn] = useState(false);
  const [isRestDay, setIsRestDay] = useState(false);
  const [drs, setDrs] = useState(null);
  const [recentSessions, setRecentSessions] = useState([]);
  const [injuryAlerts, setInjuryAlerts] = useState([]);

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const loadData = async () => {
    const [checkIns, sessions, alerts] = await Promise.all([
      getCheckIns(), getSessions(), getInjuryAlerts(),
    ]);
    const last7 = getLast7Days().map(date => sessions[date] || null);
    setRecentSessions(last7);
    setInjuryAlerts(alerts);

    if (checkIns[today]) {
      setAlreadyCheckedIn(true);
      const ci = checkIns[today];
      setSoreness(ci.soreness);
      setAffectedFingers(ci.affectedFingers || []);
      setPainAreas(ci.painAreas || []);
      setIsRestDay(ci.isRestDay || false);
      setDrs(calculateDRS(ci.soreness, ci.painAreas, ci.affectedFingers, last7, ci.isRestDay));
    } else {
      setAlreadyCheckedIn(false);
      setSoreness(null);
      setAffectedFingers([]);
      setPainAreas([]);
      setIsRestDay(false);
      setDrs(null);
    }
  };

  const toggleFinger = (id) => {
    if (alreadyCheckedIn) return;
    setAffectedFingers(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]);
  };

  const togglePain = (id) => {
    if (alreadyCheckedIn) return;
    setPainAreas(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  const handleSave = async () => {
    await saveCheckIn({ date: today, soreness, affectedFingers, painAreas, isRestDay: false });
    const score = calculateDRS(soreness, painAreas, affectedFingers, recentSessions, false);
    setDrs(score);
    setAlreadyCheckedIn(true);
  };

  const handleRestDay = async () => {
    await saveCheckIn({ date: today, soreness: '0', affectedFingers: [], painAreas: [], isRestDay: true });
    setIsRestDay(true);
    setDrs(100);
    setAlreadyCheckedIn(true);
  };

  const verdict = drs !== null ? getDRSVerdict(drs) : null;
  const liveScore = !alreadyCheckedIn && soreness
    ? calculateDRS(soreness, painAreas, affectedFingers, recentSessions, false)
    : null;
  const liveVerdict = liveScore !== null ? getDRSVerdict(liveScore) : null;
  const displayVerdict = alreadyCheckedIn ? verdict : liveVerdict;
  const displayScore = alreadyCheckedIn ? drs : liveScore;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </Text>
            <Text style={styles.title}>Daily Check-in</Text>
            <View style={styles.headerRule} />
          </View>
          {alreadyCheckedIn && (
            <View style={styles.checkedBadge}>
              <Ionicons name="checkmark" size={12} color={C.green} />
              <Text style={styles.checkedBadgeText}>Done</Text>
            </View>
          )}
        </View>

        {/* Injury Alerts */}
        {injuryAlerts.length > 0 && (
          <View style={styles.alertBanner}>
            <View style={styles.alertIconWrap}>
              <Ionicons name="fitness-outline" size={16} color={C.red} />
            </View>
            <View style={styles.alertContent}>
              <Text style={styles.alertTitle}>Overload Warning</Text>
              {injuryAlerts.map(alert => (
                <Text key={alert.partId} style={styles.alertText}>{alert.partName} — {alert.suggestion}</Text>
              ))}
            </View>
          </View>
        )}

        {/* Rest Day Button */}
        {!alreadyCheckedIn && (
          <TouchableOpacity style={styles.restDayButton} onPress={handleRestDay}>
            <View style={styles.restDayIconWrap}>
              <Ionicons name="bed-outline" size={20} color={C.green} />
            </View>
            <View style={styles.restDayContent}>
              <Text style={styles.restDayTitle}>Log Rest Day</Text>
              <Text style={styles.restDaySubtitle}>Skip the session and recover</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={C.dust} />
          </TouchableOpacity>
        )}

        {/* Rest Day Confirmed */}
        {isRestDay && alreadyCheckedIn ? (
          <View style={styles.restDayCard}>
            <View style={styles.restDayCardIcon}>
              <Ionicons name="bed-outline" size={28} color={C.green} />
            </View>
            <Text style={styles.restDayCardEyebrow}>TODAY</Text>
            <Text style={styles.restDayCardTitle}>Rest Day</Text>
            <Text style={styles.restDayCardSub}>Recovery mode — your body is thanking you</Text>
            <View style={styles.restDayBadge}>
              <Text style={styles.restDayBadgeText}>DRS 100</Text>
            </View>
          </View>
        ) : (
          <>
            {/* Soreness */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionEyebrow}>Overall Soreness</Text>
              <View style={styles.sorenessRow}>
                {SORENESS_LEVELS.map((level) => {
                  const selected = soreness === level;
                  const color = getSorenessColor(level);
                  return (
                    <TouchableOpacity
                      key={level}
                      style={[
                        styles.sorenessButton,
                        selected && { backgroundColor: color, borderColor: color }
                      ]}
                      onPress={() => !alreadyCheckedIn && setSoreness(level)}
                    >
                      <Text style={[styles.sorenessText, selected && { color: C.chalk }]}>{level}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {soreness && (
                <Text style={styles.sorenessHint}>
                  {parseInt(soreness) <= 3 ? '— Feeling good' :
                   parseInt(soreness) <= 6 ? '— Some fatigue present' :
                   '— High soreness, consider resting'}
                </Text>
              )}
            </View>

            {/* Finger Condition */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionEyebrow}>Finger Condition</Text>
              <Text style={styles.sectionHint}>Tap any fingers that feel sore or tweaked</Text>
              <View style={styles.chipRow}>
                {FINGER_ZONES.map((finger) => {
                  const selected = affectedFingers.includes(finger.id);
                  return (
                    <TouchableOpacity
                      key={finger.id}
                      style={[styles.chip, selected && styles.chipSelected]}
                      onPress={() => toggleFinger(finger.id)}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                        {finger.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Pain Areas */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionEyebrow}>Pain or Strain</Text>
              <Text style={styles.sectionHint}>Select all areas that feel off today</Text>
              <View style={styles.chipRow}>
                {PAIN_AREAS.map((area) => {
                  const selected = painAreas.includes(area.id);
                  return (
                    <TouchableOpacity
                      key={area.id}
                      style={[styles.chip, selected && styles.chipSelected]}
                      onPress={() => togglePain(area.id)}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                        {area.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* DRS Card */}
            {displayVerdict && displayScore !== null && (
              <View style={[styles.drsCard, { backgroundColor: displayVerdict.bg, borderColor: displayVerdict.color + '50' }]}>
                <Text style={styles.drsEyebrow}>
                  {alreadyCheckedIn ? 'Daily Readiness Score' : 'Readiness Preview'}
                </Text>
                <View style={styles.drsTop}>
                  <Text style={[styles.drsVerdict, { color: displayVerdict.color }]}>
                    {displayVerdict.label}
                  </Text>
                  <View style={[styles.drsScoreCircle, { borderColor: displayVerdict.color + '60' }]}>
                    <Text style={[styles.drsScore, { color: displayVerdict.color }]}>{displayScore}</Text>
                  </View>
                </View>

                {alreadyCheckedIn && (
                  <View style={styles.drsBreakdown}>
                    <View style={styles.drsBreakdownItem}>
                      <Text style={styles.drsBreakdownLabel}>Soreness</Text>
                      <Text style={[styles.drsBreakdownValue, { color: C.chalk }]}>{soreness}/10</Text>
                    </View>
                    <View style={styles.drsBreakdownDivider} />
                    <View style={styles.drsBreakdownItem}>
                      <Text style={styles.drsBreakdownLabel}>Pain Areas</Text>
                      <Text style={[styles.drsBreakdownValue, { color: C.chalk }]}>{painAreas.length}</Text>
                    </View>
                    <View style={styles.drsBreakdownDivider} />
                    <View style={styles.drsBreakdownItem}>
                      <Text style={styles.drsBreakdownLabel}>Sessions (7d)</Text>
                      <Text style={[styles.drsBreakdownValue, { color: C.chalk }]}>{recentSessions.filter(s => s !== null).length}</Text>
                    </View>
                  </View>
                )}

                {!alreadyCheckedIn && (
                  <Text style={[styles.drsHint, { color: displayVerdict.color + 'aa' }]}>
                    — Save your check-in to confirm —
                  </Text>
                )}
              </View>
            )}

            {/* Save Button */}
            {soreness && !alreadyCheckedIn && (
              <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                <Text style={styles.saveButtonText}>Save Check-in</Text>
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
  checkedBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.greenBg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: C.green + '40', marginTop: 8 },
  checkedBadgeText: { color: C.green, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },

  alertBanner: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: C.redBg, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.red + '40', gap: 12 },
  alertIconWrap: { width: 28, height: 28, borderRadius: 8, backgroundColor: C.red + '20', justifyContent: 'center', alignItems: 'center' },
  alertContent: { flex: 1 },
  alertTitle: { color: C.red, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 3 },
  alertText: { color: C.red + '99', fontSize: 12, lineHeight: 17 },

  restDayButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.greenBg, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: C.green + '30', gap: 14 },
  restDayIconWrap: { width: 38, height: 38, borderRadius: 10, backgroundColor: C.green + '20', justifyContent: 'center', alignItems: 'center' },
  restDayContent: { flex: 1 },
  restDayTitle: { color: C.green, fontSize: 14, fontWeight: '700', letterSpacing: 0.3 },
  restDaySubtitle: { color: C.dust, fontSize: 12, marginTop: 2 },

  restDayCard: { backgroundColor: C.greenBg, borderRadius: 16, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: C.green + '30', marginBottom: 12, gap: 6 },
  restDayCardIcon: { width: 56, height: 56, borderRadius: 16, backgroundColor: C.green + '20', justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  restDayCardEyebrow: { fontSize: 10, fontWeight: '700', color: C.dust, letterSpacing: 2, textTransform: 'uppercase' },
  restDayCardTitle: { color: C.green, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  restDayCardSub: { color: C.dust, fontSize: 13, textAlign: 'center' },
  restDayBadge: { backgroundColor: C.green + '20', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6, marginTop: 8, borderWidth: 1, borderColor: C.green + '30' },
  restDayBadgeText: { color: C.green, fontSize: 12, fontWeight: '700', letterSpacing: 1 },

  sectionCard: { backgroundColor: C.surface, borderRadius: 14, padding: 18, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  sectionEyebrow: { fontSize: 10, fontWeight: '700', color: C.dust, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14 },
  sectionHint: { color: C.dust, fontSize: 12, marginBottom: 12, marginTop: -6 },

  sorenessRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  sorenessButton: { width: 40, height: 40, backgroundColor: C.surfaceAlt, borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.border },
  sorenessText: { color: C.dust, fontSize: 14, fontWeight: '700' },
  sorenessHint: { color: C.dust, fontSize: 11, marginTop: 12, letterSpacing: 0.3 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: C.surfaceAlt, borderRadius: 8, borderWidth: 1, borderColor: C.border },
  chipSelected: { backgroundColor: C.redBg, borderColor: C.red + '60' },
  chipText: { color: C.dust, fontSize: 13, fontWeight: '600' },
  chipTextSelected: { color: C.red },

  drsCard: { borderRadius: 14, padding: 20, marginBottom: 12, borderWidth: 1 },
  drsEyebrow: { fontSize: 10, fontWeight: '700', color: C.dust, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 },
  drsTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  drsVerdict: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  drsScoreCircle: { width: 60, height: 60, borderRadius: 30, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  drsScore: { fontSize: 22, fontWeight: '800' },
  drsBreakdown: { flexDirection: 'row', justifyContent: 'space-around', paddingTop: 16, borderTopWidth: 1, borderTopColor: C.border },
  drsBreakdownItem: { alignItems: 'center' },
  drsBreakdownLabel: { color: C.dust, fontSize: 10, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4 },
  drsBreakdownValue: { fontSize: 18, fontWeight: '800' },
  drsBreakdownDivider: { width: 1, backgroundColor: C.border },
  drsHint: { fontSize: 11, textAlign: 'center', letterSpacing: 0.5 },

  saveButton: { backgroundColor: C.terra, padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 8, marginBottom: 8 },
  saveButtonText: { color: C.chalk, fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
});