import { Feather } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import WebView from "react-native-webview";

import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { WEB_BASE_URL } from "@/lib/web-base-url";
import type { RootStackParamList } from "@/navigation/types";
import { colors } from "@/theme";

type SettingsWebViewScreenProps = NativeStackScreenProps<
  RootStackParamList,
  "SettingsWebView"
>;

export function SettingsWebViewScreen({
  navigation,
  route,
}: SettingsWebViewScreenProps) {
  const { path, title } = route.params;
  const url = WEB_BASE_URL ? `${WEB_BASE_URL}${path}` : null;

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-surface-subtle">
      <View className="h-16 flex-row items-center px-5">
        <Pressable
          accessibilityLabel="뒤로 가기"
          className="h-10 w-10 items-center justify-center rounded-full"
          hitSlop={8}
          onPress={navigation.goBack}
        >
          <Feather name="arrow-left" size={24} color={colors.ink.DEFAULT} />
        </Pressable>
        <Text className="ml-2 text-2xl">{title}</Text>
      </View>

      {url ? (
        <WebView
          source={{ uri: url }}
          className="flex-1 bg-surface-subtle"
          startInLoadingState
          renderLoading={() => (
            <View className="flex-1 items-center justify-center bg-surface-subtle">
              <ActivityIndicator color={colors.brand.DEFAULT} size="large" />
            </View>
          )}
          renderError={(_errorDomain, _errorCode, errorDescription) => (
            <View className="flex-1 items-center justify-center bg-surface-subtle px-6">
              <Text accessibilityRole="header" className="text-center text-2xl">
                페이지를 열지 못했어요
              </Text>
              <Text className="mt-3 text-center text-sm leading-6 text-ink-muted">
                {errorDescription}
              </Text>
            </View>
          )}
        />
      ) : (
        <View className="flex-1 items-center justify-center bg-surface-subtle px-6">
          <Text accessibilityRole="header" className="text-center text-2xl">
            웹 주소가 필요해요
          </Text>
          <Text className="mt-3 text-center text-sm leading-6 text-ink-muted">
            앱 환경변수 EXPO_PUBLIC_WEB_BASE_URL을 설정해 주세요.
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}
