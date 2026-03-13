import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Modal, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { getProfile, saveProfile } from '../../storage';

const V_GRADES = ['VB', 'V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10', 'V11', 'V12'];

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
            <Ionicons name="close" size={20} color="#888" />
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

function SettingsRow({ icon, iconColor = '#888', iconBg = '#1e1e22', label, sublabel, onPress, chevron = true, destructive = false }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress}>
      <View style={[styles.rowIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={17} color={iconColor} />
      </View>
      <View style={styles.rowContent}>
        <Text style={[styles.rowLabel, destructive && styles.rowLabelDestructive]}>{label}</Text>
        {sublabel && <Text style={styles.rowSublabel}>{sublabel}</Text>}
      </View>
      {chevron && <Ionicons name="chevron-forward" size={16} color="#333" />}
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
    await saveProfile({ maxGrade, projectGrade });
    setModalVisible(false);
    await loadProfile();
  };

  const clearTodaySession = () => {
    Alert.alert("Clear Today's Session", "This will delete today's session so you can re-log it.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear', style: 'destructive', onPress: async () => {
          const today = new Date().toISOString().split('T')[0];
          const data = await AsyncStorage.getItem('sessions');
          const sessions = data ? JSON.parse(data) : {};
          delete sessions[today];
          await AsyncStorage.setItem('sessions', JSON.stringify(sessions));
        }
      }
    ]);
  };

  const clearTodayCheckIn = () => {
    Alert.alert("Clear Today's Check-in", "This will delete today's check-in so you can re-log it.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear', style: 'destructive', onPress: async () => {
          const today = new Date().toISOString().split('T')[0];
          const data = await AsyncStorage.getItem('checkins');
          const checkIns = data ? JSON.parse(data) : {};
          delete checkIns[today];
          await AsyncStorage.setItem('checkins', JSON.stringify(checkIns));
        }
      }
    ]);
  };

  const clearAllData = () => {
    Alert.alert(
      'Clear All Data',
      'This permanently deletes all sessions, check-ins, and your profile. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything', style: 'destructive', onPress: async () => {
            await AsyncStorage.clear();
            setProfile(null);
          }
        }
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

        {/* Profile Card */}
        <View style={styles.profileCard}>
            <View style={styles.profileAvatar}>
                <Ionicons name="person-outline" size={28} color="#00b4d8" />
            </View>
            <View style={styles.profileInfo}>
                {editingName ? (
                    <TextInput
                    style={styles.nameInput}
                    value={nameInput}
                    onChangeText={setNameInput}
                    placeholder="Enter your name"
                    placeholderTextColor="#333"
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
      <Text style={[styles.profileEditBtnText, { color: '#00b4d8' }]}>Save</Text>
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
              <Text style={styles.gradeDisplayLabel}>LEVEL</Text>
              <Text style={styles.gradeDisplayValue}>{profile?.maxGrade ?? '—'}</Text>
            </View>
            <View style={styles.gradeDisplayArrow}>
              <Ionicons name="arrow-forward" size={16} color="#2a2a2e" />
            </View>
            <View style={styles.gradeDisplayItem}>
              <Text style={styles.gradeDisplayLabel}>PROJECT</Text>
              <Text style={[styles.gradeDisplayValue, { color: '#00b4d8' }]}>{profile?.projectGrade ?? '—'}</Text>
            </View>
          </View>
          <View style={styles.cardDivider} />
          <SettingsRow
            icon="pencil-outline"
            iconColor="#00b4d8"
            iconBg="#001e2e"
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
            iconColor="#f4a261"
            iconBg="#2a1800"
            label="Clear Today's Session"
            sublabel="Re-log today's climbing session"
            onPress={clearTodaySession}
          />
          <View style={styles.cardDivider} />
          <SettingsRow
            icon="refresh-outline"
            iconColor="#f4a261"
            iconBg="#2a1800"
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
            iconColor="#e63946"
            iconBg="#2a0808"
            label="Clear All Data"
            sublabel="Permanently delete everything"
            onPress={clearAllData}
            destructive
          />
        </View>

        {/* App Info */}
        <View style={styles.appInfo}>
          <View style={styles.appInfoLogo}>
            <Ionicons name="trending-up-outline" size={20} color="#333" />
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
  container: { flex: 1, backgroundColor: '#0d0d0f' },
  scrollContent: { padding: 20, paddingBottom: 48 },

  header: { marginTop: 16, marginBottom: 28 },
  greeting: { fontSize: 13, color: '#555', fontWeight: '500', letterSpacing: 0.3, marginBottom: 4 },
  title: { fontSize: 30, fontWeight: '800', color: '#ffffff', letterSpacing: -0.5 },

  profileCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#141416', borderRadius: 20, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: '#1e1e22', gap: 14 },
  profileAvatar: { width: 52, height: 52, borderRadius: 16, backgroundColor: '#001e2e', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#003d4d' },
  profileInfo: { flex: 1 },
  profileName: { color: '#ffffff', fontSize: 16, fontWeight: '700', marginBottom: 3 },
  profileGrades: { color: '#444', fontSize: 13 },
  profileEditBtn: { backgroundColor: '#1e1e22', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7 },
  profileEditBtnText: { color: '#888', fontSize: 13, fontWeight: '600' },

  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#333', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8, marginLeft: 4 },

  card: { backgroundColor: '#141416', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 4, marginBottom: 24, borderWidth: 1, borderColor: '#1e1e22' },
  dangerCard: { borderColor: '#2a0808' },

  gradeDisplay: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 20, gap: 24 },
  gradeDisplayItem: { alignItems: 'center' },
  gradeDisplayLabel: { fontSize: 10, fontWeight: '700', color: '#333', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 },
  gradeDisplayValue: { fontSize: 36, fontWeight: '800', color: '#ffffff' },
  gradeDisplayArrow: { paddingTop: 8 },
  cardDivider: { height: 1, backgroundColor: '#1e1e22', marginHorizontal: -16 },

  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 14 },
  rowIcon: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  rowContent: { flex: 1 },
  rowLabel: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  rowLabelDestructive: { color: '#e63946' },
  rowSublabel: { color: '#444', fontSize: 12, marginTop: 2 },

  appInfo: { alignItems: 'center', gap: 4, paddingTop: 8 },
  appInfoLogo: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#141416', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#1e1e22', marginBottom: 8 },
  appInfoName: { color: '#333', fontSize: 15, fontWeight: '800' },
  appInfoTagline: { color: '#2a2a2e', fontSize: 12 },
  appInfoVersion: { color: '#222', fontSize: 11, marginTop: 2 },
  nameInput: { color: '#ffffff', fontSize: 16, fontWeight: '700', borderBottomWidth: 1, borderBottomColor: '#00b4d8', paddingBottom: 2, minWidth: 120 },
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