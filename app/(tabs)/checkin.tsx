import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getAlertSettings, getCheckIns, getInjuryAlerts, getSessions, getTodayDate, saveCheckIn } from '../../storage';
import { useTheme } from '../../context/ThemeContext';

const today = getTodayDate();

function WindowBox({ label, labelColor, borderColor, bgColor, children, style }) {
  const { C } = useTheme();
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
  const [soreness, setSoreness] = useState(null);
  const [affectedFingers, setAffectedFingers] = useState([]);
  const [painAreas, setPainAreas] = useState([]);
  const [alreadyCheckedIn, setAlreadyCheckedIn] = useState(false);
  const [isRestDay, setIsRestDay] = useState(false);
  const [drs, setDrs] = useState(null);
  const [recentSessions, setRecentSessions] = useState([]);
  const [injuryAlerts, setInjuryAlerts] = useState([]);
  const [alertSettings, setAlertSettings] = useState({ injuryOverload: true });

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const loadData = async () => {
    const [checkIns, sessions, alerts, alertPrefs] = await Promise.all([
      getCheckIns(), getSessions(), getInjuryAlerts(), getAlertSettings(),
    ]);
    const last7 = getLast7Days().map(date => sessions[date] || null);
    setRecentSessions(last7);
    setInjuryAlerts(alerts);
    setAlertSettings(alertPrefs);

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
    Haptics.selectionAsync();
    setAffectedFingers(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]);
  };

  const togglePain = (id) => {
    if (alreadyCheckedIn) return;
    Haptics.selectionAsync();
    setPainAreas(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  const handleSave = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await saveCheckIn({ date: today, soreness, affectedFingers, painAreas, isRestDay: false });
    const score = calculateDRS(soreness, painAreas, affectedFingers, recentSessions, false);
    setDrs(score);
    setAlreadyCheckedIn(true);
  };

  const handleRestDay = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await saveCheckIn({ date: today, soreness: '0', affectedFingers: [], painAreas: [], isRestDay: true });
    setIsRestDay(true);
    setDrs(100);
    setAlreadyCheckedIn(true);
  };

  const verdict = drs !== null ? getDRSVerdict(C, drs) : null;
  const liveScore = !alreadyCheckedIn && soreness
    ? calculateDRS(soreness, painAreas, affectedFingers, recentSessions, false)
    : null;
  const liveVerdict = liveScore !== null ? getDRSVerdict(C, liveScore) : null;
  const displayVerdict = alreadyCheckedIn ? verdict : liveVerdict;
  const displayScore = alreadyCheckedIn ? drs : liveScore;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, soreness && !alreadyCheckedIn && { paddingBottom: 88 }]}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </Text>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Check-in</Text>
            {alreadyCheckedIn && (
              <View style={styles.doneBadge}>
                <Text style={styles.doneBadgeText}>✓ Done</Text>
              </View>
            )}
          </View>
        </View>

        {/* Injury Alert */}
        {alertSettings.injuryOverload && injuryAlerts.length > 0 && (
          <WindowBox
            label="⚠ Overload Warning"
            borderColor={C.redBorder}
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
          </WindowBox>
        )}

        {/* Rest Day Button */}
        {!alreadyCheckedIn && (
          <WindowBox
            label="Rest Day"
            borderColor={C.greenBorder}
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
          </WindowBox>
        )}

        {/* Rest Day Confirmed */}
        {isRestDay && alreadyCheckedIn ? (
          <WindowBox
            label="Today"
            borderColor={C.greenBorder}
            bgColor={C.greenBg}
            labelColor={C.green}
          >
            <View style={styles.restDayConfirmed}>
              <Text style={styles.restDayConfirmedTitle}>Rest Day</Text>
              <Text style={styles.restDayConfirmedSub}>Recovery mode — your body is thanking you</Text>
              <View style={styles.restDayDRS}>
                <Text style={styles.restDayDRSLabel}>DRS</Text>
                <Text style={styles.restDayDRSScore}>100</Text>
              </View>
            </View>
          </WindowBox>
        ) : (
          <>
            {/* Soreness */}
            <WindowBox label="Overall Soreness">
              <View style={styles.sectionInner}>
                <View style={styles.sorenessRow}>
                  {SORENESS_LEVELS.map((level) => {
                    const selected = soreness === level;
                    const color = getSorenessColor(C, level);
                    return (
                      <TouchableOpacity
                        key={level}
                        style={[styles.sorenessBtn, selected && { backgroundColor: color, borderColor: color }]}
                        onPress={() => { if (!alreadyCheckedIn) { Haptics.selectionAsync(); setSoreness(level); } }}
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
            </WindowBox>

            {/* Finger Condition */}
            <WindowBox label="Finger Condition">
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
            </WindowBox>

            {/* Pain Areas */}
            <WindowBox label="Pain or Strain">
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
            </WindowBox>

            {/* DRS */}
            {displayVerdict && displayScore !== null && (
              <WindowBox
                label={alreadyCheckedIn ? 'Daily Readiness Score' : 'Readiness Preview'}
                borderColor={displayVerdict.border}
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

                  {alreadyCheckedIn && (
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

                  {!alreadyCheckedIn && (
                    <Text style={[styles.drsHint, { color: displayVerdict.color + 'aa' }]}>
                      → Save check-in to confirm
                    </Text>
                  )}
                </View>
              </WindowBox>
            )}

          </>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>

      {soreness && !alreadyCheckedIn && (
        <View style={styles.stickyFooter}>
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
            <Text style={styles.saveBtnText}>Save Check-in →</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    scrollContent: { paddingBottom: 48 },

    header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 20 },
    greeting: { fontSize: 11, color: C.dust, fontWeight: '600', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    title: { fontSize: 38, fontWeight: '800', color: C.ink, letterSpacing: -1.5, lineHeight: 42 },
    doneBadge: { backgroundColor: C.greenBg, borderWidth: 1.5, borderColor: C.greenBorder, borderRadius: 4, paddingHorizontal: 10, paddingVertical: 4, marginTop: 4 },
    doneBadgeText: { color: C.green, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },

    alertInner: { padding: 14, gap: 4 },
    alertText: { color: C.red, fontSize: 12, lineHeight: 18 },

    restDayBtn: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
    restDayBtnLeft: { flex: 1 },
    restDayBtnTitle: { color: C.green, fontSize: 14, fontWeight: '800' },
    restDayBtnSub: { color: C.sand, fontSize: 12, marginTop: 2 },
    restDayBtnArrow: { fontSize: 18, fontWeight: '700' },

    restDayConfirmed: { padding: 24, alignItems: 'center', gap: 6 },
    restDayConfirmedTitle: { fontSize: 32, fontWeight: '800', color: C.green, letterSpacing: -1 },
    restDayConfirmedSub: { color: C.sand, fontSize: 12, textAlign: 'center' },
    restDayDRS: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 8 },
    restDayDRSLabel: { fontSize: 10, fontWeight: '800', color: C.green, letterSpacing: 2, textTransform: 'uppercase' },
    restDayDRSScore: { fontSize: 28, fontWeight: '800', color: C.green, letterSpacing: -1 },

    sectionInner: { padding: 16, paddingTop: 20 },
    sectionHint: { color: C.dust, fontSize: 12, marginBottom: 12 },

    sorenessRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
    sorenessBtn: { width: 40, height: 40, backgroundColor: C.surfaceAlt, borderRadius: 4, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.borderLight },
    sorenessBtnText: { color: C.sand, fontSize: 13, fontWeight: '800' },
    sorenessHint: { color: C.sand, fontSize: 11, marginTop: 12, fontWeight: '600' },

    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
    chip: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: C.surfaceAlt, borderRadius: 4, borderWidth: 1, borderColor: C.borderLight },
    chipText: { color: C.sand, fontSize: 12, fontWeight: '700' },

    fingerTable: { gap: 8 },
    fingerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    fingerLabel: { color: C.inkLight, fontSize: 13, fontWeight: '700', width: 60 },
    fingerSides: { flexDirection: 'row', gap: 8, flex: 1 },
    sideChip: { flex: 1, paddingVertical: 8, backgroundColor: C.surfaceAlt, borderRadius: 4, borderWidth: 1, borderColor: C.borderLight, alignItems: 'center' },
    sideChipText: { color: C.sand, fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },

    drsInner: { padding: 18, paddingTop: 22 },
    drsTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    drsVerdict: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
    drsScoreBox: { width: 56, height: 56, borderWidth: 1.5, borderRadius: 4, justifyContent: 'center', alignItems: 'center' },
    drsScoreNum: { fontSize: 22, fontWeight: '800' },
    drsBreakdown: { flexDirection: 'row', paddingTop: 14, borderTopWidth: 1 },
    drsBreakdownGroup: { flex: 1, alignItems: 'center', position: 'relative' },
    drsBreakdownLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
    drsBreakdownVal: { fontSize: 18, fontWeight: '800' },
    drsBreakdownTick: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 1 },
    drsHint: { fontSize: 11, fontWeight: '600' },

    stickyFooter: { paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 16, backgroundColor: C.bg, borderTopWidth: 1, borderTopColor: C.borderLight },
    saveBtn: { backgroundColor: C.ink, padding: 16, borderRadius: 4, alignItems: 'center' },
    saveBtnText: { color: C.surface, fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },
  });
}
