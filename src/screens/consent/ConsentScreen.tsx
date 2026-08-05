import { Feather } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { ActivityIndicator, Image, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { useAuth } from "@/features/auth/auth-context";
import type { RootStackParamList } from "@/navigation/types";
import { colors, shadows } from "@/theme";

// public/은 `@/` 별칭 범위(./src) 밖이라 상대 경로로 require한다.
const consentMascot = require("../../../public/mascots/start_rabbit.png");

type ConsentScreenProps = NativeStackScreenProps<RootStackParamList, "Consent">;

type RequiredItemKey = "privacy" | "terms";

const COLLECTION_TABLE_ROWS: Array<{ label: string; value: string }> = [
  { label: "수집 항목", value: "기기 정보, 앱 사용 기록(점수, 녹음 기록 등)" },
  { label: "이용 목적", value: "모의고사 제공, 피드백 분석, 서비스 개선" },
  { label: "보유 기간", value: "앱 삭제 시까지 (사용자가 데이터 삭제 시 즉시 삭제)" },
];

export function ConsentScreen({ navigation }: ConsentScreenProps) {
  const { acceptConsent, retry, state } = useAuth();
  const [mode] = useState(() =>
    state.status === "CONSENT_REQUIRED" ? state.mode : "new",
  );
  const [requiredItems] = useState(() =>
    state.status === "CONSENT_REQUIRED"
      ? state.requiredItems
      : { privacy: true, terms: true },
  );
  const [checked, setChecked] = useState<Record<RequiredItemKey, boolean>>({
    privacy: !requiredItems.privacy,
    terms: !requiredItems.terms,
  });
  const allChecked =
    (!requiredItems.privacy || checked.privacy) &&
    (!requiredItems.terms || checked.terms);
  const isSubmitting =
    state.status === "GUEST_RECOVERING" ||
    state.status === "CONSENT_UPDATING" ||
    (state.status === "RETRYABLE_ERROR" &&
      state.source === "consent-submit" &&
      state.isRetrying === true);
  const submitError =
    state.status === "RETRYABLE_ERROR" && state.source === "consent-submit"
      ? state.message
      : null;

  const toggle = (key: RequiredItemKey) => {
    setChecked((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const openPrivacyPolicy = () => {
    navigation.navigate("SettingsWebView", {
      path: "/app-settings/privacy",
      title: "개인정보 처리방침",
    });
  };

  const openTerms = () => {
    navigation.navigate("SettingsWebView", {
      path: "/app-settings/terms",
      title: "이용약관",
    });
  };

  const handleStart = async () => {
    if (!allChecked || isSubmitting) {
      return;
    }
    if (submitError) {
      await retry();
      return;
    }
    await acceptConsent();
  };

  const idleButtonLabel = mode === "existing" ? "동의하고 계속하기" : "모두 동의하고 시작하기";
  const busyButtonLabel = mode === "existing" ? "동의 반영 중..." : "시작하는 중...";

  return (
    <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-surface-subtle">
      <ScrollView className="flex-1" contentContainerClassName="px-5 pb-6 pt-8">
        <Text className="text-center text-lg">토선생과 함께하는</Text>
        <Text className="text-center text-3xl" style={{ color: colors.brand.text }}>
          토익스피킹 연습
        </Text>
        <Text className="mt-2 text-center text-sm text-ink-muted">
          {mode === "existing"
            ? "변경된 내용에 다시 동의해주세요."
            : "서비스 이용을 위해 아래 동의가 필요해요."}
        </Text>

        <Image
          source={consentMascot}
          className="mx-auto mt-4 h-64 w-64"
          resizeMode="contain"
          accessible={false}
        />

        <View
          className="mt-14 overflow-hidden rounded-3xl border border-line bg-surface px-4"
          style={shadows.card}
        >
          {requiredItems.privacy ? (
            <View className={requiredItems.terms ? "border-b border-line py-4" : "py-4"}>
              <RequiredRowHeader
                checked={checked.privacy}
                label="개인정보 수집 및 이용 동의"
                onToggle={() => toggle("privacy")}
              />
              <View className="mt-3 gap-2 rounded-2xl bg-surface-muted p-4">
                {COLLECTION_TABLE_ROWS.map((row) => (
                  <View className="flex-row" key={row.label}>
                    <Text className="w-20 text-xs text-ink-muted">{row.label}</Text>
                    <Text className="flex-1 text-xs leading-5">{row.value}</Text>
                  </View>
                ))}
              </View>
              <Pressable
                accessibilityLabel="개인정보 처리방침 자세히 보기"
                className="mt-3 items-center rounded-full border border-line py-2.5"
                onPress={openPrivacyPolicy}
              >
                <Text className="text-xs text-ink-muted">자세히 보기</Text>
              </Pressable>
            </View>
          ) : null}

          {requiredItems.terms ? (
            <RequiredRow
              checked={checked.terms}
              label="서비스 이용약관 동의"
              onPressDetail={openTerms}
              onToggle={() => toggle("terms")}
            />
          ) : null}
        </View>

        <Pressable
          accessibilityLabel={idleButtonLabel}
          accessibilityState={{ busy: isSubmitting, disabled: !allChecked || isSubmitting }}
          className="mt-6 min-h-14 flex-row items-center justify-center gap-2 rounded-full py-4"
          disabled={!allChecked || isSubmitting}
          onPress={handleStart}
          style={{ backgroundColor: allChecked ? colors.brand.DEFAULT : colors.line.DEFAULT }}
        >
          {isSubmitting ? <ActivityIndicator color={colors.surface.DEFAULT} /> : null}
          <Text
            className="text-base"
            style={{ color: allChecked ? colors.surface.DEFAULT : colors.ink.disabled }}
          >
            {isSubmitting ? busyButtonLabel : submitError ? "다시 시도하기" : idleButtonLabel}
          </Text>
        </Pressable>
        {submitError ? (
          <Text accessibilityRole="alert" className="mt-3 text-center text-sm text-ink-muted">
            {submitError}
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function RequiredRowHeader({
  checked,
  label,
  onToggle,
}: {
  checked: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      className="flex-row items-center gap-2"
      hitSlop={8}
      onPress={onToggle}
    >
      <Feather
        color={checked ? colors.brand.DEFAULT : colors.ink.disabled}
        name={checked ? "check-circle" : "circle"}
        size={20}
      />
      <Text className="text-base">{label}</Text>
      <Text className="text-xs" style={{ color: colors.brand.text }}>
        (필수)
      </Text>
    </Pressable>
  );
}

function RequiredRow({
  checked,
  label,
  onPressDetail,
  onToggle,
  showDivider = false,
}: {
  checked: boolean;
  label: string;
  onPressDetail: () => void;
  onToggle: () => void;
  showDivider?: boolean;
}) {
  return (
    <View
      className={`flex-row items-center gap-2 py-4 ${showDivider ? "border-b border-line" : ""}`}
    >
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        hitSlop={8}
        onPress={onToggle}
      >
        <Feather
          color={checked ? colors.brand.DEFAULT : colors.ink.disabled}
          name={checked ? "check-circle" : "circle"}
          size={20}
        />
      </Pressable>
      <View className="min-w-0 flex-1 flex-row items-center gap-1">
        <Text className="text-base">{label}</Text>
        <Text className="text-xs" style={{ color: colors.brand.text }}>
          (필수)
        </Text>
      </View>
      <Pressable accessibilityLabel={`${label} 자세히 보기`} hitSlop={8} onPress={onPressDetail}>
        <Feather color={colors.ink.disabled} name="chevron-right" size={20} />
      </Pressable>
    </View>
  );
}
