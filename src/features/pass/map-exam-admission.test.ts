import { entitlementsSchema, mapExamAdmission } from '@/features/pass/map-exam-admission';

function admission(raw: unknown) {
  return mapExamAdmission(entitlementsSchema.parse(raw));
}

describe('모의고사 진입 판단', () => {
  it('canTakeExam이 true면 들어가고, 안내용 값을 옮긴다', () => {
    expect(
      admission({
        paid: { continuousAccessEndsAt: '2026-11-01T00:00:00Z', hasPendingSync: false },
        examAvailability: { canTakeExam: true, preferredSource: 'PAID' },
      }),
    ).toEqual({
      kind: 'allowed',
      source: 'paid',
      paidEndsAt: new Date('2026-11-01T00:00:00Z'),
      hasPendingPayment: false,
    });
  });

  it('유료 이용권이 활성이어도 canTakeExam이 false면 막는다', () => {
    expect(
      admission({
        paid: { continuousAccessEndsAt: '2099-01-01T00:00:00Z' },
        examAvailability: { canTakeExam: false },
      }),
    ).toEqual({ kind: 'pass-required' });
  });

  it('막혔는데 반영 대기 결제가 있으면 결제 화면 대신 대기 상태다', () => {
    // pass-required로 보내면 사용자가 두 번 결제할 수 있다.
    expect(
      admission({ paid: { hasPendingSync: true }, examAvailability: { canTakeExam: false } }),
    ).toEqual({ kind: 'payment-pending' });
  });

  it.each([[{}], [{ examAvailability: null }], [{ examAvailability: { canTakeExam: null } }]])(
    '서버가 판정하지 못하면(%p) unknown이다',
    (raw) => {
      expect(admission(raw)).toEqual({ kind: 'unknown' });
    },
  );

  it.each([
    ['FREE_NEW', 'free'],
    ['FREE_RETAKE', 'free'],
    ['SOMETHING_NEW', null],
  ])('출처 %s는 %p로 읽고, 깨진 날짜는 null이다', (preferredSource, source) => {
    expect(
      admission({
        paid: { continuousAccessEndsAt: 'not-a-date' },
        examAvailability: { canTakeExam: true, preferredSource },
      }),
    ).toMatchObject({ kind: 'allowed', source, paidEndsAt: null });
  });
});
