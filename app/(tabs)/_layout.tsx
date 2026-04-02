import { Tabs } from 'expo-router';
import FloatingTabBar from '../../components/FloatingTabBar';

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        lazy: false,
      }}
      sceneContainerStyle={{ paddingBottom: 94 }}
    >
      <Tabs.Screen name="index"    options={{ title: 'Profile' }} />
      <Tabs.Screen name="checkin"  options={{ title: 'Check In' }} />
      <Tabs.Screen name="session"  options={{ title: 'Session' }} />
      <Tabs.Screen name="calendar" options={{ title: 'Calendar' }} />
      <Tabs.Screen name="heatmap"  options={{ title: 'Body' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
