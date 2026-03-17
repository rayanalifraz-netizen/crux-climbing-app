import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { getCurrentUser, restoreFromSupabase } from '../lib/supabase';
import { getOnboardingComplete, getProfile, markOnboardingComplete } from '../storage';

export default function Index() {
  const [destination, setDestination] = useState<'/(tabs)' | '/onboarding' | null>(null);

  useEffect(() => {
    async function check() {
      // If already signed in to Supabase, restore any cloud data then go to tabs
      const user = await getCurrentUser();
      if (user) {
        await restoreFromSupabase();
        setDestination('/(tabs)');
        return;
      }

      // Otherwise fall back to local onboarding check
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

  if (!destination) return <View style={{ flex: 1, backgroundColor: '#000000' }} />;
  return <Redirect href={destination} />;
}
