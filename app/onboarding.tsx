import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Dimensions, KeyboardAvoidingView, Platform,
  SafeAreaView, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { requestNotificationPermissions, saveReminderSettings, scheduleDailyReminder } from '../notifications';
import { markOnboardingComplete, saveProfile } from '../storage';

const { width: W } = Dimensions.get('window');
const V_GRADES = ['VB', 'V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10', 'V11', 'V12', 'V13+'];

const FEATURE_SLIDES = [
  {
    key: 'session',
    icon: 'trending-up-outline' as const,
    iconBg: '#4895EF',
    tag: 'Session Tracking',
    title: 'Know the Real Cost of Every Session',
    body: 'Log grades and hold types after each climb. Your Relative Effort Score (RES) cuts through guesswork — so you stop repeating the sessions that broke you.',
    stat: '73% of climbing injuries come from doing too much, too soon.',
    statIcon: 'alert-circle-outline' as const,
  },
  {
    key: 'checkin',
    icon: 'body-outline' as const,
    iconBg: '#52B788',
    tag: 'Daily Check-In',
    title: 'Catch Problems Before They Become Injuries',
    body: 'A 30-second morning check-in tracks soreness, pain areas, and finger condition. Your Daily Readiness Score tells you exactly when to push and when to hold back.',
    stat: 'Climbers who track body signals recover 2× faster.',
    statIcon: 'flash-outline' as const,
  },
  {
    key: 'health',
    icon: 'pulse-outline' as const,
    iconBg: '#9B5DE5',
    tag: 'Climber Health Index',
    title: 'One Score. Total Clarity.',
    body: 'CHI combines your readiness, training load, and injury signals into a single number. No more second-guessing — you always know if today is a send day or a rest day.',
    stat: 'Consistent check-ins improve performance plateaus in 4–6 weeks.',
    statIcon: 'ribbon-outline' as const,
  },
];

const REMINDER_HOURS = [6, 7, 8, 9, 10, 18, 19, 20, 21];
function formatHour(h: number) {
  const suffix = h >= 12 ? 'PM' : 'AM';
  const display = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${display}:00 ${suffix}`;
}

// welcome + features + notifications + setup + ready
const TOTAL_SLIDES = 1 + FEATURE_SLIDES.length + 1 + 1 + 1;

export default function OnboardingScreen() {
  const scrollRef = useRef<ScrollView>(null);
  const [slide, setSlide] = useState(0);
  const [name, setName] = useState('');
  const [maxGrade, setMaxGrade] = useState<string | null>(null);
  const [projectGrade, setProjectGrade] = useState<string | null>(null);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderHour, setReminderHour] = useState(8);
  const [saving, setSaving] = useState(false);

  const notifSlide = 1 + FEATURE_SLIDES.length;       // index 4
  const setupSlide = notifSlide + 1;                   // index 5
  const readySlide = setupSlide + 1;                   // index 6
  const isSetupSlide = slide === setupSlide;
  const isReadySlide = slide === readySlide;
  const isNotifSlide = slide === notifSlide;
  const maxIndex = maxGrade ? V_GRADES.indexOf(maxGrade) : -1;
  const projectGrades = maxGrade ? V_GRADES.slice(maxIndex) : [];
  const canProceedSetup = !!maxGrade && !!projectGrade;

  const goTo = (n: number) => {
    setSlide(n);
    scrollRef.current?.scrollTo({ x: W * n, animated: true });
  };

  const goNext = () => goTo(slide + 1);

  const handleNotifChoice = async (enable: boolean) => {
    Haptics.selectionAsync();
    if (enable) {
      const granted = await requestNotificationPermissions();
      if (granted) {
        setReminderEnabled(true);
        await saveReminderSettings({ enabled: true, hour: reminderHour, minute: 0 });
        await scheduleDailyReminder(reminderHour, 0);
      }
    } else {
      setReminderEnabled(false);
    }
    goNext();
  };

  const handleFinish = async () => {
    if (!canProceedSetup || saving) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSaving(true);
    await saveProfile({ name: name.trim() || 'Climber', maxGrade: maxGrade!, projectGrade: projectGrade! });
    await markOnboardingComplete();
    goNext();
  };

  const handleMaxGrade = (grade: string) => {
    Haptics.selectionAsync();
    setMaxGrade(grade);
    if (projectGrade && V_GRADES.indexOf(projectGrade) < V_GRADES.indexOf(grade)) {
      setProjectGrade(null);
    }
  };

  const handleStart = () => {
    router.replace('/signin');
  };

  return (
    <SafeAreaView style={s.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
          style={{ flex: 1 }}
        >

          {/* ── Slide 0: Welcome ── */}
          <View style={s.slide}>
            <View style={s.welcomeTop}>
              <View style={s.logoMark}>
                <Text style={s.logoX}>✕</Text>
              </View>
              <Text style={s.welcomeTitle}>CRUX</Text>
              <Text style={s.welcomeTag}>Climb smart. Recover faster.</Text>
            </View>
            <View style={s.welcomeHook}>
              <View style={s.hookCard}>
                <Text style={s.hookStat}>1 in 2</Text>
                <Text style={s.hookDesc}>
                  boulderers get injured every year — almost always from poor load management.{'\n\n'}
                  Crux is the daily habit that keeps you climbing.
                </Text>
              </View>
            </View>
          </View>

          {/* ── Feature slides ── */}
          {FEATURE_SLIDES.map((fs) => (
            <View key={fs.key} style={s.slide}>
              <View style={s.featureTop}>
                <View style={[s.iconCircle, { backgroundColor: fs.iconBg }]}>
                  <Ionicons name={fs.icon} size={48} color="#fff" />
                </View>
                <View style={[s.tagPill, { backgroundColor: fs.iconBg + '22' }]}>
                  <Text style={[s.tagText, { color: fs.iconBg }]}>{fs.tag}</Text>
                </View>
                <Text style={s.featureTitle}>{fs.title}</Text>
                <Text style={s.featureBody}>{fs.body}</Text>
              </View>
              <View style={s.statCard}>
                <Ionicons name={fs.statIcon} size={16} color="#C8622A" style={{ marginTop: 1 }} />
                <Text style={s.statText}>{fs.stat}</Text>
              </View>
            </View>
          ))}

          {/* ── Notifications slide ── */}
          <View style={s.slide}>
            <View style={s.notifTop}>
              <View style={[s.iconCircle, { backgroundColor: '#F4845F' }]}>
                <Ionicons name="notifications-outline" size={48} color="#fff" />
              </View>
              <Text style={s.featureTitle}>Build the Habit</Text>
              <Text style={s.featureBody}>
                A daily check-in takes 30 seconds. Climbers with reminders log 4× more consistently — and catch injuries before they happen.
              </Text>
            </View>

            <View style={s.notifOptions}>
              <Text style={s.notifLabel}>Remind me at</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hourRow}>
                {REMINDER_HOURS.map(h => (
                  <TouchableOpacity
                    key={h}
                    style={[s.hourChip, reminderHour === h && s.hourChipActive]}
                    onPress={() => { Haptics.selectionAsync(); setReminderHour(h); }}
                  >
                    <Text style={[s.hourChipText, reminderHour === h && s.hourChipTextActive]}>
                      {formatHour(h)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TouchableOpacity style={s.notifYes} onPress={() => handleNotifChoice(true)}>
                <Text style={s.notifYesText}>Turn on reminders →</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.notifSkip} onPress={() => handleNotifChoice(false)}>
                <Text style={s.notifSkipText}>Skip for now</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Setup slide ── */}
          <View style={[s.slide, { width: W }]}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={s.setupScroll}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
            >
              <Text style={s.setupTitle}>Set Up Your Profile</Text>
              <Text style={s.setupSubtitle}>Personalises your scores and tracks your progress from day one.</Text>

              <Text style={s.fieldLabel}>Your name <Text style={s.optional}>(optional)</Text></Text>
              <TextInput
                style={s.nameInput}
                value={name}
                onChangeText={setName}
                placeholder="e.g. Alex"
                placeholderTextColor="#B8B0A8"
                autoCapitalize="words"
                returnKeyType="done"
                maxLength={30}
              />

              <Text style={s.fieldLabel}>Highest grade you climb confidently</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.gradeScroll} contentContainerStyle={s.gradeRow} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                {V_GRADES.map(g => {
                  const sel = maxGrade === g;
                  return (
                    <TouchableOpacity key={g} style={[s.gradeChip, sel && s.gradeChipSelected]} onPress={() => handleMaxGrade(g)}>
                      <Text style={[s.gradeChipText, sel && s.gradeChipTextSelected]}>{g}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={s.fieldLabel}>What are you projecting?</Text>
              {!maxGrade ? (
                <Text style={s.gradeHint}>Select your level above first</Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.gradeScroll} contentContainerStyle={s.gradeRow} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                  {projectGrades.map(g => {
                    const sel = projectGrade === g;
                    return (
                      <TouchableOpacity key={g} style={[s.gradeChip, sel && s.gradeChipSelected]} onPress={() => { Haptics.selectionAsync(); setProjectGrade(g); }}>
                        <Text style={[s.gradeChipText, sel && s.gradeChipTextSelected]}>{g}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}

              <View style={{ height: 120 }} />
            </ScrollView>
          </View>

          {/* ── Ready slide ── */}
          <View style={s.slide}>
            <View style={s.readyTop}>
              <View style={s.readyCheck}>
                <Ionicons name="checkmark" size={44} color="#fff" />
              </View>
              <Text style={s.readyTitle}>You're all set{name.trim() ? `, ${name.trim()}` : ''}.</Text>
              <Text style={s.readySubtitle}>
                Your profile is ready. Here's how to start:
              </Text>
            </View>
            <View style={s.readySteps}>
              {[
                { icon: 'body-outline' as const, color: '#52B788', step: '1', text: 'Log your first check-in — how does your body feel today?' },
                { icon: 'barbell-outline' as const, color: '#4895EF', step: '2', text: 'After your next climb, log the session to get your RES score.' },
                { icon: 'pulse-outline' as const, color: '#9B5DE5', step: '3', text: 'Check your CHI on the home screen — it updates every day.' },
              ].map(item => (
                <View key={item.step} style={s.readyStep}>
                  <View style={[s.readyStepIcon, { backgroundColor: item.color + '22' }]}>
                    <Ionicons name={item.icon} size={20} color={item.color} />
                  </View>
                  <Text style={s.readyStepText}>{item.text}</Text>
                </View>
              ))}
            </View>
          </View>

        </ScrollView>

        {/* ── Bottom bar ── */}
        {!isNotifSlide && (
          <View style={s.bottomBar}>
            <View style={s.dots}>
              {Array.from({ length: TOTAL_SLIDES }).map((_, i) => (
                <View key={i} style={[s.dot, i === slide && s.dotActive]} />
              ))}
            </View>

            {isReadySlide ? (
              <TouchableOpacity style={s.btn} onPress={handleStart}>
                <Text style={s.btnText}>Start Your First Check-In →</Text>
              </TouchableOpacity>
            ) : isSetupSlide ? (
              <TouchableOpacity
                style={[s.btn, !canProceedSetup && s.btnDisabled]}
                onPress={handleFinish}
                disabled={!canProceedSetup || saving}
              >
                <Text style={s.btnText}>{saving ? 'Setting up…' : "Save & Continue →"}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={s.btn} onPress={goNext}>
                <Text style={s.btnText}>{slide === 0 ? 'Get Started →' : 'Next →'}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F0ED' },
  slide: { width: W, flex: 1 },

  // Welcome
  welcomeTop: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingTop: 20 },
  logoMark: { width: 72, height: 72, borderRadius: 20, backgroundColor: '#C8622A', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  logoX: { fontSize: 36, fontWeight: '900', color: '#fff' },
  welcomeTitle: { fontSize: 44, fontWeight: '900', color: '#1A1714', letterSpacing: 6, marginBottom: 8 },
  welcomeTag: { fontSize: 14, color: '#8A837A', fontWeight: '600', letterSpacing: 0.5, textAlign: 'center' },
  welcomeHook: { paddingHorizontal: 28, paddingBottom: 28 },
  hookCard: { backgroundColor: '#fff', borderRadius: 20, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 12, elevation: 3 },
  hookStat: { fontSize: 48, fontWeight: '900', color: '#C8622A', letterSpacing: -2, marginBottom: 10 },
  hookDesc: { fontSize: 14, color: '#8A837A', lineHeight: 22 },

  // Feature slides
  featureTop: { flex: 1, paddingHorizontal: 32, paddingTop: 40, gap: 16 },
  iconCircle: { width: 96, height: 96, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  tagPill: { alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  tagText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  featureTitle: { fontSize: 28, fontWeight: '800', color: '#1A1714', letterSpacing: -0.5, lineHeight: 34 },
  featureBody: { fontSize: 15, color: '#8A837A', lineHeight: 24 },
  statCard: { flexDirection: 'row', gap: 10, marginHorizontal: 28, marginBottom: 28, backgroundColor: '#FFF4EE', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#EDCBB8', alignItems: 'flex-start' },
  statText: { flex: 1, fontSize: 12, fontWeight: '600', color: '#9A4818', lineHeight: 18 },

  // Notifications
  notifTop: { flex: 1, paddingHorizontal: 32, paddingTop: 40, gap: 16 },
  notifOptions: { paddingHorizontal: 28, paddingBottom: 28, gap: 12 },
  notifLabel: { fontSize: 11, fontWeight: '800', color: '#8A837A', letterSpacing: 1, textTransform: 'uppercase' },
  hourRow: { gap: 8, paddingRight: 4 },
  hourChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E8E6E1' },
  hourChipActive: { backgroundColor: '#C8622A', borderColor: '#C8622A' },
  hourChipText: { fontSize: 13, fontWeight: '700', color: '#8A837A' },
  hourChipTextActive: { color: '#fff' },
  notifYes: { backgroundColor: '#1A1714', padding: 16, borderRadius: 14, alignItems: 'center' },
  notifYesText: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },
  notifSkip: { padding: 12, alignItems: 'center' },
  notifSkipText: { color: '#B8B0A8', fontSize: 13, fontWeight: '600' },

  // Setup
  setupScroll: { paddingHorizontal: 28, paddingTop: 32 },
  setupTitle: { fontSize: 28, fontWeight: '800', color: '#1A1714', letterSpacing: -0.5, marginBottom: 8 },
  setupSubtitle: { fontSize: 14, color: '#8A837A', lineHeight: 20, marginBottom: 28 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#8A837A', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 10 },
  nameInput: {
    backgroundColor: '#FFFFFF', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, color: '#1A1714', fontWeight: '600',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
    marginBottom: 28,
  },
  gradeScroll: { marginBottom: 28 },
  gradeRow: { gap: 8, paddingRight: 28 },
  gradeHint: { color: '#B8B0A8', fontSize: 13, marginBottom: 28, fontStyle: 'italic' },
  gradeChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#E8E6E1' },
  gradeChipSelected: { backgroundColor: '#C8622A', borderColor: '#C8622A' },
  gradeChipText: { fontSize: 14, fontWeight: '700', color: '#8A837A' },
  gradeChipTextSelected: { color: '#FFFFFF' },
  optional: { fontSize: 10, fontWeight: '400', color: '#B8B0A8', textTransform: 'none', letterSpacing: 0 },

  // Ready
  readyTop: { flex: 1, paddingHorizontal: 32, paddingTop: 48, gap: 16 },
  readyCheck: { width: 80, height: 80, borderRadius: 24, backgroundColor: '#52B788', justifyContent: 'center', alignItems: 'center' },
  readyTitle: { fontSize: 30, fontWeight: '900', color: '#1A1714', letterSpacing: -0.5, lineHeight: 36 },
  readySubtitle: { fontSize: 14, color: '#8A837A', lineHeight: 22 },
  readySteps: { paddingHorizontal: 28, paddingBottom: 12, gap: 12 },
  readyStep: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, backgroundColor: '#fff', borderRadius: 14, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  readyStepIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  readyStepText: { flex: 1, fontSize: 13, color: '#3A342E', lineHeight: 20, fontWeight: '500' },

  // Bottom bar
  bottomBar: { paddingHorizontal: 28, paddingBottom: 24, paddingTop: 12, backgroundColor: '#F2F0ED' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 18 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#D8D4CE' },
  dotActive: { width: 20, backgroundColor: '#C8622A', borderRadius: 3 },
  btn: { backgroundColor: '#1A1714', padding: 16, borderRadius: 14, alignItems: 'center' },
  btnDisabled: { opacity: 0.35 },
  btnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },
});
