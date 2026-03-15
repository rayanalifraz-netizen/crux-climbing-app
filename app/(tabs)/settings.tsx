import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Modal, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { clearAllData, deleteCheckInByKey, deleteSessionsByKey, getProfile, getTodayDate, saveProfile } from '../../storage';
import { useTheme } from '../../context/ThemeContext';

const V_GRADES = ['VB', 'V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10', 'V11', 'V12'];

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

function GradeModal({ visible, onClose, onSave }) {
  const { C } = useTheme();
  const modalStyles = useMemo(() => makeModalStyles(C), [C]);
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
              {(step === 1 ? V_GRADES : availableProjectGrades).map((grade) => {
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

function SettingsRow({ label, sublabel, onPress, destructive = false, rightText }) {
  const { C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  return (
    <TouchableOpacity style={styles.row} onPress={onPress}>
      <View style={styles.rowContent}>
        <Text style={[styles.rowLabel, destructive && { color: C.red }]}>{label}</Text>
        {sublabel && <Text style={styles.rowSublabel}>{sublabel}</Text>}
      </View>
      <Text style={[styles.rowArrow, destructive && { color: C.red }]}>
        {rightText || '→'}
      </Text>
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const { C, isDark, toggleDark } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [profile, setProfile] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');

  useFocusEffect(useCallback(() => { loadProfile(); }, []));

  const loadProfile = async () => {
    const prof = await getProfile();
    setProfile(prof);
    if (prof?.name) setNameInput(prof.name);
  };

  const saveName = async () => {
    const updated = { ...profile, name: nameInput.trim() || 'Climber' };
    await saveProfile(updated);
    setProfile(updated);
    setEditingName(false);
  };

  const handleGradeSave = async (maxGrade, projectGrade) => {
    const updated = { ...profile, maxGrade, projectGrade };
    await saveProfile(updated);
    setModalVisible(false);
    await loadProfile();
  };

  const clearTodaySession = () => {
    Alert.alert("Clear Today's Session", "This will delete today's session so you can re-log it.", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: async () => { await deleteSessionsByKey(getTodayDate()); } }
    ]);
  };

  const clearTodayCheckIn = () => {
    Alert.alert("Clear Today's Check-in", "This will delete today's check-in so you can re-log it.", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: async () => { await deleteCheckInByKey(getTodayDate()); } }
    ]);
  };

  const handleClearAllData = () => {
    Alert.alert(
      'Clear All Data',
      'This permanently deletes all sessions, check-ins, and your profile. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete Everything', style: 'destructive', onPress: async () => { await clearAllData(); setProfile(null); } }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        <GradeModal visible={modalVisible} onClose={() => setModalVisible(false)} onSave={handleGradeSave} />

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>App</Text>
          <Text style={styles.title}>Settings</Text>
        </View>

        {/* Profile */}
        <WindowBox label="Profile">
          <View style={styles.profileInner}>
            <View style={styles.profileAvatar}>
              <Text style={styles.profileAvatarText}>
                {(profile?.name || 'C')[0].toUpperCase()}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              {editingName ? (
                <TextInput
                  style={styles.nameInput}
                  value={nameInput}
                  onChangeText={setNameInput}
                  placeholder="Enter your name"
                  placeholderTextColor={C.dust}
                  autoFocus
                  onSubmitEditing={saveName}
                  returnKeyType="done"
                />
              ) : (
                <Text style={styles.profileName}>{profile?.name || 'Climber'}</Text>
              )}
              <Text style={styles.profileGrades}>
                {profile ? `${profile.maxGrade} · Projecting ${profile.projectGrade}` : 'No grades set'}
              </Text>
            </View>
            {editingName ? (
              <TouchableOpacity style={[styles.profileBtn, { borderColor: C.terraBorder }]} onPress={saveName}>
                <Text style={[styles.profileBtnText, { color: C.terra }]}>Save</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.profileBtn}
                onPress={() => { setNameInput(profile?.name || ''); setEditingName(true); }}
              >
                <Text style={styles.profileBtnText}>Edit</Text>
              </TouchableOpacity>
            )}
          </View>
        </WindowBox>

        {/* Appearance */}
        <WindowBox label="Appearance">
          <TouchableOpacity style={styles.row} onPress={toggleDark}>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Dark Mode</Text>
              <Text style={styles.rowSublabel}>{isDark ? 'On — tap to switch to light' : 'Off — tap to switch to dark'}</Text>
            </View>
            <View style={[styles.toggleTrack, isDark && { backgroundColor: C.terra, borderColor: C.terraBorder }]}>
              <View style={[styles.toggleThumb, isDark && { transform: [{ translateX: 18 }] }]} />
            </View>
          </TouchableOpacity>
        </WindowBox>

        {/* Grades */}
        <WindowBox label="Grades" borderColor={C.terraBorder} bgColor={C.terraBg} labelColor={C.terra}>
          <View style={styles.gradeDisplay}>
            <View style={styles.gradeItem}>
              <Text style={styles.gradeEyebrow}>Level</Text>
              <Text style={styles.gradeBig}>{profile?.maxGrade ?? '—'}</Text>
            </View>
            <View style={styles.gradeDivider} />
            <View style={styles.gradeItem}>
              <Text style={styles.gradeEyebrow}>Project</Text>
              <Text style={[styles.gradeBig, { color: C.terra }]}>{profile?.projectGrade ?? '—'}</Text>
            </View>
          </View>
          <View style={[styles.rowDivider, { backgroundColor: C.terraBorder + '40' }]} />
          <SettingsRow
            label="Edit Grades"
            sublabel="Update your climbing level and project"
            onPress={() => setModalVisible(true)}
          />
        </WindowBox>

        {/* Data */}
        <WindowBox label="Data" borderColor={C.amberBorder} bgColor={C.amberBg} labelColor={C.amber}>
          <SettingsRow
            label="Clear Today's Session"
            sublabel="Re-log today's climbing session"
            onPress={clearTodaySession}
          />
          <View style={[styles.rowDivider, { backgroundColor: C.amberBorder + '30' }]} />
          <SettingsRow
            label="Clear Today's Check-in"
            sublabel="Re-do today's body check-in"
            onPress={clearTodayCheckIn}
          />
        </WindowBox>

        {/* Danger */}
        <WindowBox label="Danger Zone" borderColor={C.redBorder} bgColor={C.redBg} labelColor={C.red}>
          <SettingsRow
            label="Clear All Data"
            sublabel="Permanently delete everything"
            onPress={handleClearAllData}
            destructive
          />
        </WindowBox>

        {/* App Info */}
        <View style={styles.appInfo}>
          <View style={styles.appInfoBox}>
            <Text style={styles.appInfoName}>CRUX</Text>
          </View>
          <Text style={styles.appInfoTagline}>Bouldering Recovery Tracker</Text>
          <Text style={styles.appInfoVersion}>Version 1.0.0</Text>
        </View>

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

    profileInner: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: 20, gap: 14 },
    profileAvatar: { width: 44, height: 44, borderRadius: 4, borderWidth: 1.5, borderColor: C.terraBorder, backgroundColor: C.terraBg, justifyContent: 'center', alignItems: 'center' },
    profileAvatarText: { fontSize: 20, fontWeight: '800', color: C.terra },
    profileInfo: { flex: 1 },
    profileName: { color: C.ink, fontSize: 15, fontWeight: '800', marginBottom: 2 },
    profileGrades: { color: C.dust, fontSize: 11 },
    profileBtn: { borderWidth: 1.5, borderColor: C.borderLight, borderRadius: 4, paddingHorizontal: 12, paddingVertical: 6 },
    profileBtnText: { color: C.sand, fontSize: 11, fontWeight: '800' },
    nameInput: { color: C.ink, fontSize: 15, fontWeight: '700', borderBottomWidth: 1.5, borderBottomColor: C.terraBorder, paddingBottom: 2, minWidth: 120 },

    gradeDisplay: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 20 },
    gradeItem: { flex: 1, alignItems: 'center' },
    gradeEyebrow: { fontSize: 9, fontWeight: '800', color: C.terraDark, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 },
    gradeBig: { fontSize: 40, fontWeight: '800', color: C.ink, letterSpacing: -1 },
    gradeDivider: { width: 1, backgroundColor: C.terraBorder + '40', marginHorizontal: 8 },
    rowDivider: { height: 1, marginHorizontal: 16 },

    row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
    rowContent: { flex: 1 },
    rowLabel: { color: C.ink, fontSize: 13, fontWeight: '700' },
    rowSublabel: { color: C.dust, fontSize: 11, marginTop: 2 },
    rowArrow: { color: C.sand, fontSize: 14, fontWeight: '700' },

    toggleTrack: { width: 40, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: C.borderLight, backgroundColor: C.surfaceAlt, justifyContent: 'center', paddingHorizontal: 2 },
    toggleThumb: { width: 14, height: 14, borderRadius: 7, backgroundColor: C.sand },

    appInfo: { alignItems: 'center', gap: 4, paddingTop: 24, paddingBottom: 8 },
    appInfoBox: { borderWidth: 1.5, borderColor: C.border, borderRadius: 4, paddingHorizontal: 16, paddingVertical: 8, marginBottom: 8 },
    appInfoName: { color: C.sand, fontSize: 14, fontWeight: '800', letterSpacing: 4 },
    appInfoTagline: { color: C.dust, fontSize: 11 },
    appInfoVersion: { color: C.dust, fontSize: 10, opacity: 0.6 },
  });
}

function makeModalStyles(C) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(26,21,16,0.5)', justifyContent: 'flex-end' },
    container: { backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.border },
    titleBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.border, paddingHorizontal: 16, paddingVertical: 10 },
    titleBarText: { fontSize: 13, fontWeight: '800', color: C.surface, letterSpacing: 0.5 },
    closeBtn: { width: 24, height: 24, borderRadius: 12, backgroundColor: C.surface, justifyContent: 'center', alignItems: 'center' },
    closeBtnText: { fontSize: 12, fontWeight: '800', color: C.ink },
    body: { padding: 24, paddingBottom: 48 },
    subtitle: { fontSize: 12, color: C.dust, marginBottom: 20 },
    gradeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    gradeButton: { width: '22%', aspectRatio: 1, backgroundColor: C.surfaceAlt, borderRadius: 4, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: C.borderLight },
    selectedButton: { backgroundColor: C.terra, borderColor: C.terra },
    gradeText: { color: C.sand, fontSize: 14, fontWeight: '800' },
    selectedText: { color: '#fff' },
    continueButton: { backgroundColor: C.ink, padding: 14, borderRadius: 4, alignItems: 'center', marginTop: 24 },
    continueText: { color: C.surface, fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },
  });
}
