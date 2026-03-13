import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getCheckIns, getInjuryAlerts, getSessions, getTodayDate, saveCheckIn } from '../../storage';

const today = getTodayDate();

const SORENESS_LEVELS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

const FINGER_ZONES = [
  { id: 'index', label: 'Index' },
  { id: 'middle', label: 'Middle' },
  { id: 'ring', label: 'Ring' },
  { id: 'pinky', label: 'Pinky' },
  { id: 'thumb', label: 'Thumb' },
];

const PAIN_AREAS = [
  { id: 'shoulder', label: 'Shoulder', icon: 'body-outline' },
  { id: 'elbow', label: 'Elbow', icon: 'fitness-outline' },
  { id: 'wrist', label: 'Wrist', icon: 'hand-left-outline' },
  { id: 'knee', label: 'Knee', icon: 'walk-outline' },
  { id: 'hip', label: 'Hip', icon: 'person-outline' },
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
  if (score >= 70) return { label: 'Train Hard', color: '#00b4d8', icon: 'flash-outline', bg: '#001e2e' };
  if (score >= 40) return { label: 'Take it Easy', color: '#f4a261', icon: 'partly-sunny-outline', bg: '#2a1800' };
  return { label: 'Rest Day', color: '#e63946', icon: 'bed-outline', bg: '#2a0000' };
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
  if (num <= 3) return '#00b4d8';
  if (num <= 6) return '#f4a261';
  return '#e63946';
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
          </View>
          {alreadyCheckedIn && (
            <View style={styles.checkedBadge}>
              <Ionicons name="checkmark" size={14} color="#4caf50" />
              <Text style={styles.checkedBadgeText}>Done</Text>
            </View>
          )}
        </View>

        {/* Injury Alerts */}
        {injuryAlerts.length > 0 && (
          <View style={styles.alertBanner}>
            <View style={styles.alertIconWrap}>
              <Ionicons name="fitness-outline" size={18} color="#e63946" />
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
              <Ionicons name="bed-outline" size={22} color="#4caf50" />
            </View>
            <View style={styles.restDayContent}>
              <Text style={styles.restDayTitle}>Log Rest Day</Text>
              <Text style={styles.restDaySubtitle}>Skip the session and recover</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#2d6b2d" />
          </TouchableOpacity>
        )}

        {/* Rest Day Confirmed */}
        {isRestDay && alreadyCheckedIn ? (
          <View style={styles.restDayCard}>
            <View style={styles.restDayCardIcon}>
              <Ionicons name="bed-outline" size={32} color="#4caf50" />
            </View>
            <Text style={styles.restDayCardTitle}>Rest Day</Text>
            <Text style={styles.restDayCardSub}>Recovery Mode — your body is thanking you</Text>
            <View style={styles.restDayBadge}>
              <Text style={styles.restDayBadgeText}>DRS 100</Text>
            </View>
          </View>
        ) : (
          <>
            {/* Soreness */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Ionicons name="pulse-outline" size={16} color="#888" />
                <Text style={styles.sectionTitle}>Overall Soreness</Text>
              </View>
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
                      <Text style={[styles.sorenessText, selected && { color: '#fff' }]}>{level}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {soreness && (
                <Text style={styles.sorenessHint}>
                  {parseInt(soreness) <= 3 ? 'Feeling good' :
                   parseInt(soreness) <= 6 ? 'Some fatigue present' :
                   'High soreness — consider resting'}
                </Text>
              )}
            </View>

            {/* Finger Condition */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Ionicons name="hand-left-outline" size={16} color="#888" />
                <Text style={styles.sectionTitle}>Finger Condition</Text>
              </View>
              <Text style={styles.sectionHint}>Tap any fingers that feel sore or tweaked</Text>
              <View style={styles.chipRow}>
                {FINGER_ZONES.map((finger) => {
                  const selected = affectedFingers.includes(finger.id);
                  return (
                    <TouchableOpacity
                      key={finger.id}
                      style={[styles.chip, selected && styles.chipRed]}
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
              <View style={styles.sectionHeader}>
                <Ionicons name="warning-outline" size={16} color="#888" />
                <Text style={styles.sectionTitle}>Pain or Strain</Text>
              </View>
              <Text style={styles.sectionHint}>Select all areas that feel off today</Text>
              <View style={styles.chipRow}>
                {PAIN_AREAS.map((area) => {
                  const selected = painAreas.includes(area.id);
                  return (
                    <TouchableOpacity
                      key={area.id}
                      style={[styles.chip, selected && styles.chipRed]}
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
              <View style={[styles.drsCard, { backgroundColor: displayVerdict.bg, borderColor: displayVerdict.color + '40' }]}>
                <View style={styles.drsTop}>
                  <View>
                    <Text style={styles.drsLabel}>
                      {alreadyCheckedIn ? 'Daily Readiness Score' : 'Readiness Preview'}
                    </Text>
                    <Text style={[styles.drsVerdict, { color: displayVerdict.color }]}>
                      {displayVerdict.label}
                    </Text>
                  </View>
                  <View style={[styles.drsScoreCircle, { borderColor: displayVerdict.color + '60' }]}>
                    <Text style={[styles.drsScore, { color: displayVerdict.color }]}>{displayScore}</Text>
                  </View>
                </View>

                {alreadyCheckedIn && (
                  <View style={styles.drsBreakdown}>
                    <View style={styles.drsBreakdownItem}>
                      <Text style={styles.drsBreakdownLabel}>Soreness</Text>
                      <Text style={styles.drsBreakdownValue}>{soreness}/10</Text>
                    </View>
                    <View style={styles.drsBreakdownDivider} />
                    <View style={styles.drsBreakdownItem}>
                      <Text style={styles.drsBreakdownLabel}>Pain Areas</Text>
                      <Text style={styles.drsBreakdownValue}>{painAreas.length}</Text>
                    </View>
                    <View style={styles.drsBreakdownDivider} />
                    <View style={styles.drsBreakdownItem}>
                      <Text style={styles.drsBreakdownLabel}>Sessions (7d)</Text>
                      <Text style={styles.drsBreakdownValue}>{recentSessions.filter(s => s !== null).length}</Text>
                    </View>
                  </View>
                )}

                {!alreadyCheckedIn && (
                  <Text style={[styles.drsHint, { color: displayVerdict.color + 'aa' }]}>
                    Save your check-in to confirm
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
  container: { flex: 1, backgroundColor: '#0d0d0f' },
  scrollContent: { padding: 20, paddingBottom: 40 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 16, marginBottom: 24 },
  greeting: { fontSize: 13, color: '#555', fontWeight: '500', letterSpacing: 0.3, marginBottom: 4 },
  title: { fontSize: 30, fontWeight: '800', color: '#ffffff', letterSpacing: -0.5 },
  checkedBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#0d2a0d', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#1a4a1a' },
  checkedBadgeText: { color: '#4caf50', fontSize: 12, fontWeight: '700' },

  alertBanner: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#1a0808', borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#3a0a0a', gap: 12 },
  alertIconWrap: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#2a0808', justifyContent: 'center', alignItems: 'center' },
  alertContent: { flex: 1 },
  alertTitle: { color: '#e63946', fontSize: 13, fontWeight: '700', marginBottom: 3 },
  alertText: { color: '#7a2020', fontSize: 12, lineHeight: 17 },

  restDayButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0d1f0d', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#1a3a1a', gap: 14 },
  restDayIconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#142814', justifyContent: 'center', alignItems: 'center' },
  restDayContent: { flex: 1 },
  restDayTitle: { color: '#4caf50', fontSize: 15, fontWeight: '700' },
  restDaySubtitle: { color: '#2d6b2d', fontSize: 12, marginTop: 2 },

  restDayCard: { backgroundColor: '#0d1f0d', borderRadius: 20, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: '#1a3a1a', marginBottom: 16, gap: 8 },
  restDayCardIcon: { width: 64, height: 64, borderRadius: 20, backgroundColor: '#142814', justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  restDayCardTitle: { color: '#4caf50', fontSize: 24, fontWeight: '800' },
  restDayCardSub: { color: '#2d6b2d', fontSize: 13, textAlign: 'center' },
  restDayBadge: { backgroundColor: '#142814', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6, marginTop: 8 },
  restDayBadgeText: { color: '#4caf50', fontSize: 13, fontWeight: '700' },

  sectionCard: { backgroundColor: '#141416', borderRadius: 20, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: '#1e1e22' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  sectionTitle: { color: '#888', fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  sectionHint: { color: '#444', fontSize: 12, marginBottom: 12, marginTop: -6 },

  sorenessRow: { flexDirection: 'row', gap: 7, flexWrap: 'wrap' },
  sorenessButton: { width: 42, height: 42, backgroundColor: '#1e1e22', borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#2a2a2e' },
  sorenessText: { color: '#666', fontSize: 15, fontWeight: '700' },
  sorenessHint: { color: '#444', fontSize: 12, marginTop: 10 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 9, backgroundColor: '#1e1e22', borderRadius: 10, borderWidth: 1, borderColor: '#2a2a2e' },
  chipRed: { backgroundColor: '#2a0808', borderColor: '#e63946' },
  chipText: { color: '#666', fontSize: 14, fontWeight: '600' },
  chipTextSelected: { color: '#e63946' },

  drsCard: { borderRadius: 20, padding: 20, marginBottom: 12, borderWidth: 1 },
  drsTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  drsLabel: { color: '#555', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  drsVerdict: { fontSize: 22, fontWeight: '800' },
  drsScoreCircle: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  drsScore: { fontSize: 24, fontWeight: '800' },
  drsBreakdown: { flexDirection: 'row', justifyContent: 'space-around', paddingTop: 16, borderTopWidth: 1, borderTopColor: '#ffffff10' },
  drsBreakdownItem: { alignItems: 'center' },
  drsBreakdownLabel: { color: '#444', fontSize: 11, marginBottom: 4 },
  drsBreakdownValue: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  drsBreakdownDivider: { width: 1, backgroundColor: '#ffffff10' },
  drsHint: { fontSize: 12, textAlign: 'center' },

  saveButton: { backgroundColor: '#00b4d8', padding: 18, borderRadius: 16, alignItems: 'center', marginTop: 8, marginBottom: 8 },
  saveButtonText: { color: '#ffffff', fontSize: 17, fontWeight: '700' },
});