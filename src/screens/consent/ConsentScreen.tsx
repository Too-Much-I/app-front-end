import { Feather } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { Alert, Image, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { saveConsent } from "@/features/consent/consent-storage";
import type { RootStackParamList } from "@/navigation/types";
import { colors, shadows } from "@/theme";

// public/은 `@/` 별칭 범위(./src) 밖이라 상대 경로로 require한다.
const consentMascot = require("../../../public/mascots/start_rabbit.png");

type ConsentScreenProps = NativeStackScreenProps<RootStackParamList, "Consent">;

type RequiredItemKey = "privacyUsage" | "terms";

const COLLECTION_TABLE_ROWS: Array<{ label: string; value: string }> = [
  { label: "수집 항목", value: "기기 정보, 앱 사용 기록(점수, 녹음 기록 등)" },
  { label: "이용 목적", value: "모의고사 제공, 피드백 분석, 서비스 개선" },
  { label: "보유 기간", value: "앱 삭제 시까지 (사용자가 데이터 삭제 시 즉시 삭제)" },
];

export function ConsentScreen({ navigation }: ConsentScreenProps) {
  const [checked, setChecked] = useState<Record<RequiredItemKey, boolean>>({
    privacyUsage: false,
    terms: false,
  });
  const [isSaving, setSaving] = useState(false);

  const allChecked = Object.values(checked).every(Boolean);

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
    if (!allChecked || isSaving) {
      return;
    }

    setSaving(true);
    try {
      await saveConsent();
      navigation.reset({ index: 0, routes: [{ name: "MainTabs" }] });
    } catch {
      Alert.alert("저장에 실패했어요", "잠시 후 다시 시도해주세요.");
      setSaving(false);
    }
  };

  return (
    <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-surface-subtle">
      <ScrollView className="flex-1" contentContainerClassName="px-5 pb-6 pt-8">
        <Text className="text-center text-lg">토선생과 함께하는</Text>
        <Text className="text-center text-3xl" style={{ color: colors.brand.text }}>
          토익스피킹 연습
        </Text>
        <Text className="mt-2 text-center text-sm text-ink-muted">
          서비스 이용을 위해 아래 동의가 필요해요.
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
          <View className="border-b border-line py-4">
            <RequiredRowHeader
              checked={checked.privacyUsage}
              label="개인정보 수집 및 이용 동의"
              onToggle={() => toggle("privacyUsage")}
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

          <RequiredRow
            checked={checked.terms}
            label="서비스 이용약관 동의"
            onPressDetail={openTerms}
            onToggle={() => toggle("terms")}
          />
        </View>

        <Pressable
          accessibilityLabel="모두 동의하고 시작하기"
          accessibilityState={{ disabled: !allChecked || isSaving }}
          className="mt-6 items-center rounded-full py-4"
          disabled={!allChecked || isSaving}
          onPress={handleStart}
          style={{ backgroundColor: allChecked ? colors.brand.DEFAULT : colors.line.DEFAULT }}
        >
          <Text
            className="text-base"
            style={{ color: allChecked ? "#FFFFFF" : colors.ink.disabled }}
          >
            모두 동의하고 시작하기
          </Text>
        </Pressable>
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
