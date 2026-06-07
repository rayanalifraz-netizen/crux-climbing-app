import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import Constants from 'expo-constants';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as Updates from 'expo-updates';
import { useEffect, useRef, useState } from 'react';
import { Animated, Image, Linking, StyleSheet, Text, TouchableOpacity } from 'react-native';
import 'react-native-reanimated';
import { ThemeProvider as AppThemeProvider } from '../context/ThemeContext';
import { configureNotifications } from '../notifications';

configureNotifications();

function isNewerVersion(store: string, current: string): boolean {
  const a = store.split('.').map(Number);
  const b = current.split('.').map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return false;
}

async function checkAppStoreVersion(
  setAvailable: (v: boolean) => void,
  setUrl: (v: string) => void,
  bannerOpacity: Animated.Value,
) {
  try {
    const res = await fetch('https://itunes.apple.com/lookup?bundleId=com.cruxapp.crux');
    const data = await res.json();
    const result = data.results?.[0];
    if (!result) return;
    const current = Constants.expoConfig?.version ?? '0.0.0';
    if (isNewerVersion(result.version, current)) {
      setUrl(result.trackViewUrl);
      setAvailable(true);
      Animated.timing(bannerOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    }
  } catch {}
}

async function checkForUpdate(setUpdateReady: (v: boolean) => void, bannerOpacity: Animated.Value) {
  try {
    if (!Updates.isEnabled) return;
    const update = await Updates.checkForUpdateAsync();
    if (update.isAvailable) {
      await Updates.fetchUpdateAsync();
      setUpdateReady(true);
      Animated.timing(bannerOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    }
  } catch {}
}

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
  const [updateReady, setUpdateReady] = useState(false);
  const [storeUpdateAvailable, setStoreUpdateAvailable] = useState(false);
  const [storeUrl, setStoreUrl] = useState('');
  const bannerOpacity = useRef(new Animated.Value(0)).current;
  const storeBannerOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
    checkForUpdate(setUpdateReady, bannerOpacity);
    checkAppStoreVersion(setStoreUpdateAvailable, setStoreUrl, storeBannerOpacity);
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
      {updateReady && (
        <Animated.View style={[styles.updateBanner, { opacity: bannerOpacity }]}>
          <Text style={styles.updateBannerText}>Update ready</Text>
          <TouchableOpacity
            onPress={() => Updates.reloadAsync().catch(() => {})}
            style={styles.updateBannerBtn}
          >
            <Text style={styles.updateBannerBtnText}>Restart now →</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              Animated.timing(bannerOpacity, { toValue: 0, duration: 250, useNativeDriver: true })
                .start(() => setUpdateReady(false));
            }}
            style={styles.updateBannerClose}
          >
            <Text style={styles.updateBannerCloseText}>✕</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
      {storeUpdateAvailable && (
        <Animated.View style={[styles.updateBanner, { opacity: storeBannerOpacity, bottom: updateReady ? 160 : 110 }]}>
          <Text style={styles.updateBannerText}>New version available</Text>
          <TouchableOpacity
            onPress={() => Linking.openURL(storeUrl).catch(() => {})}
            style={styles.updateBannerBtn}
          >
            <Text style={styles.updateBannerBtnText}>Update →</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              Animated.timing(storeBannerOpacity, { toValue: 0, duration: 250, useNativeDriver: true })
                .start(() => setStoreUpdateAvailable(false));
            }}
            style={styles.updateBannerClose}
          >
            <Text style={styles.updateBannerCloseText}>✕</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
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
  updateBanner: {
    position: 'absolute',
    bottom: 110,
    left: 16,
    right: 16,
    backgroundColor: '#1A1A1A',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 10,
  },
  updateBannerText: {
    flex: 1,
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  updateBannerBtn: {
    backgroundColor: '#C8622A',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  updateBannerBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  updateBannerClose: {
    marginLeft: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  updateBannerCloseText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
});
