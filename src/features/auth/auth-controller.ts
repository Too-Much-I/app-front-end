import { getConsentStatus } from "@/features/auth/api/get-consent-status";
import { createGuest } from "@/features/auth/api/create-guest";
import { logout } from "@/features/auth/api/logout";
import {
  isDefinitiveRefreshFailure,
  reissueTokens,
} from "@/features/auth/api/reissue-tokens";
import { updateConsents } from "@/features/auth/api/update-consents";
import {
  clearAuthSession,
  readAuthSession,
  writeAuthSession,
} from "@/features/auth/auth-session-storage";
import {
  getOrCreateInstallationId,
  InstallationIdError,
  persistInstallationId,
} from "@/features/auth/installation-id";
import type {
  AuthBootstrapState,
  AuthSession,
  BootstrapRetry,
  BootstrapSource,
  ConsentRequirements,
  GuestAuthRequest,
  RequestAuthSnapshot,
  ServerConsentStatus,
  UpdateConsentsRequest,
} from "@/features/auth/types";
import {
  createConsentRecord,
  getStoredConsent,
  isCurrentConsent,
  persistConsent,
  type ConsentRecordV2,
} from "@/features/consent/consent-storage";
import {
  createOptionalConsentRecord,
  getStoredOptionalConsent,
  persistOptionalConsent,
  QUALITY_REVIEW_CONSENT_VERSION,
} from "@/features/consent/optional-consent-storage";
import { ApiError } from "@/lib/api/transport";
import { reportOperationalError } from "@/lib/operational-error-reporting";

const PROACTIVE_REFRESH_WINDOW_MS = 60_000;
const RETRY_MESSAGE = "인증을 준비하지 못했습니다. 잠시 후 다시 시도해주세요.";
const ALL_CONSENTS_REQUIRED: ConsentRequirements = { privacy: true, terms: true };

function logAuthDebug(message: string, error?: unknown): void {
  if (!__DEV__) return;
  if (error === undefined) {
    console.log(`[Auth] ${message}`);
    return;
  }
  const details =
    error instanceof ApiError
      ? {
          name: error.name,
          message: error.message,
          status: error.status,
          code: error.code,
        }
      : error instanceof Error
        ? { name: error.name, message: error.message }
        : { valueType: typeof error };
  console.error(`[Auth] ${message}`, details);
}

type AuthStateListener = () => void;
type SessionContinuation = "authenticated" | "check-consent";

class AuthController {
  private state: AuthBootstrapState = { status: "CHECKING_LOCAL" };
  private readonly listeners = new Set<AuthStateListener>();
  private session: AuthSession | null = null;
  private generation = 0;
  private bootstrapPromise: Promise<void> | null = null;
  private rotationPromise: Promise<AuthSession> | null = null;
  private pendingRotationSession: AuthSession | null = null;
  private runGeneration = 0;
  private consent: ConsentRecordV2 | null = null;
  /**
   * 선택 동의(채점 품질 개선)의 마지막으로 알려진 값. 저장소에서 읽어 두었다가
   * 게스트 생성·동의 갱신 요청에 실어 보낸다. 아직 읽지 못했거나 이용자가 한 번도
   * 선택하지 않았으면 `null`이며, 요청에는 `false`로 나간다.
   */
  private optionalConsentGranted: boolean | null = null;
  private serverConsent: ServerConsentStatus | null = null;
  private installationId: string | null = null;
  private reissueSession: AuthSession | null = null;
  private reportingAttempt = 0;
  private reportingAttemptKind: "initial" | "retry" = "initial";
  private lastReportedAttempt = -1;

  getState = (): AuthBootstrapState => this.state;

  subscribe = (listener: AuthStateListener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private setState(state: AuthBootstrapState, run?: number): void {
    if (run !== undefined && run !== this.runGeneration) {
      return;
    }
    this.state = state;
    this.listeners.forEach((listener) => listener());
  }

  private setRetry(
    source: BootstrapSource,
    retry: BootstrapRetry,
    run?: number,
    cause?: unknown,
  ): void {
    if (run !== undefined && run !== this.runGeneration) return;
    if (this.lastReportedAttempt !== this.reportingAttempt) {
      this.lastReportedAttempt = this.reportingAttempt;
      reportOperationalError({
        code: "AUTH_BOOTSTRAP_FAILED",
        source,
        operation: retry.operation,
        attempt: this.reportingAttemptKind,
        cause,
      });
    }
    this.setState({ status: "RETRYABLE_ERROR", source, retry, message: RETRY_MESSAGE }, run);
  }

  startBootstrap(): () => void {
    void this.bootstrap();
    return () => undefined;
  }

  async bootstrap(): Promise<void> {
    if (this.bootstrapPromise) {
      return this.bootstrapPromise;
    }

    this.reportingAttempt += 1;
    this.reportingAttemptKind = "initial";
    const run = ++this.runGeneration;
    this.setState({ status: "CHECKING_LOCAL" }, run);
    this.bootstrapPromise = this.runBootstrap(run);
    try {
      await this.bootstrapPromise;
    } finally {
      if (run === this.runGeneration) {
        this.bootstrapPromise = null;
      }
    }
  }

  private async runBootstrap(run: number, preserveRetryUi = false): Promise<void> {
    try {
      const storedSession = await readAuthSession();
      if (storedSession) {
        this.reissueSession = storedSession;
        if (!preserveRetryUi) {
          this.setState({ status: "REISSUING" }, run);
        }
        await this.reissueForBootstrap(storedSession, run, preserveRetryUi);
        return;
      }

      await this.prepareSessionlessBootstrap(run, preserveRetryUi);
    } catch (error) {
      logAuthDebug("bootstrap failed unexpectedly", error);
      this.setRetry("startup", { operation: "read-local" }, run, error);
    }
  }

  private async prepareSessionlessBootstrap(run: number, preserveRetryUi = false): Promise<void> {
    try {
      this.installationId = await getOrCreateInstallationId();
    } catch (error) {
      logAuthDebug("installation id preparation failed", error);
      if (error instanceof InstallationIdError && error.pendingInstallationId) {
        this.setRetry(
          "startup",
          { operation: "persist-installation", installationId: error.pendingInstallationId },
          run,
          error,
        );
      } else {
        this.setRetry("startup", { operation: "read-local" }, run, error);
      }
      return;
    }

    await this.continueSessionlessBootstrap(run, preserveRetryUi);
  }

  private async continueSessionlessBootstrap(run: number, preserveRetryUi = false): Promise<void> {
    let consent: ConsentRecordV2 | null;
    try {
      consent = await getStoredConsent();
    } catch (error) {
      logAuthDebug("stored consent read failed", error);
      this.setRetry("startup", { operation: "read-local" }, run, error);
      return;
    }

    // 게스트 생성 요청에 선택 동의를 실으려면 그 전에 읽어 두어야 한다.
    await this.loadOptionalConsent();

    if (!consent || !isCurrentConsent(consent)) {
      this.consent = null;
      this.setState(
        { status: "CONSENT_REQUIRED", mode: "new", requiredItems: ALL_CONSENTS_REQUIRED },
        run,
      );
      return;
    }

    this.consent = consent;
    await this.recoverGuest("startup", run, preserveRetryUi);
  }

  async acceptConsent(): Promise<void> {
    if (this.state.status !== "CONSENT_REQUIRED") {
      return;
    }

    this.reportingAttempt += 1;
    this.reportingAttemptKind = "initial";
    const run = this.runGeneration;
    // 동의 화면이 선택 동의를 먼저 저장한 뒤 이 메서드를 부른다. 아래 두 갈래
    // (게스트 생성 / 동의 갱신) 모두 요청을 만들 때 이 값을 쓰므로 먼저 읽는다.
    await this.loadOptionalConsent();
    if (this.state.mode === "existing") {
      const request = this.buildUpdateConsentsRequest();
      if (!request) {
        this.setRetry("consent-submit", { operation: "check-consent" }, run);
        return;
      }
      await this.updateExistingConsents(request, run);
      return;
    }

    const consent = createConsentRecord();
    this.consent = consent;
    this.setState({ status: "GUEST_RECOVERING", source: "consent-submit" }, run);
    try {
      await persistConsent(consent);
    } catch (error) {
      this.setRetry(
        "consent-submit",
        { operation: "persist-consent", consent, continuation: "guest" },
        run,
        error,
      );
      return;
    }
    await this.recoverGuest("consent-submit", run);
  }

  private buildGuestRequest(): GuestAuthRequest | null {
    if (!this.consent || !this.installationId) {
      return null;
    }
    return {
      installationId: this.installationId,
      isPrivacyConsented: true,
      privacyConsentVersion: this.consent.privacy.version,
      isTermConsented: true,
      termConsentVersion: this.consent.term.version,
      isQualityReviewConsented: this.optionalConsentGranted ?? false,
      qualityReviewConsentVersion: QUALITY_REVIEW_CONSENT_VERSION,
    };
  }

  /**
   * 저장된 선택 동의를 컨트롤러 필드로 읽어 온다.
   *
   * 게스트 생성 요청을 만들기 전에 반드시 한 번 호출되어야 한다. 최초 동의 흐름은
   * 서버 동의 조회(GET)를 타지 않으므로, 여기서 읽은 값이 `POST /auth/guest`에
   * 실리지 않으면 이용자의 선택이 서버에 영영 도달하지 않는다.
   *
   * 읽기에 실패해도 부트스트랩을 멈추지 않는다. 선택 항목이라 없어도 서비스 이용에
   * 지장이 없고, 값이 없으면 `false`로 나가 개인정보를 덜 쓰는 쪽으로 기운다.
   */
  private async loadOptionalConsent(): Promise<void> {
    const record = await getStoredOptionalConsent();
    this.optionalConsentGranted = record?.qualityReview.consented ?? null;
  }

  /**
   * 서버가 알려준 선택 동의 상태를 기기에 반영한다.
   *
   * 기기를 바꾸거나 앱을 지웠다 깔면 로컬 기록만 사라지고 서버 기록은 남는다.
   * 그 경우 서버 값이 진실이므로 내려받아 덮어쓴다.
   */
  private async syncOptionalConsent(status: ServerConsentStatus): Promise<void> {
    this.optionalConsentGranted = status.qualityReview.consented;
    try {
      await persistOptionalConsent(
        createOptionalConsentRecord(
          status.qualityReview.consented,
          status.qualityReview.consentedAt ?? undefined,
        ),
      );
    } catch {
      // 로컬 반영 실패는 다음 실행에서 다시 시도되므로 흐름을 멈추지 않는다.
    }
  }

  private async recoverGuest(
    source: BootstrapSource,
    run: number,
    preserveRetryUi = false,
  ): Promise<void> {
    const request = this.buildGuestRequest();
    if (!request) {
      this.setRetry(source, { operation: "read-local" }, run);
      return;
    }
    if (!preserveRetryUi) {
      this.setState({ status: "GUEST_RECOVERING", source }, run);
    }
    try {
      const session = await createGuest(request);
      const continuation: SessionContinuation =
        source === "startup" ? "check-consent" : "authenticated";
      await this.persistAndCommit(session, source, continuation, run);
    } catch (error) {
      logAuthDebug("guest recovery failed", error);
      this.setRetry(source, { operation: "guest" }, run, error);
    }
  }

  private async reissueForBootstrap(
    session: AuthSession,
    run: number,
    preserveRetryUi = false,
  ): Promise<void> {
    try {
      const nextSession = await reissueTokens(session.refreshToken);
      await this.persistAndCommit(nextSession, "startup", "check-consent", run);
    } catch (error) {
      logAuthDebug("token reissue failed", error);
      if (isDefinitiveRefreshFailure(error)) {
        await this.prepareSessionlessBootstrap(run, preserveRetryUi);
        return;
      }
      this.setRetry("startup", { operation: "reissue" }, run, error);
    }
  }

  private async persistAndCommit(
    session: AuthSession,
    source: BootstrapSource,
    continuation: SessionContinuation,
    run?: number,
  ): Promise<boolean> {
    try {
      await writeAuthSession(session);
    } catch (error) {
      logAuthDebug("session persistence failed", error);
      this.setRetry(
        source,
        { operation: "persist-session", session, continuation },
        run,
        error,
      );
      return false;
    }

    this.commitSession(session);
    if (continuation === "check-consent") {
      await this.checkServerConsent(run ?? this.runGeneration);
    } else {
      this.setState({ status: "AUTHENTICATED" }, run);
    }
    return true;
  }

  private commitSession(session: AuthSession): void {
    this.session = session;
    this.generation += 1;
  }

  private async checkServerConsent(
    run: number,
    source: BootstrapSource = "startup",
    preserveRetryUi = false,
    didRetryUnauthorized = false,
  ): Promise<void> {
    if (!preserveRetryUi) {
      this.setState({ status: "CHECKING_SERVER_CONSENT" }, run);
    }

    try {
      const status = await getConsentStatus(this.requireSession().accessToken);
      this.serverConsent = status;
      await this.syncOptionalConsent(status);
      const requiredItems = this.getConsentRequirements(status);
      if (requiredItems.privacy || requiredItems.terms) {
        this.setState(
          { status: "CONSENT_REQUIRED", mode: "existing", requiredItems },
          run,
        );
        return;
      }

      const consent = this.createSyncedConsentRecord(status);
      try {
        await persistConsent(consent);
      } catch (error) {
        this.setRetry(
          source,
          { operation: "persist-consent", consent, continuation: "authenticated" },
          run,
          error,
        );
        return;
      }
      this.consent = consent;
      this.setState({ status: "AUTHENTICATED" }, run);
    } catch (error) {
      logAuthDebug("server consent check failed", error);
      if (error instanceof ApiError && error.status === 401 && !didRetryUnauthorized) {
        try {
          await this.rotateSession();
          await this.checkServerConsent(run, source, preserveRetryUi, true);
          return;
        } catch {
          // 아래의 동일 GET 재시도 상태로 수렴한다.
        }
      }
      this.setRetry(source, { operation: "check-consent" }, run, error);
    }
  }

  /**
   * 동의 화면을 다시 띄워야 하는지 판단한다.
   *
   * `status.qualityReview.requiresConsent`는 의도적으로 보지 않는다. 필수 항목에서
   * 이 값은 "동의해야 진행 가능"이지만 선택 항목에서는 "문구가 바뀌었으니 다시
   * 물어볼 것"이라는 뜻이다. 여기에 넣으면 선택 항목 하나 때문에 앱 진입이 막힌다.
   */
  private getConsentRequirements(status: ServerConsentStatus): ConsentRequirements {
    return {
      privacy: status.privacy.requiresConsent,
      terms: status.terms.requiresConsent,
    };
  }

  private createSyncedConsentRecord(status: ServerConsentStatus): ConsentRecordV2 {
    return {
      schemaVersion: 2,
      privacy: {
        consented: true,
        version: status.privacy.consentedVersion,
        agreedAt: status.privacy.consentedAt,
      },
      term: {
        consented: true,
        version: status.terms.consentedVersion,
        agreedAt: status.terms.consentedAt,
      },
    };
  }

  private buildUpdateConsentsRequest(): UpdateConsentsRequest | null {
    if (!this.serverConsent) {
      return null;
    }
    return {
      isPrivacyConsented: true,
      privacyConsentVersion: this.serverConsent.privacy.currentVersion,
      isTermConsented: true,
      termConsentVersion: this.serverConsent.terms.currentVersion,
      isQualityReviewConsented: this.optionalConsentGranted ?? false,
      qualityReviewConsentVersion: QUALITY_REVIEW_CONSENT_VERSION,
    };
  }

  private createUpdatedConsentRecord(
    status: ServerConsentStatus,
    agreedAt: string,
  ): ConsentRecordV2 {
    return {
      schemaVersion: 2,
      privacy: {
        consented: true,
        version: status.privacy.requiresConsent
          ? status.privacy.currentVersion
          : status.privacy.consentedVersion,
        agreedAt: status.privacy.requiresConsent ? agreedAt : status.privacy.consentedAt,
      },
      term: {
        consented: true,
        version: status.terms.requiresConsent
          ? status.terms.currentVersion
          : status.terms.consentedVersion,
        agreedAt: status.terms.requiresConsent ? agreedAt : status.terms.consentedAt,
      },
    };
  }

  private async updateExistingConsents(
    request: UpdateConsentsRequest,
    run: number,
    preserveRetryUi = false,
    didRetryUnauthorized = false,
  ): Promise<void> {
    if (!this.serverConsent) {
      this.setRetry("consent-submit", { operation: "check-consent" }, run);
      return;
    }
    if (!preserveRetryUi) {
      this.setState({ status: "CONSENT_UPDATING", source: "consent-submit" }, run);
    }

    try {
      await updateConsents(this.requireSession().accessToken, request);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401 && !didRetryUnauthorized) {
        try {
          await this.rotateSession();
          await this.updateExistingConsents(request, run, preserveRetryUi, true);
          return;
        } catch {
          // 아래의 동일 PUT 재시도 상태로 수렴한다.
        }
      }
      this.setRetry(
        "consent-submit",
        { operation: "update-consent", request },
        run,
        error,
      );
      return;
    }

    const consent = this.createUpdatedConsentRecord(
      this.serverConsent,
      new Date().toISOString(),
    );
    try {
      await persistConsent(consent);
    } catch (error) {
      this.setRetry(
        "consent-submit",
        { operation: "persist-consent", consent, continuation: "authenticated" },
        run,
        error,
      );
      return;
    }
    this.consent = consent;
    this.setState({ status: "AUTHENTICATED" }, run);
  }

  async retry(): Promise<void> {
    if (this.state.status !== "RETRYABLE_ERROR" || this.state.isRetrying) {
      return;
    }
    const { retry, source } = this.state;
    const run = this.runGeneration;
    this.reportingAttempt += 1;
    this.reportingAttemptKind = "retry";
    logAuthDebug(`retry started: source=${source}, operation=${retry.operation}`);
    this.setState({ ...this.state, isRetrying: true }, run);

    // 동의 제출이 실패한 뒤 이용자가 선택 항목 체크를 바꾸고 다시 시도할 수 있다.
    // 동의 화면은 재시도 전에 바뀐 값을 저장하므로, 여기서 다시 읽어야 최신 선택이
    // 요청에 실린다.
    await this.loadOptionalConsent();

    if (retry.operation === "read-local") {
      await this.runBootstrap(run, true);
      return;
    }
    if (retry.operation === "persist-consent") {
      try {
        await persistConsent(retry.consent);
      } catch (error) {
        this.setRetry(source, retry, run, error);
        return;
      }
      this.consent = retry.consent;
      if (retry.continuation === "guest") {
        await this.recoverGuest(source, run, true);
      } else {
        this.setState({ status: "AUTHENTICATED" }, run);
      }
      return;
    }
    if (retry.operation === "persist-installation") {
      try {
        this.installationId = await persistInstallationId(retry.installationId);
      } catch (error) {
        this.setRetry(source, retry, run, error);
        return;
      }
      await this.continueSessionlessBootstrap(run, true);
      return;
    }
    if (retry.operation === "guest") {
      await this.recoverGuest(source, run, true);
      return;
    }
    if (retry.operation === "reissue") {
      if (!this.reissueSession) {
        this.setRetry(source, { operation: "read-local" }, run);
        return;
      }
      await this.reissueForBootstrap(this.reissueSession, run, true);
      return;
    }
    if (retry.operation === "persist-session") {
      await this.persistAndCommit(retry.session, source, retry.continuation, run);
      return;
    }
    if (retry.operation === "check-consent") {
      await this.checkServerConsent(run, source, true);
      return;
    }
    // 굳어진 요청에서 선택 항목만 최신 값으로 바꾼다. 필수 항목 버전은 재시도
    // 시점에도 그대로여야 하므로 요청 전체를 다시 만들지는 않는다.
    await this.updateExistingConsents(
      {
        ...retry.request,
        isQualityReviewConsented: this.optionalConsentGranted ?? false,
        qualityReviewConsentVersion: QUALITY_REVIEW_CONSENT_VERSION,
      },
      run,
      true,
    );
  }

  /**
   * 게스트 계정을 삭제하고 새 게스트로 앱을 다시 시작한다 — 설정의 "모든 학습 기록 삭제".
   *
   * consent와 installationId는 남긴다. 로컬 동의 기록이 있어야 재부트스트랩이 재동의
   * 화면으로 빠지지 않고, 서버 게스트가 이미 삭제됐으므로 같은 installationId로도
   * 복구될 대상이 없어 빈 게스트가 새로 발급된다.
   */
  async deleteGuestAccount(): Promise<void> {
    logAuthDebug("guest account deletion started");
    // 회전이 진행 중이면 먼저 끝낸다. 회전 직후의 낡은 refresh token으로 로그아웃하면
    // 재사용 감지에 걸려 불필요하게 실패한다.
    if (this.rotationPromise) {
      try {
        await this.rotationPromise;
      } catch {
        // 회전 실패는 아래 로그아웃 실패로 그대로 드러난다.
      }
    }

    // 서버 삭제가 실패하면 로컬을 하나도 건드리지 않는다. 여기서 로컬만 지우면 살아있는
    // 계정의 학습 기록에 사용자가 다시 접근할 방법이 없어진다. 토큰 회전은 성공했지만
    // SecureStore 기록만 실패했다면 기존 refresh token은 이미 폐기됐을 수 있으므로,
    // 메모리에 남겨 둔 새 세션을 우선 사용한다.
    // 탈퇴는 access token과 refresh token을 함께 보내므로 둘을 같은 세션에서 꺼낸다.
    // 각각 다른 출처에서 고르면 회전 직후 짝이 어긋난 조합이 나갈 수 있다.
    const session = this.pendingRotationSession ?? this.requireSession();
    await logout(session.accessToken, session.refreshToken);
    logAuthDebug("server withdraw completed");

    try {
      await clearAuthSession();
      logAuthDebug("local auth session cleared");
    } catch (error) {
      logAuthDebug("local auth session clear failed", error);
      // 서버 계정은 이미 사라져 되돌릴 수 없다. 남은 저장 세션은 죽은 값이고, 다음 부팅의
      // reissue가 확정적 401을 받아 sessionless 경로로 자가 치유한다.
    }

    this.session = null;
    this.serverConsent = null;
    this.reissueSession = null;
    this.pendingRotationSession = null;
    this.rotationPromise = null;
    // 비우지 않으면 아래 bootstrap()이 직전 실행의 promise를 보고 조기 반환한다.
    this.bootstrapPromise = null;

    // 완료를 기다리지 않는다. 재부트스트랩이 시작되는 순간 App이 NavigationContainer를
    // 언마운트하므로 이 호출을 기다리던 화면은 이미 사라져 있다.
    logAuthDebug("bootstrap after deletion started");
    void this.bootstrap();
  }

  private requireSession(): AuthSession {
    if (!this.session) {
      throw new Error("인증 세션이 준비되지 않았습니다.");
    }
    return this.session;
  }

  private snapshot(): RequestAuthSnapshot {
    return { accessToken: this.requireSession().accessToken, generation: this.generation };
  }

  async prepareRequest(): Promise<RequestAuthSnapshot> {
    const session = this.requireSession();
    if (session.accessTokenExpiresAt - Date.now() <= PROACTIVE_REFRESH_WINDOW_MS) {
      await this.rotateSession();
    }
    return this.snapshot();
  }

  async recoverUnauthorized(usedGeneration: number): Promise<RequestAuthSnapshot> {
    if (this.generation === usedGeneration) {
      await this.rotateSession();
    }
    return this.snapshot();
  }

  private async rotateSession(): Promise<AuthSession> {
    if (this.rotationPromise) {
      return this.rotationPromise;
    }
    const session = this.requireSession();
    this.rotationPromise = (async () => {
      const nextSession = this.pendingRotationSession ?? await reissueTokens(session.refreshToken);
      this.pendingRotationSession = nextSession;
      await writeAuthSession(nextSession);
      this.commitSession(nextSession);
      this.pendingRotationSession = null;
      return nextSession;
    })();
    try {
      return await this.rotationPromise;
    } finally {
      this.rotationPromise = null;
    }
  }
}

export const authController = new AuthController();
