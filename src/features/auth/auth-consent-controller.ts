import { getConsentStatus } from '@/features/auth/api/get-consent-status';
import { updateConsents } from '@/features/auth/api/update-consents';
import {
  marketingPushConsentFields,
  type OptionalConsentChoices,
  type RequestAuthSnapshot,
  type ServerConsentStatus,
} from '@/features/auth/types';
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
  /** 이미 서버에 보낸 선택. 같은 선택으로 다시 누르면(조회만 실패한 재시도) PUT을 다시 보내지 않는다. */
  let acceptedChoices: OptionalConsentChoices | null = null;

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

  async function accept(choices: OptionalConsentChoices): Promise<ServerConsentStatus> {
    if (!current) throw new Error('동의 상태가 준비되지 않았습니다.');
    const status = current;
    const alreadySent =
      acceptedChoices?.qualityReview === choices.qualityReview &&
      acceptedChoices.marketingPush === choices.marketingPush;
    if (!alreadySent) {
      // 광고성 푸시는 서버가 항목을 줬고 화면에서 물었을 때만 보낸다. 빼면 서버가 기존 상태를 둔다.
      const marketingPush =
        choices.marketingPush !== null && status.marketingPush
          ? { consented: choices.marketingPush, version: status.marketingPush.currentVersion }
          : undefined;
      await withSession((token) =>
        updateConsents(token, {
          isPrivacyConsented: true,
          privacyConsentVersion: status.privacy.currentVersion,
          isTermConsented: true,
          termConsentVersion: status.terms.currentVersion,
          isQualityReviewConsented: choices.qualityReview,
          qualityReviewConsentVersion: status.qualityReview.currentVersion,
          ...marketingPushConsentFields(marketingPush),
        }),
      );
      acceptedChoices = choices;
    }
    const statusAfterUpdate = await load();
    acceptedChoices = null;
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

  /** 광고성 푸시 동의 여부. 서버가 항목을 주지 않으면 `null`이라 설정에서 토글을 그리지 않는다. */
  async function readMarketingPushConsent(): Promise<boolean | null> {
    return (await load()).marketingPush?.consented ?? null;
  }

  /**
   * 알림 설정의 이벤트·혜택 알림 토글(2026-10-27 결정). 답변 검토는 서버가 "빠지면 false"로 보므로 지금 값을 함께
   * 보낸다 — 빼면 광고 알림을 끄는 순간 답변 검토 동의까지 철회된다.
   */
  async function setMarketingPushConsent(consented: boolean): Promise<void> {
    const status = current ?? (await load());
    const marketingPush = status.marketingPush;
    if (!marketingPush) throw new Error('광고성 푸시 동의 항목이 없습니다.');
    await withSession((token) =>
      updateConsents(token, {
        isPrivacyConsented: true,
        privacyConsentVersion: status.privacy.consentedVersion,
        isTermConsented: true,
        termConsentVersion: status.terms.consentedVersion,
        isQualityReviewConsented: status.qualityReview.consented,
        qualityReviewConsentVersion: status.qualityReview.currentVersion,
        isMarketingPushConsented: consented,
        marketingPushConsentVersion: marketingPush.currentVersion,
      }),
    );
    current = { ...status, marketingPush: { ...marketingPush, consented } };
  }

  return {
    load,
    accept,
    readQualityReviewConsent,
    setQualityReviewConsent,
    readMarketingPushConsent,
    setMarketingPushConsent,
  };
}
