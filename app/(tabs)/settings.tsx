import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Modal, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { clearAllData, deleteCheckInByKey, deleteSessionsByKey, getProfile, getTodayDate, saveProfile } from '../../storage';

const V_GRADES = ['VB', 'V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10', 'V11', 'V12'];

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
  terraDark:  '#8a4a2a',
  amber:      '#d4943a',
  amberBg:    '#261e10',
  red:        '#c44a3a',
  redBg:      '#241410',
  green:      '#6a9a5a',
  greenBg:    '#16201a',
};

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
            <Ionicons name="close" size={18} color={C.dust} />
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

function SettingsRow({ icon, iconColor, iconBg, label, sublabel, onPress, chevron = true, destructive = false }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress}>
      <View style={[styles.rowIcon, { backgroundColor: iconBg || C.surfaceAlt }]}>
        <Ionicons name={icon} size={16} color={iconColor || C.dust} />
      </View>
      <View style={styles.rowContent}>
        <Text style={[styles.rowLabel, destructive && { color: C.red }]}>{label}</Text>
        {sublabel && <Text style={styles.rowSublabel}>{sublabel}</Text>}
      </View>
      {chevron && <Ionicons name="chevron-forward" size={14} color={C.dust} />}
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
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
          <View style={styles.headerRule} />
        </View>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileAvatar}>
            <Ionicons name="person-outline" size={24} color={C.terra} />
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
            <TouchableOpacity style={styles.profileEditBtn} onPress={saveName}>
              <Text style={[styles.profileEditBtnText, { color: C.terra }]}>Save</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.profileEditBtn} onPress={() => { setNameInput(profile?.name || ''); setEditingName(true); }}>
              <Text style={styles.profileEditBtnText}>Edit</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Grades Section */}
        <Text style={styles.sectionLabel}>Grades</Text>
        <View style={styles.card}>
          <View style={styles.gradeDisplay}>
            <View style={styles.gradeDisplayItem}>
              <Text style={styles.gradeDisplayEyebrow}>Level</Text>
              <Text style={styles.gradeDisplayValue}>{profile?.maxGrade ?? '—'}</Text>
            </View>
            <View style={styles.gradeDisplayDivider} />
            <View style={styles.gradeDisplayItem}>
              <Text style={styles.gradeDisplayEyebrow}>Project</Text>
              <Text style={[styles.gradeDisplayValue, { color: C.terra }]}>{profile?.projectGrade ?? '—'}</Text>
            </View>
          </View>
          <View style={styles.cardDivider} />
          <SettingsRow
            icon="pencil-outline"
            iconColor={C.terra}
            iconBg={C.terraBg}
            label="Edit Grades"
            sublabel="Update your climbing level and project"
            onPress={() => setModalVisible(true)}
          />
        </View>

        {/* Data Section */}
        <Text style={styles.sectionLabel}>Data</Text>
        <View style={styles.card}>
          <SettingsRow
            icon="refresh-outline"
            iconColor={C.amber}
            iconBg={C.amberBg}
            label="Clear Today's Session"
            sublabel="Re-log today's climbing session"
            onPress={clearTodaySession}
          />
          <View style={styles.cardDivider} />
          <SettingsRow
            icon="refresh-outline"
            iconColor={C.amber}
            iconBg={C.amberBg}
            label="Clear Today's Check-in"
            sublabel="Re-do today's body check-in"
            onPress={clearTodayCheckIn}
          />
        </View>

        {/* Danger Zone */}
        <Text style={styles.sectionLabel}>Danger Zone</Text>
        <View style={[styles.card, styles.dangerCard]}>
          <SettingsRow
            icon="trash-outline"
            iconColor={C.red}
            iconBg={C.redBg}
            label="Clear All Data"
            sublabel="Permanently delete everything"
            onPress={handleClearAllData}
            destructive
          />
        </View>

        {/* App Info */}
        <View style={styles.appInfo}>
          <View style={styles.appInfoLogo}>
            <Ionicons name="trending-up-outline" size={18} color={C.dust} />
          </View>
          <Text style={styles.appInfoName}>Crux</Text>
          <Text style={styles.appInfoTagline}>Bouldering Recovery Tracker</Text>
          <Text style={styles.appInfoVersion}>Version 1.0.0</Text>
        </View>

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
  headerRule: { height: 1, backgroundColor: C.border, marginTop: 14 },

  profileCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: 14, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: C.border, gap: 14 },
  profileAvatar: { width: 48, height: 48, borderRadius: 14, backgroundColor: C.terraBg, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.terra + '40' },
  profileInfo: { flex: 1 },
  profileName: { color: C.chalk, fontSize: 16, fontWeight: '700', marginBottom: 3 },
  profileGrades: { color: C.dust, fontSize: 12 },
  profileEditBtn: { backgroundColor: C.surfaceAlt, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: C.border },
  profileEditBtnText: { color: C.dust, fontSize: 12, fontWeight: '600' },
  nameInput: { color: C.chalk, fontSize: 15, fontWeight: '700', borderBottomWidth: 1, borderBottomColor: C.terra, paddingBottom: 2, minWidth: 120 },

  sectionLabel: { fontSize: 9, fontWeight: '700', color: C.dust, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8, marginLeft: 2 },

  card: { backgroundColor: C.surface, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 4, marginBottom: 20, borderWidth: 1, borderColor: C.border },
  dangerCard: { borderColor: C.red + '40' },

  gradeDisplay: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 20, gap: 0 },
  gradeDisplayItem: { flex: 1, alignItems: 'center' },
  gradeDisplayEyebrow: { fontSize: 9, fontWeight: '700', color: C.dust, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 },
  gradeDisplayValue: { fontSize: 40, fontWeight: '800', color: C.chalk, letterSpacing: -1 },
  gradeDisplayDivider: { width: 1, height: 50, backgroundColor: C.border },
  cardDivider: { height: 1, backgroundColor: C.border, marginHorizontal: -16 },

  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 14 },
  rowIcon: { width: 32, height: 32, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  rowContent: { flex: 1 },
  rowLabel: { color: C.chalk, fontSize: 14, fontWeight: '600' },
  rowSublabel: { color: C.dust, fontSize: 11, marginTop: 2 },

  appInfo: { alignItems: 'center', gap: 4, paddingTop: 16 },
  appInfoLogo: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.border, marginBottom: 8 },
  appInfoName: { color: C.dust, fontSize: 14, fontWeight: '800', letterSpacing: 2 },
  appInfoTagline: { color: C.dust, fontSize: 11, opacity: 0.6 },
  appInfoVersion: { color: C.dust, fontSize: 10, marginTop: 2, opacity: 0.4 },
});

const modalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  container: { backgroundColor: C.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 48, borderTopWidth: 1, borderColor: C.border },
  handle: { width: 36, height: 3, backgroundColor: C.border, borderRadius: 2, alignSelf: 'center', marginBottom: 24 },
  closeBtn: { position: 'absolute', top: 20, right: 24, width: 30, height: 30, borderRadius: 8, backgroundColor: C.surfaceAlt, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.border },
  title: { fontSize: 20, fontWeight: '800', color: C.chalk, marginBottom: 4, letterSpacing: -0.5 },
  subtitle: { fontSize: 12, color: C.dust, marginBottom: 24 },
  gradeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gradeButton: { width: '22%', aspectRatio: 1, backgroundColor: C.surfaceAlt, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.border },
  selectedButton: { backgroundColor: C.terra, borderColor: C.terra },
  gradeText: { color: C.dust, fontSize: 15, fontWeight: '700' },
  selectedText: { color: C.chalk },
  continueButton: { backgroundColor: C.terra, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 24 },
  continueText: { color: C.chalk, fontSize: 15, fontWeight: '700', letterSpacing: 0.5 },
});