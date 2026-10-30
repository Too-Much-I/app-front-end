import { Button } from '@/components/ui/Button';
import { MascotModal } from '@/components/ui/MascotModal';

// public/은 `@/` 별칭 범위(./src) 밖이라 상대 경로로 require한다.
const gift = require('../../../../public/icons/gift.png');

interface ReferralInviteModalProps {
  visible: boolean;
  onOpenInvite: () => void;
  onDismiss: () => void;
}

/** 친구 초대 안내(2026-10-29 시안 E). 누르면 친구 초대 화면으로 간다. */
export function ReferralInviteModal({
  visible,
  onOpenInvite,
  onDismiss,
}: ReferralInviteModalProps) {
  return (
    <MascotModal
      mascot={gift}
      message="친구가 가입할 때 내 추천 코드를 입력하면 나와 친구 모두 무료 모의고사권을 받아요."
      onRequestClose={onDismiss}
      title="친구를 초대하면 둘 다 모의고사권 1장!"
      visible={visible}
    >
      <Button
        className="mt-section w-full"
        label="내 추천 코드 보기"
        onPress={onOpenInvite}
        size="lg"
      />
      <Button
        className="mt-element w-full"
        label="다음에 할게요"
        onPress={onDismiss}
        size="lg"
        variant="text"
      />
    </MascotModal>
  );
}
