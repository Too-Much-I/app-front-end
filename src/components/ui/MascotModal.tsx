import type { ReactNode } from "react";
import { Image, Modal, View, type ImageSourcePropType } from "react-native";

import { Text } from "@/components/ui/Text";
import { shadows } from "@/theme";

interface MascotModalProps {
  visible: boolean;
  /** 카드 상단 마스코트. 상황에 맞는 표정을 사용처가 고른다. */
  mascot: ImageSourcePropType;
  /** 없으면 안내 박스가 곧바로 마스코트 아래에 온다. */
  title?: string;
  message: string;
  /** 안내 박스 왼쪽의 brand-cta 원형 "!" 배지. */
  warningBadge?: boolean;
  /** Android 뒤로 가기. 닫을 수 없는 안내라면 생략한다. */
  onRequestClose?: () => void;
  /** 안내 박스 아래에 붙는 내용 — 버튼, 에러 문구 등. */
  children?: ReactNode;
}

/**
 * 마스코트와 안내 박스를 가진 모달의 공용 껍데기.
 *
 * 확인 버튼이 필요하면 `ConfirmModal`을 쓴다. 이 컴포넌트를 직접 쓰는 것은
 * 버튼이 없는 알림(화면 회전 안내)처럼 확인할 것이 없는 경우다.
 *
 * `mascot`에 기본값을 두지 않는다. 기본값을 주면 어느 화면이 어떤 표정을 쓰는지가
 * 이 파일 안에 숨는다.
 */
export function MascotModal({
  visible,
  mascot,
  title,
  message,
  warningBadge = false,
  onRequestClose,
  children,
}: MascotModalProps) {
  return (
    <Modal
      animationType="fade"
      onRequestClose={onRequestClose}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View className="flex-1 items-center justify-center bg-ink/50 px-6">
        <View
          accessibilityViewIsModal
          className="w-full max-w-md items-center rounded-3xl bg-surface px-6 pb-6 pt-3"
          style={shadows.card}
        >
          {/* 얼굴 전체는 유지하고 원본 하단의 불필요한 여백만 컨테이너 밖으로 숨긴다. */}
          <View className="h-36 w-40 overflow-hidden">
            <Image className="h-40 w-40" resizeMode="contain" source={mascot} />
          </View>

          {title ? <Text className="mt-4 text-lg text-exam-navy">{title}</Text> : null}

          <View
            className={`w-full flex-row items-center rounded-2xl border border-brand-200 bg-brand-50 px-4 py-4 ${
              title ? "mt-3" : "mt-5"
            }`}
          >
            {warningBadge ? (
              <View className="mr-3 h-7 w-7 items-center justify-center rounded-full bg-brand-cta">
                <Text className="text-sm text-white">!</Text>
              </View>
            ) : null}
            <Text className="flex-1 text-sm leading-6 text-brand-900">{message}</Text>
          </View>

          {children}
        </View>
      </View>
    </Modal>
  );
}
