import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { getOnboardingComplete, getProfile, markOnboardingComplete } from '../storage';

export default function Index() {
  const [destination, setDestination] = useState<'/(tabs)' | '/onboarding' | null>(null);

  useEffect(() => {
    async function check() {
      const [done, prof] = await Promise.all([getOnboardingComplete(), getProfile()]);
      if (!done && !prof) {
        setDestination('/onboarding');
      } else {
        if (!done) await markOnboardingComplete();
        setDestination('/(tabs)');
      }
    }
    check();
  }, []);

  if (!destination) return <View style={{ flex: 1, backgroundColor: '#F2F0ED' }} />;
  return <Redirect href={destination} />;
}
