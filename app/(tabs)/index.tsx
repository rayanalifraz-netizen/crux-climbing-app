import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Modal, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getCheckIns, getInjuryAlerts, getProfile, getSessions, saveProfile } from '../../storage';

const V_GRADES = ['VB', 'V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10', 'V11', 'V12'];

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  bg:         '#1a1510',   // dark warm charcoal
  surface:    '#221e18',   // card surface
  surfaceAlt: '#2a2420',   // slightly lighter card
  border:     '#36302a',   // warm border
  borderFaint:'#2a2520',   // subtle border
  chalk:      '#f0ebe3',   // primary text — chalk white
  sand:       '#a89880',   // secondary text — warm sand
  dust:       '#6a5e52',   // muted text
  terra:      '#c4734a',   // terracotta accent
  terraLight: '#d4896a',   // lighter terra
  terraDark:  '#8a4a2a',   // darker terra
  terraBg:    '#2a1e16',   // terra tinted bg
  amber:      '#d4943a',   // warm amber for warnings
  amberBg:    '#261e10',
  red:        '#c44a3a',
  redBg:      '#241410',
  green:      '#6a9a5a',
  greenBg:    '#16201a',
};

function getConsecutiveHighIntensityDays(sessions) {
  let count = 0;
  const today = new Date();
  for (let i = 1; i <= 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    if (sessions[dateStr] && sessions[dateStr].res >= 70) count++;
    else break;
  }
  return count;
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

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={modalStyles.overlay}>
        <View style={modalStyles.container}>
          <View style={modalStyles.handle} />
          <TouchableOpacity onPress={handleClose} style={modalStyles.closeBtn}>
            <Ionicons name="close" size={20} color={C.dust} />
          </TouchableOpacity>
          {step === 1 ? (
            <>
              <Text style={modalStyles.title}>Climbing Level</Text>
              <Text style={modalStyles.subtitle}>Select the hardest grade you have sent</Text>
              <View style={modalStyles.gradeGrid}>
                {V_GRADES.map((grade) => (
                  <TouchableOpacity
                    key={grade}
                    style={[modalStyles.gradeButton, maxGrade === grade && modalStyles.selectedButton]}
                    onPress={() => setMaxGrade(grade)}
                  >
                    <Text style={[modalStyles.gradeText, maxGrade === grade && modalStyles.selectedText]}>
                      {grade}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {maxGrade && (
                <TouchableOpacity style={modalStyles.continueButton} onPress={() => setStep(2)}>
                  <Text style={modalStyles.continueText}>Continue</Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <>
              <Text style={modalStyles.title}>Project Grade</Text>
              <Text style={modalStyles.subtitle}>What grade are you working toward?</Text>
              <View style={modalStyles.gradeGrid}>
                {availableProjectGrades.map((grade) => (
                  <TouchableOpacity
                    key={grade}
                    style={[modalStyles.gradeButton, projectGrade === grade && modalStyles.selectedButton]}
                    onPress={() => setProjectGrade(grade)}
                  >
                    <Text style={[modalStyles.gradeText, projectGrade === grade && modalStyles.selectedText]}>
                      {grade}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {projectGrade && (
                <TouchableOpacity style={modalStyles.continueButton} onPress={handleSave}>
                  <Text style={modalStyles.continueText}>Save</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

export default function ProfileScreen() {
  const [profile, setProfile] = useState(null);
  const [totalSessions, setTotalSessions] = useState(0);
  const [progressCount, setProgressCount] = useState(0);
  const [progressMax] = useState(10);
  const [showCongrats, setShowCongrats] = useState(false);
  const [highIntensityDays, setHighIntensityDays] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [weeklySummary, setWeeklySummary] = useState(null);
  const [injuryAlerts, setInjuryAlerts] = useState([]);

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const loadData = async () => {
    const [prof, sessions, checkIns, alerts] = await Promise.all([
      getProfile(), getSessions(), getCheckIns(), getInjuryAlerts(),
    ]);
    if (!prof) { setProfile(null); return; }
    setProfile(prof);
    setTotalSessions(Object.keys(sessions).length);
    setHighIntensityDays(getConsecutiveHighIntensityDays(sessions));
    setWeeklySummary(getWeeklySummary(sessions, checkIns));
    setInjuryAlerts(alerts);

    let count = 0;
    if (prof.projectGrade) {
      Object.values(sessions).forEach(sess => {
        if (sess.gradeCounts?.[prof.projectGrade])
          count += sess.gradeCounts[prof.projectGrade];
      });
    }
    setProgressCount(count);
    const goalReached = count >= progressMax;
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

  const getAvgResColor = (res) => {
    if (!res) return C.dust;
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

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>{greeting}</Text>
          <Text style={styles.title}>My Profile</Text>
          <View style={styles.headerRule} />
        </View>

        {!profile ? (
          <View style={styles.emptyCard}>
            <Ionicons name="person-circle-outline" size={56} color={C.dust} />
            <Text style={styles.emptyTitle}>Welcome to Crux</Text>
            <Text style={styles.emptyText}>Set up your profile to start tracking your climbing recovery.</Text>
            <TouchableOpacity style={styles.setupButton} onPress={() => setModalVisible(true)}>
              <Text style={styles.setupButtonText}>Get Started</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Alert Banners */}
            {weeklySummary?.totalRes >= 280 && (
              <View style={styles.alertBanner}>
                <View style={styles.alertIconWrap}>
                  <Ionicons name="warning-outline" size={16} color={C.amber} />
                </View>
                <View style={styles.alertContent}>
                  <Text style={styles.alertTitle}>Rest Day Recommended</Text>
                  <Text style={styles.alertText}>Weekly load at {weeklySummary.totalRes} RES — your body needs recovery time.</Text>
                </View>
              </View>
            )}

            {injuryAlerts.length > 0 && (
              <View style={[styles.alertBanner, { borderColor: C.red + '60', backgroundColor: C.redBg }]}>
                <View style={[styles.alertIconWrap, { backgroundColor: C.red + '20' }]}>
                  <Ionicons name="fitness-outline" size={16} color={C.red} />
                </View>
                <View style={styles.alertContent}>
                  <Text style={[styles.alertTitle, { color: C.red }]}>Overload Warning</Text>
                  {injuryAlerts.map(alert => (
                    <Text key={alert.partId} style={[styles.alertText, { color: C.red + 'aa' }]}>
                      {alert.partName}
                    </Text>
                  ))}
                </View>
              </View>
            )}

            {/* Grade Hero Card */}
            <View style={styles.heroCard}>
              <Text style={styles.heroEyebrow}>CURRENT STATUS</Text>
              <View style={styles.heroGradeSection}>
                <View style={styles.heroGrade}>
                  <Text style={styles.heroGradeLabel}>LEVEL</Text>
                  <Text style={styles.heroGradeValue}>{profile.maxGrade}</Text>
                </View>
                <View style={styles.heroDivider} />
                <View style={styles.heroGrade}>
                  <Text style={styles.heroGradeLabel}>PROJECT</Text>
                  <Text style={[styles.heroGradeValue, { color: C.terra }]}>{profile.projectGrade}</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.heroEditBtn} onPress={() => setModalVisible(true)}>
                <Ionicons name="pencil-outline" size={13} color={C.dust} />
                <Text style={styles.heroEditBtnText}>Edit Grades</Text>
              </TouchableOpacity>
            </View>

            {/* Progress Card */}
            <View style={styles.progressCard}>
              <View style={styles.progressHeader}>
                <View>
                  <Text style={styles.progressEyebrow}>PROJECT PROGRESS</Text>
                  <Text style={styles.progressLabel}>Sends at {profile.projectGrade}</Text>
                </View>
                <Text style={styles.progressFraction}>
                  <Text style={styles.progressCount}>{progressCount}</Text>
                  <Text style={styles.progressMax}>/{progressMax}</Text>
                </Text>
              </View>
              <View style={styles.progressBarTrack}>
                <View style={[styles.progressBarFill, { width: `${Math.min(progressCount / progressMax, 1) * 100}%` }]} />
              </View>
              <Text style={styles.progressHint}>
                {showCongrats ? '— Grade updated. New goal set —' : `${progressMax - progressCount} more sends to unlock ${profile.projectGrade}`}
              </Text>
            </View>

            {/* Weekly Summary */}
            {weeklySummary && (
              <View style={styles.weeklyCard}>
                <Text style={styles.weeklyEyebrow}>THIS WEEK</Text>
                <View style={styles.weeklyGrid}>
                  <View style={styles.weeklyItem}>
                    <Text style={styles.weeklyValue}>{weeklySummary.sessionCount}</Text>
                    <Text style={styles.weeklyLabel}>Sessions</Text>
                  </View>
                  <View style={styles.weeklyDivider} />
                  <View style={styles.weeklyItem}>
                    <Text style={[styles.weeklyValue, { color: getAvgResColor(weeklySummary.avgRes) }]}>
                      {weeklySummary.avgRes ?? '—'}
                    </Text>
                    <Text style={styles.weeklyLabel}>Avg RES</Text>
                  </View>
                  <View style={styles.weeklyDivider} />
                  <View style={styles.weeklyItem}>
                    <Text style={[styles.weeklyValue, { color: weeklySummary.hardSessions >= 3 ? C.amber : C.chalk }]}>
                      {weeklySummary.hardSessions}
                    </Text>
                    <Text style={styles.weeklyLabel}>Hard</Text>
                  </View>
                  <View style={styles.weeklyDivider} />
                  <View style={styles.weeklyItem}>
                    <Text style={[styles.weeklyValue, { color: C.green }]}>{weeklySummary.restDays}</Text>
                    <Text style={styles.weeklyLabel}>Rest</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Stats Row */}
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statEyebrow}>TOTAL</Text>
                <Text style={styles.statValue}>{totalSessions}</Text>
                <Text style={styles.statLabel}>Sessions</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statEyebrow}>STREAK</Text>
                <Text style={[styles.statValue, highIntensityDays >= 3 && { color: C.amber }]}>
                  {highIntensityDays}
                </Text>
                <Text style={styles.statLabel}>Hard Days</Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scrollContent: { padding: 20, paddingBottom: 48 },

  header: { marginTop: 16, marginBottom: 28 },
  greeting: { fontSize: 12, color: C.dust, fontWeight: '600', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 },
  title: { fontSize: 36, fontWeight: '800', color: C.chalk, letterSpacing: -1, lineHeight: 40 },
  headerRule: { height: 1, backgroundColor: C.border, marginTop: 16 },

  emptyCard: { backgroundColor: C.surface, borderRadius: 16, padding: 40, alignItems: 'center', gap: 12, marginTop: 40, borderWidth: 1, borderColor: C.border },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: C.chalk, marginTop: 8 },
  emptyText: { color: C.dust, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  setupButton: { backgroundColor: C.terra, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 10, marginTop: 8 },
  setupButtonText: { color: C.chalk, fontSize: 15, fontWeight: '700', letterSpacing: 0.5 },

  alertBanner: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: C.amberBg, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.amber + '40', gap: 12 },
  alertIconWrap: { width: 30, height: 30, borderRadius: 8, backgroundColor: C.amber + '20', justifyContent: 'center', alignItems: 'center' },
  alertContent: { flex: 1 },
  alertTitle: { color: C.amber, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 3 },
  alertText: { color: C.amber + '99', fontSize: 12, lineHeight: 17 },

  heroCard: { backgroundColor: C.surface, borderRadius: 16, padding: 24, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  heroEyebrow: { fontSize: 10, fontWeight: '700', color: C.dust, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 20 },
  heroGradeSection: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  heroGrade: { flex: 1, alignItems: 'center' },
  heroGradeLabel: { fontSize: 10, fontWeight: '700', color: C.dust, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 },
  heroGradeValue: { fontSize: 56, fontWeight: '800', color: C.chalk, letterSpacing: -2, lineHeight: 60 },
  heroDivider: { width: 1, height: 60, backgroundColor: C.border },
  heroEditBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 16, marginTop: 4 },
  heroEditBtnText: { color: C.dust, fontSize: 12, fontWeight: '600', letterSpacing: 0.5 },

  progressCard: { backgroundColor: C.surface, borderRadius: 16, padding: 20, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  progressEyebrow: { fontSize: 10, fontWeight: '700', color: C.dust, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 },
  progressLabel: { color: C.sand, fontSize: 14, fontWeight: '500' },
  progressFraction: { alignItems: 'flex-end' },
  progressCount: { fontSize: 28, fontWeight: '800', color: C.terra },
  progressMax: { fontSize: 16, fontWeight: '600', color: C.dust },
  progressBarTrack: { height: 3, backgroundColor: C.border, borderRadius: 2, marginBottom: 12, overflow: 'hidden' },
  progressBarFill: { height: 3, backgroundColor: C.terra, borderRadius: 2 },
  progressHint: { color: C.dust, fontSize: 11, letterSpacing: 0.3 },

  weeklyCard: { backgroundColor: C.surface, borderRadius: 16, padding: 20, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  weeklyEyebrow: { fontSize: 10, fontWeight: '700', color: C.dust, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 18 },
  weeklyGrid: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  weeklyItem: { flex: 1, alignItems: 'center' },
  weeklyValue: { color: C.chalk, fontSize: 24, fontWeight: '800', marginBottom: 4, letterSpacing: -0.5 },
  weeklyLabel: { color: C.dust, fontSize: 10, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase' },
  weeklyDivider: { width: 1, height: 36, backgroundColor: C.border },

  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, backgroundColor: C.surface, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: C.border },
  statEyebrow: { fontSize: 9, fontWeight: '700', color: C.dust, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 },
  statValue: { color: C.chalk, fontSize: 36, fontWeight: '800', letterSpacing: -1, marginBottom: 2 },
  statLabel: { color: C.dust, fontSize: 11, fontWeight: '500' },
});

const modalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  container: { backgroundColor: C.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 48, borderTopWidth: 1, borderColor: C.border },
  handle: { width: 36, height: 3, backgroundColor: C.border, borderRadius: 2, alignSelf: 'center', marginBottom: 24 },
  closeBtn: { position: 'absolute', top: 20, right: 24, width: 32, height: 32, borderRadius: 10, backgroundColor: C.surfaceAlt, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '800', color: C.chalk, marginBottom: 4, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: C.dust, marginBottom: 24 },
  gradeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gradeButton: { width: '22%', aspectRatio: 1, backgroundColor: C.surfaceAlt, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.border },
  selectedButton: { backgroundColor: C.terra, borderColor: C.terra },
  gradeText: { color: C.dust, fontSize: 15, fontWeight: '700' },
  selectedText: { color: C.chalk },
  continueButton: { backgroundColor: C.terra, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 24 },
  continueText: { color: C.chalk, fontSize: 15, fontWeight: '700', letterSpacing: 0.5 },
});