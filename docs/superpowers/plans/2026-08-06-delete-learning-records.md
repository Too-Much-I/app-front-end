# 모든 학습 기록 삭제 및 확인 모달 공용화 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 설정 화면의 "모든 학습 기록 삭제" 스텁을 실제 동작으로 채우고, 중복된 확인 모달 두 개를 공용 `ConfirmModal`로 합친다.

**Architecture:** 삭제는 Identity의 `POST /api/v1/auth/logout` 한 번으로 끝난다 — 백엔드가 이 엔드포인트에서 게스트 계정을 삭제하므로, 로컬 세션을 지우고 부트스트랩을 다시 돌리면 `/auth/guest`가 복구할 대상이 없어 빈 게스트를 새로 발급한다. 재부트스트랩이 시작되면 `App.tsx`가 `NavigationContainer`를 언마운트하므로 화면 이동 처리는 필요 없다. 확인 UI는 기존 `ExamExitConfirmationModal` / `ReanswerDiscardModal`을 `src/components/ui/ConfirmModal.tsx`로 합쳐 세 곳이 함께 쓴다.

**Tech Stack:** Expo 57 / React Native, strict TypeScript, NativeWind, expo-secure-store, oxlint

설계 근거는 [2026-08-06 설계 문서](../specs/2026-08-06-delete-learning-records-design.md)에 있다. 이 계획은 그 문서를 코드로 옮긴 것이다.

## Global Constraints

- 패키지 매니저는 `pnpm`. 새 의존성을 추가하지 않는다 — 이 작업에 필요한 것이 없다.
- `src/components/ui/Text.tsx`와 `src/components/ui/Pressable.tsx`를 쓴다. `react-native`의 `Text` / `Pressable`을 직접 import하면 oxlint `no-restricted-imports`가 에러를 낸다.
- Jua 폰트는 단일 weight다. `font-medium` / `font-bold`를 붙이지 않는다.
- 색·간격·그림자는 `@/theme`의 토큰을 쓰고 hex를 화면에 흩뿌리지 않는다.
- strict TypeScript 유지. `any`, 단언, 타입 억제 금지.
- 자동 테스트 러너가 없다. **모든 태스크의 검증은 `pnpm lint` + `pnpm exec tsc --noEmit` + 문서에 적힌 수동 확인**이다. 실행 가능한 테스트가 없으므로 이 계획에는 red-green TDD 사이클이 없다. 이는 저장소의 제약이지 생략이 아니다.
- **커밋은 사용자가 명시적으로 요청할 때만 한다** (AGENTS.md). 각 태스크의 커밋 스텝은 요청이 있을 때 쓸 명령을 적어둔 것이며, 요청 없이 실행하지 않는다.
- 커밋 제목/본문은 한국어, Conventional Commit 타입과 스코프는 소문자 영문.
- 사용자에게 보이는 에러 문구에 서버 원문 메시지나 token 값을 넣지 않는다 (`specs/009-guest-auth-bootstrap/data-model.md:227`).

## File Structure

| 파일 | 책임 |
| --- | --- |
| `src/components/ui/ConfirmModal.tsx` (신규) | 파괴적 동작 확인 모달의 유일한 구현. 문구·톤·대기/에러 상태만 prop으로 받는다 |
| `src/screens/mock-exam/components/ExamExitConfirmationModal.tsx` (삭제) | `ConfirmModal`로 흡수 |
| `src/screens/reanswer/components/ReanswerDiscardModal.tsx` (삭제) | `ConfirmModal`로 흡수 |
| `src/screens/mock-exam/ExamSessionScreen.tsx` (수정) | 시험 나가기 문구를 호출부에서 직접 지정 |
| `src/screens/reanswer/ReanswerScreen.tsx` (수정) | 재답변 폐기 문구를 호출부에서 직접 지정 |
| `src/features/auth/api/logout.ts` (신규) | 단일 로그아웃 엔드포인트 하나. 게스트 계정 삭제라는 계약을 주석으로 고정 |
| `src/features/auth/auth-session-storage.ts` (수정) | 저장 세션 삭제(`clearAuthSession`) 추가 |
| `src/features/auth/auth-controller.ts` (수정) | `deleteGuestAccount()` — 서버 삭제 → 로컬 정리 → 재부트스트랩 순서와 실패 규칙을 소유 |
| `src/features/auth/auth-context.ts` (수정) | 화면이 컨트롤러를 직접 import하지 않도록 동작 노출 |
| `src/features/auth/auth-provider.tsx` (수정) | 위 동작을 컨트롤러에 연결 |
| `src/screens/settings/use-delete-learning-records.ts` (신규) | 확인/대기/에러 상태 머신. "성공 경로에서 setState 금지" 규칙을 가둔다 |
| `src/screens/settings/SettingsScreen.tsx` (수정) | 스텁 제거, 훅과 모달 연결 |

태스크는 세 개다. Task 1(모달 공용화)은 인증 쪽과 독립이라 먼저 끝내도 되고, Task 3은 Task 1과 2를 모두 필요로 한다.

---

### Task 1: ConfirmModal 공용화

기존 두 모달의 렌더 결과가 **픽셀 단위로 지금과 같아야** 한다. 이 태스크의 합격 기준은 "새 컴포넌트가 생겼다"가 아니라 "시험 나가기와 재답변 폐기 모달이 이전과 구분되지 않는다"이다.

**Files:**
- Create: `src/components/ui/ConfirmModal.tsx`
- Delete: `src/screens/mock-exam/components/ExamExitConfirmationModal.tsx`
- Delete: `src/screens/reanswer/components/ReanswerDiscardModal.tsx`
- Modify: `src/screens/mock-exam/ExamSessionScreen.tsx:17` (import), `:323-327` (사용처)
- Modify: `src/screens/reanswer/ReanswerScreen.tsx:12` (import), `:244-248` (사용처)

**Interfaces:**
- Consumes: 없음 (첫 태스크)
- Produces: `ConfirmModal(props: ConfirmModalProps)` — Task 3이 `visible`, `title`, `message`, `warningBadge`, `cancelLabel`, `confirmLabel`, `confirmTone`, `confirmHint`, `pending`, `errorMessage`, `onCancel`, `onConfirm`을 넘긴다.

- [ ] **Step 1: 기존 두 모달을 나란히 읽고 차이를 확인한다**

`src/screens/mock-exam/components/ExamExitConfirmationModal.tsx`와 `src/screens/reanswer/components/ReanswerDiscardModal.tsx`를 연다. 차이는 네 가지뿐이다.

| 항목 | ExamExit | ReanswerDiscard |
| --- | --- | --- |
| 제목 | 없음 (안내 박스가 `mt-5`) | `"녹음을 그만둘까요?"` (`mt-4 text-lg text-exam-navy`, 안내 박스는 `mt-3`) |
| 안내 박스 배지 | `brand-cta` 원형 `"!"` 있음, 박스가 `flex-row items-center` | 없음 |
| 확인 버튼 | `border-exam-dangerLine` / `text-exam-danger` | `border-line` / `text-ink-muted` |
| 버튼 문구 | `"계속 응시하기"` / `"시험 나가기"` | `"계속 녹음하기"` / `"나가기"` |

- [ ] **Step 2: `src/components/ui/ConfirmModal.tsx` 생성**

```tsx
import { Image, Modal, View } from "react-native";

import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { shadows } from "@/theme";

// public/은 `@/` 별칭 범위(./src) 밖이라 상대 경로로 require한다.
// 마스코트를 prop으로 열지 않고 고정한 이유: 세 사용처(시험 나가기, 재답변 폐기,
// 학습 기록 삭제)가 모두 "지금 것이 사라진다"는 같은 신호라 표정이 갈릴 이유가 없다.
const shockedRabbit = require("../../../public/mascots/shocked_rabbit.png");

interface ConfirmModalProps {
  visible: boolean;
  /** 없으면 안내 박스가 곧바로 마스코트 아래에 온다. */
  title?: string;
  message: string;
  /** 안내 박스 왼쪽의 brand-cta 원형 "!" 배지. */
  warningBadge?: boolean;
  /** CTA(채움) 버튼 — 되돌아가는 쪽이 항상 시각적 기본값이다. */
  cancelLabel: string;
  /** 보조(외곽선) 버튼 — 파괴적이거나 되돌릴 수 없는 쪽. */
  confirmLabel: string;
  confirmTone?: "danger" | "neutral";
  confirmHint?: string;
  /** 확인 동작이 네트워크를 기다리는 중. 두 버튼을 모두 잠근다. */
  pending?: boolean;
  /** 확인 동작 실패 시 버튼 위에 표시하고 재시도를 허용한다. */
  errorMessage?: string;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * 되돌릴 수 없는 동작을 확인받는 공용 모달.
 *
 * 취소가 CTA(채움), 확인이 보조(외곽선)다. 파괴적인 쪽을 시각적 기본값으로 두지 않는다.
 */
export function ConfirmModal({
  visible,
  title,
  message,
  warningBadge = false,
  cancelLabel,
  confirmLabel,
  confirmTone = "neutral",
  confirmHint,
  pending = false,
  errorMessage,
  onCancel,
  onConfirm,
}: ConfirmModalProps) {
  const confirmBorderClassName =
    confirmTone === "danger" ? "border-exam-dangerLine" : "border-line";
  const confirmTextClassName =
    confirmTone === "danger" ? "text-exam-danger" : "text-ink-muted";

  return (
    <Modal
      animationType="fade"
      onRequestClose={pending ? undefined : onCancel}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View className="flex-1 items-center justify-center bg-ink/50 px-6">
        <View
          accessibilityViewIsModal
          className="w-full max-w-md items-center rounded-3xl bg-surface px-6 pb-6 pt-3"
          style={shadows.card}
        >
          {/* 얼굴 전체는 유지하고 원본 하단의 불필요한 여백만 컨테이너 밖으로 숨긴다. */}
          <View className="h-36 w-40 overflow-hidden">
            <Image className="h-40 w-40" resizeMode="contain" source={shockedRabbit} />
          </View>

          {title ? <Text className="mt-4 text-lg text-exam-navy">{title}</Text> : null}

          <View
            className={`w-full flex-row items-center rounded-2xl border border-brand-200 bg-brand-50 px-4 py-4 ${
              title ? "mt-3" : "mt-5"
            }`}
          >
            {warningBadge ? (
              <View className="mr-3 h-7 w-7 items-center justify-center rounded-full bg-brand-cta">
                <Text className="text-sm text-white">!</Text>
              </View>
            ) : null}
            <Text className="flex-1 text-sm leading-6 text-brand-900">{message}</Text>
          </View>

          {errorMessage ? (
            <Text className="mt-3 w-full text-sm text-exam-danger">{errorMessage}</Text>
          ) : null}

          {/* Pressable이 자체 Animated opacity를 style 배열 끝에 덧붙여 className의
              opacity-*를 덮어쓴다. 대기 중 흐림 처리는 바깥 View에서 해야 먹는다. */}
          <View className={`w-full ${pending ? "opacity-50" : ""}`}>
            <Pressable
              accessibilityRole="button"
              className="mt-6 w-full items-center rounded-full bg-brand-cta py-4"
              disabled={pending}
              onPress={onCancel}
            >
              <Text className="text-base text-white">{cancelLabel}</Text>
            </Pressable>

            <Pressable
              accessibilityHint={confirmHint}
              accessibilityRole="button"
              className={`mt-3 w-full items-center rounded-full border bg-surface py-4 ${confirmBorderClassName}`}
              disabled={pending}
              onPress={onConfirm}
            >
              <Text className={`text-base ${confirmTextClassName}`}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
```

- [ ] **Step 3: `ExamSessionScreen.tsx`를 `ConfirmModal`로 옮긴다**

17번째 줄의 import를 지우고, `@/components/ui/Pressable` import 바로 위에 새 import를 넣는다.

```diff
+import { ConfirmModal } from "@/components/ui/ConfirmModal";
 import { Pressable } from "@/components/ui/Pressable";
 import { Text } from "@/components/ui/Text";
```

```diff
-import { ExamExitConfirmationModal } from "@/screens/mock-exam/components/ExamExitConfirmationModal";
```

사용처(323~327줄)를 교체한다.

```tsx
      <ConfirmModal
        cancelLabel="계속 응시하기"
        confirmHint="진행 중인 시험을 종료하고 모의고사 첫 화면으로 이동합니다"
        confirmLabel="시험 나가기"
        confirmTone="danger"
        message="지금 나가면 이번 시험은 제출되지 않고 채점 결과도 받을 수 없어요."
        onCancel={handleCancelExitExam}
        onConfirm={handleConfirmExitExam}
        visible={isExitConfirmationVisible}
        warningBadge
      />
```

- [ ] **Step 4: `ReanswerScreen.tsx`를 `ConfirmModal`로 옮긴다**

```diff
+import { ConfirmModal } from "@/components/ui/ConfirmModal";
 import { ShardHeader } from "@/components/ui/ShardHeader";
```

```diff
-import { ReanswerDiscardModal } from "@/screens/reanswer/components/ReanswerDiscardModal";
```

사용처(244~248줄)를 교체한다. 삭제되는 파일의 doc 주석에 있던 판단 근거를 여기로 옮긴다.

```tsx
      {/* 폐기되는 것(지금 녹음)과 남는 것(이미 받은 피드백과 이전 회차)을 함께 말한다 —
          재답변은 기존 답변을 덮어쓰지 않으므로 여기서 잃는 건 방금 녹음뿐이다. */}
      <ConfirmModal
        cancelLabel="계속 녹음하기"
        confirmHint="지금 녹음을 버리고 문제별 피드백으로 돌아갑니다"
        confirmLabel="나가기"
        message="지금 녹음한 답변은 저장되지 않아요. 이미 받은 피드백과 이전 회차는 그대로 남아요."
        onCancel={() => setIsDiscardVisible(false)}
        onConfirm={leaveScreen}
        title="녹음을 그만둘까요?"
        visible={isDiscardVisible}
      />
```

- [ ] **Step 5: 옛 모달 파일 두 개를 삭제한다**

```bash
rm src/screens/mock-exam/components/ExamExitConfirmationModal.tsx
rm src/screens/reanswer/components/ReanswerDiscardModal.tsx
```

- [ ] **Step 6: 참조가 남지 않았는지 확인한다**

```bash
grep -rn "ExamExitConfirmationModal\|ReanswerDiscardModal" src
```

Expected: 출력 없음 (exit code 1)

- [ ] **Step 7: lint와 타입 검사**

```bash
pnpm lint && pnpm exec tsc --noEmit
```

Expected: 둘 다 에러 없이 종료. `Found 0 warnings and 0 errors` 계열 출력.

- [ ] **Step 8: 시각적 회귀 수동 확인**

`pnpm ios`(또는 `pnpm android`)로 앱을 띄우고 두 모달을 이전과 비교한다.

1. 모의고사를 시작해 시험 세션에 들어간 뒤 헤더의 나가기 버튼을 누른다 → 마스코트, `"!"` 배지가 붙은 안내 박스, `"계속 응시하기"`(주황 채움), `"시험 나가기"`(빨간 외곽선)가 이전과 같이 보인다.
2. 피드백 → 재답변 화면에서 녹음을 시작하고 뒤로 나간다 → `"녹음을 그만둘까요?"` 제목, 배지 없는 안내 박스, `"계속 녹음하기"`(주황 채움), `"나가기"`(회색 외곽선)가 이전과 같이 보인다.

- [ ] **Step 9: 커밋 (사용자가 요청한 경우에만)**

```bash
git add src/components/ui/ConfirmModal.tsx src/screens/mock-exam src/screens/reanswer
git commit -m "refactor(ui): 확인 모달 공용 컴포넌트로 통합"
```

---

### Task 2: 게스트 계정 삭제 파이프라인

화면 없이 인증 계층만 만든다. 이 태스크가 끝나면 `deleteGuestAccount()`를 호출할 수 있지만 아직 부르는 곳이 없다.

**Files:**
- Create: `src/features/auth/api/logout.ts`
- Modify: `src/features/auth/auth-session-storage.ts` (파일 끝에 추가)
- Modify: `src/features/auth/auth-controller.ts` (import 블록, 클래스에 메서드 추가)
- Modify: `src/features/auth/auth-context.ts:5-9`
- Modify: `src/features/auth/auth-provider.tsx:15-22`

**Interfaces:**
- Consumes: 기존 `serviceFetch`, `getIdentityApiBaseUrl`, `AuthStorageError`, `authController`
- Produces:
  - `logout(refreshToken: string): Promise<void>`
  - `clearAuthSession(): Promise<void>`
  - `AuthController.deleteGuestAccount(): Promise<void>`
  - `AuthContextValue.deleteGuestAccount: () => Promise<void>` — Task 3의 훅이 `useAuth()`로 꺼내 쓴다

- [ ] **Step 1: `src/features/auth/api/logout.ts` 생성**

`reissue-tokens.ts`와 같은 형태다. Identity base URL, `Authorization` 헤더 없음, envelope는 버린다. `serviceFetch`가 이미 non-2xx와 `isSuccess !== true`를 `ApiError`로 바꾸므로 추가 검증을 두지 않는다.

```ts
import { getIdentityApiBaseUrl } from "@/lib/api/service-base-url";
import { serviceFetch } from "@/lib/api/transport";

/**
 * 단일 로그아웃 — 이 게스트 계정 자체를 삭제한다.
 *
 * 앱의 "모든 학습 기록 삭제"가 이 호출 하나로 성립하는 근거가 여기에 있다. 만약 이
 * 엔드포인트가 refresh token만 폐기하도록 바뀌면, 같은 installationId로 `/auth/guest`가
 * 같은 게스트를 복구해(specs/009-guest-auth-bootstrap) 삭제가 조용히 무효화된다.
 * 그때는 installationId를 새 UUID로 교체하는 경로를 함께 넣어야 한다.
 */
export async function logout(refreshToken: string): Promise<void> {
  await serviceFetch<unknown>(`${getIdentityApiBaseUrl()}/api/v1/auth/logout`, {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
  });
}
```

- [ ] **Step 2: `auth-session-storage.ts`에 `clearAuthSession` 추가**

파일 끝(`writeAuthSession` 아래)에 붙인다. 기존 두 함수와 같이 `assertNativeStorage()`로 시작하고 실패 시 `AuthStorageError`를 던진다.

```ts
export async function clearAuthSession(): Promise<void> {
  assertNativeStorage();
  try {
    await SecureStore.deleteItemAsync(AUTH_SESSION_KEY);
  } catch {
    throw new AuthStorageError("인증 정보를 삭제하지 못했습니다.");
  }
}
```

- [ ] **Step 3: `auth-controller.ts`의 import 두 곳을 고친다**

`create-guest` import 아래에 `logout`을 넣는다.

```diff
 import { createGuest } from "@/features/auth/api/create-guest";
+import { logout } from "@/features/auth/api/logout";
 import {
   isDefinitiveRefreshFailure,
   reissueTokens,
 } from "@/features/auth/api/reissue-tokens";
```

세션 저장소 import에 `clearAuthSession`을 추가한다.

```diff
-import { readAuthSession, writeAuthSession } from "@/features/auth/auth-session-storage";
+import {
+  clearAuthSession,
+  readAuthSession,
+  writeAuthSession,
+} from "@/features/auth/auth-session-storage";
```

- [ ] **Step 4: `AuthController`에 `deleteGuestAccount()` 추가**

`retry()` 메서드 바로 아래, `private requireSession()` 위에 넣는다. 공개 메서드를 private 블록 앞에 두는 기존 배치를 따른다.

```ts
  /**
   * 게스트 계정을 삭제하고 새 게스트로 앱을 다시 시작한다 — 설정의 "모든 학습 기록 삭제".
   *
   * consent와 installationId는 남긴다. 로컬 동의 기록이 있어야 재부트스트랩이 재동의
   * 화면으로 빠지지 않고, 서버 게스트가 이미 삭제됐으므로 같은 installationId로도
   * 복구될 대상이 없어 빈 게스트가 새로 발급된다.
   */
  async deleteGuestAccount(): Promise<void> {
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

    try {
      await clearAuthSession();
    } catch {
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
    void this.bootstrap();
  }
```

- [ ] **Step 5: `auth-context.ts`에 동작 노출**

```diff
 export type AuthContextValue = {
   state: AuthBootstrapState;
   acceptConsent: () => Promise<void>;
   retry: () => Promise<void>;
+  deleteGuestAccount: () => Promise<void>;
 };
```

- [ ] **Step 6: `auth-provider.tsx`에서 컨트롤러에 연결**

```diff
   const value = useMemo<AuthContextValue>(
     () => ({
       state,
       acceptConsent: () => authController.acceptConsent(),
       retry: () => authController.retry(),
+      deleteGuestAccount: () => authController.deleteGuestAccount(),
     }),
     [state],
   );
```

- [ ] **Step 7: lint와 타입 검사**

```bash
pnpm lint && pnpm exec tsc --noEmit
```

Expected: 둘 다 에러 없이 종료.

- [ ] **Step 8: 재부트스트랩 경로를 눈으로 따라간다**

코드 실행 없이 `auth-controller.ts`에서 다음 경로가 실제로 이어지는지 확인한다. 하나라도 어긋나면 Task 3에서 증상이 화면 멈춤으로 나타나 원인을 찾기 어렵다.

`bootstrap()` → `runBootstrap()` → `readAuthSession()`이 `null` → `prepareSessionlessBootstrap()` → `getOrCreateInstallationId()`(기존 값 반환) → `continueSessionlessBootstrap()` → `getStoredConsent()`가 유효 → `recoverGuest("startup", run)` → `createGuest()` → `persistAndCommit(session, "startup", "check-consent")` → `checkServerConsent()` → `AUTHENTICATED`

특히 `continueSessionlessBootstrap`이 `!consent || !isCurrentConsent(consent)`에서 `CONSENT_REQUIRED`로 빠지지 않는지 확인한다 — 동의 기록은 AsyncStorage에 있고 이 태스크는 그것을 지우지 않는다.

- [ ] **Step 9: 커밋 (사용자가 요청한 경우에만)**

```bash
git add src/features/auth
git commit -m "feat(auth): 게스트 계정 삭제와 재부트스트랩 경로 추가"
```

---

### Task 3: 설정 화면 연결

**Files:**
- Create: `src/screens/settings/use-delete-learning-records.ts`
- Modify: `src/screens/settings/SettingsScreen.tsx` (import 블록, 컴포넌트 본문, `:128-136` 행, `:139` 뒤 모달)

**Interfaces:**
- Consumes: Task 1의 `ConfirmModal`, Task 2의 `AuthContextValue.deleteGuestAccount`
- Produces: 없음 (마지막 태스크)

- [ ] **Step 1: `src/screens/settings/use-delete-learning-records.ts` 생성**

`src/screens/home/use-recent-feedback.ts`와 같이 화면 폴더에 평평하게 둔다.

```ts
import { useCallback, useRef, useState } from "react";

import { useAuth } from "@/features/auth/auth-context";

export type DeleteRecordsStatus = "idle" | "confirming" | "deleting" | "error";

/**
 * 설정 화면의 "모든 학습 기록 삭제" 확인 흐름.
 *
 * 성공 경로에서 상태를 되돌리지 않는 것이 이 훅의 핵심 규칙이다. 삭제가 성공하면
 * 재부트스트랩이 NavigationContainer를 언마운트하므로 되돌릴 컴포넌트가 이미 없다.
 * 실패했을 때만 화면으로 돌아온다.
 */
export function useDeleteLearningRecords() {
  const { deleteGuestAccount } = useAuth();
  const [status, setStatus] = useState<DeleteRecordsStatus>("idle");
  // 상태 반영을 기다리는 사이의 연타를 막는다. status만으로는 한 프레임이 비어 있다.
  const isDeletingRef = useRef(false);

  const request = useCallback(() => {
    setStatus("confirming");
  }, []);

  const cancel = useCallback(() => {
    // 요청이 나간 뒤에는 되돌릴 수 없으므로 닫기를 무시한다.
    if (isDeletingRef.current) {
      return;
    }
    setStatus("idle");
  }, []);

  const confirm = useCallback(async () => {
    if (isDeletingRef.current) {
      return;
    }
    isDeletingRef.current = true;
    setStatus("deleting");

    try {
      await deleteGuestAccount();
      // 성공: 이 컴포넌트는 곧 언마운트된다. 여기서 상태를 만지지 않는다.
    } catch (error) {
      console.error("[Settings] 학습 기록 삭제 실패", error);
      isDeletingRef.current = false;
      setStatus("error");
    }
  }, [deleteGuestAccount]);

  return { status, request, cancel, confirm };
}
```

- [ ] **Step 2: `SettingsScreen.tsx`에 import 두 개 추가**

```diff
+import { ConfirmModal } from "@/components/ui/ConfirmModal";
 import { Pressable } from "@/components/ui/Pressable";
 import { Text } from "@/components/ui/Text";
 import { getStoredConsent } from "@/features/consent/consent-storage";
 import type { RootStackParamList } from "@/navigation/types";
 import { SettingsRow } from "@/screens/settings/components/SettingsRow";
 import { SettingsSection } from "@/screens/settings/components/SettingsSection";
+import { useDeleteLearningRecords } from "@/screens/settings/use-delete-learning-records";
 import { colors, shadows } from "@/theme";
```

- [ ] **Step 3: 컴포넌트에서 훅을 부른다**

`SettingsScreen` 본문의 `const [consentAgreedAt, setConsentAgreedAt] = useState...` 아래에 넣는다.

```diff
   const [consentAgreedAt, setConsentAgreedAt] = useState<string | null>(null);
+  const deletion = useDeleteLearningRecords();
```

- [ ] **Step 4: 삭제 행의 스텁을 교체한다**

128~136줄. `TODO` 주석과 `console.log`를 지운다.

```diff
             <SettingsRow
               description="삭제 후 복구할 수 없으니 신중히 선택해주세요."
               destructive
               icon="trash-2"
-              // TODO: 실제 삭제 로직과 확인 다이얼로그가 생기면 연결
-              onPress={() => console.log("[Settings] 모든 학습 기록 삭제 press")}
+              onPress={deletion.request}
               showDivider={false}
               title="모든 학습 기록 삭제"
             />
```

- [ ] **Step 5: `ConfirmModal`을 붙인다**

`</ScrollView>`와 `</SafeAreaView>` 사이에 넣는다.

```tsx
      <ConfirmModal
        cancelLabel="그대로 둘게요"
        confirmHint="모든 학습 기록을 삭제하고 앱을 처음 상태로 되돌립니다"
        confirmLabel="삭제하기"
        confirmTone="danger"
        errorMessage={
          deletion.status === "error"
            ? "삭제하지 못했어요. 잠시 후 다시 시도해주세요."
            : undefined
        }
        message="지금까지의 시험 기록과 피드백이 모두 사라져요. 삭제하면 되돌릴 수 없어요."
        onCancel={deletion.cancel}
        onConfirm={deletion.confirm}
        pending={deletion.status === "deleting"}
        title="모든 학습 기록을 지울까요?"
        visible={deletion.status !== "idle"}
        warningBadge
      />
```

에러 문구에 서버 메시지를 넣지 않는다는 점을 지킨다. 훅이 원본 오류를 `console.error`로 남기므로 디버깅 정보는 잃지 않는다.

- [ ] **Step 6: lint와 타입 검사**

```bash
pnpm lint && pnpm exec tsc --noEmit
```

Expected: 둘 다 에러 없이 종료.

- [ ] **Step 7: 스텁이 남지 않았는지 확인한다**

```bash
grep -rn "학습 기록 삭제 press" src
```

Expected: 출력 없음 (exit code 1)

- [ ] **Step 8: 수동 확인**

`pnpm ios`(또는 `pnpm android`)로 앱을 띄운다. 3번이 이 작업 전체의 핵심 검증이다 — 여기서 기록이 돌아오면 "로그아웃이 게스트 계정을 삭제한다"는 전제가 틀린 것이고, 설계 문서의 `installationId` 교체 경로로 되돌아가야 한다.

1. 시험을 한 번 완료해 홈과 피드백에 기록이 남은 상태를 만든다.
2. 설정 → 모든 학습 기록 삭제 → `"그대로 둘게요"` → 요청 없이 모달만 닫힌다. 기록 그대로.
3. 다시 열어 `"삭제하기"` → 두 버튼이 흐려지며 잠기고, 잠시 뒤 홈이 빈 상태로 새로 뜬다. **재동의 화면이 뜨지 않는다.** 이어서 앱을 완전히 종료했다 다시 켜도 기록이 돌아오지 않는다.
4. 기기를 비행기 모드로 두고 삭제를 누른다 → 모달이 유지된 채 `"삭제하지 못했어요..."`가 보이고 버튼이 다시 눌린다. 연결을 복구하고 다시 누르면 성공한다.
5. 삭제 중(버튼이 흐려진 동안) 확인 버튼을 여러 번 눌러도 요청이 한 번만 나간다.

- [ ] **Step 9: 커밋 (사용자가 요청한 경우에만)**

```bash
git add src/screens/settings
git commit -m "feat(settings): 모든 학습 기록 삭제 동작 연결"
```

---

## 완료 조건

- `pnpm lint`와 `pnpm exec tsc --noEmit`이 모두 통과한다.
- `ExamExitConfirmationModal`, `ReanswerDiscardModal` 참조가 저장소에 남아있지 않다.
- 시험 나가기 / 재답변 폐기 모달의 겉모습과 동작이 작업 전과 같다.
- 설정에서 삭제를 실행하면 새 게스트로 앱이 다시 뜨고, 앱을 재시작해도 기록이 돌아오지 않는다.
- 삭제 실패 시 모달 안에서 재시도할 수 있고, 로컬 세션이 파괴되지 않는다.
