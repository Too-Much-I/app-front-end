import { getConsentStatus } from '@/features/auth/api/get-consent-status';
import { updateConsents } from '@/features/auth/api/update-consents';
import type { RequestAuthSnapshot, ServerConsentStatus } from '@/features/auth/types';
import { persistConsent } from '@/features/consent/consent-storage';
import {
  createOptionalConsentRecord,
  persistOptionalConsent,
} from '@/features/consent/optional-consent-storage';
import { SessionRestorationError } from '@/features/auth/session-restoration-types';
import { ApiError } from '@/lib/api/transport';

interface ConsentSessionAccess {
  prepareRequest: () => Promise<RequestAuthSnapshot>;
  recoverUnauthorized: (generation: number, code?: string) => Promise<RequestAuthSnapshot>;
}

/** 약관 API는 새 세션만 사용한다. 선택 동의 저장이 필수 동의 버전을 올리지 않는다. */
export function createAuthConsentController(session: ConsentSessionAccess) {
  let current: ServerConsentStatus | null = null;
  let acceptedChoice: boolean | null = null;

  async function withSession<T>(request: (token: string) => Promise<T>): Promise<T> {
    const snapshot = await session.prepareRequest();
    try {
      return await request(snapshot.accessToken);
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) throw error;
      const retry = await session.recoverUnauthorized(snapshot.generation, error.code);
      return request(retry.accessToken);
    }
  }

  async function load(): Promise<ServerConsentStatus> {
    current = await withSession(getConsentStatus);
    // 서버가 정본이다. 선택 동의의 로컬 사본 저장 실패는 서버 결과를 뒤집지 않는다.
    try {
      await persistOptionalConsent(
        createOptionalConsentRecord(
          current.qualityReview.consented,
          current.qualityReview.consentedAt ?? undefined,
        ),
      );
    } catch {
      /* 다음 조회에서 다시 동기화한다. */
    }
    if (!current.privacy.requiresConsent && !current.terms.requiresConsent) {
      try {
        await persistConsent({
          schemaVersion: 2,
          privacy: {
            consented: true,
            version: current.privacy.consentedVersion,
            agreedAt: current.privacy.consentedAt,
          },
          term: {
            consented: true,
            version: current.terms.consentedVersion,
            agreedAt: current.terms.consentedAt,
          },
        });
      } catch {
        throw new SessionRestorationError('storage');
      }
    }
    return current;
  }

  async function accept(qualityReview: boolean): Promise<ServerConsentStatus> {
    if (!current) throw new Error('동의 상태가 준비되지 않았습니다.');
    const status = current;
    if (acceptedChoice !== qualityReview) {
      await withSession((token) =>
        updateConsents(token, {
          isPrivacyConsented: true,
          privacyConsentVersion: status.privacy.currentVersion,
          isTermConsented: true,
          termConsentVersion: status.terms.currentVersion,
          isQualityReviewConsented: qualityReview,
          qualityReviewConsentVersion: status.qualityReview.currentVersion,
        }),
      );
      acceptedChoice = qualityReview;
    }
    const statusAfterUpdate = await load();
    acceptedChoice = null;
    return statusAfterUpdate;
  }

  async function readQualityReviewConsent(): Promise<boolean> {
    return (await load()).qualityReview.consented;
  }

  async function setQualityReviewConsent(consented: boolean): Promise<void> {
    const status = current ?? (await load());
    await withSession((token) =>
      updateConsents(token, {
        isPrivacyConsented: true,
        privacyConsentVersion: status.privacy.consentedVersion,
        isTermConsented: true,
        termConsentVersion: status.terms.consentedVersion,
        isQualityReviewConsented: consented,
        qualityReviewConsentVersion: status.qualityReview.currentVersion,
      }),
    );
    current = {
      ...status,
      qualityReview: { ...status.qualityReview, consented },
    };
    try {
      await persistOptionalConsent(createOptionalConsentRecord(consented));
    } catch {
      /* 서버 반영이 끝났으므로 화면을 이전 값으로 되돌리지 않는다. */
    }
  }

  return { load, accept, readQualityReviewConsent, setQualityReviewConsent };
}
