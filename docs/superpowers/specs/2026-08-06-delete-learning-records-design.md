# 모든 학습 기록 삭제 및 확인 모달 공용화 설계

## 배경

설정 화면의 "모든 학습 기록 삭제" 행은 [2026-08-04 설정 화면 설계](./2026-08-04-settings-screen-design.md)에서 의도적으로 스텁으로 남겨둔 항목이다. 현재 `src/screens/settings/SettingsScreen.tsx`에 `// TODO: 실제 삭제 로직과 확인 다이얼로그가 생기면 연결` 주석과 `console.log`만 있다. 이번 작업에서 그 두 가지를 모두 채운다.

삭제는 Identity 서비스의 **단일 로그아웃**(`POST /api/v1/auth/logout`) 하나로 이뤄진다. 백엔드가 이 엔드포인트에서 게스트 계정 자체를 삭제하므로, 별도의 학습 기록 삭제 API 없이 게스트를 지우고 새로 발급받는 것으로 "모든 기록 삭제"가 성립한다.

확인 다이얼로그는 새로 만들지 않는다. 앱에는 이미 거의 동일한 확인 모달이 두 개 중복돼 있어(시험 나가기 / 재답변 녹음 폐기), 이번 기회에 공용 컴포넌트로 추출하고 세 번째 사용처로 삭제 확인을 붙인다.

## 사전 확인 사항

### 로그아웃이 게스트 계정을 삭제한다

`specs/009-guest-auth-bootstrap`의 계약상 `installationId`는 **같은 게스트를 복구하는 키**다.

- `quickstart.md:154` — refresh token이 확정적으로 무효일 때 "유효한 consent/installationId로 `/auth/guest`를 호출하고 같은 Guest를 복구한다"
- `research.md:59` — "손상 값을 조용히 바꾸면 학습 이력이 다른 Guest로 분리될 수 있다"

따라서 로그아웃이 refresh token만 폐기하는 동작이라면, 세션을 지우고 재부트스트랩해도 같은 `installationId`로 같은 게스트가 복구되어 학습 기록이 그대로 남는다. 이 설계는 **백엔드의 `POST /api/v1/auth/logout`이 게스트 계정을 삭제한다**는 확인된 사실 위에 성립한다. 복구할 게스트가 없으므로 `/auth/guest`는 신규 게스트를 발급한다.

이 전제가 깨지면(로그아웃이 token만 폐기하도록 바뀌면) 삭제가 조용히 무효화된다. 그때는 `installationId`를 새 UUID로 교체하는 경로를 추가해야 한다. 이 위험을 `logout.ts`에 주석으로 남긴다.

### 재부트스트랩이 화면 트리를 교체한다

`App.tsx`의 `authHasRenderableState`는 `CHECKING_LOCAL`, `GUEST_RECOVERING`(source `startup`), `CHECKING_SERVER_CONSENT`에서 false다. 재부트스트랩이 시작되면 `AppContent`가 `null`을 반환해 `NavigationContainer`가 언마운트되고, `AUTHENTICATED`가 되면 홈부터 새로 마운트된다. 설정 화면과 네비게이션 스택이 통째로 정리되므로 별도의 화면 이동 처리가 필요 없다. 삭제 직후 잠시 빈 화면이 보이는 것은 콜드 스타트와 동일한 경로이며 의도된 동작이다.

## 범위

### 포함

1. `src/components/ui/ConfirmModal.tsx` 신설 — 확인 모달 공용 컴포넌트
2. `ExamExitConfirmationModal`, `ReanswerDiscardModal` 제거 후 호출부에서 `ConfirmModal` 직접 사용
3. `src/features/auth/api/logout.ts` 신설
4. `auth-session-storage.ts`에 `clearAuthSession()` 추가
5. `auth-controller.ts`에 `deleteGuestAccount()` 추가
6. `auth-context.ts` / `auth-provider.tsx`에 `deleteGuestAccount` 노출
7. `src/screens/settings/use-delete-learning-records.ts` 신설
8. `SettingsScreen.tsx`의 스텁을 실제 동작으로 교체

### 제외

- `exam.danger` / `exam.dangerLine` 토큰 리네이밍. 이름은 exam 스코프지만 `tokens.js:100` 주석이 "저건 오류·경고를 알리는 빨강"이라고 역할을 명시하고 있어 공용 모달에서 그대로 쓴다. 리네이밍은 exam 화면 전체와 `tailwind.config.js`를 건드려야 해서 이번 범위 밖이다.
- 전체 로그아웃, 회원 탈퇴, 사용자 프로필 조회. `specs/009-guest-auth-bootstrap/spec.md:40`에서 이미 별개 항목으로 분리돼 있다.
- 설정 화면의 나머지 스텁 행(학습 알림 토글, 앱 평가하기 등).

## 1. ConfirmModal 공용 컴포넌트

### 현재 중복

`ExamExitConfirmationModal.tsx`와 `ReanswerDiscardModal.tsx`는 골격이 완전히 같다.

- `Modal`(`animationType="fade"`, `statusBarTranslucent`, `transparent`)
- `bg-ink/50` 오버레이 + `px-6`
- `w-full max-w-md items-center rounded-3xl bg-surface px-6 pb-6 pt-3` 카드 + `shadows.card`
- `h-36 w-40 overflow-hidden` 컨테이너 안의 `h-40 w-40` shockedRabbit 마스코트
- `rounded-2xl border border-brand-200 bg-brand-50 px-4 py-4` 안내 박스
- `mt-6 w-full items-center rounded-full bg-brand-cta py-4` CTA 버튼(= 취소)
- `mt-3 w-full items-center rounded-full border bg-surface py-4` 보조 버튼(= 확인)

차이는 네 가지뿐이다.

| 항목 | ExamExit | ReanswerDiscard |
| --- | --- | --- |
| 제목 | 없음 | "녹음을 그만둘까요?" (`mt-4 text-lg text-exam-navy`) |
| 안내 박스 배지 | `brand-cta` 원형 "!" 있음 | 없음 |
| 확인 버튼 색 | `border-exam-dangerLine` / `text-exam-danger` | `border-line` / `text-ink-muted` |
| 버튼 문구 | "계속 응시하기" / "시험 나가기" | "계속 녹음하기" / "나가기" |

### 인터페이스

```ts
interface ConfirmModalProps {
  visible: boolean;
  /** 없으면 안내 박스가 곧바로 마스코트 아래에 온다(시험 나가기). */
  title?: string;
  message: string;
  /** 안내 박스 왼쪽의 brand-cta 원형 "!" 배지. */
  warningBadge?: boolean;
  /** CTA(brand-cta 채움) 버튼 — 되돌아가는 쪽이 항상 시각적 기본값이다. */
  cancelLabel: string;
  /** 보조(외곽선) 버튼 — 파괴적이거나 되돌릴 수 없는 쪽. */
  confirmLabel: string;
  confirmTone?: "danger" | "neutral";
  confirmHint?: string;
  /** 확인 동작이 네트워크를 기다리는 중. 두 버튼을 모두 비활성화한다. */
  pending?: boolean;
  /** 확인 동작 실패 시 버튼 위에 표시하고 재시도를 허용한다. */
  errorMessage?: string;
  onCancel: () => void;
  onConfirm: () => void;
}
```

기본값은 `confirmTone = "neutral"`, `warningBadge = false`, `pending = false`.

마스코트는 prop으로 받지 않고 shockedRabbit을 고정한다. 세 사용처 모두 "지금 것이 사라진다"는 같은 신호이며, `ReanswerDiscardModal`의 기존 주석도 표정 통일을 명시적 의도로 기록하고 있다.

`pending`과 `errorMessage`가 유일한 신규 동작이다. 기존 두 사용처는 두 prop을 넘기지 않으므로 렌더 결과가 지금과 동일하게 유지된다.

`pending`일 때 확인 버튼의 라벨은 바꾸지 않고 `opacity-50` + `disabled`로만 표현한다. 라벨 교체는 버튼 폭이 흔들려 시각적 잡음이 크다.

### 호출부 이전

기존 두 파일은 삭제하고 호출부에서 `ConfirmModal`을 직접 쓴다. 얇은 래퍼를 남기면 간접층만 늘고 문구가 화면에서 한 단계 멀어진다. 각 파일에 있던 문구 결정 이유 주석(마스코트 선택, "폐기되는 것과 남는 것을 함께 말한다")은 호출부로 옮긴다.

- `ExamSessionScreen.tsx:323` — `visible` / `onCancel` / `onConfirm`은 그대로, 나머지 prop을 명시
- `ReanswerScreen.tsx:244` — 동일

## 2. 삭제 파이프라인

### `src/features/auth/api/logout.ts`

```ts
export async function logout(refreshToken: string): Promise<void>
```

`reissue-tokens.ts`와 같은 패턴이다. `getIdentityApiBaseUrl()` 기반, `Authorization` 헤더 없음, `serviceFetch<unknown>`으로 호출하고 envelope는 버린다. `serviceFetch`가 이미 `isSuccess !== true`와 non-2xx를 `ApiError`로 변환하므로 별도 검증을 두지 않는다.

이 파일에 "이 엔드포인트는 게스트 계정을 삭제한다. token만 폐기하도록 바뀌면 `installationId`로 같은 게스트가 복구되어 삭제가 무효화된다"는 주석을 남긴다.

### `auth-session-storage.ts`

```ts
export async function clearAuthSession(): Promise<void>
```

`assertNativeStorage()` 후 `SecureStore.deleteItemAsync(AUTH_SESSION_KEY)`. 실패 시 기존 두 함수와 같이 `AuthStorageError`를 던진다.

### `auth-controller.ts`

```ts
async deleteGuestAccount(): Promise<void>
```

순서:

1. `await logout(this.requireSession().refreshToken)` — 실패하면 여기서 예외가 그대로 올라가고 로컬 상태는 하나도 건드리지 않는다. 서버 게스트가 살아있는데 로컬만 지워 사용자가 자기 기록에 접근하지 못하게 되는 상황을 막는다.
2. `await clearAuthSession()` — 실패해도 삼키고 진행한다. 서버 게스트는 이미 삭제됐으므로 남은 저장 세션은 죽은 값이고, 다음 부팅의 reissue가 확정적 401을 받아 `isDefinitiveRefreshFailure` 경로로 자가 치유된다. 여기서 예외를 올리면 이미 지워진 계정으로 되돌아갈 수 없는 상태에서 실패만 보고하게 된다.
3. 인메모리 리셋 — `session`, `serverConsent`, `reissueSession`, `pendingRotationSession`, `rotationPromise`, `bootstrapPromise`를 모두 `null`로 되돌린다. `bootstrapPromise`를 비우지 않으면 4번의 `bootstrap()`이 조기 반환한다.
4. `void this.bootstrap()` — 완료를 기다리지 않는다. 재부트스트랩이 시작되는 순간 호출한 화면이 언마운트되므로 기다릴 대상이 없다.

`consent`와 `installationId`는 유지한다.

- `consent`: 로컬 동의 기록이 살아있어야 `continueSessionlessBootstrap`이 `CONSENT_REQUIRED`로 빠지지 않고 곧바로 `recoverGuest`로 간다. 기록을 지운다고 약관에 다시 동의시킬 이유가 없다.
- `installationId`: 백엔드가 게스트를 지웠으므로 복구 대상이 없어 신규 게스트가 발급된다. 새 UUID를 만들면 `installation-id.v1` 쓰기 실패라는 새 실패 지점이 생기는데, 얻는 것이 없다.

재부트스트랩 경로는 `runBootstrap` → 저장 세션 없음 → `prepareSessionlessBootstrap` → `installationId` 읽기 → `continueSessionlessBootstrap` → 동의 유효 → `recoverGuest("startup")` → `createGuest` → `persistAndCommit(..., "check-consent")` → `checkServerConsent` → `AUTHENTICATED`다. 신규 게스트는 현재 동의 버전으로 생성되므로 `requiresConsent`가 false여서 재동의 화면이 뜨지 않는다.

### `auth-context.ts` / `auth-provider.tsx`

`AuthContextValue`에 `deleteGuestAccount: () => Promise<void>`를 추가하고 provider의 `useMemo` 값에 `() => authController.deleteGuestAccount()`를 넣는다. `acceptConsent` / `retry`와 같은 방식이며, 화면이 `authController`를 직접 import하지 않게 한다.

## 3. 설정 화면 연결

### `src/screens/settings/use-delete-learning-records.ts`

`src/screens/home/use-recent-feedback.ts`와 같이 화면 폴더에 평평하게 둔다.

```ts
type DeleteStatus = "idle" | "confirming" | "deleting" | "error";

export function useDeleteLearningRecords(): {
  status: DeleteStatus;
  request: () => void;   // idle  -> confirming
  cancel: () => void;    // -> idle (deleting 중에는 무시)
  confirm: () => Promise<void>;
};
```

`confirm`은 `status === "deleting"`이면 즉시 반환해 중복 탭을 막는다. 성공 경로에서는 상태를 되돌리지 않는다 — 재부트스트랩이 트리를 언마운트하므로 되돌릴 컴포넌트가 없다. 이 규칙을 주석으로 남긴다. 실패 시에만 `"error"`로 간다.

상태를 화면이 아니라 훅에 두는 이유는 두 가지다. `SettingsScreen`은 지금 `useState` 하나(동의 일시)만 있는 거의 순수 렌더링 화면이고, 여기에 4-상태 머신과 async 분기를 얹으면 관계없는 두 관심사가 섞인다. 그리고 "성공 경로에서 setState 금지"라는 비직관적 규칙을 JSX 옆에 흩어놓는 것보다 훅 안에 가둬두는 편이 안전하다.

이 상태를 `authController`에 올리지는 않는다. `AuthBootstrapState`는 부트스트랩 진행 상태를 표현하는 유니온이고, "확인 다이얼로그가 떠 있는가"는 설정 화면 한 곳의 상호작용 상태다. 컨트롤러는 `deleteGuestAccount()`라는 동작만 제공한다.

### `SettingsScreen.tsx`

`SettingsRow`의 `onPress`를 `deletion.request`로 바꾸고 `TODO` 주석을 제거한다. `SafeAreaView` 안쪽 끝에 `ConfirmModal`을 렌더링한다.

| prop | 값 |
| --- | --- |
| `visible` | `deletion.status !== "idle"` |
| `title` | `"모든 학습 기록을 지울까요?"` |
| `message` | `"지금까지의 시험 기록과 피드백이 모두 사라져요. 삭제하면 되돌릴 수 없어요."` |
| `warningBadge` | `true` |
| `cancelLabel` | `"그대로 둘게요"` |
| `confirmLabel` | `"삭제하기"` |
| `confirmTone` | `"danger"` |
| `confirmHint` | `"모든 학습 기록을 삭제하고 앱을 처음 상태로 되돌립니다"` |
| `pending` | `deletion.status === "deleting"` |
| `errorMessage` | `status === "error"`일 때 `"삭제하지 못했어요. 잠시 후 다시 시도해주세요."` |

취소가 CTA(채움 버튼), 삭제가 보조(외곽선) 버튼이다. 기존 두 모달과 같은 배치이며, 파괴적 동작을 시각적 기본값으로 두지 않는다.

에러 문구에 서버 메시지를 그대로 노출하지 않는다. `specs/009-guest-auth-bootstrap/data-model.md:227`이 사용자 메시지에 token이나 backend 원문 validation 값을 넣지 않도록 요구한다.

## 실패 처리 요약

| 실패 지점 | 동작 |
| --- | --- |
| `logout` 네트워크/timeout/5xx | 로컬 무변경, 모달 유지 + 에러 표시, 재시도 가능 |
| `logout` 401 (세션이 이미 죽음) | 위와 동일. 사용자가 앱을 재시작하면 부트스트랩이 정리한다 |
| `clearAuthSession` 실패 | 삼키고 재부트스트랩 진행. 저장된 죽은 세션은 다음 부팅에서 자가 치유 |
| 재부트스트랩 중 `createGuest` 실패 | 기존 `RETRYABLE_ERROR` UI가 그대로 처리(신규 처리 없음) |
| 삭제 중 중복 탭 | `confirm`이 `deleting` 상태에서 즉시 반환 |

## 검증

자동 테스트 러너가 없으므로 `pnpm lint`와 `pnpm exec tsc --noEmit`을 돌린다.

수동 확인:

1. 설정 → 모든 학습 기록 삭제 → 모달의 취소를 누르면 아무 요청 없이 닫힌다.
2. 삭제를 누르면 버튼이 비활성화되고, 성공 시 홈이 빈 상태로 새로 뜬다. 재동의 화면은 뜨지 않는다.
3. 삭제 후 앱을 완전히 종료했다 켜도 기록이 돌아오지 않는다(같은 `installationId`로 복구되지 않는지 확인하는 핵심 검증).
4. 네트워크를 끊고 삭제를 누르면 모달이 유지된 채 에러가 보이고, 연결 복구 후 다시 누르면 성공한다.
5. 시험 나가기 모달과 재답변 폐기 모달이 이전과 동일하게 보이고 동작한다.
