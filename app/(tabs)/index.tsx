import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Modal, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { getAlertSettings, getCheckIns, getInjuryAlerts, getProfile, getSessions, saveProfile } from '../../storage';
import { gradeColor, useTheme } from '../../context/ThemeContext';

const GAUGE_R = 85;
const GAUGE_SW = 16;
const GAUGE_SIZE = (GAUGE_R + GAUGE_SW + 6) * 2;

const V_GRADES = ['VB', 'V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10', 'V11', 'V12'];

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


function computeCHI(sessions, checkIns, injuryAlerts) {
  const today = new Date();

  // 1. Body Readiness (35%) — from latest check-in (today or yesterday)
  let readiness = 65;
  for (let i = 0; i <= 2; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const ci = checkIns[d.toISOString().split('T')[0]];
    if (!ci) continue;
    if (ci.isRestDay) { readiness = 100; break; }
    let score = 100;
    const s = parseInt(ci.soreness || '0');
    if (s >= 8) score -= 40; else if (s >= 6) score -= 25; else if (s >= 4) score -= 10;
    const p = ci.painAreas?.length || 0;
    if (p >= 3) score -= 30; else if (p >= 2) score -= 20; else if (p >= 1) score -= 10;
    const f = ci.affectedFingers?.length || 0;
    if (f >= 3) score -= 20; else if (f >= 1) score -= 10;
    readiness = Math.max(0, Math.min(100, score));
    break;
  }

  // 2. Load Balance (35%) — last 7 days
  let load = 100;
  let sessionCount = 0, totalRES = 0, restCount = 0, consec = 0, maxConsec = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().split('T')[0];
    if (sessions[ds]) {
      sessionCount++; totalRES += sessions[ds].res;
      if (sessions[ds].res > 70) { consec++; maxConsec = Math.max(maxConsec, consec); } else consec = 0;
    } else consec = 0;
    if (checkIns[ds]?.isRestDay) restCount++;
  }
  if (sessionCount === 0) {
    load = 65;
  } else {
    if (totalRES >= 300) load -= 30; else if (totalRES >= 240) load -= 15;
    if (maxConsec >= 3) load -= 25; else if (maxConsec >= 2) load -= 10;
    if (restCount === 0 && sessionCount >= 4) load -= 15;
    else if (restCount >= 1) load += 5;
  }
  load = Math.max(0, Math.min(100, load));

  // 3. Injury Status (30%) — injury alerts + recent check-in pain
  let injury = 100 - injuryAlerts.length * 25;
  for (let i = 0; i <= 2; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const ci = checkIns[d.toISOString().split('T')[0]];
    if (!ci || ci.isRestDay) continue;
    const p = ci.painAreas?.length || 0;
    const f = ci.affectedFingers?.length || 0;
    if (p >= 3) injury -= 30; else if (p >= 2) injury -= 18; else if (p >= 1) injury -= 8;
    if (f >= 3) injury -= 20; else if (f >= 1) injury -= 10;
    break;
  }
  injury = Math.max(0, injury);

  const chi = Math.round(readiness * 0.35 + load * 0.35 + injury * 0.30);
  return { chi, readiness: Math.round(readiness), load: Math.round(load), injury: Math.round(injury) };
}

function CHICard({ data }) {
  const { C } = useTheme();
  const { chi, readiness, load, injury } = data;

  const chiColor = chi >= 80 ? C.green : chi >= 65 ? C.terra : chi >= 45 ? C.amber : C.red;
  const chiLabel = chi >= 80 ? 'Peak' : chi >= 65 ? 'Good' : chi >= 45 ? 'Stressed' : 'Recovery Mode';
  const chiDesc = chi >= 80
    ? 'Your body is in peak condition for performance.'
    : chi >= 65
    ? 'Good shape — a few things to keep an eye on.'
    : chi >= 45
    ? 'Your body is under stress. Consider active recovery.'
    : 'High recovery need. Prioritize rest over training.';

  const circumference = 2 * Math.PI * GAUGE_R;
  const arcLength = circumference * 0.75;
  const filled = (chi / 100) * arcLength;
  const cx = GAUGE_SIZE / 2;
  const cy = GAUGE_SIZE / 2;

  return (
    <View style={{
      backgroundColor: C.surface, borderRadius: 20, marginHorizontal: 16, marginBottom: 14,
      shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 12,
      elevation: 3, padding: 20,
    }}>
      {/* Title row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: C.ink, letterSpacing: 0.2 }}>Climber Health Index</Text>
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.terra, justifyContent: 'center', alignItems: 'center' }}>
          <Ionicons name="fitness" size={18} color="#fff" />
        </View>
      </View>

      {/* Gauge */}
      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={GAUGE_SIZE} height={GAUGE_SIZE}>
          <Circle cx={cx} cy={cy} r={GAUGE_R} fill="none"
            stroke={C.borderLight} strokeWidth={GAUGE_SW}
            strokeDasharray={`${arcLength} ${circumference - arcLength}`}
            strokeLinecap="round"
            transform={`rotate(135 ${cx} ${cy})`}
          />
          <Circle cx={cx} cy={cy} r={GAUGE_R} fill="none"
            stroke={chiColor} strokeWidth={GAUGE_SW}
            strokeDasharray={`${filled} ${circumference - filled}`}
            strokeLinecap="round"
            transform={`rotate(135 ${cx} ${cy})`}
          />
        </Svg>
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 58, fontWeight: '900', color: C.ink, letterSpacing: -2, lineHeight: 62 }}>{chi}</Text>
          <Text style={{ fontSize: 15, fontWeight: '700', color: chiColor, marginTop: 2 }}>{chiLabel}</Text>
        </View>
      </View>

      {/* Description */}
      <Text style={{ textAlign: 'center', color: C.sand, fontSize: 13, lineHeight: 18, marginTop: -12, marginBottom: 20 }}>
        {chiDesc}
      </Text>

      {/* Sub-component bars */}
      <View style={{ gap: 10 }}>
        {[
          { label: 'Readiness', value: readiness },
          { label: 'Load Balance', value: load },
          { label: 'Injury Status', value: injury },
        ].map(item => {
          const barColor = item.value >= 80 ? C.green : item.value >= 55 ? C.amber : C.red;
          return (
            <View key={item.label}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: C.sand }}>{item.label}</Text>
                <Text style={{ fontSize: 11, fontWeight: '700', color: barColor }}>{item.value}</Text>
              </View>
              <View style={{ height: 5, backgroundColor: C.borderLight, borderRadius: 3, overflow: 'hidden' }}>
                <View style={{ height: 5, width: `${item.value}%`, backgroundColor: barColor, borderRadius: 3 }} />
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function computeRecovery(sessions, checkIns) {
  const sortedDates = Object.keys(sessions).sort().reverse();
  if (sortedDates.length === 0) return null;

  const lastDate = sortedDates[0];
  const lastSession = sessions[lastDate];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const lastD = new Date(lastDate + 'T00:00:00');
  const daysSince = Math.round((today.getTime() - lastD.getTime()) / (1000 * 60 * 60 * 24));
  if (daysSince > 7) return null;

  // Base: light = 0, moderate/hard = 1. Adjustments only for genuine warning signs.
  let days = lastSession.res <= 40 ? 0 : 1;
  const factors: string[] = [];

  const nextDayD = new Date(lastD);
  nextDayD.setDate(nextDayD.getDate() + 1);
  const nextDayStr = nextDayD.toISOString().split('T')[0];
  const checkIn = checkIns[nextDayStr] || checkIns[lastDate];

  const soreness = parseInt(checkIn?.soreness || '0');
  const fingerIntensive = lastSession.holdTypes?.some(h => ['crimps', 'pockets'].includes(h));
  const fingersSore = (checkIn?.affectedFingers?.length || 0) > 0;

  // Only add a day for high soreness (8+), not moderate
  if (soreness >= 8) {
    days += 1; factors.push('Very high soreness');
  }
  // Finger-intensive holds AND fingers reported sore — both signals needed
  if (fingerIntensive && fingersSore) {
    days += 1; factors.push('Finger load + soreness');
  }
  // 3+ consecutive hard sessions, not 2
  let consecutive = 0;
  for (let i = 0; i < 5; i++) {
    const d = new Date(lastD);
    d.setDate(d.getDate() - i);
    const dStr = d.toISOString().split('T')[0];
    if (sessions[dStr]?.res >= 70) consecutive++;
    else break;
  }
  if (consecutive >= 3) {
    days += 1; factors.push('3+ hard sessions in a row');
  }

  days = Math.min(days, 3);

  const earliestDate = new Date(lastD);
  earliestDate.setDate(earliestDate.getDate() + days);
  const isReady = today >= earliestDate;

  return { days, earliestDate, isReady, factors, res: lastSession.res };
}

function getWeeklySummary(sessions, checkIns) {
  const today = new Date();
  let sessionCount = 0, totalRes = 0, restDays = 0, hardSessions = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    if (sessions[dateStr]) {
      sessionCount++;
      totalRes += sessions[dateStr].res;
      if (sessions[dateStr].res > 70) hardSessions++;
    }
    if (checkIns[dateStr]?.isRestDay) restDays++;
  }
  const avgRes = sessionCount > 0 ? Math.round(totalRes / sessionCount) : null;
  return { sessionCount, avgRes, restDays, hardSessions, totalRes };
}

function GradeModal({ visible, onClose, onSave }) {
  const [step, setStep] = useState(1);
  const [maxGrade, setMaxGrade] = useState(null);
  const [projectGrade, setProjectGrade] = useState(null);

  const reset = () => { setStep(1); setMaxGrade(null); setProjectGrade(null); };
  const handleClose = () => { reset(); onClose(); };
  const handleSave = () => { onSave(maxGrade, projectGrade); reset(); };
  const maxIndex = maxGrade ? V_GRADES.indexOf(maxGrade) : 0;
  const availableProjectGrades = V_GRADES.slice(maxIndex);
  const { C } = useTheme();
  const modalStyles = useMemo(() => makeModalStyles(C), [C]);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={modalStyles.overlay}>
        <View style={modalStyles.container}>
          <View style={modalStyles.titleBar}>
            <Text style={modalStyles.titleBarText}>
              {step === 1 ? 'Climbing Level' : 'Project Grade'}
            </Text>
            <TouchableOpacity onPress={handleClose} style={modalStyles.closeBtn}>
              <Text style={modalStyles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={modalStyles.body}>
            <Text style={modalStyles.subtitle}>
              {step === 1 ? 'Select the hardest grade you have sent' : 'What grade are you working toward?'}
            </Text>
            <View style={modalStyles.gradeGrid}>
              {(step === 1 ? V_GRADES : V_GRADES.slice(maxIndex)).map((grade) => {
                const selected = step === 1 ? maxGrade === grade : projectGrade === grade;
                return (
                  <TouchableOpacity
                    key={grade}
                    style={[modalStyles.gradeButton, selected && modalStyles.selectedButton]}
                    onPress={() => step === 1 ? setMaxGrade(grade) : setProjectGrade(grade)}
                  >
                    <Text style={[modalStyles.gradeText, selected && modalStyles.selectedText]}>
                      {grade}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {((step === 1 && maxGrade) || (step === 2 && projectGrade)) && (
              <TouchableOpacity
                style={modalStyles.continueButton}
                onPress={() => step === 1 ? setStep(2) : handleSave()}
              >
                <Text style={modalStyles.continueText}>
                  {step === 1 ? 'Continue →' : 'Save →'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const SENDS_OPTIONS = [3, 5, 8, 10, 12, 15, 20, 25, 30];

function SendsModal({ visible, current, onClose, onSave }) {
  const { C } = useTheme();
  const modalStyles = useMemo(() => makeModalStyles(C), [C]);
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={modalStyles.overlay}>
        <View style={modalStyles.container}>
          <View style={modalStyles.titleBar}>
            <Text style={modalStyles.titleBarText}>Sends to Unlock</Text>
            <TouchableOpacity onPress={onClose} style={modalStyles.closeBtn}>
              <Text style={modalStyles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={modalStyles.body}>
            <Text style={modalStyles.subtitle}>How many sends of your project grade unlock the next level?</Text>
            <View style={modalStyles.gradeGrid}>
              {SENDS_OPTIONS.map((n) => (
                <TouchableOpacity
                  key={n}
                  style={[modalStyles.gradeButton, current === n && modalStyles.selectedButton]}
                  onPress={() => onSave(n)}
                >
                  <Text style={[modalStyles.gradeText, current === n && modalStyles.selectedText]}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function ProfileScreen() {
  const { C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [profile, setProfile] = useState(null);
  const [totalSessions, setTotalSessions] = useState(0);
  const [progressCount, setProgressCount] = useState(0);
  const [progressMax, setProgressMax] = useState(10);
  const [showSendsModal, setShowSendsModal] = useState(false);
  const [showCongrats, setShowCongrats] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [weeklySummary, setWeeklySummary] = useState(null);
  const [injuryAlerts, setInjuryAlerts] = useState([]);
  const [alertSettings, setAlertSettings] = useState({ weeklyLoad: true, injuryOverload: true, bodyHighLoad: true });
  const [recovery, setRecovery] = useState(null);
  const [chiData, setChiData] = useState(null);

  useFocusEffect(useCallback(() => {
    loadData();
  }, []));

  const loadData = async () => {
    const [prof, sessions, checkIns, alerts, alertPrefs] = await Promise.all([
      getProfile(), getSessions(), getCheckIns(), getInjuryAlerts(), getAlertSettings(),
    ]);
    if (!prof) { setProfile(null); return; }
    setProfile(prof);
    setProgressMax(prof.sendsToUnlock ?? 10);
    setTotalSessions(Object.keys(sessions).length);
    setWeeklySummary(getWeeklySummary(sessions, checkIns));
    setInjuryAlerts(alerts);
    setAlertSettings(alertPrefs);
    setRecovery(computeRecovery(sessions, checkIns));
    setChiData(computeCHI(sessions, checkIns, alerts));

    let count = 0;
    if (prof.projectGrade) {
      Object.values(sessions).forEach(sess => {
        if (sess.gradeCounts?.[prof.projectGrade])
          count += sess.gradeCounts[prof.projectGrade];
      });
    }
    setProgressCount(count);
    const target = prof.sendsToUnlock ?? 10;
    const goalReached = count >= target;
    setShowCongrats(goalReached);

    if (goalReached && prof.projectGrade && prof.maxGrade) {
      const currentMaxIndex = V_GRADES.indexOf(prof.maxGrade);
      const projectIndex = V_GRADES.indexOf(prof.projectGrade);
      if (projectIndex > currentMaxIndex) {
        const newProjectIndex = Math.min(projectIndex + 1, V_GRADES.length - 1);
        await saveProfile({ ...prof, maxGrade: prof.projectGrade, projectGrade: V_GRADES[newProjectIndex] });
        const updatedProf = await getProfile();
        setProfile(updatedProf);
        setProgressCount(0);
        setShowCongrats(false);
      }
    }
  };

  const handleGradeSave = async (maxGrade, projectGrade) => {
    await saveProfile({ ...profile, maxGrade, projectGrade });
    setModalVisible(false);
    await loadData();
  };

  const handleSendsChange = async (n) => {
    await saveProfile({ ...profile, sendsToUnlock: n });
    setShowSendsModal(false);
    await loadData();
  };

  const getAvgResColor = (res) => {
    if (!res) return C.sand;
    if (res <= 40) return C.terra;
    if (res <= 70) return C.amber;
    return C.red;
  };

  const today = new Date();
  const timeGreeting = today.getHours() < 12 ? 'Good morning' : today.getHours() < 17 ? 'Good afternoon' : 'Good evening';
  const greeting = profile?.name ? `${timeGreeting}, ${profile.name}` : timeGreeting;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        <GradeModal visible={modalVisible} onClose={() => setModalVisible(false)} onSave={handleGradeSave} />
        <SendsModal visible={showSendsModal} current={progressMax} onClose={() => setShowSendsModal(false)} onSave={handleSendsChange} />

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>{greeting}</Text>
          <Text style={styles.title}>Profile</Text>
        </View>

        {!profile ? (
          <Card label="Setup" style={{ marginTop: 20 }}>
            <View style={{ padding: 32, alignItems: 'center', gap: 12 }}>
              <Text style={styles.emptyTitle}>No profile yet</Text>
              <Text style={styles.emptyText}>Set up your grades to start tracking.</Text>
              <TouchableOpacity style={styles.setupButton} onPress={() => setModalVisible(true)}>
                <Text style={styles.setupButtonText}>Get Started →</Text>
              </TouchableOpacity>
            </View>
          </Card>
        ) : (
          <>
            {/* Alerts */}
            {/* ── Getting started (no sessions yet) ── */}
            {totalSessions === 0 && (
              <Card label="Getting Started" accentColor={C.terra} bgColor={C.terraBg} labelColor={C.terra} style={{ marginTop: 8 }}>
                <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 }}>
                  <Text style={{ fontSize: 13, color: C.sand, lineHeight: 19, marginBottom: 16 }}>
                    Your recovery scores, CHI, and progress appear here once you start logging. Do these two things first:
                  </Text>
                  <TouchableOpacity
                    style={styles.startStep}
                    onPress={() => router.navigate('/(tabs)/session')}
                  >
                    <View style={[styles.startStepNum, { backgroundColor: C.terra }]}>
                      <Text style={styles.startStepNumText}>1</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.startStepTitle, { color: C.ink }]}>Log a session</Text>
                      <Text style={styles.startStepSub}>Track grades and hold types from today's climb</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={C.dust} />
                  </TouchableOpacity>
                  <View style={styles.startDivider} />
                  <TouchableOpacity
                    style={styles.startStep}
                    onPress={() => router.navigate('/(tabs)/checkin')}
                  >
                    <View style={[styles.startStepNum, { backgroundColor: '#52B788' }]}>
                      <Text style={styles.startStepNumText}>2</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.startStepTitle, { color: C.ink }]}>Morning check-in</Text>
                      <Text style={styles.startStepSub}>Log soreness and pain to track recovery</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={C.dust} />
                  </TouchableOpacity>
                  <View style={{ height: 16 }} />
                </View>
              </Card>
            )}

            {totalSessions > 0 && alertSettings.weeklyLoad && weeklySummary?.totalRes >= 280 && (
              <Card
                label="⚠ Notice"
                accentColor={C.amber}
                bgColor={C.amberBg}
                labelColor={C.amber}
                style={{ marginTop: 8 }}
              >
                <View style={styles.alertInner}>
                  <Text style={[styles.alertText, { color: C.amber }]}>
                    Weekly load {weeklySummary.totalRes} RES — consider a rest day
                  </Text>
                </View>
              </Card>
            )}

            {totalSessions > 0 && alertSettings.injuryOverload && injuryAlerts.length > 0 && (
              <Card
                label="⚠ Overload"
                accentColor={C.red}
                bgColor={C.redBg}
                labelColor={C.red}
                style={{ marginTop: weeklySummary?.totalRes >= 280 ? 0 : 8 }}
              >
                <View style={styles.alertInner}>
                  <Text style={[styles.alertText, { color: C.red }]}>
                    {injuryAlerts.map(a => a.partName).join(' · ')}
                  </Text>
                </View>
              </Card>
            )}

            {/* CHI */}
            {totalSessions > 0 && chiData && <CHICard data={chiData} />}

            {/* Grade Hero */}
            <Card label="Current Status" style={{ marginTop: 8 }}>
              <View style={styles.gradeHeroInner}>
                <View style={styles.gradeHeroCol}>
                  <Text style={styles.gradeEyebrow}>LEVEL</Text>
                  <Text style={styles.gradeBig}>{profile.maxGrade}</Text>
                </View>
                <View style={styles.gradeHeroDivider} />
                <View style={[styles.gradeHeroCol, { alignItems: 'flex-end' }]}>
                  <Text style={styles.gradeEyebrow}>PROJECT</Text>
                  <Text style={[styles.gradeBig, { color: gradeColor(profile.projectGrade) }]}>{profile.projectGrade}</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.editGradesBtn}
                onPress={() => setModalVisible(true)}
              >
                <Text style={styles.editGradesBtnText}>Edit grades →</Text>
              </TouchableOpacity>
            </Card>

            {/* Progress */}
            <Card label="Project Progress" accentColor={C.terra} bgColor={C.terraBg} labelColor={C.terra}>
              <View style={styles.progressInner}>
                <View style={styles.progressTopRow}>
                  <View>
                    <Text style={styles.progressEyebrow}>Sends at {profile.projectGrade}</Text>
                    <View style={styles.progressNumRow}>
                      <Text style={styles.progressBigNum}>{progressCount}</Text>
                      <Text style={styles.progressDenom}>/ {progressMax}</Text>
                    </View>
                  </View>
                  <Text style={styles.progressPct}>
                    {Math.round(Math.min(progressCount / progressMax, 1) * 100)}%
                  </Text>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${Math.min(progressCount / progressMax, 1) * 100}%` }]} />
                </View>
                <Text style={styles.progressHint}>
                  {showCongrats ? 'Grade updated — new goal set' : `${progressMax - progressCount} more to unlock ${profile.projectGrade}`}
                </Text>
              </View>
              <TouchableOpacity style={styles.sendsTargetBtn} onPress={() => setShowSendsModal(true)}>
                <Text style={styles.sendsTargetText}>Target: {progressMax} sends · change →</Text>
              </TouchableOpacity>
            </Card>

            {/* Recovery */}
            {totalSessions > 0 && recovery && (() => {
              const rc = recovery.isReady
                ? { color: C.green, bg: C.greenBg, border: C.greenBorder }
                : recovery.days >= 3
                  ? { color: C.red, bg: C.redBg, border: C.redBorder }
                  : { color: C.amber, bg: C.amberBg, border: C.amberBorder };
              return (
                <Card label="Recovery" accentColor={rc.color} bgColor={rc.bg} labelColor={rc.color}>
                  <View style={styles.recoveryInner}>
                    <View style={styles.recoveryTopRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.recoveryStatus, { color: rc.color }]}>
                          {recovery.isReady ? 'Ready to climb' : `Earliest: ${recovery.earliestDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}`}
                        </Text>
                        {!recovery.isReady && (
                          <Text style={[styles.recoverySub, { color: rc.color + 'aa' }]}>
                            {recovery.days} day{recovery.days !== 1 ? 's' : ''} recommended rest · Last session RES {recovery.res}
                          </Text>
                        )}
                        {recovery.isReady && (
                          <Text style={[styles.recoverySub, { color: rc.color + 'aa' }]}>
                            Last session RES {recovery.res} — body should be ready
                          </Text>
                        )}
                      </View>
                      <View style={[styles.recoveryDaysBox, { borderColor: rc.border }]}>
                        <Text style={[styles.recoveryDaysNum, { color: rc.color }]}>
                          {recovery.isReady ? '✓' : recovery.days}
                        </Text>
                        {!recovery.isReady && <Text style={[styles.recoveryDaysLabel, { color: rc.color }]}>days</Text>}
                      </View>
                    </View>
                    {!recovery.isReady && recovery.factors.length > 0 && (
                      <View style={styles.recoveryFactors}>
                        {recovery.factors.map(f => (
                          <View key={f} style={[styles.recoveryFactor, { borderColor: rc.border + '60' }]}>
                            <Text style={[styles.recoveryFactorText, { color: rc.color }]}>{f}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                    <Text style={styles.recoveryDisclaimer}>
                      Guide only — always trust how your body feels over any estimate.
                    </Text>
                  </View>
                </Card>
              );
            })()}

            {/* Weekly */}
            {totalSessions > 0 && weeklySummary && (
              <Card label="This Week">
                <View style={styles.weeklyInner}>
                  {[
                    { val: weeklySummary.sessionCount, label: 'sessions', color: C.ink },
                    { val: weeklySummary.avgRes ?? '—', label: 'avg RES', color: getAvgResColor(weeklySummary.avgRes) },
                    { val: weeklySummary.hardSessions, label: 'hard', color: weeklySummary.hardSessions >= 3 ? C.amber : C.ink },
                    { val: weeklySummary.restDays, label: 'rest', color: C.green },
                  ].map((item, i, arr) => (
                    <View key={item.label} style={styles.weeklyCellWrap}>
                      <View style={styles.weeklyCell}>
                        <Text style={[styles.weeklyBig, { color: item.color }]}>{item.val}</Text>
                        <Text style={styles.weeklySmall}>{item.label}</Text>
                      </View>
                      {i < arr.length - 1 && <View style={styles.weeklyDivider} />}
                    </View>
                  ))}
                </View>
              </Card>
            )}

            {/* Stats */}
            <Card label="All Time">
              <View style={styles.statsInner}>
                <View style={styles.statCell}>
                  <Text style={styles.statEyebrow}>Sessions</Text>
                  <Text style={styles.statBig}>{totalSessions}</Text>
                </View>
              </View>
            </Card>
          </>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    scrollContent: { paddingBottom: 60 },

    header: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 20 },
    greeting: { fontSize: 11, color: C.dust, fontWeight: '600', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 },
    title: { fontSize: 38, fontWeight: '800', color: C.ink, letterSpacing: -1.5, lineHeight: 42 },

    emptyTitle: { fontSize: 18, fontWeight: '800', color: C.ink },
    emptyText: { color: C.sand, fontSize: 13, textAlign: 'center' },
    setupButton: { backgroundColor: C.terra, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, marginTop: 4 },
    setupButtonText: { color: '#fff', fontSize: 13, fontWeight: '700' },

    alertInner: { padding: 14, paddingLeft: 24 },
    alertText: { fontSize: 12, fontWeight: '600', lineHeight: 17 },

    gradeHeroInner: { flexDirection: 'row', padding: 20, paddingBottom: 8 },
    gradeHeroCol: { flex: 1 },
    gradeHeroDivider: { width: 1, backgroundColor: C.borderLight, marginHorizontal: 12 },
    gradeEyebrow: { fontSize: 10, fontWeight: '700', color: C.dust, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
    gradeBig: { fontSize: 64, fontWeight: '800', color: C.ink, letterSpacing: -2, lineHeight: 68 },
    editGradesBtn: { borderTopWidth: 1, borderTopColor: C.borderLight, padding: 12, alignItems: 'center' },
    editGradesBtnText: { color: C.sand, fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },

    progressInner: { padding: 18, paddingLeft: 24 },
    progressTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 },
    progressEyebrow: { fontSize: 10, fontWeight: '700', color: C.terraDark || C.sand, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
    progressNumRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
    progressBigNum: { fontSize: 48, fontWeight: '800', color: C.terra, letterSpacing: -2, lineHeight: 52 },
    progressDenom: { fontSize: 18, fontWeight: '600', color: C.sand },
    progressPct: { fontSize: 13, fontWeight: '700', color: C.sand },
    progressTrack: { height: 6, backgroundColor: C.borderLight, borderRadius: 3, marginBottom: 10, overflow: 'hidden' },
    progressFill: { height: 6, backgroundColor: C.terra, borderRadius: 3 },
    progressHint: { color: C.sand, fontSize: 11 },
    sendsTargetBtn: { borderTopWidth: 1, borderTopColor: C.terraBorder + '40', paddingHorizontal: 24, paddingVertical: 10 },
    sendsTargetText: { color: C.terraDark || C.terra, fontSize: 11, fontWeight: '600' },

    recoveryInner: { padding: 18, paddingTop: 14, paddingLeft: 24 },
    recoveryTopRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    recoveryStatus: { fontSize: 18, fontWeight: '800', letterSpacing: -0.5, marginBottom: 4 },
    recoverySub: { fontSize: 11, fontWeight: '600', lineHeight: 16 },
    recoveryDaysBox: { width: 52, height: 52, borderWidth: 1.5, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    recoveryDaysNum: { fontSize: 20, fontWeight: '800', lineHeight: 24 },
    recoveryDaysLabel: { fontSize: 8, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
    recoveryFactors: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
    recoveryFactor: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
    recoveryFactorText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
    recoveryDisclaimer: { fontSize: 10, color: C.dust, marginTop: 10, fontStyle: 'italic' },

    weeklyInner: { flexDirection: 'row', padding: 16 },
    weeklyCellWrap: { flex: 1, flexDirection: 'row', alignItems: 'center' },
    weeklyCell: { flex: 1, alignItems: 'center' },
    weeklyBig: { fontSize: 26, fontWeight: '800', color: C.ink, letterSpacing: -1, marginBottom: 2 },
    weeklySmall: { fontSize: 8, fontWeight: '700', color: C.dust, letterSpacing: 1, textTransform: 'uppercase' },
    weeklyDivider: { width: 1, height: 30, backgroundColor: C.borderLight },

    startStep: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 },
    startStepNum: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    startStepNumText: { fontSize: 13, fontWeight: '800', color: '#fff' },
    startStepTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
    startStepSub: { fontSize: 12, color: C.sand, lineHeight: 16 },
    startDivider: { height: 1, backgroundColor: C.borderLight, marginLeft: 42 },

    statsInner: { flexDirection: 'row', padding: 18 },
    statCell: { flex: 1 },
    statEyebrow: { fontSize: 10, fontWeight: '700', color: C.dust, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 },
    statBig: { fontSize: 44, fontWeight: '800', color: C.ink, letterSpacing: -2, lineHeight: 48 },
    statDivider: { width: 1, backgroundColor: C.borderLight, marginHorizontal: 16 },
  });
}

function makeModalStyles(C) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(26,21,16,0.5)', justifyContent: 'flex-end' },
    container: { backgroundColor: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' },
    titleBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.ink, paddingHorizontal: 16, paddingVertical: 14 },
    titleBarText: { fontSize: 13, fontWeight: '800', color: C.surface, letterSpacing: 0.5 },
    closeBtn: { width: 24, height: 24, borderRadius: 12, backgroundColor: C.surface, justifyContent: 'center', alignItems: 'center' },
    closeBtnText: { fontSize: 12, fontWeight: '800', color: C.ink },
    body: { padding: 24, paddingBottom: 48 },
    subtitle: { fontSize: 13, color: C.sand, marginBottom: 20 },
    gradeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    gradeButton: { width: '22%', aspectRatio: 1, backgroundColor: C.surfaceAlt, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.borderLight },
    selectedButton: { backgroundColor: C.terra, borderColor: C.terra },
    gradeText: { color: C.sand, fontSize: 14, fontWeight: '700' },
    selectedText: { color: '#fff' },
    continueButton: { backgroundColor: C.ink, padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 24 },
    continueText: { color: C.surface, fontSize: 14, fontWeight: '700', letterSpacing: 0.5 },
  });
}
