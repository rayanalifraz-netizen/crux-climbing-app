import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Dimensions, Image, KeyboardAvoidingView, Platform,
  SafeAreaView, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { markOnboardingComplete, saveProfile } from '../storage';

const { width: W } = Dimensions.get('window');
const V_GRADES = ['VB', 'V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10', 'V11', 'V12'];

const FEATURE_SLIDES = [
  {
    key: 'session',
    icon: 'trending-up-outline' as const,
    iconBg: '#4895EF',
    tag: 'Session Tracking',
    title: 'Log Every Session',
    body: 'Track grades climbed and hold types. Your Relative Effort Score (RES) shows the true cost of each session so you never overtrain blind.',
  },
  {
    key: 'checkin',
    icon: 'body-outline' as const,
    iconBg: '#52B788',
    tag: 'Body Awareness',
    title: 'Check In Daily',
    body: 'Log soreness, pain areas, and finger condition each morning. Your Daily Readiness Score (DRS) tells you when to push hard and when to back off.',
  },
  {
    key: 'health',
    icon: 'fitness-outline' as const,
    iconBg: '#9B5DE5',
    tag: 'Smart Scoring',
    title: 'Your Health at a Glance',
    body: 'The Climber Health Index (CHI) combines readiness, training load, and injury signals into one score so you always know where your body stands.',
  },
];

const TOTAL_SLIDES = FEATURE_SLIDES.length + 2; // welcome + features + setup

export default function OnboardingScreen() {
  const scrollRef = useRef<ScrollView>(null);
  const [slide, setSlide] = useState(0);
  const [name, setName] = useState('');
  const [maxGrade, setMaxGrade] = useState<string | null>(null);
  const [projectGrade, setProjectGrade] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const maxIndex = maxGrade ? V_GRADES.indexOf(maxGrade) : -1;
  const projectGrades = maxGrade ? V_GRADES.slice(maxIndex) : [];

  const isSetupSlide = slide === TOTAL_SLIDES - 1;
  const canFinish = isSetupSlide && !!maxGrade && !!projectGrade;

  const goNext = () => {
    const next = slide + 1;
    setSlide(next);
    scrollRef.current?.scrollTo({ x: W * next, animated: true });
  };

  const handleFinish = async () => {
    if (!canFinish || saving) return;
    setSaving(true);
    await saveProfile({ name: name.trim() || 'Climber', maxGrade: maxGrade!, projectGrade: projectGrade! });
    await markOnboardingComplete();
    router.replace('/(tabs)');
  };

  const handleMaxGrade = (grade: string) => {
    setMaxGrade(grade);
    // Reset project grade if it's now below max
    if (projectGrade && V_GRADES.indexOf(projectGrade) < V_GRADES.indexOf(grade)) {
      setProjectGrade(null);
    }
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
            <View style={s.welcomeVisual}>
              <Image
                source={require('../assets/images/splash-icon.png')}
                style={s.welcomeImage}
                resizeMode="contain"
              />
            </View>
            <View style={s.textBlock}>
              <Text style={s.welcomeTitle}>CRUX</Text>
              <Text style={s.welcomeSubtitle}>
                The climbing recovery app built for boulderers who want to train smarter, not harder.
              </Text>
            </View>
          </View>

          {/* ── Feature slides ── */}
          {FEATURE_SLIDES.map((fs) => (
            <View key={fs.key} style={s.slide}>
              <View style={s.featureVisual}>
                <View style={[s.iconCircle, { backgroundColor: fs.iconBg }]}>
                  <Ionicons name={fs.icon} size={52} color="#fff" />
                </View>
              </View>
              <View style={s.textBlock}>
                <View style={[s.tagPill, { backgroundColor: fs.iconBg + '22' }]}>
                  <Text style={[s.tagText, { color: fs.iconBg }]}>{fs.tag}</Text>
                </View>
                <Text style={s.featureTitle}>{fs.title}</Text>
                <Text style={s.featureBody}>{fs.body}</Text>
              </View>
            </View>
          ))}

          {/* ── Setup slide ── */}
          <View style={[s.slide, { width: W }]}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={s.setupScroll}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
            >
              <Text style={s.setupTitle}>Set Up Your Profile</Text>
              <Text style={s.setupSubtitle}>This helps Crux personalise your scores and track your progress.</Text>

              {/* Name */}
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

              {/* Max grade */}
              <Text style={s.fieldLabel}>Hardest grade you've sent</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.gradeScroll} contentContainerStyle={s.gradeRow} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                {V_GRADES.map(g => {
                  const sel = maxGrade === g;
                  return (
                    <TouchableOpacity
                      key={g}
                      style={[s.gradeChip, sel && s.gradeChipSelected]}
                      onPress={() => handleMaxGrade(g)}
                    >
                      <Text style={[s.gradeChipText, sel && s.gradeChipTextSelected]}>{g}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Project grade */}
              <Text style={s.fieldLabel}>What are you projecting?</Text>
              {!maxGrade ? (
                <Text style={s.gradeHint}>Select your level first</Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.gradeScroll} contentContainerStyle={s.gradeRow} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                  {projectGrades.map(g => {
                    const sel = projectGrade === g;
                    return (
                      <TouchableOpacity
                        key={g}
                        style={[s.gradeChip, sel && s.gradeChipSelected]}
                        onPress={() => setProjectGrade(g)}
                      >
                        <Text style={[s.gradeChipText, sel && s.gradeChipTextSelected]}>{g}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}

              <View style={{ height: 120 }} />
            </ScrollView>
          </View>

        </ScrollView>

        {/* ── Bottom bar (progress dots + button) ── */}
        <View style={s.bottomBar}>
          {/* Dots */}
          <View style={s.dots}>
            {Array.from({ length: TOTAL_SLIDES }).map((_, i) => (
              <View key={i} style={[s.dot, i === slide && s.dotActive]} />
            ))}
          </View>

          {isSetupSlide ? (
            <TouchableOpacity
              style={[s.btn, !canFinish && s.btnDisabled]}
              onPress={handleFinish}
              disabled={!canFinish || saving}
            >
              <Text style={s.btnText}>{saving ? 'Setting up…' : "Let's climb →"}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={s.btn} onPress={goNext}>
              <Text style={s.btnText}>{slide === 0 ? 'Get Started →' : 'Next →'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F0ED' },
  slide: { width: W, flex: 1 },

  // Welcome
  welcomeVisual: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 20 },
  welcomeImage: { width: 200, height: 200 },
  welcomeTitle: { fontSize: 44, fontWeight: '900', color: '#C8622A', letterSpacing: 5, textAlign: 'center', marginBottom: 14 },
  welcomeSubtitle: { fontSize: 16, color: '#8A837A', lineHeight: 24, textAlign: 'center' },

  // Feature slides
  featureVisual: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  iconCircle: { width: 120, height: 120, borderRadius: 60, justifyContent: 'center', alignItems: 'center' },
  tagPill: { alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, marginBottom: 14 },
  tagText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  featureTitle: { fontSize: 30, fontWeight: '800', color: '#1A1714', letterSpacing: -0.5, marginBottom: 14, lineHeight: 36 },
  featureBody: { fontSize: 15, color: '#8A837A', lineHeight: 24 },

  // Shared text block
  textBlock: { paddingHorizontal: 32, paddingBottom: 16 },

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
  gradeChip: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10,
    backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#E8E6E1',
  },
  gradeChipSelected: { backgroundColor: '#C8622A', borderColor: '#C8622A' },
  gradeChipText: { fontSize: 14, fontWeight: '700', color: '#8A837A' },
  gradeChipTextSelected: { color: '#FFFFFF' },
  optional: { fontSize: 10, fontWeight: '400', color: '#B8B0A8', textTransform: 'none', letterSpacing: 0 },

  // Bottom bar
  bottomBar: { paddingHorizontal: 28, paddingBottom: 24, paddingTop: 12, backgroundColor: '#F2F0ED' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 18 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#D8D4CE' },
  dotActive: { width: 20, backgroundColor: '#C8622A', borderRadius: 3 },
  btn: { backgroundColor: '#1A1714', padding: 16, borderRadius: 14, alignItems: 'center' },
  btnDisabled: { opacity: 0.35 },
  btnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },
});
