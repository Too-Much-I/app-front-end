import { pickHomeNotice } from '@/screens/home/home-notice';

const SETTLED_NONE = { status: 'none' } as const;

describe('pickHomeNotice', () => {
  it('추천 코드 결과를 모르면 아무것도 띄우지 않고 기다린다', () => {
    expect(
      pickHomeNotice({
        referralResult: { status: 'checking' },
        paidTransition: 'visible',
        referralInvite: 'pending',
      }),
    ).toBeNull();
  });

  it('추천 코드 결과 → 유료 전환 → 친구 초대 순서다', () => {
    expect(
      pickHomeNotice({
        referralResult: { status: 'open', result: { kind: 'applied' } },
        paidTransition: 'visible',
        referralInvite: 'pending',
      }),
    ).toBe('referral-result');
    expect(
      pickHomeNotice({
        referralResult: SETTLED_NONE,
        paidTransition: 'visible',
        referralInvite: 'pending',
      }),
    ).toBe('paid-transition');
    expect(
      pickHomeNotice({
        referralResult: SETTLED_NONE,
        paidTransition: 'hidden',
        referralInvite: 'pending',
      }),
    ).toBe('referral-invite');
  });

  it('유료 전환 안내를 띄울지 모르면 친구 초대는 기다린다', () => {
    expect(
      pickHomeNotice({
        referralResult: SETTLED_NONE,
        paidTransition: 'loading',
        referralInvite: 'pending',
      }),
    ).toBeNull();
  });

  it('결과 팝업을 닫으면 사라지는 동안에도 다음 팝업으로 넘어간다', () => {
    expect(
      pickHomeNotice({
        referralResult: { status: 'closing', result: { kind: 'applied' } },
        paidTransition: 'visible',
        referralInvite: 'pending',
      }),
    ).toBe('paid-transition');
  });

  it('친구 초대를 닫으면 아무것도 띄우지 않는다', () => {
    expect(
      pickHomeNotice({
        referralResult: SETTLED_NONE,
        paidTransition: 'hidden',
        referralInvite: 'done',
      }),
    ).toBeNull();
  });
});
