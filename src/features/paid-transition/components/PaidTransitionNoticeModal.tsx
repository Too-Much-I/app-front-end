import { Image, Modal, View, useWindowDimensions } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { shadows } from '@/theme';

// public/은 `@/` 별칭 범위(./src) 밖이라 상대 경로로 require한다.
const thanksRabbit = require('../../../../public/mascots/thanks_heart_rabbit.jpg');

/** 시안에서 카드 폭 342에 그림 높이 300. 토끼 발밑 배경까지 보이는 비율이다. */
const ILLUSTRATION_ASPECT_RATIO = 342 / 300;
/** 작은 화면(높이 667)에서 버튼이 화면 밖으로 밀리지 않도록 그림이 차지할 수 있는 화면 높이 비율. */
const MAX_ILLUSTRATION_SCREEN_RATIO = 0.35;

interface PaidTransitionNoticeModalProps {
  visible: boolean;
  onConfirm: () => void;
  onOpenPass: () => void;
}

/** 2.x를 쓰던 사용자에게 3.0.0에서 모의고사가 이용권제로 바뀐 이유를 한 번 알린다. */
export function PaidTransitionNoticeModal({
  visible,
  onConfirm,
  onOpenPass,
}: PaidTransitionNoticeModalProps) {
  const { height } = useWindowDimensions();

  return (
    <Modal
      animationType="fade"
      onRequestClose={onConfirm}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View className="flex-1 items-center justify-center bg-ink/50 px-6">
        <View
          accessibilityViewIsModal
          className="w-full max-w-md overflow-hidden rounded-card bg-surface"
          style={shadows.card}
        >
          <Image
            className="w-full"
            resizeMode="cover"
            source={thanksRabbit}
            style={{
              aspectRatio: ILLUSTRATION_ASPECT_RATIO,
              maxHeight: height * MAX_ILLUSTRATION_SCREEN_RATIO,
            }}
          />
          <View className="p-2xl">
            <Text accessibilityRole="header" className="text-lg leading-8 text-exam-navy">
              {'그동안 무료로 써 주셔서\n감사했어요'}
            </Text>
            <Text className="mt-md text-sm leading-6 text-ink">
              모의고사 채점과 피드백, 기록 저장에 드는 비용이 커져, 무료로는 서비스를 이어 가기
              어려워졌어요. 그래서 이번 업데이트부터 모의고사는 이용권이 있어야 볼 수 있어요.
            </Text>
            <Button
              className="mt-section w-full"
              label="확인했어요"
              size="lg"
              onPress={onConfirm}
            />
            <Button
              className="mt-element w-full"
              label="이용권 살펴보기"
              size="lg"
              variant="text"
              onPress={onOpenPass}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}
