import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Modal, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getAlertSettings, getCheckIns, getInjuryAlerts, getProfile, getSessions, saveProfile } from '../../storage';
import { useTheme } from '../../context/ThemeContext';

const V_GRADES = ['VB', 'V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10', 'V11', 'V12'];

// Retro window box component
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

  useFocusEffect(useCallback(() => { loadData(); }, []));

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
          <WindowBox label="Setup" style={{ marginTop: 20 }}>
            <View style={{ padding: 32, alignItems: 'center', gap: 12 }}>
              <Text style={styles.emptyTitle}>No profile yet</Text>
              <Text style={styles.emptyText}>Set up your grades to start tracking.</Text>
              <TouchableOpacity style={styles.setupButton} onPress={() => setModalVisible(true)}>
                <Text style={styles.setupButtonText}>Get Started →</Text>
              </TouchableOpacity>
            </View>
          </WindowBox>
        ) : (
          <>
            {/* Alerts */}
            {alertSettings.weeklyLoad && weeklySummary?.totalRes >= 280 && (
              <WindowBox
                label="⚠ Notice"
                borderColor={C.amberBorder}
                bgColor={C.amberBg}
                labelColor={C.amber}
                style={{ marginTop: 8 }}
              >
                <View style={styles.alertInner}>
                  <Text style={[styles.alertText, { color: C.amber }]}>
                    Weekly load {weeklySummary.totalRes} RES — consider a rest day
                  </Text>
                </View>
              </WindowBox>
            )}

            {alertSettings.injuryOverload && injuryAlerts.length > 0 && (
              <WindowBox
                label="⚠ Overload"
                borderColor={C.redBorder}
                bgColor={C.redBg}
                labelColor={C.red}
                style={{ marginTop: weeklySummary?.totalRes >= 280 ? 0 : 8 }}
              >
                <View style={styles.alertInner}>
                  <Text style={[styles.alertText, { color: C.red }]}>
                    {injuryAlerts.map(a => a.partName).join(' · ')}
                  </Text>
                </View>
              </WindowBox>
            )}

            {/* Grade Hero */}
            <WindowBox label="Current Status" style={{ marginTop: 8 }}>
              <View style={styles.gradeHeroInner}>
                <View style={styles.gradeHeroCol}>
                  <Text style={styles.gradeEyebrow}>LEVEL</Text>
                  <Text style={styles.gradeBig}>{profile.maxGrade}</Text>
                </View>
                <View style={styles.gradeHeroDivider} />
                <View style={[styles.gradeHeroCol, { alignItems: 'flex-end' }]}>
                  <Text style={styles.gradeEyebrow}>PROJECT</Text>
                  <Text style={[styles.gradeBig, { color: C.terra }]}>{profile.projectGrade}</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.editGradesBtn}
                onPress={() => setModalVisible(true)}
              >
                <Text style={styles.editGradesBtnText}>Edit grades →</Text>
              </TouchableOpacity>
            </WindowBox>

            {/* Progress */}
            <WindowBox label="Project Progress" borderColor={C.terraBorder} bgColor={C.terraBg} labelColor={C.terra}>
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
            </WindowBox>

            {/* Recovery */}
            {recovery && (() => {
              const rc = recovery.isReady
                ? { color: C.green, bg: C.greenBg, border: C.greenBorder }
                : recovery.days >= 3
                  ? { color: C.red, bg: C.redBg, border: C.redBorder }
                  : { color: C.amber, bg: C.amberBg, border: C.amberBorder };
              return (
                <WindowBox label="Recovery" borderColor={rc.border} bgColor={rc.bg} labelColor={rc.color}>
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
                  </View>
                </WindowBox>
              );
            })()}

            {/* Weekly */}
            {weeklySummary && (
              <WindowBox label="This Week">
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
              </WindowBox>
            )}

            {/* Stats */}
            <WindowBox label="All Time">
              <View style={styles.statsInner}>
                <View style={styles.statCell}>
                  <Text style={styles.statEyebrow}>Sessions</Text>
                  <Text style={styles.statBig}>{totalSessions}</Text>
                </View>
              </View>
            </WindowBox>
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
    scrollContent: { paddingBottom: 48 },

    header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 20 },
    greeting: { fontSize: 11, color: C.dust, fontWeight: '600', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 },
    title: { fontSize: 38, fontWeight: '800', color: C.ink, letterSpacing: -1.5, lineHeight: 42 },

    emptyTitle: { fontSize: 18, fontWeight: '800', color: C.ink },
    emptyText: { color: C.sand, fontSize: 13, textAlign: 'center' },
    setupButton: { backgroundColor: C.terra, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 4, marginTop: 4 },
    setupButtonText: { color: '#fff', fontSize: 13, fontWeight: '700' },

    alertInner: { padding: 14 },
    alertText: { fontSize: 12, fontWeight: '600', lineHeight: 17 },

    gradeHeroInner: { flexDirection: 'row', padding: 20, paddingBottom: 8 },
    gradeHeroCol: { flex: 1 },
    gradeHeroDivider: { width: 1, backgroundColor: C.borderLight, marginHorizontal: 12 },
    gradeEyebrow: { fontSize: 9, fontWeight: '800', color: C.dust, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 },
    gradeBig: { fontSize: 64, fontWeight: '800', color: C.ink, letterSpacing: -2, lineHeight: 68 },
    editGradesBtn: { borderTopWidth: 1, borderTopColor: C.borderLight, padding: 12, alignItems: 'center' },
    editGradesBtnText: { color: C.sand, fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },

    progressInner: { padding: 18 },
    progressTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 },
    progressEyebrow: { fontSize: 9, fontWeight: '800', color: C.terraDark || C.sand, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 },
    progressNumRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
    progressBigNum: { fontSize: 48, fontWeight: '800', color: C.terra, letterSpacing: -2, lineHeight: 52 },
    progressDenom: { fontSize: 18, fontWeight: '600', color: C.sand },
    progressPct: { fontSize: 13, fontWeight: '700', color: C.sand },
    progressTrack: { height: 3, backgroundColor: C.borderLight, borderRadius: 2, marginBottom: 10, overflow: 'hidden' },
    progressFill: { height: 3, backgroundColor: C.terra, borderRadius: 2 },
    progressHint: { color: C.sand, fontSize: 11 },
    sendsTargetBtn: { borderTopWidth: 1, borderTopColor: C.terraBorder + '40', paddingHorizontal: 18, paddingVertical: 10 },
    sendsTargetText: { color: C.terraDark || C.terra, fontSize: 11, fontWeight: '600' },

    recoveryInner: { padding: 18, paddingTop: 22 },
    recoveryTopRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    recoveryStatus: { fontSize: 18, fontWeight: '800', letterSpacing: -0.5, marginBottom: 4 },
    recoverySub: { fontSize: 11, fontWeight: '600', lineHeight: 16 },
    recoveryDaysBox: { width: 52, height: 52, borderWidth: 1.5, borderRadius: 4, justifyContent: 'center', alignItems: 'center' },
    recoveryDaysNum: { fontSize: 20, fontWeight: '800', lineHeight: 24 },
    recoveryDaysLabel: { fontSize: 8, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
    recoveryFactors: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
    recoveryFactor: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 },
    recoveryFactorText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },

    weeklyInner: { flexDirection: 'row', padding: 16 },
    weeklyCellWrap: { flex: 1, flexDirection: 'row', alignItems: 'center' },
    weeklyCell: { flex: 1, alignItems: 'center' },
    weeklyBig: { fontSize: 26, fontWeight: '800', color: C.ink, letterSpacing: -1, marginBottom: 2 },
    weeklySmall: { fontSize: 8, fontWeight: '700', color: C.dust, letterSpacing: 1, textTransform: 'uppercase' },
    weeklyDivider: { width: 1, height: 30, backgroundColor: C.borderLight },

    statsInner: { flexDirection: 'row', padding: 18 },
    statCell: { flex: 1 },
    statEyebrow: { fontSize: 9, fontWeight: '800', color: C.dust, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 },
    statBig: { fontSize: 44, fontWeight: '800', color: C.ink, letterSpacing: -2, lineHeight: 48 },
    statDivider: { width: 1, backgroundColor: C.borderLight, marginHorizontal: 16 },
  });
}

function makeModalStyles(C) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(26,21,16,0.5)', justifyContent: 'flex-end' },
    container: { backgroundColor: C.surface, borderTopLeftRadius: 0, borderTopRightRadius: 0, borderWidth: 1.5, borderColor: C.border, marginHorizontal: 0 },
    titleBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.border, paddingHorizontal: 16, paddingVertical: 10 },
    titleBarText: { fontSize: 13, fontWeight: '800', color: C.surface, letterSpacing: 0.5 },
    closeBtn: { width: 24, height: 24, borderRadius: 12, backgroundColor: C.surface, justifyContent: 'center', alignItems: 'center' },
    closeBtnText: { fontSize: 12, fontWeight: '800', color: C.ink },
    body: { padding: 24, paddingBottom: 48 },
    subtitle: { fontSize: 13, color: C.sand, marginBottom: 20 },
    gradeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    gradeButton: { width: '22%', aspectRatio: 1, backgroundColor: C.surfaceAlt, borderRadius: 4, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.borderLight },
    selectedButton: { backgroundColor: C.terra, borderColor: C.terra },
    gradeText: { color: C.sand, fontSize: 14, fontWeight: '700' },
    selectedText: { color: '#fff' },
    continueButton: { backgroundColor: C.ink, padding: 14, borderRadius: 4, alignItems: 'center', marginTop: 24 },
    continueText: { color: C.surface, fontSize: 14, fontWeight: '700', letterSpacing: 0.5 },
  });
}
