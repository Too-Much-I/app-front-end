import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { ScreenCrashLayout } from '@/components/ui/ScreenCrashLayout';
import type { LearningStackParamList } from '@/navigation/types';
import { LearningHomeScreen } from '@/screens/learning/LearningHomeScreen';
import { LearningSessionScreen } from '@/screens/learning/LearningSessionScreen';
import { AppTypographyProvider } from '@/theme/AppTypographyProvider';

const Stack = createNativeStackNavigator<LearningStackParamList>();
export function LearningStackNavigator() {
  return (
    <AppTypographyProvider variant="system">
      <Stack.Navigator screenLayout={ScreenCrashLayout} screenOptions={{ headerShown: false }}>
        <Stack.Screen name="LearningHome" component={LearningHomeScreen} />
        <Stack.Screen name="LearningSession" component={LearningSessionScreen} />
      </Stack.Navigator>
    </AppTypographyProvider>
  );
}
