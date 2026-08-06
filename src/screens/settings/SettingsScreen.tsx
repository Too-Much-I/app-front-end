import { Feather } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { Image, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { getStoredConsent } from "@/features/consent/consent-storage";
import type { RootStackParamList } from "@/navigation/types";
import { SettingsRow } from "@/screens/settings/components/SettingsRow";
import { SettingsSection } from "@/screens/settings/components/SettingsSection";
import { useDeleteLearningRecords } from "@/screens/settings/use-delete-learning-records";
import { colors, shadows } from "@/theme";

// public/은 `@/` 별칭 범위(./src) 밖이라 상대 경로로 require한다.
const encouragementMascot = require("../../../public/mascots/growing_rabbit.png");

type SettingsScreenProps = NativeStackScreenProps<RootStackParamList, "Settings">;

function formatConsentDate(iso: string): string {
  const date = new Date(iso);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd}`;
}

export function SettingsScreen({ navigation }: SettingsScreenProps) {
  const [consentAgreedAt, setConsentAgreedAt] = useState<string | null>(null);
  const deletion = useDeleteLearningRecords();

  useEffect(() => {
    getStoredConsent()
      .then((record) => setConsentAgreedAt(record?.privacy.agreedAt ?? null))
      .catch(() => setConsentAgreedAt(null));
  }, []);

  return (
    <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-surface-subtle">
      <View className="h-16 flex-row items-center px-5">
        <Pressable
          accessibilityLabel="뒤로 가기"
          className="h-10 w-10 items-center justify-center rounded-full"
          hitSlop={8}
          onPress={navigation.goBack}
        >
          <Feather name="arrow-left" size={24} color={colors.ink.DEFAULT} />
        </Pressable>
        <Text className="ml-2 text-2xl">설정</Text>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-5 pb-10 pt-2">
          <View
            className="flex-row items-center gap-4 overflow-hidden rounded-3xl border border-line bg-brand-50 p-5"
            style={shadows.card}
          >
            <View className="min-w-0 flex-1">
              <Text className="text-xs" style={{ color: colors.brand.text }}>
                토선생의 한마디
              </Text>
              <Text className="mt-1 text-lg leading-7">
                오늘도 꾸준히 연습하면{"\n"}점수는 반드시 올라가요!
              </Text>
              <Text className="mt-2 text-sm text-ink-muted">
                토선생이 항상 응원할게요 🧡
              </Text>
            </View>
            <Image
              source={encouragementMascot}
              className="h-32 w-24"
              resizeMode="contain"
              accessible={false}
            />
          </View>

          <SettingsSection title="서비스">
            <SettingsRow
              icon="file-text"
              onPress={() =>
                navigation.navigate("SettingsWebView", {
                  path: "/app-settings/privacy",
                  title: "개인정보 처리방침",
                })
              }
              title="개인정보 처리방침"
            />
            <SettingsRow
              icon="clipboard"
              onPress={() =>
                navigation.navigate("SettingsWebView", {
                  path: "/app-settings/terms",
                  title: "이용약관",
                })
              }
              title="이용약관"
            />
            {consentAgreedAt ? (
              <SettingsRow
                icon="check-circle"
                title="동의 일시"
                trailing={
                  <Text className="text-sm text-ink-muted">
                    {formatConsentDate(consentAgreedAt)}
                  </Text>
                }
              />
            ) : null}
            <SettingsRow
              description="버그 제보 및 기능 제안을 할 수 있어요."
              icon="message-circle"
              onPress={() =>
                navigation.navigate("SettingsWebView", {
                  path: "/app-settings/contact",
                  title: "문의하기",
                })
              }
              title="문의하기"
            />
            <SettingsRow
              icon="info"
              showDivider={false}
              title="버전 정보"
              trailing={<Text className="text-sm text-ink-muted">v1.0.0</Text>}
            />
          </SettingsSection>

          <SettingsSection title="데이터 관리">
            <SettingsRow
              description="삭제 후 복구할 수 없으니 신중히 선택해주세요."
              destructive
              icon="trash-2"
              onPress={deletion.request}
              showDivider={false}
              title="모든 학습 기록 삭제"
            />
          </SettingsSection>
        </View>
      </ScrollView>

      <ConfirmModal
        cancelLabel="그대로 둘게요"
        confirmHint="모든 학습 기록을 삭제하고 앱을 처음 상태로 되돌립니다"
        confirmLabel="삭제하기"
        confirmTone="danger"
        errorMessage={
          deletion.status === "error"
            ? "삭제하지 못했어요. 잠시 후 다시 시도해주세요."
            : undefined
        }
        message="지금까지의 시험 기록과 피드백이 모두 사라져요. 삭제하면 되돌릴 수 없어요."
        onCancel={deletion.cancel}
        onConfirm={deletion.confirm}
        pending={deletion.status === "deleting"}
        title="모든 학습 기록을 지울까요?"
        visible={deletion.status !== "idle"}
        warningBadge
      />
    </SafeAreaView>
  );
}
