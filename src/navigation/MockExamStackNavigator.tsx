import { createNativeStackNavigator } from "@react-navigation/native-stack";

import type { MockExamStackParamList } from "@/navigation/types";
import { ExamPartGuideScreen } from "@/screens/mock-exam/ExamPartGuideScreen";
import { ExamSessionScreen } from "@/screens/mock-exam/ExamSessionScreen";
import { MicrophoneTestScreen } from "@/screens/mock-exam/MicrophoneTestScreen";
import { MockExamReadyScreen } from "@/screens/mock-exam/MockExamReadyScreen";
import { SoundTestScreen } from "@/screens/mock-exam/SoundTestScreen";

const Stack = createNativeStackNavigator<MockExamStackParamList>();

export function MockExamStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MockExamReady" component={MockExamReadyScreen} />
      <Stack.Screen name="ExamPartGuide" component={ExamPartGuideScreen} />
      <Stack.Screen name="MicrophoneTest" component={MicrophoneTestScreen} />
      <Stack.Screen name="SoundTest" component={SoundTestScreen} />
      <Stack.Screen name="ExamSession" component={ExamSessionScreen} />
    </Stack.Navigator>
  );
}
