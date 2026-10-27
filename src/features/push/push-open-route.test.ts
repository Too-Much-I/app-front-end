import { readPushOpenRoute } from '@/features/push/push-open-route';

describe('readPushOpenRoute', () => {
  it('모의고사 리마인더와 기프티콘 이벤트 route를 읽는다', () => {
    expect(readPushOpenRoute({ data: { route: 'MOCK_EXAM_HOME' } })).toBe('MOCK_EXAM_HOME');
    expect(
      readPushOpenRoute({ data: { type: 'CASHBACK_EVENT', route: 'CASHBACK_EVENT_HOME' } }),
    ).toBe('CASHBACK_EVENT_HOME');
  });

  it('type만 있거나 모르는 route면 이동하지 않는다', () => {
    expect(readPushOpenRoute({ data: { type: 'CASHBACK_EVENT' } })).toBeNull();
    expect(readPushOpenRoute({ data: { route: 'UNKNOWN_HOME' } })).toBeNull();
    expect(readPushOpenRoute(null)).toBeNull();
  });
});
