import { Button } from '@/components/ui/Button';
import { MascotModal } from '@/components/ui/MascotModal';
import type { ReferralRejection } from '@/features/referral/referral-application';
import type { ReferralApplicationResult } from '@/features/referral/use-referral-application-result';

// public/은 `@/` 별칭 범위(./src) 밖이라 상대 경로로 require한다.
const gift = require('../../../../public/icons/gift.png');
const shockedRabbit = require('../../../../public/mascots/shocked_rabbit.png');

/** 다시 입력할 기회가 없어(2026-10-29 D5 결정) 고치라고 하지 않고 사실만 알린다. 추천인 정보는 드러내지 않는다. */
const REJECTION_MESSAGES = {
  'self-referral': '내 추천 코드는 쓸 수 없어요.',
  'code-unavailable': '입력한 추천 코드를 찾을 수 없어서 적용하지 못했어요.',
  'already-applied': '이미 다른 추천 코드를 적용했어요.',
} as const satisfies Record<ReferralRejection, string>;

interface ReferralResultModalProps {
  visible: boolean;
  /** 닫히는 동안에도 넘긴다. 없으면 그리지 않는다. */
  result: ReferralApplicationResult | null;
  onClose: () => void;
}

/** 가입 때 입력한 추천 코드의 결과(2026-10-29 시안 B). 결과가 처음 확정된 홈에서 한 번 띄운다. */
export function ReferralResultModal({ visible, result, onClose }: ReferralResultModalProps) {
  if (!result) return null;
  const applied = result.kind === 'applied';
  return (
    <MascotModal
      cropMascotBottom={!applied}
      mascot={applied ? gift : shockedRabbit}
      message={
        result.kind === 'rejected'
          ? REJECTION_MESSAGES[result.reason]
          : '무료 모의고사권 1장을 받았어요. 코드를 알려준 친구도 1장 받았어요.'
      }
      onRequestClose={onClose}
      title={applied ? '추천 코드가 적용됐어요' : '추천 코드를 적용하지 못했어요'}
      visible={visible}
    >
      <Button className="mt-section w-full" label="확인" onPress={onClose} size="lg" />
    </MascotModal>
  );
}
