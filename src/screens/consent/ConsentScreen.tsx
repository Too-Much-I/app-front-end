import { Feather } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, ScrollView, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { useAuth } from "@/features/auth/auth-context";
import {
  createOptionalConsentRecord,
  getStoredOptionalConsent,
  persistOptionalConsent,
} from "@/features/consent/optional-consent-storage";
import { trackEvent } from "@/lib/amplitude";
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
  const { acceptConsent, retry, setPendingQualityReviewConsent, state } = useAuth();
  // 하단 고정 영역이 SafeAreaView 밖에 있으므로 제스처 바 여백을 직접 먹는다.
  const insets = useSafeAreaInsets();
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
  // 저장값 로드가 늦게 도착해도 이용자가 이미 만진 선택을 덮지 않게 표시해 둔다.
  const hasUserChosenQualityReview = useRef(false);
  // `isSubmitting`은 acceptConsent가 setState를 부른 뒤에야 켜진다. 그전에 await가
  // 있어 연타가 통과하므로, 렌더를 기다리지 않는 동기 잠금이 따로 필요하다.
  const isSubmittingRef = useRef(false);
  /**
   * 제출이 실패하면 같은 버튼으로 다시 시도할 수 있어 `handleStart`가 여러 번 돈다.
   * 선택 동의는 화면당 한 번의 결정이므로 첫 제출에서만 기록해야 동의율이 부풀지 않는다.
   */
  const hasTrackedConsentDecisionRef = useRef(false);
  const allChecked =
    (!requiredItems.privacy || checked.privacy) &&
    (!requiredItems.terms || checked.terms);
  // 필수 항목만 만족해도 시작할 수 있다. 전체 동의 체크는 선택 항목까지 포함해야 켜진다.
  const allAgreed = allChecked && qualityReviewChecked;

  // 재동의(mode === "existing")로 다시 들어온 이용자가 이전에 선택 동의를 켜 뒀다면
  // 그 선택을 유지한 채로 보여준다. 저장값이 없으면 기본값 false를 그대로 쓴다.
  // 읽기가 끝나기 전에 이용자가 먼저 선택했다면 그쪽이 최신이므로 건드리지 않는다.
  useEffect(() => {
    let cancelled = false;
    void getStoredOptionalConsent().then((record) => {
      if (!cancelled && record && !hasUserChosenQualityReview.current) {
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

  /** 선택 동의를 바꾸는 유일한 경로. 이용자가 직접 정했다는 사실을 함께 남긴다. */
  const chooseQualityReview = (next: boolean) => {
    hasUserChosenQualityReview.current = true;
    setQualityReviewChecked(next);
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
    chooseQualityReview(next);
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
   * 없고, 반대로 진입을 막으면 필수도 아닌 항목 때문에 앱을 못 쓰게 된다.
   *
   * 이 저장은 다음 실행을 위한 캐시일 뿐, 이번 제출의 전달 통로가 아니다. 통로로
   * 쓰면 쓰기 실패가 곧 선택 유실이 되어, 방금 철회한 이용자의 이전 동의가
   * 저장소에 남아 있다가 그대로 서버로 나간다.
   */
  const persistQualityReviewChoice = async () => {
    try {
      await persistOptionalConsent(createOptionalConsentRecord(qualityReviewChecked));
    } catch {
      // 선택 동의 저장 실패는 이용자에게 알리지 않고 넘어간다.
    }
  };

  const handleStart = async () => {
    if (!allChecked || isSubmitting || isSubmittingRef.current) {
      return;
    }
    isSubmittingRef.current = true;
    try {
      // 선택 동의 문구가 얼마나 설득력이 있는지를 보는 지표다.
      if (!hasTrackedConsentDecisionRef.current) {
        hasTrackedConsentDecisionRef.current = true;
        trackEvent({
          name: "optional_consent_decided",
          properties: { consented: qualityReviewChecked },
        });
      }
      // 저장소가 아니라 컨트롤러 메모리로 선택을 넘긴다. 저장이 실패해도 이번
      // 제출에는 화면에 보이던 선택이 그대로 실린다.
      setPendingQualityReviewConsent(qualityReviewChecked);
      // acceptConsent()가 성공하면 화면이 곧바로 벗어나므로 그 전에 저장한다.
      await persistQualityReviewChoice();
      if (submitError) {
        await retry();
        return;
      }
      await acceptConsent();
    } finally {
      isSubmittingRef.current = false;
    }
  };

  // 선택 항목을 끄고도 시작할 수 있으므로 "모두 동의하고"라고 쓰지 않는다.
  // 일괄 동의는 위쪽 "약관 전체 동의" 행이 담당한다.
  const idleButtonLabel = mode === "existing" ? "동의하고 계속하기" : "동의하고 시작하기";
  const busyButtonLabel = mode === "existing" ? "동의 반영 중..." : "시작하는 중...";

  return (
    // bottom edge는 SafeAreaView가 아니라 아래 고정 영역이 직접 처리한다.
    <SafeAreaView edges={["top"]} className="flex-1 bg-surface-subtle">
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
            // 켜짐 배경은 반드시 불투명색이어야 한다. 알파가 있는 색을 쓰면 아래
            // `shadows.card`의 elevation 그림자가 배경을 뚫고 올라와 박스가 흙탕물색이 된다.
            backgroundColor: allAgreed ? colors.brand[100] : colors.surface.DEFAULT,
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
            onToggle={() => chooseQualityReview(!qualityReviewChecked)}
          />
        </View>

      </ScrollView>

      {/*
        시작 버튼은 스크롤에서 빼내 화면 아래에 고정한다. 동의를 다 켜고도 버튼을 찾아
        스크롤해야 했기 때문이다.

        배경은 반드시 불투명색이어야 한다. 스크롤 내용이 이 영역 뒤로 지나가기도 하고,
        `raisedBottom`이 `elevation: 8`을 걸어서 반투명색을 쓰면 Android에서 그림자가
        배경을 뚫고 올라온다(전체 동의 박스에서 겪은 것과 같은 문제).
      */}
      {/*
        여백을 두 겹으로 나눈다. 바깥은 제스처 바 인셋만, 안쪽은 상하 대칭 여백만 맡는다.

        인셋은 홈 인디케이터가 차지하는 물리적 영역이라 글자 크기와 무관하게 늘 같아야
        하고, 반대로 상하 여백은 화면과 같이 커져야 한다. 한 View에서 `paddingBottom`
        하나로 둘을 더해버리면 NativeWind의 rem 스케일을 타지 못해 여백만 고정된다.
        (`MainTabNavigator`가 탭바 치수에서 같은 이유로 둘을 분리한다.)
      */}
      <View
        className="bg-surface-subtle"
        style={{ paddingBottom: insets.bottom, ...shadows.raisedBottom }}
      >
        <View className="px-5 pb-3 pt-3">
          {/* 버튼 위에 둔다. 아래에 두면 에러가 뜰 때 버튼이 위로 밀려 누르던 자리가 바뀐다. */}
          {submitError ? (
            <Text accessibilityRole="alert" className="mb-3 text-center text-sm text-ink-muted">
              {submitError}
            </Text>
          ) : null}
          <Pressable
            accessibilityLabel={idleButtonLabel}
            accessibilityState={{ busy: isSubmitting, disabled: !allChecked || isSubmitting }}
            className="min-h-14 flex-row items-center justify-center gap-2 rounded-full py-4"
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
        </View>
      </View>
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
