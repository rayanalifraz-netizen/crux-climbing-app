import * as AppleAuthentication from 'expo-apple-authentication';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Platform, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { restoreFromSupabase, supabase } from '../lib/supabase';
import { useTheme } from '../context/ThemeContext';

export default function SignInScreen() {
  const { C, isDark } = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAppleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      const { error: authError } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken!,
      });

      if (authError) throw authError;

      await restoreFromSupabase();
      router.replace('/(tabs)');
    } catch (e: any) {
      if (e.code !== 'ERR_REQUEST_CANCELED') {
        setError('Sign in failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={s.content}>
        <View style={[s.iconWrap, { backgroundColor: C.surfaceAlt }]}>
          <Ionicons name="cloud-outline" size={36} color="#C8622A" />
        </View>

        <Text style={[s.title, { color: C.ink }]}>Back Up Your Data</Text>
        <Text style={[s.subtitle, { color: C.sand }]}>
          Sign in with Apple to keep your climbing history safe and restore it on any device.
        </Text>

        <View style={s.features}>
          {[
            'Restore data on a new phone',
            'Cloud backup, independent of iCloud',
            'Private — only you can see your data',
          ].map(f => (
            <View key={f} style={s.featureRow}>
              <Text style={s.featureDot}>●</Text>
              <Text style={[s.featureText, { color: C.ink }]}>{f}</Text>
            </View>
          ))}
        </View>

        {error ? <Text style={s.error}>{error}</Text> : null}

        {Platform.OS === 'ios' ? (
          loading ? (
            <View style={s.loadingWrap}>
              <ActivityIndicator color="#C8622A" />
            </View>
          ) : (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={isDark
                ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={14}
              style={s.appleBtn}
              onPress={handleAppleSignIn}
            />
          )
        ) : null}

        <TouchableOpacity style={[s.skipBtn, { borderColor: C.borderLight }]} onPress={handleSkip} disabled={loading}>
          <Text style={[s.skipText, { color: C.sand }]}>Skip for now</Text>
        </TouchableOpacity>

        <Text style={[s.note, { color: C.dust }]}>
          You can always sign in later from the Profile tab.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 48,
    paddingBottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 28,
  },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5, textAlign: 'center', marginBottom: 12 },
  subtitle: { fontSize: 15, lineHeight: 22, textAlign: 'center', marginBottom: 32 },
  features: { alignSelf: 'stretch', gap: 12, marginBottom: 40 },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  featureDot: { color: '#C8622A', fontSize: 8, marginTop: 5 },
  featureText: { fontSize: 14, fontWeight: '600', flex: 1 },
  error: { color: '#D94F2B', fontSize: 13, textAlign: 'center', marginBottom: 16, fontWeight: '600' },
  appleBtn: { width: '100%', height: 52, marginBottom: 16 },
  loadingWrap: { height: 52, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  skipBtn: {
    paddingVertical: 14, paddingHorizontal: 24,
    borderRadius: 14, borderWidth: 1.5,
    width: '100%', alignItems: 'center', marginBottom: 16,
  },
  skipText: { fontSize: 15, fontWeight: '700' },
  note: { fontSize: 12, textAlign: 'center', lineHeight: 18 },
});
