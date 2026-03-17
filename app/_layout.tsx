import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Animated, Image, StyleSheet, Text } from 'react-native';
import 'react-native-reanimated';
import { ThemeProvider as AppThemeProvider } from '../context/ThemeContext';
import { configureNotifications } from '../notifications';

configureNotifications();

export const unstable_settings = {
  initialRouteName: 'index',
};

function CustomSplash({ onDone }: { onDone: () => void }) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }).start(() => onDone());
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View style={[styles.splash, { opacity }]}>
      <Image
        source={require('../assets/images/splash-icon.png')}
        style={styles.splashImage}
        resizeMode="contain"
      />
      <Text style={styles.splashTitle}>CRUX</Text>
      <Text style={styles.splashSubtitle}>Climbing Recovery</Text>
    </Animated.View>
  );
}

export default function RootLayout() {
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <AppThemeProvider>
      <ThemeProvider value={DefaultTheme}>
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="signin" options={{ headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
      {!splashDone && <CustomSplash onDone={() => setSplashDone(true)} />}
    </AppThemeProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  splashImage: {
    width: 220,
    height: 220,
  },
  splashTitle: {
    marginTop: 28,
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: 8,
    color: '#C8622A',
  },
  splashSubtitle: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 3,
    color: '#6A6560',
    textTransform: 'uppercase',
  },
});
