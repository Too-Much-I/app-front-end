import { createNativeStackNavigator } from "@react-navigation/native-stack";

import type { MockExamStackParamList } from "@/navigation/types";
import { ExamPartGuideScreen } from "@/screens/mock-exam/ExamPartGuideScreen";
import { MockExamReadyScreen } from "@/screens/mock-exam/MockExamReadyScreen";

const Stack = createNativeStackNavigator<MockExamStackParamList>();

export function MockExamStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MockExamReady" component={MockExamReadyScreen} />
      <Stack.Screen name="ExamPartGuide" component={ExamPartGuideScreen} />
    </Stack.Navigator>
  );
}
