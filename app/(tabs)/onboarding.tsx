import { useState, useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { saveProfile } from '../../storage';

const V_GRADES = ['VB', 'V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10', 'V11', 'V12'];

export default function OnboardingScreen() {
  const { t } = useLocalSearchParams();
  const [step, setStep] = useState(1);
  const [maxGrade, setMaxGrade] = useState(null);
  const [projectGrade, setProjectGrade] = useState(null);
  const router = useRouter();

  useEffect(() => {
    setStep(1);
    setMaxGrade(null);
    setProjectGrade(null);
  }, [t]);

  const maxIndex = maxGrade ? V_GRADES.indexOf(maxGrade) : 0;
  const availableProjectGrades = V_GRADES.slice(maxIndex);

  const handleSave = async () => {
    await saveProfile({
      maxGrade,
      projectGrade,
    });
    router.push('/(tabs)');
  };

  if (step === 1) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>What is your current max grade?</Text>
        <Text style={styles.subtitle}>Select the hardest boulder you have sent</Text>
        <View style={styles.gradeGrid}>
          {V_GRADES.map((grade) => (
            <TouchableOpacity
              key={grade}
              style={[styles.gradeButton, maxGrade === grade && styles.selectedButton]}
              onPress={() => setMaxGrade(grade)}
            >
              <Text style={[styles.gradeText, maxGrade === grade && styles.selectedText]}>
                {grade}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {maxGrade && (
          <TouchableOpacity style={styles.continueButton} onPress={() => setStep(2)}>
            <Text style={styles.continueText}>Continue</Text>
          </TouchableOpacity>
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>What are you projecting?</Text>
      <Text style={styles.subtitle}>Select the grade you are working toward</Text>
      <View style={styles.gradeGrid}>
        {availableProjectGrades.map((grade) => (
          <TouchableOpacity
            key={grade}
            style={[styles.gradeButton, projectGrade === grade && styles.selectedButton]}
            onPress={() => setProjectGrade(grade)}
          >
            <Text style={[styles.gradeText, projectGrade === grade && styles.selectedText]}>
              {grade}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {projectGrade && (
        <TouchableOpacity style={styles.continueButton} onPress={handleSave}>
          <Text style={styles.continueText}>Save & Continue</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 40,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#888888',
    marginBottom: 32,
  },
  gradeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gradeButton: {
    width: '22%',
    aspectRatio: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  selectedButton: {
    backgroundColor: '#00b4d8',
    borderColor: '#00b4d8',
  },
  gradeText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  selectedText: {
    color: '#ffffff',
  },
  continueButton: {
    backgroundColor: '#00b4d8',
    padding: 18,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 32,
  },
  continueText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});