import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { MascotModal } from '@/components/ui/MascotModal';

const hmmRabbit = require('../../../../public/mascots/hmm_rabbit_tight.png');

interface PassRequiredModalProps {
  visible: boolean;
  /** 어떤 행동이 막혔는지에 따라 문구가 다르다. 기본은 시험 시작. */
  message?: string;
  ctaLabel?: string;
  onOpenPass: () => void;
  onClose: () => void;
}

/**
 * 서버가 응시권이 없다(402)고 거절했을 때의 안내. 시험 시작과 재답변 제출이 함께 쓴다.
 *
 * 준비 화면의 진입 확인(`canTakeExam=false`)은 팝업 없이 결제 화면으로 보낸다. 여기는 준비 화면을 통과한 뒤
 * 막힌 것이라, 왜 결제 화면으로 가는지 알 수 있게 팝업으로 알린다(2026-10-17 결정).
 */
export function PassRequiredModal({
  visible,
  message = '이용권을 구매하면 모의고사를 볼 수 있어요.',
  ctaLabel = '이용권 보러 가기',
  onOpenPass,
  onClose,
}: PassRequiredModalProps) {
  return (
    <MascotModal
      mascot={hmmRabbit}
      message={message}
      title="응시권이 없어요"
      visible={visible}
      onRequestClose={onClose}
    >
      <View className="w-full">
        <Button className="mt-section w-full" label={ctaLabel} size="lg" onPress={onOpenPass} />
        <Button
          className="mt-element w-full"
          label="닫기"
          size="lg"
          variant="text"
          onPress={onClose}
        />
      </View>
    </MascotModal>
  );
}
