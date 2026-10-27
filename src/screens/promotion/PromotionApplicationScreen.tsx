import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Pressable } from '@/components/ui/Pressable';
import { Text } from '@/components/ui/Text';
import { gifticonLabel } from '@/features/promotion/promotion-application';
import type { RootStackParamList } from '@/navigation/types';
import { GifticonSheet } from '@/screens/promotion/components/GifticonSheet';
import { PromotionResult } from '@/screens/promotion/components/PromotionResult';
import { usePromotionApplication } from '@/features/promotion/use-promotion-application';
import { colors, FONT_FAMILY, size } from '@/theme';

// public/은 `@/` 별칭 범위(./src) 밖이라 상대 경로로 require한다.
const reportRabbit = require('../../../public/mascots/paper_rabbit.png');

type PromotionApplicationScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'PromotionApplication'
>;

/** 이벤트 안내 목록. 마지막 줄은 일찍 마감될 수 있다는 경고라 진하게 둔다(2026-10-27 시안 1). */
const EVENT_NOTES = [
  '성적표를 내면 확인 후 메일로 보내드려요',
  '이용권을 결제한 분만 받을 수 있어요',
  '한 사람당 한 번만 신청할 수 있어요',
] as const;

/** 신청 폼에서 받는 개인정보 수집·이용 고지(개인정보 보호법 제15조 제2항). */
const COLLECTION_ROWS = [
  { label: '수집 항목', value: '메일 주소, 성적표 이미지(성적표에 적힌 이름 등 포함)' },
  { label: '이용 목적', value: '이벤트 참여 확인과 기프티콘 발송' },
  // 처리방침 제2조와 같은 값이어야 한다(2026-10-27 결정). 바꾸면 웹 처리방침도 함께 고친다.
  { label: '보유 기간', value: '기프티콘 발송 완료 후 1개월까지 보관 후 파기' },
] as const;

/**
 * 기프티콘 이벤트 신청(2026-10-27 시안 https://claude.ai/artifact/P4PJbmsnRv42Fg7aUDkxzM).
 *
 * 받고 싶은 기프티콘·받을 메일·성적표 사진과 개인정보 수집 동의를 받아 한 번에 보낸다. 신청 여부는 서버 409로만
 * 알고 기기에 저장하지 않아, 다시 들어오면 폼부터 보인다.
 */
export function PromotionApplicationScreen({ navigation }: PromotionApplicationScreenProps) {
  const { state, selectGifticon, changeEmail, toggleConsent, pickReport, submit } =
    usePromotionApplication();
  const [sheetVisible, setSheetVisible] = useState(false);

  if (state.status !== 'editing' && state.status !== 'submitting') {
    return (
      <SafeAreaView className="flex-1 bg-surface-subtle">
        <PromotionResult result={state} onClose={navigation.goBack} />
      </SafeAreaView>
    );
  }

  const { draft } = state;
  const isSubmitting = state.status === 'submitting';
  const message = state.status === 'editing' ? state.message : null;
  const reportMessage = state.status === 'editing' ? state.reportMessage : null;

  return (
    <SafeAreaView className="flex-1 bg-surface-subtle">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View className="min-h-control-lg flex-row items-center gap-content px-screen">
          <Pressable
            accessibilityLabel="뒤로 가기"
            accessibilityRole="button"
            className="h-11 w-11 items-center justify-center"
            onPress={navigation.goBack}
          >
            <Feather name="chevron-left" size={size.icon.lg} color={colors.ink.DEFAULT} />
          </Pressable>
          <Text className="text-xl">이벤트 신청</Text>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerClassName="gap-section px-screen pb-section pt-sm"
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        >
          <View className="gap-card rounded-card bg-brand-100 p-card">
            <View className="flex-row gap-sm">
              <View className="flex-1 gap-element">
                <View className="flex-row flex-wrap gap-xs">
                  <View className="rounded-pill bg-surface px-sm py-xs">
                    <Text className="text-xs text-brand-text">~ 11월 23일까지</Text>
                  </View>
                  <View className="rounded-pill bg-brand-700 px-sm py-xs">
                    <Text className="text-xs text-surface">선착순</Text>
                  </View>
                </View>
                <Text accessibilityRole="header" className="text-2xl">
                  성적 입력하고{'\n'}기프티콘 5천 원
                </Text>
              </View>
              <Image
                accessible={false}
                className="h-24 w-20"
                resizeMode="contain"
                source={reportRabbit}
              />
            </View>
            <View className="gap-sm border-t border-brand-200 pt-element">
              {EVENT_NOTES.map((note) => (
                <EventNote key={note} text={note} />
              ))}
              <EventNote emphasized text="기한 전에 일찍 마감될 수 있어요" />
            </View>
          </View>

          <View className="gap-content">
            <Text className="text-base">받고 싶은 기프티콘</Text>
            <Pressable
              accessibilityHint="기프티콘을 고르는 창이 열립니다"
              accessibilityLabel={`받고 싶은 기프티콘, ${draft.gifticon ? gifticonLabel(draft.gifticon) : '선택 안 함'}`}
              accessibilityRole="button"
              className="min-h-control-lg flex-row items-center justify-between rounded-control border border-line bg-surface px-card"
              disabled={isSubmitting}
              onPress={() => setSheetVisible(true)}
            >
              <Text className={draft.gifticon ? 'text-base' : 'text-base text-ink-disabled'}>
                {draft.gifticon ? gifticonLabel(draft.gifticon) : '골라 주세요'}
              </Text>
              <Feather name="chevron-down" size={size.icon.md} color={colors.ink.muted} />
            </Pressable>
          </View>

          <View className="gap-content">
            <Text className="text-base">기프티콘 받을 메일</Text>
            <TextInput
              accessibilityLabel="기프티콘 받을 메일"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              className="min-h-control-lg rounded-control border border-line bg-surface px-card text-base text-ink"
              editable={!isSubmitting}
              keyboardType="email-address"
              placeholder="example@email.com"
              placeholderTextColor={colors.ink.disabled}
              style={{ fontFamily: FONT_FAMILY, includeFontPadding: false }}
              value={draft.email}
              onChangeText={changeEmail}
            />
            <Text className="text-xs text-ink-muted">
              잘못 적으면 기프티콘을 받을 수 없어요. 한 번 더 확인해 주세요.
            </Text>
          </View>

          <View className="gap-content">
            <View className="flex-row items-baseline justify-between">
              <Text className="text-base">토익스피킹 성적표</Text>
              <Text className="text-xs text-ink-muted">사진 1장 · 9MB 이하</Text>
            </View>
            {draft.report ? (
              <View className="flex-row items-center gap-md rounded-control border border-line bg-surface p-sm">
                <Image
                  accessibilityLabel="고른 성적표 사진"
                  className="h-14 w-14 rounded-chip"
                  source={{ uri: draft.report.uri }}
                />
                <View className="flex-1 gap-xs">
                  <Text className="text-sm">성적표 사진</Text>
                  <Text className="text-xs text-ink-muted">글씨가 잘 보이는지 확인해 주세요</Text>
                </View>
                <Button
                  disabled={isSubmitting}
                  label="다시 고르기"
                  size="sm"
                  variant="text"
                  onPress={() => void pickReport()}
                />
              </View>
            ) : (
              <Pressable
                accessibilityRole="button"
                className="min-h-24 items-center justify-center gap-xs rounded-control border border-dashed border-brand-300 bg-brand-50"
                disabled={isSubmitting}
                onPress={() => void pickReport()}
              >
                <Feather name="plus" size={size.icon.md} color={colors.brand.text} />
                <Text className="text-sm text-brand-text">사진첩에서 고르기</Text>
              </Pressable>
            )}
            {reportMessage ? (
              <Text accessibilityRole="alert" className="text-sm !text-exam-danger">
                {reportMessage}
              </Text>
            ) : null}
            <Text className="text-xs leading-5 text-ink-muted">
              성적표 화면을 캡처하거나 종이 성적표를 찍어 올려 주세요. PDF는 받지 않아요.
            </Text>
          </View>

          <View className="gap-element rounded-card border border-line bg-surface p-card">
            <Pressable
              accessibilityLabel="이벤트 신청 개인정보 수집·이용 동의 (필수)"
              accessibilityRole="checkbox"
              accessibilityState={{ checked: draft.consented, disabled: isSubmitting }}
              className="flex-row items-center gap-sm"
              disabled={isSubmitting}
              onPress={toggleConsent}
            >
              <Feather
                name={draft.consented ? 'check-square' : 'square'}
                size={size.icon.lg}
                color={draft.consented ? colors.brand.DEFAULT : colors.ink.disabled}
              />
              <Text className="flex-1 text-base">
                <Text className="text-base text-brand-text">[필수] </Text>
                이벤트 신청 개인정보 수집·이용 동의
              </Text>
            </Pressable>
            <View className="gap-sm rounded-2xl bg-surface-muted p-card">
              {COLLECTION_ROWS.map((row) => (
                <View key={row.label} className="flex-row">
                  <Text className="w-20 text-xs text-ink-muted">{row.label}</Text>
                  <Text className="flex-1 text-xs leading-5">{row.value}</Text>
                </View>
              ))}
            </View>
            <Text className="text-xs leading-5 text-ink-muted">
              동의하지 않을 수 있어요. 다만 동의하지 않으면 이벤트에 신청할 수 없어요.
            </Text>
          </View>

          <View className="gap-content">
            {message ? (
              <Text accessibilityRole="alert" className="text-center text-sm !text-exam-danger">
                {message}
              </Text>
            ) : null}
            <Text className="text-center text-xs text-ink-muted">
              신청 후에는 수정할 수 없어요.
            </Text>
            <Button
              disabled={!draft.consented}
              label={isSubmitting ? '보내는 중...' : '신청하기'}
              loading={isSubmitting}
              size="lg"
              onPress={() => void submit()}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <GifticonSheet
        selected={draft.gifticon}
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        onSelect={selectGifticon}
      />
    </SafeAreaView>
  );
}

function EventNote({ text, emphasized = false }: { text: string; emphasized?: boolean }) {
  return (
    <View className="flex-row items-center gap-sm">
      <View
        className="h-1.5 w-1.5 rounded-pill"
        style={{ backgroundColor: emphasized ? colors.brand[800] : colors.brand.DEFAULT }}
      />
      <Text
        className="flex-1 text-sm"
        style={{ color: emphasized ? colors.brand[800] : colors.ink.DEFAULT }}
      >
        {text}
      </Text>
    </View>
  );
}
