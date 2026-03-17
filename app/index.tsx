import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { getCurrentUser, restoreFromSupabase } from '../lib/supabase';
import { getOnboardingComplete, getProfile, markOnboardingComplete, purgeFutureDates } from '../storage';

export default function Index() {
  const [destination, setDestination] = useState<'/(tabs)' | '/onboarding' | null>(null);

  useEffect(() => {
    async function check() {
      await purgeFutureDates();
      // If already signed in to Supabase, restore cloud data
      const user = await getCurrentUser();
      if (user) {
        const hasCloudData = await restoreFromSupabase();
        if (hasCloudData) {
          setDestination('/(tabs)');
        } else {
          // Signed in but no cloud data — new account, go through onboarding
          setDestination('/onboarding');
        }
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
