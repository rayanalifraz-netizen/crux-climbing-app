import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Modal, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { AlertSettings, clearAllData, deleteCheckInByKey, deleteSessionsByKey, getAlertSettings, getProfile, getTodayDate, saveAlertSettings, saveProfile } from '../../storage';
import { useTheme } from '../../context/ThemeContext';

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

function AnimatedToggle({ value, onPress }: { value: boolean; onPress: () => void }) {
  const { C } = useTheme();
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: value ? 1 : 0,
      useNativeDriver: true,
      bounciness: 5,
      speed: 20,
    }).start();
  }, [value]);

  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 18] });
  const trackBg = anim.interpolate({ inputRange: [0, 1], outputRange: [C.surfaceAlt, C.terra] });

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <Animated.View style={{
        width: 40, height: 22, borderRadius: 11,
        borderWidth: 1, borderColor: value ? C.terraBorder : C.borderLight,
        backgroundColor: trackBg, justifyContent: 'center', paddingHorizontal: 2,
      }}>
        <Animated.View style={{
          width: 14, height: 14, borderRadius: 7, backgroundColor: value ? '#fff' : C.sand,
          transform: [{ translateX }],
        }} />
      </Animated.View>
    </TouchableOpacity>
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
  const [alertSettings, setAlertSettings] = useState<AlertSettings>({ weeklyLoad: true, injuryOverload: true, bodyHighLoad: true });

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const loadData = async () => {
    const [prof, alerts] = await Promise.all([getProfile(), getAlertSettings()]);
    setProfile(prof);
    if (prof?.name) setNameInput(prof.name);
    setAlertSettings(alerts);
  };

  const toggleAlert = async (key: keyof AlertSettings) => {
    const updated = { ...alertSettings, [key]: !alertSettings[key] };
    setAlertSettings(updated);
    await saveAlertSettings(updated);
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
    await loadData();
  };

  const clearTodaySession = () => {
    Haptics.selectionAsync();
    Alert.alert("Clear Today's Session", "This will delete today's session so you can re-log it.", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: async () => { await deleteSessionsByKey(getTodayDate()); } }
    ]);
  };

  const clearTodayCheckIn = () => {
    Haptics.selectionAsync();
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
        <Card label="Profile">
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
        </Card>

        {/* Appearance */}
        <Card label="Appearance">
          <TouchableOpacity style={styles.row} onPress={() => { Haptics.selectionAsync(); toggleDark(); }}>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Dark Mode</Text>
              <Text style={styles.rowSublabel}>{isDark ? 'On — tap to switch to light' : 'Off — tap to switch to dark'}</Text>
            </View>
            <AnimatedToggle value={isDark} onPress={() => { Haptics.selectionAsync(); toggleDark(); }} />
          </TouchableOpacity>
        </Card>

        {/* Alerts */}
        <Card label="Alerts">
          {[
            {
              key: 'weeklyLoad' as keyof AlertSettings,
              label: 'Weekly Load Warning',
              sublabel: 'Warns when your total weekly effort is very high',
            },
            {
              key: 'injuryOverload' as keyof AlertSettings,
              label: 'Injury Overload',
              sublabel: 'Flags body parts with too many strain signals in 14 days',
            },
            {
              key: 'bodyHighLoad' as keyof AlertSettings,
              label: 'High Body Load',
              sublabel: 'Banner on the Body tab when a part reaches its limit',
            },
          ].map((item, i, arr) => (
            <View key={item.key}>
              <TouchableOpacity style={styles.row} onPress={() => { Haptics.selectionAsync(); toggleAlert(item.key); }}>
                <View style={styles.rowContent}>
                  <Text style={styles.rowLabel}>{item.label}</Text>
                  <Text style={styles.rowSublabel}>{item.sublabel}</Text>
                </View>
                <AnimatedToggle value={alertSettings[item.key]} onPress={() => { Haptics.selectionAsync(); toggleAlert(item.key); }} />
              </TouchableOpacity>
              {i < arr.length - 1 && <View style={styles.rowDivider} />}
            </View>
          ))}
        </Card>

        {/* Grades */}
        <Card label="Grades" accentColor={C.terra} bgColor={C.terraBg} labelColor={C.terra}>
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
        </Card>

        {/* Data */}
        <Card label="Data" accentColor={C.amber} bgColor={C.amberBg} labelColor={C.amber}>
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
        </Card>

        {/* Danger */}
        <Card label="Danger Zone" accentColor={C.red} bgColor={C.redBg} labelColor={C.red}>
          <SettingsRow
            label="Clear All Data"
            sublabel="Permanently delete everything"
            onPress={handleClearAllData}
            destructive
          />
        </Card>

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
    scrollContent: { paddingBottom: 60 },

    header: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 20 },
    greeting: { fontSize: 11, color: C.dust, fontWeight: '600', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 },
    title: { fontSize: 38, fontWeight: '800', color: C.ink, letterSpacing: -1.5, lineHeight: 42 },

    profileInner: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: 14, gap: 14 },
    profileAvatar: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: C.terraBorder, backgroundColor: C.terraBg, justifyContent: 'center', alignItems: 'center' },
    profileAvatarText: { fontSize: 20, fontWeight: '800', color: C.terra },
    profileInfo: { flex: 1 },
    profileName: { color: C.ink, fontSize: 15, fontWeight: '800', marginBottom: 2 },
    profileGrades: { color: C.dust, fontSize: 11 },
    profileBtn: { borderWidth: 1, borderColor: C.borderLight, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
    profileBtnText: { color: C.sand, fontSize: 11, fontWeight: '800' },
    nameInput: { color: C.ink, fontSize: 15, fontWeight: '700', borderBottomWidth: 1, borderBottomColor: C.terraBorder, paddingBottom: 2, minWidth: 120 },

    gradeDisplay: { flexDirection: 'row', paddingHorizontal: 24, paddingVertical: 16 },
    gradeItem: { flex: 1, alignItems: 'center' },
    gradeEyebrow: { fontSize: 10, fontWeight: '700', color: C.terraDark, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
    gradeBig: { fontSize: 40, fontWeight: '800', color: C.ink, letterSpacing: -1 },
    gradeDivider: { width: 1, backgroundColor: C.terraBorder + '40', marginHorizontal: 8 },
    rowDivider: { height: 1, marginHorizontal: 16 },

    row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
    rowContent: { flex: 1 },
    rowLabel: { color: C.ink, fontSize: 13, fontWeight: '700' },
    rowSublabel: { color: C.dust, fontSize: 11, marginTop: 2 },
    rowArrow: { color: C.sand, fontSize: 14, fontWeight: '700' },

    appInfo: { alignItems: 'center', gap: 4, paddingTop: 24, paddingBottom: 8 },
    appInfoBox: { borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8, marginBottom: 8 },
    appInfoName: { color: C.sand, fontSize: 14, fontWeight: '800', letterSpacing: 4 },
    appInfoTagline: { color: C.dust, fontSize: 11 },
    appInfoVersion: { color: C.dust, fontSize: 10, opacity: 0.6 },
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
    subtitle: { fontSize: 12, color: C.dust, marginBottom: 20 },
    gradeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    gradeButton: { width: '22%', aspectRatio: 1, backgroundColor: C.surfaceAlt, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.borderLight },
    selectedButton: { backgroundColor: C.terra, borderColor: C.terra },
    gradeText: { color: C.sand, fontSize: 14, fontWeight: '800' },
    selectedText: { color: '#fff' },
    continueButton: { backgroundColor: C.ink, padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 24 },
    continueText: { color: C.surface, fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },
  });
}
