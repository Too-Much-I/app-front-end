import { Feather } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as Application from "expo-application";
import { useCallback, useEffect, useState } from "react";
import { Image, ScrollView, Switch, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { getStoredConsent } from "@/features/consent/consent-storage";
import { trackEvent } from "@/lib/amplitude";
import type { RootStackParamList } from "@/navigation/types";
import { SettingsRow } from "@/screens/settings/components/SettingsRow";
import { SettingsSection } from "@/screens/settings/components/SettingsSection";
import { useDeleteLearningRecords } from "@/screens/settings/use-delete-learning-records";
import { useQualityReviewConsent } from "@/screens/settings/use-quality-review-consent";
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

function formatApplicationVersion(version: string | null): string {
  if (!version) return "확인 불가";
  return version.startsWith("v") ? version : `v${version}`;
}

export function SettingsScreen({ navigation }: SettingsScreenProps) {
  const [consentAgreedAt, setConsentAgreedAt] = useState<string | null>(null);
  const deletion = useDeleteLearningRecords();
  const qualityReview = useQualityReviewConsent();

  /**
   * 이탈을 가장 강하게 예고하는 행동이라 삭제 성공이 아니라 요청 시점에 남긴다.
   * 확인 모달에서 취소하더라도 "지우고 싶다"는 의사는 이미 드러난 것이기 때문이다.
   */
  const requestDeletion = useCallback(() => {
    trackEvent({ name: "learning_record_delete_requested" });
    deletion.request();
  }, [deletion]);

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
              trailing={
                <Text className="text-sm text-ink-muted">
                  {formatApplicationVersion(Application.nativeApplicationVersion)}
                </Text>
              }
            />
          </SettingsSection>

          <SettingsSection title="개인정보">
            <SettingsRow
              description={
                qualityReview.hasError
                  ? "설정을 바꾸지 못했어요. 잠시 후 다시 시도해주세요."
                  : "채점이 잘못됐을 때 담당자가 답변 음성을 확인해 원인을 찾아요. 꺼도 응시와 채점에는 영향이 없어요."
              }
              icon="shield"
              showDivider={false}
              title="채점 품질 개선을 위한 답변 검토"
              trailing={
                <Switch
                  accessibilityLabel="채점 품질 개선을 위한 답변 검토 동의"
                  disabled={!qualityReview.isLoaded}
                  ios_backgroundColor={colors.line.DEFAULT}
                  onValueChange={qualityReview.toggle}
                  thumbColor={colors.surface.DEFAULT}
                  trackColor={{
                    false: colors.line.DEFAULT,
                    true: colors.brand.DEFAULT,
                  }}
                  value={qualityReview.enabled}
                />
              }
            />
          </SettingsSection>

          <SettingsSection title="데이터 관리">
            <SettingsRow
              description="삭제 후 복구할 수 없으니 신중히 선택해주세요."
              destructive
              icon="trash-2"
              onPress={requestDeletion}
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
