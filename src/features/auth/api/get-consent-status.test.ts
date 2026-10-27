import { getConsentStatus } from '@/features/auth/api/get-consent-status';
import { serviceFetch } from '@/lib/api/transport';

jest.mock('@/lib/api/service-base-url', () => ({
  getIdentityApiBaseUrl: () => 'https://identity.test',
}));
jest.mock('@/lib/api/transport', () => ({ serviceFetch: jest.fn() }));

const REQUIRED = {
  currentVersion: 'privacy-v2',
  consentedVersion: 'privacy-v1',
  consentedAt: '2026-10-01T00:00:00Z',
  requiresConsent: true,
};
const OPTIONAL = {
  currentVersion: 'quality-review-v1',
  consented: false,
  consentedVersion: null,
  consentedAt: null,
  requiresConsent: false,
};

function respondWith(result: unknown) {
  jest.mocked(serviceFetch).mockResolvedValueOnce({
    isSuccess: true,
    code: 'SUCCESS',
    message: 'ok',
    result,
  });
}

describe('getConsentStatus의 광고성 푸시 항목', () => {
  it('서버가 항목을 주지 않으면(운영 배포 전) 실패하지 않고 null로 둔다', async () => {
    respondWith({ privacy: REQUIRED, terms: REQUIRED, qualityReview: OPTIONAL });
    await expect(getConsentStatus('token')).resolves.toMatchObject({ marketingPush: null });
  });

  it('항목이 오면 선택 동의 모양으로 읽는다', async () => {
    const marketingPush = {
      ...OPTIONAL,
      currentVersion: 'marketing-push-v1',
      consented: true,
      consentedVersion: 'marketing-push-v1',
      consentedAt: '2026-10-27T00:00:00Z',
    };
    respondWith({ privacy: REQUIRED, terms: REQUIRED, qualityReview: OPTIONAL, marketingPush });
    await expect(getConsentStatus('token')).resolves.toMatchObject({ marketingPush });
  });

  it('항목이 왔는데 모양이 다르면 다른 항목처럼 형식 오류다', async () => {
    respondWith({
      privacy: REQUIRED,
      terms: REQUIRED,
      qualityReview: OPTIONAL,
      marketingPush: { currentVersion: 'marketing-push-v1' },
    });
    await expect(getConsentStatus('token')).rejects.toThrow('동의 상태 응답 형식');
  });
});
