import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Modal, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { getCheckIns, getInjuryAlerts, getProfile, getSessions, saveProfile } from '../../storage';

const V_GRADES = ['VB', 'V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10', 'V11', 'V12'];

function ProgressRing({ progress, size, stroke, color, bg }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);
  return (
    <Svg width={size} height={size}>
      <Defs>
        <LinearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#00b4d8" />
          <Stop offset="1" stopColor="#0077a8" />
        </LinearGradient>
      </Defs>
      <Circle cx={size / 2} cy={size / 2} r={radius} stroke={bg} strokeWidth={stroke} fill="none" />
      <Circle
        cx={size / 2} cy={size / 2} r={radius} stroke="url(#grad)" strokeWidth={stroke} fill="none"
        strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
        strokeLinecap="round" rotation="-90" origin={`${size / 2}, ${size / 2}`}
      />
    </Svg>
  );
}

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
  let sessionCount = 0;
  let totalRes = 0;
  let restDays = 0;
  let hardSessions = 0;
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
  return { sessionCount, avgRes, restDays, hardSessions, totalRes  };
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
            <Ionicons name="close" size={22} color="#888" />
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
        if (sess.gradeCounts && sess.gradeCounts[prof.projectGrade])
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
        await saveProfile({ maxGrade: prof.projectGrade, projectGrade: V_GRADES[newProjectIndex] });
        const updatedProf = await getProfile();
        setProfile(updatedProf);
        setProgressCount(0);
        setShowCongrats(false);
      }
    }
  };

  const handleGradeSave = async (maxGrade, projectGrade) => {
    await saveProfile({ maxGrade, projectGrade });
    setModalVisible(false);
    await loadData();
  };

  const getAvgResColor = (res) => {
    if (!res) return '#888';
    if (res <= 40) return '#00b4d8';
    if (res <= 70) return '#f4a261';
    return '#e63946';
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
          <View>
            <Text style={styles.greeting}>{greeting}</Text>
            <Text style={styles.title}>My Profile</Text>
          </View>
        </View>

        {!profile ? (
          <View style={styles.emptyCard}>
            <Ionicons name="person-circle-outline" size={64} color="#333" />
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
                 <Ionicons name="warning-outline" size={18} color="#f4a261" />
                </View>
               <View style={styles.alertContent}>
                <Text style={styles.alertTitle}>Rest Day Recommended</Text>
                <Text style={styles.alertText}>Your weekly load is {weeklySummary.totalRes} RES — your body needs recovery time.</Text>
              </View>
             </View>
            )}

            {injuryAlerts.length > 0 && (
              <View style={[styles.alertBanner, styles.alertBannerRed]}>
                <View style={[styles.alertIconWrap, styles.alertIconWrapRed]}>
                  <Ionicons name="fitness-outline" size={18} color="#e63946" />
                </View>
                <View style={styles.alertContent}>
                  <Text style={[styles.alertTitle, { color: '#e63946' }]}>Overload Warning</Text>
                  {injuryAlerts.map(alert => (
                    <Text key={alert.partId} style={[styles.alertText, { color: '#a04040' }]}>
                      {alert.partName}
                    </Text>
                  ))}
                </View>
              </View>
            )}

            {/* Grade Hero Card */}
            <View style={styles.heroCard}>
              <View style={styles.heroGradeSection}>
                <View style={styles.heroGrade}>
                  <Text style={styles.heroGradeLabel}>LEVEL</Text>
                  <Text style={styles.heroGradeValue}>{profile.maxGrade}</Text>
                </View>
                <View style={styles.heroArrow}>
                  <Ionicons name="arrow-forward" size={20} color="#333" />
                </View>
                <View style={styles.heroGrade}>
                  <Text style={styles.heroGradeLabel}>PROJECT</Text>
                  <Text style={[styles.heroGradeValue, { color: '#00b4d8' }]}>{profile.projectGrade}</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.heroEditBtn} onPress={() => setModalVisible(true)}>
                <Ionicons name="pencil-outline" size={14} color="#888" />
                <Text style={styles.heroEditBtnText}>Edit Grades</Text>
              </TouchableOpacity>
            </View>

            {/* Progress Card */}
            <View style={styles.progressCard}>
              <View style={styles.progressHeader}>
                <View>
                  <Text style={styles.progressLabel}>Project Progress</Text>
                  <Text style={styles.progressSubLabel}>Sends at {profile.projectGrade}</Text>
                </View>
                <Text style={styles.progressFraction}>{progressCount}/{progressMax}</Text>
              </View>
              <View style={styles.progressBarTrack}>
                <View style={[styles.progressBarFill, { width: `${Math.min(progressCount / progressMax, 1) * 100}%` }]} />
              </View>
              <Text style={styles.progressHint}>
                {showCongrats ? 'Grade updated — new goal set!' : `${progressMax - progressCount} more sends to unlock ${profile.projectGrade}`}
              </Text>
            </View>

            {/* Weekly Summary */}
            {weeklySummary && (
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="bar-chart-outline" size={16} color="#888" />
                  <Text style={styles.sectionTitle}>This Week</Text>
                </View>
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
                    <Text style={[styles.weeklyValue, { color: weeklySummary.hardSessions >= 3 ? '#f4a261' : '#fff' }]}>
                      {weeklySummary.hardSessions}
                    </Text>
                    <Text style={styles.weeklyLabel}>Hard</Text>
                  </View>
                  <View style={styles.weeklyDivider} />
                  <View style={styles.weeklyItem}>
                    <Text style={[styles.weeklyValue, { color: '#4caf50' }]}>{weeklySummary.restDays}</Text>
                    <Text style={styles.weeklyLabel}>Rest</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Stats */}
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <View style={styles.statIconWrap}>
                  <Ionicons name="calendar-outline" size={18} color="#00b4d8" />
                </View>
                <Text style={styles.statValue}>{totalSessions}</Text>
                <Text style={styles.statLabel}>Total Sessions</Text>
              </View>
              <View style={styles.statCard}>
                <View style={styles.statIconWrap}>
                  <Ionicons name="flame-outline" size={18} color={highIntensityDays >= 3 ? '#f4a261' : '#00b4d8'} />
                </View>
                <Text style={[styles.statValue, highIntensityDays >= 3 && { color: '#f4a261' }]}>
                  {highIntensityDays}
                </Text>
                <Text style={styles.statLabel}>Hard Streak</Text>
              </View>
            </View>
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
  greeting: { fontSize: 13, color: '#555', fontWeight: '500', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4 },
  title: { fontSize: 30, fontWeight: '800', color: '#ffffff', letterSpacing: -0.5 },

  emptyCard: { backgroundColor: '#141416', borderRadius: 20, padding: 40, alignItems: 'center', gap: 12, marginTop: 40, borderWidth: 1, borderColor: '#1e1e22' },
  emptyTitle: { fontSize: 22, fontWeight: '700', color: '#ffffff', marginTop: 8 },
  emptyText: { color: '#555', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  setupButton: { backgroundColor: '#00b4d8', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 12, marginTop: 8 },
  setupButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },

  alertBanner: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#1e1608', borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#3a2a0a', gap: 12 },
  alertBannerRed: { backgroundColor: '#1a0808', borderColor: '#3a0a0a' },
  alertIconWrap: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#2a1e08', justifyContent: 'center', alignItems: 'center' },
  alertIconWrapRed: { backgroundColor: '#2a0808' },
  alertContent: { flex: 1 },
  alertTitle: { color: '#f4a261', fontSize: 13, fontWeight: '700', marginBottom: 3 },
  alertText: { color: '#7a5a30', fontSize: 12, lineHeight: 17 },

  heroCard: { backgroundColor: '#141416', borderRadius: 20, padding: 24, marginBottom: 12, borderWidth: 1, borderColor: '#1e1e22' },
  heroGradeSection: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: 20 },
  heroGrade: { alignItems: 'center', flex: 1 },
  heroGradeLabel: { fontSize: 10, fontWeight: '700', color: '#444', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 },
  heroGradeValue: { fontSize: 48, fontWeight: '800', color: '#ffffff', letterSpacing: -1 },
  heroArrow: { paddingBottom: 4 },
  heroEditBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#1e1e22', borderRadius: 10, padding: 10 },
  heroEditBtnText: { color: '#888', fontSize: 13, fontWeight: '600' },

  progressCard: { backgroundColor: '#141416', borderRadius: 20, padding: 20, marginBottom: 12, borderWidth: 1, borderColor: '#1e1e22' },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  progressLabel: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  progressSubLabel: { color: '#444', fontSize: 12, marginTop: 2 },
  progressFraction: { color: '#00b4d8', fontSize: 20, fontWeight: '800' },
  progressBarTrack: { height: 6, backgroundColor: '#1e1e22', borderRadius: 3, marginBottom: 10, overflow: 'hidden' },
  progressBarFill: { height: 6, backgroundColor: '#00b4d8', borderRadius: 3 },
  progressHint: { color: '#444', fontSize: 12 },

  sectionCard: { backgroundColor: '#141416', borderRadius: 20, padding: 20, marginBottom: 12, borderWidth: 1, borderColor: '#1e1e22' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  sectionTitle: { color: '#888', fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  weeklyGrid: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  weeklyItem: { flex: 1, alignItems: 'center' },
  weeklyValue: { color: '#ffffff', fontSize: 22, fontWeight: '800', marginBottom: 4 },
  weeklyLabel: { color: '#444', fontSize: 11, fontWeight: '500' },
  weeklyDivider: { width: 1, height: 32, backgroundColor: '#1e1e22' },

  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  statCard: { flex: 1, backgroundColor: '#141416', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#1e1e22' },
  statIconWrap: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#1e1e22', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  statValue: { color: '#ffffff', fontSize: 30, fontWeight: '800', marginBottom: 2 },
  statLabel: { color: '#444', fontSize: 12, fontWeight: '500' },
});

const modalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  container: { backgroundColor: '#141416', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 48 },
  handle: { width: 36, height: 4, backgroundColor: '#333', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  closeBtn: { position: 'absolute', top: 20, right: 24, width: 32, height: 32, borderRadius: 16, backgroundColor: '#1e1e22', justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '800', color: '#ffffff', marginBottom: 6 },
  subtitle: { fontSize: 13, color: '#555', marginBottom: 24 },
  gradeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gradeButton: { width: '22%', aspectRatio: 1, backgroundColor: '#1e1e22', borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#2a2a2e' },
  selectedButton: { backgroundColor: '#00b4d8', borderColor: '#00b4d8' },
  gradeText: { color: '#888', fontSize: 16, fontWeight: '700' },
  selectedText: { color: '#ffffff' },
  continueButton: { backgroundColor: '#00b4d8', padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 24 },
  continueText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
});