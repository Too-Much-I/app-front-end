import { getAppVersionPolicy } from '@/features/app-version/api/app-version-policy';
import { getAppUpdateRequirement } from '@/features/app-version/app-update-requirement';
import { ApiError, TransportConnectionError } from '@/lib/api/transport';
import { reportOperationalError } from '@/lib/operational-error-reporting';

jest.mock('@/features/app-version/api/app-version-policy', () => ({
  getAppVersionPolicy: jest.fn(),
}));
jest.mock('@/lib/operational-error-reporting', () => ({ reportOperationalError: jest.fn() }));

const policyMock = jest.mocked(getAppVersionPolicy);
const reportMock = jest.mocked(reportOperationalError);

beforeEach(() => {
  jest.useFakeTimers();
  policyMock.mockReset();
  reportMock.mockClear();
});
afterEach(() => {
  jest.useRealTimers();
});

describe('강제 업데이트 확인', () => {
  it('정책을 받으면 설치 버전과 비교한 결과를 돌려준다', async () => {
    policyMock.mockResolvedValue({ minimumVersion: '3.0.0' });

    await expect(getAppUpdateRequirement('ios', '2.9.0')).resolves.toBe('required');
  });

  it('연결이 잠깐 끊겼다 돌아오면 재시도해서 판단한다', async () => {
    policyMock
      .mockRejectedValueOnce(new TransportConnectionError())
      .mockResolvedValueOnce({ minimumVersion: '3.0.0' });

    const result = getAppUpdateRequirement('android', '3.0.0');
    await jest.advanceTimersByTimeAsync(1_000);

    await expect(result).resolves.toBe('not-required');
    expect(reportMock).not.toHaveBeenCalled();
  });

  it('세 번 모두 연결에 실패하면 connection-failed로 알린다', async () => {
    policyMock.mockRejectedValue(new TransportConnectionError());

    const result = getAppUpdateRequirement('ios', '3.0.0');
    await jest.advanceTimersByTimeAsync(2_000);

    await expect(result).resolves.toBe('connection-failed');
    expect(policyMock).toHaveBeenCalledTimes(3);
    expect(reportMock).toHaveBeenCalledTimes(1);
  });

  it('서버가 답한 실패는 다시 묻지 않고 막지도 않는다', async () => {
    policyMock.mockRejectedValue(new ApiError(503, 'unavailable', 'APP_VERSION_UNAVAILABLE'));

    await expect(getAppUpdateRequirement('ios', '1.0.0')).resolves.toBe('unknown');
    expect(policyMock).toHaveBeenCalledTimes(1);
  });
});
