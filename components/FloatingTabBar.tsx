import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Animated, TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useRef, useEffect } from 'react';

const TABS = [
  { name: 'index',    title: 'Profile',   icon: 'person-outline' },
  { name: 'checkin',  title: 'Check In',  icon: 'body-outline' },
  { name: 'session',  title: 'Session',   icon: 'trending-up-outline' },
  { name: 'calendar', title: 'Calendar',  icon: 'calendar-outline' },
  { name: 'heatmap',  title: 'Body',      icon: 'fitness-outline' },
  { name: 'settings', title: 'Settings',  icon: 'settings-outline' },
] as const;

export default function FloatingTabBar({ state, navigation }: any) {
  const { C, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  // animated scale per tab
  const scales = useRef(TABS.map(() => new Animated.Value(1))).current;

  const handlePress = (route: any, index: number, isFocused: boolean) => {
    Haptics.selectionAsync();

    // quick bounce on the tapped tab
    Animated.sequence([
      Animated.timing(scales[index], { toValue: 0.88, duration: 80, useNativeDriver: true }),
      Animated.spring(scales[index], { toValue: 1, useNativeDriver: true, friction: 5 }),
    ]).start();

    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
  };

  const borderColor = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.72)';
  const overlayColor = isDark ? 'rgba(18,16,14,0.38)' : 'rgba(255,255,255,0.22)';
  const activePillBg = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(200,98,42,0.10)';
  const activePillBorder = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(200,98,42,0.22)';

  return (
    <View style={[styles.wrap, { bottom: insets.bottom + 14 }]}>
      {/* outer glow shadow ring */}
      <View style={[styles.glowRing, { borderColor }]}>
        <BlurView
          intensity={isDark ? 70 : 60}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
        {/* colour wash on top of blur */}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: overlayColor, borderRadius: 26 }]} />

        <View style={styles.inner}>
          {state.routes.map((route: any, index: number) => {
            const tab = TABS.find(t => t.name === route.name);
            if (!tab) return null;
            const isFocused = state.index === index;
            const iconColor = isFocused ? C.terra : C.dust;

            return (
              <Animated.View
                key={route.key}
                style={[styles.tabItem, { transform: [{ scale: scales[index] }] }]}
              >
                <TouchableOpacity
                  style={styles.tabTouch}
                  onPress={() => handlePress(route, index, isFocused)}
                  activeOpacity={1}
                >
                  {/* active glass pill */}
                  {isFocused && (
                    <View style={[styles.activePill, { backgroundColor: activePillBg, borderColor: activePillBorder }]} />
                  )}
                  <Ionicons name={tab.icon as any} size={22} color={iconColor} />
                  <Text style={[styles.label, { color: iconColor }]}>{tab.title}</Text>
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 14,
    right: 14,
    borderRadius: 26,
    // drop shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 22,
    elevation: 12,
  },
  glowRing: {
    borderRadius: 26,
    borderWidth: 1,
    overflow: 'hidden',
  },
  inner: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  tabItem: {
    flex: 1,
  },
  tabTouch: {
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
    position: 'relative',
  },
  activePill: {
    position: 'absolute',
    top: 2,
    left: 4,
    right: 4,
    bottom: 2,
    borderRadius: 14,
    borderWidth: 1,
  },
  label: {
    fontSize: 9,
    fontWeight: '700',
    marginTop: 3,
    letterSpacing: 0.2,
  },
});
