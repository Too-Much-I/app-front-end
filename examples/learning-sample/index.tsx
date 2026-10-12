import '../../global.css';
import { registerRootComponent } from 'expo';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Text } from '@/components/ui/Text';
import { LearningStackNavigator } from '@/navigation/LearningStackNavigator';
import { AppTypographyProvider } from '@/theme/AppTypographyProvider';
import { useAppFonts } from '@/theme/use-app-fonts';
import { useRemScale } from '@/theme/rem-scale';
import { colors, spacing } from '@/theme';

const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
export function SampleContent() {
  useRemScale();
  const { ready, onLayoutRootView } = useAppFonts();
  if (!ready) return null;
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface.subtle }} onLayout={onLayoutRootView}>
      <NavigationContainer>
        <LearningStackNavigator />
      </NavigationContainer>
      <SafeAreaView edges={['bottom']}>
        <Text style={{ textAlign: 'center', paddingVertical: spacing.xs, fontSize: 12 }}>
          샘플 모드 · 채점은 미리 준비된 예시 결과입니다
        </Text>
      </SafeAreaView>
      <StatusBar style="dark" />
    </View>
  );
}
export function LearningSampleApp() {
  return (
    <SafeAreaProvider>
      <AppTypographyProvider variant="system">
        <QueryClientProvider client={client}>
          <SampleContent />
        </QueryClientProvider>
      </AppTypographyProvider>
    </SafeAreaProvider>
  );
}
registerRootComponent(LearningSampleApp);
