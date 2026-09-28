import { Feather } from "@expo/vector-icons";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import {
  SUPPORT_MESSAGE_LIMIT,
  type SupportInquirySender,
} from "@/features/support/support-inquiry";
import { useSupportInquiry } from "@/screens/support/use-support-inquiry";
import { colors, FONT_FAMILY, size } from "@/theme";

interface SupportInquiryScreenProps {
  onBack: () => void;
  sendInquiry?: SupportInquirySender;
}

/** 기존 문의 페이지의 편지 캐릭터·주황색 행동 버튼을 네이티브 입력 폼으로 구성한다. */
export function SupportInquiryScreen({
  onBack,
  sendInquiry,
}: SupportInquiryScreenProps) {
  const { state, update, submit } = useSupportInquiry(sendInquiry);
  const isSubmitting = state.status === "submitting";

  return (
    <SafeAreaView className="flex-1 bg-surface-subtle">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View className="min-h-control-lg flex-row items-center gap-content px-screen">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="뒤로 가기"
            onPress={onBack}
            className="h-11 w-11 items-center justify-center"
          >
            <Feather
              name="chevron-left"
              size={size.icon.lg}
              color={colors.ink.DEFAULT}
            />
          </Pressable>
          <Text className="text-xl">문의하기</Text>
        </View>
        <ScrollView
          className="flex-1"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerClassName="grow px-screen py-section"
        >
          <View className="mx-auto w-full max-w-xl gap-section">
            <View className="items-center gap-content">
              <Image
                source={require("../../../public/mascots/mail.png")}
                className="h-40 w-40"
                resizeMode="contain"
                accessible={false}
              />
              <Text accessibilityRole="header" className="text-center text-2xl">
                {state.status === "submitted"
                  ? "문의를 접수했어요"
                  : "어떤 도움이 필요하신가요?"}
              </Text>
              <Text className="text-center text-sm leading-6 text-ink-muted">
                {state.status === "submitted"
                  ? "남겨주신 내용을 확인할게요."
                  : "이용 중 겪은 문제나 궁금한 점을 알려주세요."}
              </Text>
            </View>
            {state.status === "submitted" ? (
              <Button label="돌아가기" size="lg" onPress={onBack} />
            ) : (
              <>
                <View className="gap-content">
                  <Text className="text-base">답변 받을 이메일 (선택)</Text>
                  <TextInput
                    accessibilityLabel="답변 받을 이메일, 선택 입력"
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    autoComplete="email"
                    className="min-h-control-lg rounded-control border border-line bg-surface px-card text-base text-ink"
                    style={{
                      fontFamily: FONT_FAMILY,
                      includeFontPadding: false,
                    }}
                    placeholder="이메일 주소를 입력해 주세요"
                    placeholderTextColor={colors.ink.disabled}
                    editable={!isSubmitting}
                    value={state.draft.replyEmail}
                    onChangeText={(value) => update("replyEmail", value)}
                  />
                </View>
                <View className="gap-content">
                  <Text className="text-base">문의 내용</Text>
                  <TextInput
                    accessibilityLabel="문의 내용"
                    multiline
                    textAlignVertical="top"
                    className="min-h-40 rounded-control border border-line bg-surface p-card text-base text-ink"
                    style={{ fontFamily: FONT_FAMILY }}
                    placeholder="어느 화면에서 어떤 문제가 있었는지 알려주세요."
                    placeholderTextColor={colors.ink.disabled}
                    maxLength={SUPPORT_MESSAGE_LIMIT}
                    editable={!isSubmitting}
                    value={state.draft.message}
                    onChangeText={(value) => update("message", value)}
                  />
                  <Text className="text-right text-xs text-ink-muted">
                    {state.draft.message.length} / {SUPPORT_MESSAGE_LIMIT}
                  </Text>
                </View>
                {state.status === "failed" ? (
                  <Text
                    accessibilityRole="alert"
                    className="text-sm !text-exam-danger"
                  >
                    {state.message}
                  </Text>
                ) : null}
                {!sendInquiry ? (
                  <Text className="text-sm text-ink-muted">
                    문의 전송을 준비하고 있어요. 아직 문의가 접수되지는 않아요.
                  </Text>
                ) : null}
                <Button
                  label={isSubmitting ? "보내는 중..." : "문의 보내기"}
                  size="lg"
                  loading={isSubmitting}
                  disabled={!sendInquiry || !state.draft.message.trim()}
                  onPress={() => {
                    void submit();
                  }}
                />
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
