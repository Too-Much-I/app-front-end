import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useEffect } from 'react';

import { firebasePhoneValidation } from '@/features/auth/firebase-phone-validation';
import type { FirebaseValidationStackParamList } from '@/navigation/types';
import { FirebaseAuthValidationScreen } from '@/screens/diagnostics/FirebaseAuthValidationScreen';
import { FirebasePhoneValidationScreen } from '@/screens/diagnostics/FirebasePhoneValidationScreen';

const Stack = createNativeStackNavigator<FirebaseValidationStackParamList>();

export function FirebaseValidationNavigator() {
  useEffect(() => firebasePhoneValidation.observeUser(), []);

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Providers" component={FirebaseAuthValidationScreen} />
        <Stack.Screen name="Phone" component={FirebasePhoneValidationScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
