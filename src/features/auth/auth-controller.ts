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
import { ApiError } from "@/lib/api/transport";

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
  private serverConsent: ServerConsentStatus | null = null;
  private installationId: string | null = null;
  private reissueSession: AuthSession | null = null;

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

  private setRetry(source: BootstrapSource, retry: BootstrapRetry, run?: number): void {
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
      this.setRetry("startup", { operation: "read-local" }, run);
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
        );
      } else {
        this.setRetry("startup", { operation: "read-local" }, run);
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
      this.setRetry("startup", { operation: "read-local" }, run);
      return;
    }

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

    const run = this.runGeneration;
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
    } catch {
      this.setRetry(
        "consent-submit",
        { operation: "persist-consent", consent, continuation: "guest" },
        run,
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
    };
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
      this.setRetry(source, { operation: "guest" }, run);
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
      this.setRetry("startup", { operation: "reissue" }, run);
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
      } catch {
        this.setRetry(
          source,
          { operation: "persist-consent", consent, continuation: "authenticated" },
          run,
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
      this.setRetry(source, { operation: "check-consent" }, run);
    }
  }

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
      this.setRetry("consent-submit", { operation: "update-consent", request }, run);
      return;
    }

    const consent = this.createUpdatedConsentRecord(
      this.serverConsent,
      new Date().toISOString(),
    );
    try {
      await persistConsent(consent);
    } catch {
      this.setRetry(
        "consent-submit",
        { operation: "persist-consent", consent, continuation: "authenticated" },
        run,
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
    logAuthDebug(`retry started: source=${source}, operation=${retry.operation}`);
    this.setState({ ...this.state, isRetrying: true }, run);

    if (retry.operation === "read-local") {
      await this.runBootstrap(run, true);
      return;
    }
    if (retry.operation === "persist-consent") {
      try {
        await persistConsent(retry.consent);
      } catch {
        this.setRetry(source, retry, run);
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
      } catch {
        this.setRetry(source, retry, run);
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
    await this.updateExistingConsents(retry.request, run, true);
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
    // 계정의 학습 기록에 사용자가 다시 접근할 방법이 없어진다.
    await logout(this.requireSession().refreshToken);
    logAuthDebug("server logout completed");

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
