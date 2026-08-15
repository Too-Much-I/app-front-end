import { Feather } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { ActivityIndicator, Image, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { useAuth } from "@/features/auth/auth-context";
import {
  createOptionalConsentRecord,
  getStoredOptionalConsent,
  persistOptionalConsent,
} from "@/features/consent/optional-consent-storage";
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

const QUALITY_REVIEW_LABEL = "채점 품질 개선을 위한 답변 검토";
const QUALITY_REVIEW_DESCRIPTION =
  "채점이 잘못되거나 오류가 났을 때 담당자가 해당 답변 음성과 전사문을 직접 확인해 원인을 찾습니다. 동의하지 않아도 모의고사 응시와 채점 결과 확인에는 제한이 없어요.";

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
  const [qualityReviewChecked, setQualityReviewChecked] = useState(false);
  const allChecked =
    (!requiredItems.privacy || checked.privacy) &&
    (!requiredItems.terms || checked.terms);
  // 필수 항목만 만족해도 시작할 수 있다. 전체 동의 체크는 선택 항목까지 포함해야 켜진다.
  const allAgreed = allChecked && qualityReviewChecked;

  // 재동의(mode === "existing")로 다시 들어온 이용자가 이전에 선택 동의를 켜 뒀다면
  // 그 선택을 유지한 채로 보여준다. 저장값이 없으면 기본값 false를 그대로 쓴다.
  useEffect(() => {
    let cancelled = false;
    void getStoredOptionalConsent().then((record) => {
      if (!cancelled && record) {
        setQualityReviewChecked(record.qualityReview.consented);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);
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

  /**
   * 전체 동의는 선택 항목까지 함께 켜고 끈다.
   *
   * 개인정보 보호법 제22조는 동의 사항을 구분해 각각 동의받도록 하므로, 일괄 동의를
   * 두더라도 개별 체크박스를 그대로 노출하고 라벨에 "선택 항목 포함"을 밝혀야 한다.
   * 화면에 그려지지 않는 필수 항목(이미 동의가 끝나 requiredItems가 false인 항목)은
   * 계속 true로 둔다. 끄면 시작 버튼이 영영 비활성화된다.
   */
  const toggleAll = () => {
    const next = !allAgreed;
    setChecked({
      privacy: requiredItems.privacy ? next : true,
      terms: requiredItems.terms ? next : true,
    });
    setQualityReviewChecked(next);
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

  /**
   * 선택 동의를 기기에 남긴다.
   *
   * 저장에 실패해도 서비스 진입을 막지 않는다. 선택 항목이라 없어도 이용에 지장이
   * 없고, 저장이 안 된 상태는 "동의하지 않음"으로 읽혀 개인정보를 덜 쓰는 쪽으로
   * 기운다. 반대로 진입을 막으면 필수도 아닌 항목 때문에 앱을 못 쓰게 된다.
   */
  const persistQualityReviewChoice = async () => {
    try {
      await persistOptionalConsent(createOptionalConsentRecord(qualityReviewChecked));
    } catch {
      // 선택 동의 저장 실패는 이용자에게 알리지 않고 넘어간다.
    }
  };

  const handleStart = async () => {
    if (!allChecked || isSubmitting) {
      return;
    }
    // acceptConsent()가 성공하면 화면이 곧바로 벗어나므로 그 전에 저장한다.
    await persistQualityReviewChoice();
    if (submitError) {
      await retry();
      return;
    }
    await acceptConsent();
  };

  // 선택 항목을 끄고도 시작할 수 있으므로 "모두 동의하고"라고 쓰지 않는다.
  // 일괄 동의는 위쪽 "약관 전체 동의" 행이 담당한다.
  const idleButtonLabel = mode === "existing" ? "동의하고 계속하기" : "동의하고 시작하기";
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

        <Pressable
          accessibilityLabel="약관 전체 동의 (선택 항목 포함)"
          accessibilityRole="checkbox"
          accessibilityState={{ checked: allAgreed }}
          className="mt-14 flex-row items-center gap-3 rounded-3xl border px-4 py-4"
          onPress={toggleAll}
          style={{
            backgroundColor: allAgreed ? colors.brand.subtle : colors.surface.DEFAULT,
            borderColor: allAgreed ? colors.brand.DEFAULT : colors.line.DEFAULT,
            ...shadows.card,
          }}
        >
          <Feather
            color={allAgreed ? colors.brand.DEFAULT : colors.ink.disabled}
            name={allAgreed ? "check-circle" : "circle"}
            size={26}
          />
          <View className="min-w-0 flex-1">
            <Text className="text-lg">약관 전체 동의</Text>
            <Text className="mt-0.5 text-xs text-ink-muted">
              선택 항목까지 한 번에 동의합니다.
            </Text>
          </View>
        </Pressable>

        <View
          className="mt-3 overflow-hidden rounded-3xl border border-line bg-surface px-4"
          style={shadows.card}
        >
          {requiredItems.privacy ? (
            // 선택 항목 행이 항상 뒤따르므로 구분선은 조건 없이 그린다.
            <View className="border-b border-line py-4">
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
              showDivider
            />
          ) : null}

          <OptionalRow
            checked={qualityReviewChecked}
            description={QUALITY_REVIEW_DESCRIPTION}
            label={QUALITY_REVIEW_LABEL}
            onToggle={() => setQualityReviewChecked((prev) => !prev)}
          />
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

/**
 * 선택 동의 항목 한 줄.
 *
 * 필수 항목과 달리 "자세히 보기"로 넘길 별도 문서가 없어 설명을 행 안에 직접 적는다.
 * 이용자가 무엇에 동의하는지와 동의하지 않아도 불이익이 없다는 점을 같은 자리에서
 * 읽을 수 있어야 하기 때문이다.
 */
function OptionalRow({
  checked,
  description,
  label,
  onToggle,
}: {
  checked: boolean;
  description: string;
  label: string;
  onToggle: () => void;
}) {
  return (
    <Pressable
      accessibilityHint={description}
      accessibilityLabel={`${label} (선택)`}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      className="py-4"
      onPress={onToggle}
    >
      <View className="flex-row items-center gap-2">
        <Feather
          color={checked ? colors.brand.DEFAULT : colors.ink.disabled}
          name={checked ? "check-circle" : "circle"}
          size={20}
        />
        <View className="min-w-0 flex-1 flex-row items-center gap-1">
          <Text className="min-w-0 flex-1 text-base">{label}</Text>
          <Text className="text-xs text-ink-muted">(선택)</Text>
        </View>
      </View>
      <Text className="mt-2 pl-7 text-xs leading-5 text-ink-muted">{description}</Text>
    </Pressable>
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
