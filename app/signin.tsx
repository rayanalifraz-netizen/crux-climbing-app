import * as AppleAuthentication from 'expo-apple-authentication';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { restoreFromSupabase, supabase } from '../lib/supabase';
import { getProfile, saveProfile } from '../storage';
import { useTheme } from '../context/ThemeContext';

export default function SignInScreen() {
  const { C, isDark } = useTheme();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const passwordRef = useRef<TextInput>(null);
  const nameRef = useRef<TextInput>(null);

  const handleEmailAuth = async () => {
    setError(null);
    setSuccessMsg(null);
    if (!email.trim() || !password.trim()) { setError('Enter your email and password.'); return; }
    if (mode === 'signup' && !name.trim()) { setError('Enter your name.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }

    setLoading(true);
    try {
      if (mode === 'signup') {
        const { data, error: signUpError } = await supabase.auth.signUp({ email: email.trim(), password });
        if (signUpError) throw signUpError;

        // Save name locally and to Supabase
        const existing = await getProfile();
        await saveProfile({ ...(existing || { maxGrade: 'V4', projectGrade: 'V6', sendsToUnlock: 10 }), name: name.trim() });

        if (data.session) {
          // Email confirmation disabled — signed in immediately
          await restoreFromSupabase();
          router.replace('/(tabs)');
        } else {
          setSuccessMsg('Check your email to confirm your account, then sign in.');
          setMode('signin');
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (signInError) throw signInError;
        await restoreFromSupabase();
        router.replace('/(tabs)');
      }
    } catch (e: any) {
      const msg = e?.message || '';
      if (msg.includes('Invalid login')) setError('Wrong email or password.');
      else if (msg.includes('Email not confirmed')) setError('Check your email to confirm your account first.');
      else if (msg.includes('already registered')) setError('An account with this email already exists. Sign in instead.');
      else setError(msg || 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

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
      if (e.code !== 'ERR_REQUEST_CANCELED') setError('Apple sign in failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => router.replace('/(tabs)');

  const s = makeStyles(C);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          <View style={s.iconWrap}>
            <Text style={s.iconEmoji}>🧗</Text>
          </View>
          <Text style={s.title}>{mode === 'signup' ? 'Create Account' : 'Welcome Back'}</Text>
          <Text style={s.subtitle}>
            {mode === 'signup'
              ? 'Save your climbing history and join group sessions.'
              : 'Sign in to restore your data and join group sessions.'}
          </Text>

          {/* Apple sign-in */}
          {Platform.OS === 'ios' && (
            <>
              {loading ? (
                <View style={s.loadingWrap}><ActivityIndicator color={C.terra} /></View>
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
              )}
              <View style={s.dividerRow}>
                <View style={s.dividerLine} />
                <Text style={s.dividerText}>or</Text>
                <View style={s.dividerLine} />
              </View>
            </>
          )}

          {/* Email form */}
          <View style={s.form}>
            {mode === 'signup' && (
              <TextInput
                ref={nameRef}
                style={s.input}
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                placeholderTextColor={C.dust}
                autoCapitalize="words"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
              />
            )}
            <TextInput
              style={s.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor={C.dust}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
            <TextInput
              ref={passwordRef}
              style={s.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor={C.dust}
              secureTextEntry
              autoCapitalize="none"
              returnKeyType="done"
              onSubmitEditing={handleEmailAuth}
            />

            {error ? <Text style={s.error}>{error}</Text> : null}
            {successMsg ? <Text style={s.success}>{successMsg}</Text> : null}

            <TouchableOpacity
              style={[s.emailBtn, loading && { opacity: 0.5 }]}
              onPress={handleEmailAuth}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color={C.surface} />
                : <Text style={s.emailBtnText}>{mode === 'signup' ? 'Create Account' : 'Sign In'}</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => { setMode(m => m === 'signin' ? 'signup' : 'signin'); setError(null); setSuccessMsg(null); }}
              style={s.toggleBtn}
            >
              <Text style={s.toggleText}>
                {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
                <Text style={s.toggleLink}>{mode === 'signin' ? 'Create one' : 'Sign in'}</Text>
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={s.skipBtn} onPress={handleSkip} disabled={loading}>
            <Text style={s.skipText}>Skip for now</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles(C: any) {
  return StyleSheet.create({
    content: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 48, paddingBottom: 40, alignItems: 'center' },
    iconWrap: { width: 72, height: 72, borderRadius: 20, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
    iconEmoji: { fontSize: 32 },
    title: { fontSize: 28, fontWeight: '800', color: C.ink, letterSpacing: -0.5, textAlign: 'center', marginBottom: 10 },
    subtitle: { fontSize: 14, color: C.sand, lineHeight: 20, textAlign: 'center', marginBottom: 32, paddingHorizontal: 8 },
    appleBtn: { width: '100%', height: 52, marginBottom: 20 },
    loadingWrap: { height: 52, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
    dividerRow: { flexDirection: 'row', alignItems: 'center', width: '100%', marginBottom: 20, gap: 10 },
    dividerLine: { flex: 1, height: 1, backgroundColor: C.hairline },
    dividerText: { fontSize: 12, color: C.dust, fontWeight: '600' },
    form: { width: '100%', gap: 10, marginBottom: 16 },
    input: { backgroundColor: C.surfaceAlt, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: C.ink, fontWeight: '600' },
    error: { color: C.red, fontSize: 13, fontWeight: '600', textAlign: 'center' },
    success: { color: C.sageText, fontSize: 13, fontWeight: '600', textAlign: 'center', lineHeight: 18 },
    emailBtn: { backgroundColor: C.ink, borderRadius: 14, height: 52, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
    emailBtnText: { color: C.surface, fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },
    toggleBtn: { alignItems: 'center', paddingVertical: 4 },
    toggleText: { fontSize: 13, color: C.dust, fontWeight: '600' },
    toggleLink: { color: C.accentText, fontWeight: '800' },
    skipBtn: { paddingVertical: 14, alignItems: 'center', marginTop: 8 },
    skipText: { fontSize: 14, color: C.dust, fontWeight: '600' },
  });
}
