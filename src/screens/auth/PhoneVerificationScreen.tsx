import { Feather } from "@expo/vector-icons";
import { TextInput, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { AuthScreenFrame } from "@/screens/auth/components/AuthScreenFrame";
import { colors, FONT_FAMILY, size } from "@/theme";

export type PhoneVerificationViewState =
  | { step: "number"; phone: string; error: string | null }
  | { step: "code"; phone: string; code: string; error: string | null }
  | { step: "complete"; phone: string };

interface PhoneVerificationScreenProps {
  state: PhoneVerificationViewState;
  onBack: () => void;
  onChangePhone: (value: string) => void;
  onRequestCode: () => void;
  onEditPhone: () => void;
  onChangeCode: (value: string) => void;
  onResendCode: () => void;
  onVerify: () => void;
}

function formatSignupPhone(value: string): string {
  return [value.slice(0, 3), value.slice(3, 7), value.slice(7, 11)]
    .filter(Boolean)
    .join(" ");
}

/** 서버/SDK 호출과 단계 전환을 포함하지 않는 표시 컴포넌트. */
export function PhoneVerificationScreen({
  state,
  onBack,
  onChangePhone,
  onRequestCode,
  onEditPhone,
  onChangeCode,
  onResendCode,
  onVerify,
}: PhoneVerificationScreenProps) {
  const footer = (() => {
    switch (state.step) {
      case "number":
        return (
          <Button
            label="인증번호 받기"
            size="lg"
            disabled={!/^010\d{8}$/.test(state.phone)}
            onPress={onRequestCode}
          />
        );
      case "code":
        return (
          <Button
            label="인증 완료하기"
            size="lg"
            disabled={state.code.length !== 6}
            onPress={onVerify}
          />
        );
      case "complete":
        return (
          <Button label="인증 완료" size="lg" disabled onPress={onVerify} />
        );
    }
  })();

  return (
    <AuthScreenFrame
      title="휴대전화 인증"
      step={2}
      onBack={onBack}
      footer={footer}
    >
      <View>
        {state.step === "number" ? (
          <View className="gap-content">
            <Text className="text-lg">휴대전화 번호</Text>
            <View
              className={`min-h-control-lg flex-row items-center gap-element rounded-control border bg-surface px-card ${state.error ? "border-exam-danger" : "border-line"}`}
            >
              <Text
                className="text-base !text-ink-muted"
                style={{ lineHeight: undefined, includeFontPadding: false }}
              >
                한국 +82
              </Text>
              <View className="h-6 w-px bg-line" accessible={false} />
              <TextInput
                accessibilityLabel="휴대전화 번호"
                autoComplete="tel-national"
                keyboardType="phone-pad"
                className="min-h-control-lg min-w-0 flex-1 p-0 text-base text-ink"
                style={{
                  fontFamily: FONT_FAMILY,
                  // 본문용 행간 대신 네이티브 단일 행 입력의 폰트 메트릭을 사용한다.
                  lineHeight: undefined,
                  includeFontPadding: false,
                  textAlignVertical: "center",
                }}
                placeholder="010 0000 0000"
                placeholderTextColor={colors.ink.disabled}
                value={formatSignupPhone(state.phone)}
                onChangeText={(value) =>
                  onChangePhone(value.replace(/\D/g, "").slice(0, 11))
                }
              />
            </View>
            {state.error ? (
              <Text
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
                className="text-sm !text-exam-danger"
              >
                {state.error}
              </Text>
            ) : null}
          </View>
        ) : state.step === "code" ? (
          <View className="gap-section">
            <View className="flex-row items-center justify-between border-b border-line pb-card">
              <Text className="text-lg">{formatSignupPhone(state.phone)}</Text>
              <Button
                label="수정"
                variant="text"
                size="sm"
                onPress={onEditPhone}
              />
            </View>
            <View className="gap-content">
              <View className="flex-row items-center justify-between">
                <Text className="text-lg">인증번호</Text>
                <Button
                  label="다시 받기"
                  variant="text"
                  size="sm"
                  onPress={onResendCode}
                />
              </View>
              <TextInput
                accessibilityLabel="인증번호 6자리"
                keyboardType="number-pad"
                autoComplete="sms-otp"
                textContentType="oneTimeCode"
                maxLength={6}
                className={`min-h-control-lg rounded-control border bg-surface px-card py-0 text-base text-ink ${state.error ? "border-exam-danger" : "border-brand"}`}
                style={{
                  fontFamily: FONT_FAMILY,
                  // 본문용 행간 대신 네이티브 단일 행 입력의 폰트 메트릭을 사용한다.
                  lineHeight: undefined,
                  includeFontPadding: false,
                  textAlignVertical: "center",
                }}
                placeholder="문자로 받은 6자리"
                placeholderTextColor={colors.ink.disabled}
                value={state.code}
                onChangeText={(value) =>
                  onChangeCode(value.replace(/\D/g, "").slice(0, 6))
                }
              />
              {state.error ? (
                <Text
                  accessibilityRole="alert"
                  accessibilityLiveRegion="polite"
                  className="text-sm !text-exam-danger"
                >
                  {state.error}
                </Text>
              ) : null}
            </View>
          </View>
        ) : (
          <View
            className="flex-row items-center gap-element"
            accessibilityLiveRegion="polite"
          >
            <View className="h-12 w-12 items-center justify-center rounded-pill bg-brand-100">
              <Feather
                name="check"
                size={size.icon.lg}
                color={colors.brand.text}
              />
            </View>
            <Text className="text-xl">인증 완료</Text>
          </View>
        )}
      </View>
    </AuthScreenFrame>
  );
}
