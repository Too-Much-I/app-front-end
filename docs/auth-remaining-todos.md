# 로그인 연동: 남은 작업

기준: 2026-09-30 현재 코드와 대화에서 확인한 내용. 7번의 Guest 병합 진행 상태는 2026-10-02 기준. 이 문서는 작업 목록이며, 미결정 상태 설계를 확정하거나 구현을 시작하는 문서가 아니다. 번호는 현재 상태를 기준으로 다시 정리했다.

## 현재 어디까지 됐나

- **세션 복원 구현 완료:** 저장된 Identity 세션 읽기, 재발급, 저장 실패 시 메모리의 새 토큰으로 저장 재시도, 재발급 요청 ID 보존, MEMBER/GUEST 구분, 복구 행동 분류.
- **코디네이터 기반 구현 완료:** Zustand 상태, bootstrap, 복원 재시도, MEMBER 필수 약관 확인, 상태에 따른 RootNavigator 화면 선택.
- **Identity 로그인 연결 구현:** 새 runtime에서 proof 결과 분기, exchange/Guest prepare, 가입·병합 전달 상태, 메모리 세션 활성화와 백그라운드 저장 재시도를 연결했다. 실제 서버·기기 검증과 기본 앱 활성화는 남아 있다.
- **Firebase SNS 컨트롤러 구현 완료:** Google·Apple·Kakao 어댑터, 단계별 재시도, 사용자 취소, 이전 native 작업 종료 전 새 인증 차단. 실제 Provider 설정·인증 검증과는 별개다.
- **개발 환경 연결 완료:** SDK 설치, Firebase 설정 파일과 native plugin 연결, iOS·Android 개발 빌드 및 검증 화면 실행. Android Google 로그인 안내 화면 진입 확인.
- **신규 가입 흐름 구현(2026-09-30):** 닉네임 → 약관 → 전화 인증 → signup 제출을 실제 SDK·API에 연결했다. 실서버·실기기 검증과 품질 검토 동의 필드 전송은 남아 있다. [결정 기록](decisions/2026-09-30-신규-가입-흐름.md).
- **기본 앱 전환 완료(2026-09-30):** App과 공용 API가 같은 `appAuthRuntime`을 쓴다. Guest 승격·병합 대상자는 "준비 중" 화면을 본다. [결정 기록](decisions/2026-09-30-인증-runtime-기본-경로-전환.md).
- **테스트 Identity 주소:** `https://identity-test.to-teacher.com`. 로컬 환경변수에 반영했지만 서버 응답·배포 계약은 아직 검증하지 않았다.

즉, 서비스 로그인과 신규 가입은 연결됐으며 **Guest 승격·병합(기록 이전)과 실환경 검증**이 남아 있다.

## 남은 작업 요약

| 번호 | 작업 | 성격 | 사용자 스켈레톤 |
| --- | --- | --- | --- |
| 1 | 실제 Provider 인증·환경 검증 | 설정·기기 검증 | 보통 불필요 |
| 2 | Firebase 증명을 Identity에 제출 | API·응답 분기 | 구현 완료·실서버 검증 남음 |
| 3 | 새 Identity 세션 확정 | 세션 컨트롤러 확장 | 구현 완료·앱 전환 남음 |
| 4 | 가입 진행과 입력 관리 | 가입 상태·화면 연결 | 구현 완료(스켈레톤 생략) |
| 5 | 같은 Firebase 사용자에게 전화번호 연결 | SDK·SMS 생명주기 | 구현 완료·기기 검증 남음 |
| 6 | 신규 가입 완료 | signup·완료/실패 처리 | 구현 완료·실서버 검증 남음 |
| 7 | 기존 Guest 승격·병합 | 소유 증명·확인 UI·API | 필요 |
| 8 | 기본 앱 인증 경로 전환 | runtime·화면·공용 API 연결 | 기존 뼈대 확장, 미결정 UX만 추가 |
| 9 | 실제 서비스까지 종단 검증 | 통합·회귀 검증 | 불필요 |

9개는 크기가 같은 작업이 아니다. 4·5·7번은 여러 상태와 예외를 다루므로 SDK 설정 작업보다 범위가 크다.

## 1. 실제 Provider 인증·환경 검증

- [ ] Google: iOS·Android에서 실제 계정 인증 → Firebase ID Token 획득까지 확인한다. 지금은 Android 로그인 안내 화면 진입까지만 확인했다.
- [ ] Apple: iOS native 인증과 Android 웹 인증을 각각 확인한다. 콘솔의 Apple은 활성화돼 있지만 Android Services ID·redirect 설정 및 실제 인증 성공은 미확인이다.
- [ ] Kakao: 현재 Firebase 콘솔에는 카카오가 없다. 백엔드와 동일 프로젝트인지, OIDC 설정이 어느 프로젝트에 있는지 확인하고 정확한 Provider ID를 받는다. 임의의 `oidc.kakao` 값을 넣지 않는다.
- [ ] 테스트 서버의 Firebase 프로젝트 일치, Guest prepare 계약을 확인한다. 재발급 replay는 지원한다고 확인했다(2026-09-30). 사용자가 테스트 서버 활성화를 전달했지만 실제 응답 검증은 남아 있다.
- [ ] EAS 개발 빌드에도 Firebase 파일 환경변수와 OAuth 설정을 공급한다. 로컬에서 빌드된 것만으로 클라우드 빌드 설정이 완료되지는 않는다.

**완료 기준:** 지원할 Provider가 대상 플랫폼에서 실제 `proof-ready`를 반환하고, 취소·실패 후 다시 시작할 수 있다. 계정 선택·비밀번호·동의는 사용자가 수행한다.

**추가 SDK:** Google·Apple·Firebase 패키지는 설치돼 있다. 현재 OIDC 계획에서는 Kakao native SDK 추가 설치가 전제되지 않는다. 실제 설정과 호환성 검증 결과에 따라 판단한다.

관련: [SDK 설정과 검증 기록](firebase-auth-sdk-setup.md), [Firebase 어댑터](../src/features/auth/firebase-auth-sdk.ts).

## 2. Firebase 증명을 Identity에 제출

- [x] Guest가 없으면 `exchange`, 있으면 Guest Bearer와 함께 `guest/prepare`를 호출한다.
- [x] 응답 mapper에서 토큰·가입 요구사항·병합 필요를 구분한다.
- [x] 코디네이터에서 proof 결과 분기, 중복 시작 차단, 취소와 늦은 응답 무시를 처리한다.
- [x] 잘못된 증명은 강제 갱신 후 한 번 재시도하고, 최근 인증 요구는 SNS 재로그인으로 처리한다.
- [x] 일시적인 Identity 요청 실패는 수동 재시도로 해당 단계부터 재개한다. 서버 자동 재전송은 하지 않는다.
- [ ] 실제 Identity 테스트 서버의 응답·오류 계약을 검증한다.
- [x] direct signup의 `signingUp`을 가입 흐름과 연결한다.
- [ ] Guest의 `signingUp`과 `mergeRequired`를 승격·병합 흐름과 연결한다.

`RootNavigator`의 `renderEnrollment`가 가입 영역 연결 지점이다. `onComplete(session)`은
현재 flowId를 보존하며 취소된 이전 가입 흐름의 결과는 적용하지 않는다.

## 3. 새 Identity 세션 확정

- [x] `acceptSession`으로 MEMBER 토큰을 메모리에 활성화하고 API에서 즉시 사용한다.
- [x] 영구 저장 실패는 로그인 진행을 막지 않는다. 저장만 1/3/10초 기준 지터로 재시도하고,
  횟수 소진 후에는 앱 재활성화 때 다시 시도한다. 앱 종료 후 실행은 보장하지 않는다.
- [x] 기존 복원 종료 후 새 세션을 활성화하고, 저장은 직렬화해 이전 쓰기가 최신 세션을 덮어쓰지 않게 한다.
- [x] 메모리 활성화 후 필수 약관을 확인해 재동의 또는 메인으로 전환한다.
- [x] 기본 App과 공용 API를 같은 새 runtime으로 전환하고 계정 변경 시 캐시 정리를 연결한다.
- [ ] 저장 전 종료로 옛 Guest 세션이 남는 경우의 서버 복구 동작을 실환경에서 검증한다.

저장된 세션이 없으면 다음 실행은 로그인 화면으로 간다. 남아 있는 옛 세션이 있으면
기존 복원 규칙을 적용한다. Firebase 자동 재로그인은 이번 범위에서 추가하지 않았다.

관련: [결정·구현 기록](decisions/2026-09-29-identity-login.md),
[세션 컨트롤러](../src/features/auth/session-controller.ts).

## 4. 가입 진행과 입력 관리

**하는 일:** 서버의 `missingRequirements`에 맞춰 필요한 가입 화면만 보여주고, 화면을 오가도 입력과 가입 절차가 연결되게 한다.

- [x] direct signup과 Guest enrollment를 구분한다. 가입 흐름은 `origin: 'noSession'` enrollment만 받고 Guest는 준비 중 화면으로 보낸다.
- [x] 고정 순서 닉네임 → 약관 → 전화 인증. 닉네임·약관은 signup body 필수라 항상 받고, 전화 인증만 `PHONE_VERIFICATION`에 따라 건너뛴다.
- [x] 닉네임·약관 동의·전화번호를 가입 전용 메모리 store에 보관한다. 프로필 화면과 전화 인증 미리보기에 연결하고, 실제 가입 renderer에 같은 store를 전달한다. 최종 제출 API 연결은 6번에서 진행한다.
- [x] 화면 이동 시 초안을 유지하고, 새 로그인 시작·취소·완료·runtime 종료 시 초기화한다. 약관 버전 변경은 해당 동의를 해제하며, 전화번호 변경은 이전 인증 화면 상태를 무효화한다.
- [x] direct signup은 약관 화면 진입 시 공개 API `GET /api/v1/policies/consents`로 버전을 받는다. 실패는 5/10/20초+지터 재시도 후 오류 화면, 포그라운드 복귀 시 재조회. API 배포 후 실제 응답을 확인한다. Guest는 prepare 응답의 버전을 쓴다.
- [x] 뒤로 가기는 이전 단계, 첫 단계는 경고 팝업 후 로그인 화면(SNS 재인증). 만료는 제출 직전에만 확인하고 exchange로 새 enrollment를 받아 입력을 유지한 채 이어간다. 앱 재시작 시 입력은 남기지 않는다.

**완료 기준:** 서버가 요구하는 정보만 입력받고, 만료된 가입 ID를 반복 제출하지 않는다.

입력 보관: [결정 기록](decisions/2026-09-29-signup-draft-inputs.md). 가입 흐름: [결정 기록](decisions/2026-09-30-신규-가입-흐름.md).

## 5. 같은 Firebase 사용자에게 전화번호 연결

**하는 일:** SMS 인증으로 확인한 번호를 SNS 인증을 시작했던 Firebase 사용자에게 연결한다. 전화번호로 별도 사용자를 로그인시키는 작업이 아니다.

- [x] 번호 입력 → SMS 요청 → 코드 입력·재전송 → credential 생성 → `linkWithCredential`을 구현한다.
- [x] 오입력, 만료, 발송 제한, 전화번호 충돌, 네트워크 실패를 구분한다. Android 자동 인증은 받은 코드를 채우기만 하고 확인은 사용자가 누른다.
- [x] 번호 수정·흐름 종료 시 이전 요청의 늦은 결과를 무시한다. 인증 완료는 단계를 오가도 유지하고 번호가 바뀌면 다시 받는다.
- [x] 연결 전후 같은 Firebase UID인지 확인하고(다르면 SNS 재로그인), 제출 직전 ID Token을 강제 갱신한다.
- [ ] iOS 앱 검증/APNs·reCAPTCHA, Android 앱 검증·서명, Firebase 테스트 전화번호 및 실제 SMS를 확인한다.

**완료 기준:** 같은 UID에 전화번호가 연결되고, 갱신된 증명을 얻는다. 문자 인증 성공을 서비스 회원가입 완료로 표시하지 않는다.

**추가 SDK:** 설치된 Firebase Auth가 기반이다. 먼저 SDK를 더 설치하는 작업보다 SMS 상태·구독·오류 분기를 설계하는 작업이다.

## 6. 신규 가입 완료

**하는 일:** Guest가 없는 신규 사용자의 enrollment, 닉네임, 약관 동의, 갱신된 Firebase 증명을 `POST /api/v1/auth/firebase/signup`에 제출한다.

- [x] 가입 요청·응답 모듈을 구현하고 성공 토큰을 3번의 세션 확정 액션에 전달한다.
- [x] enrollment 만료·충돌, 재인증 필요, 증명 불일치, 전화 인증 필요, 탈퇴 정리 중, 서버 장애를 각각 처리한다. 입력 검증 오류 code는 계약에 없어 4xx를 "정보 수정"으로 묶었다. code가 확정되면 해당 단계로 좁힌다.
- [x] 제출 중 중복 입력을 막는다. 응답 유실 후 재제출이 충돌이면 exchange를 다시 해 AUTHENTICATED로 완료한다.
- [ ] 응답 유실 시 서버가 실제로 충돌 code를 주는지 테스트 서버에서 확인한다.
- [x] 품질 검토(선택) 동의를 가입 중에 받아 signup body로 함께 보낸다. 동의하지 않으면 `false`와 version을 보낸다(서버 필드 추가 확인, Swagger 2026-10-05).

**완료 기준:** 신규 사용자가 필요한 인증·동의를 마치면 MEMBER 세션으로 진입하고 재실행 후에도 복원된다.

## 7. 기존 Guest 승격·병합

**하는 일:** 구버전 Guest의 학습 기록 소유 증명을 유지하면서 회원으로 전환한다.

- [x] prepare가 가입을 요구하면 `/firebase/guest/upgrade`로 같은 계정을 MEMBER로 승격한다(#64).
- [x] upgrade body의 품질 검토 동의 필드: 서버에 추가됐고(Swagger 2026-10-05) 앱도 `false`+version까지 보낸다.
- [x] `MERGE_REQUIRED`이면 사용자에게 기록 통합을 설명하고 확인받은 뒤 `/firebase/guest/merge`를 호출한다(`guest-merge-flow.ts`, `GuestMergeNavigator.tsx`). 실서버 검증은 남아 있다.
- [ ] 성공 응답을 새 MEMBER 세션으로 확정하고, 중간 실패 시 기존 Guest 증명을 성급하게 지우지 않는다.
- [ ] 소유권 충돌·만료·응답 유실은 해당 계약에 맞춰 복구한다. 새 Guest 생성이나 direct signup으로 우회하지 않는다.
- [ ] Identity 병합 성공 이후 Learning의 실제 기록 이전까지 확인한다.

**완료 기준:** 기존 사용자 기록이 보존되고, 명시적인 사용자 확인 없이 계정이 병합되지 않는다.

### Guest 병합 진행 상태 (2026-10-02, 브랜치 `feat/guest-merge`)

결정 초안: [Guest 병합](decisions/2026-10-01-guest-병합.md). 아래 결정은 3단계 설계 논의 기록으로 옮긴 뒤 구현한다.

결정한 것:

- 실행 담당: `guest-merge-flow.ts`가 실행하고 코디네이터는 진입(`mergeRequired`)·출구(`completeEnrollment`, `cancelLogin`, `mergeRequired → signingUp`)만 맡는다.
- 응답 유실 판별: Guest 토큰으로 prepare. `403 GUEST_UPGRADE_NOT_ALLOWED`는 병합 성공으로 보고 exchange, `MERGE_REQUIRED`면 merge 재전송. 결정 초안의 401 표기는 고친다(계약 5.5는 정정됨).
- 오류 처리: `TARGET_WITHDRAWN`은 안내 후 승격으로 이어가기, `GUEST_MERGE_TARGET_NOT_ACTIVE`는 정지 안내와 다른 계정 로그인, `TARGET_CONFLICT`는 다시 로그인 1회 후 도움받기, `USER_NOT_FOUND`·`GUEST_MERGE_NOT_ALLOWED`·`ACCOUNT_MERGED_TOKEN_REJECTED`는 exchange, `PROVIDER_RELINK_REQUIRED`는 기본 처리.
- 병합 흐름 밖에서 옛 Guest 토큰이 `401 ACCOUNT_MERGED_TOKEN_REJECTED`·`403 ACCOUNT_NOT_ACTIVE`로 거절되면: "계정이 활성화되지 않았어요" 안내 → 저장된 세션 삭제 → 다시 로그인 버튼 → 로그인 화면. 기기에 남은 Firebase `currentUser`로 자동 exchange하지 않는다.
- `mergeRequired`에 uid를 싣는다. `requireMerge(flowId)` 시그니처는 유지하고 직전 `signingUp`의 `state.uid`를 옮긴다. 입구 1·2는 `proof.uid`. `App.tsx`가 병합 흐름에 넘긴다.
- 확인 화면: 제목 "지금까지의 학습 기록이 이 SNS 계정으로 옮겨져요", 작은 글씨 "이제 여러 기기에 흩어져 있던 학습 기록을 한곳에서 확인할 수 있어요.", 메인 버튼 "학습 기록 합치기", 상단 취소 아이콘. 취소 아이콘은 "다른 SNS 계정으로 로그인하시겠어요?" [취소 / 확인] 대화상자를 띄우고, 확인이면 SNS 로그인 화면(Guest 유지)으로 간다. 되돌릴 수 없다는 문구는 넣지 않는다.
- 병합으로 옮겨지는 것은 학습 기록뿐이며 되돌릴 수 없다(사용자 확인).
- 사용자는 구현 초안을 직접 쓰지 않는다. TEMP 코드(`TEMP-DEBUG`·`TEMP-GUEST`·`[TEMP firebase login]`)는 실기기 테스트가 끝나면 지운다.

서버 답(2026-10-05 사용자 전달):

- 정지된 사용자는 스스로 풀 수 없고, 문의하면 복구해 준다. 앱에 문의 전송 경로가 아직 없다(아래 "문의 API").
- 학습 기록 이전은 계정 병합과 별개로 진행된다. 오래 걸리지 않으며, 서버가 기록 병합 완료를 조회하는 API를 하나 만든다.
- 승격은 기록을 합치지 않으므로 이전 대기와 상관없다(#64 영향 없음).

아직 답을 받지 못한 것:

- [ ] 정지된 MEMBER의 exchange 응답 code
- [ ] prepare 단계에서 target이 정지일 때의 흐름
- [x] 기록 병합 조회 API(Swagger 2026-10-05): merge 응답의 `mergeId`(추적 OFF/legacy면 null)로 `GET /api/v1/users/me/merges/{mergeId}`를 MEMBER 토큰으로 조회. `status` PROCESSING/ACTION_REQUIRED/COMPLETED, 구성 요소(learningCore·billing)별 상태, `nextPollAfterSeconds`. 응답 유실 시에는 exchange 후 `GET /api/v1/users/me/merges`로 찾는다. 계약 문서 5.5에 옮긴다.
- [x] `ACTION_REQUIRED`: 자동 진행이 막혀 운영 확인 필요(2026-10-05 서버 답). 앱은 받는 즉시 조회를 멈춘다.
- [x] 병합 성공 뒤 화면(2026-10-05): 홈으로 보내 둘러볼 수 있게 하고, 학습 기록 영역에만 로딩을 보인다. `nextPollAfterSeconds` 간격으로 최대 5분 조회한다. `mergeId`가 null이면 조회하지 않고 넘어간다. 완료 문구는 띄우지 않고 기록이 보이는 것으로 충분하다. 5분이 지나면 로딩만 멈춘다. 앱을 다시 켜면 이어서 조회하지 않는다. 진행 상태는 스토어에 두고 홈 `RecentFeedbackCard`가 읽어 로딩을 보이고, 완료되면 다시 조회한다.
- [ ] 종단 이전 검증 완료 여부 → 기능 플래그(A 빌드 환경 변수 / B 원격 설정 / C 검증 뒤 머지) 결정

아직 정할 것:

- [x] 오류 안내 문구(AI 제안, 사용자 승인 2026-10-02). 해요체, 사용자가 본 말("학습 기록 합치기")을 쓴다.
  - 결과 불명: "학습 기록을 합쳤는지 확인하지 못했어요. 잠시 후 다시 시도해 주세요." [다시 시도] → 반복 시 "…문제가 계속되면 도움을 요청해 주세요." [다시 시도] [도움 요청하기]. 기록 안전 문장은 넣지 않는다.
  - 대상 탈퇴: "이 SNS 계정은 탈퇴한 계정이에요. 이 계정으로 새로 가입하면 지금까지의 학습 기록을 그대로 이어서 쓸 수 있어요." [가입 이어가기]
  - 대상 충돌: "계정 상태를 확인하지 못했어요. SNS 로그인부터 다시 진행해 주세요." [다시 로그인] → 반복 시 기존 `identityConflict` 문구 [도움 요청하기]
  - 흐름 밖 거절: 제목 "계정이 활성화되지 않았어요", 본문 "계정을 계속 사용하려면 다시 로그인해 주세요." [다시 로그인하기]
  - 예상 못 한 오류: "학습 기록을 합치지 못했어요. 잠시 후 다시 시도해 주세요." [다시 시도]
  - 연결·서버 오류는 `AUTH_RECOVERY_MESSAGES` 재사용.
- [ ] 대상 정지: 행동은 "다른 계정으로 로그인" 대신 **도움 요청하기**로 결정(2026-10-05). 정지는 문의로만 복구되고, 번호당 계정 하나라 다른 계정은 막다른 길이다. 문구는 이에 맞춰 다시 정한다. 문의 API가 전제다.
- [ ] 완료 문구와 보여 주는 방식. 후보 "이전 학습기록이 통합됐어요. 이제부터는 어느 기기에서든 학습 기록을 잃지 않아요." 이전 완료 확인 방법을 받은 뒤 확정한다.
- [ ] `403 ACCOUNT_NOT_ACTIVE`를 `DEFINITIVE_REFRESH_CODES`에 넣어 unexpected 화면에 갇히지 않게 한다(구현 항목).

주의: 최신 명세에서 Guest `ALREADY_LINKED`는 폐기됐다. 오래된 검토 문서의 해당 분기를 새 구현에 가져오지 않는다.

## 8. 기본 앱 인증 경로 전환

**하는 일:** 개발 검증 화면에서만 가능한 인증을 실제 앱의 로그인 버튼·부트스트랩·API 요청에 연결한다.

- [x] 앱에서 runtime을 한 번 조립하고 Firebase·세션·동의 컨트롤러와 코디네이터를 연결한다.
- [x] `App.tsx`와 `src/lib/api/client.ts`를 함께 전환해 화면과 API의 세션 소유자가 같게 한다.
- [ ] RootNavigator에 SNS 진행·가입·전화 인증·병합·실패 상태와 실제 액션을 연결한다.
- [ ] 오류 문구와 행동을 연결한다. 네트워크·서버 장애는 재시도 안내, 재인증은 로그인 재시작, 복구 불가 오류는 도움받기로 이어진다.
- [ ] 로그인 화면의 둘러보기·닫기 목적지를 결정한다. 신규 Guest 자동 생성으로 연결하지 않는다.
- [x] `AuthProvider` 연결을 제거하고 설정의 품질 검토 토글을 새 동의 컨트롤러로 옮겼다.
- [ ] 더 이상 import되지 않는 `auth-controller.ts`와 전용 모듈을 정리한다.
- [x] 신규 가입은 가입 흐름으로 대체했다.
- [ ] Guest 승격·병합을 구현해 남은 "준비 중" 화면을 대체한다. 이 전에는 출시하지 않는다.

**완료 기준:** 일반 앱 실행부터 새 코디네이터가 동작하고, 로그인 성공 후 API도 동일한 MEMBER 세션을 사용한다.

관련: [runtime](../src/features/auth/auth-runtime.ts), [코디네이터](../src/features/auth/auth-coordinator.ts), [RootNavigator](../src/navigation/RootNavigator.tsx).

## 9. 실제 서비스까지 종단 검증

- [ ] 기존 회원 로그인 → MEMBER 세션 → 실제 Learning API 호출까지 확인한다. Learning 테스트 환경이 새 Identity 토큰을 받아들이는지도 확인한다.
- [ ] 신규 가입, 기존 Guest 승격, Guest 병합과 기록 조회를 각각 확인한다.
- [ ] 취소 직후 새 인증, 중복 탭, 네트워크 단절, 서버 오류, 저장 실패, 앱 종료·재시작을 관련 단계에서 검증한다.
- [ ] iOS·Android에서 확인하고, 배포용 서명·Provider 설정은 개발용 설정과 별도로 검증한다.
- [ ] 변경된 로직의 회귀 검사와 저장소 필수 검사(lint·TypeScript·architecture·naming)를 실행한다.

**완료 기준:** Firebase 토큰 획득만이 아니라 서비스 회원 권한과 기록 보존까지 확인한 시나리오를 기록한다.

## 별도로 남겨 둔 후속 작업

- [ ] **문의 API:** 입력 화면·검증·제출 상태는 구현돼 있지만 전송 어댑터가 없다. 비로그인 호출 가능한 endpoint·요청/응답 계약을 서버와 확정한 뒤 연결한다. 현재는 실제 접수할 수 없다. 복구 불가 사용자의 지원 경로를 출시 전에 확보해야 한다.
- [ ] **학습 기록 삭제:** 사용자 결정대로 서버 endpoint 개발 전까지 보류한다. 회원탈퇴 API로 대체하지 않는다.
- [ ] **로그아웃·회원탈퇴:** 회원용 메뉴를 제공할 때 각각 계약과 재인증·로컬 정리를 연결한다. 기존 `api/logout.ts`는 실제로 `/users/withdraw`를 호출하므로 일반 로그아웃에 재사용하지 않는다.
- [ ] **회원의 SNS 추가 연결·해제:** 첫 로그인과 별도 기능이다. 제공 범위를 정한 뒤 전용 서버 계약으로 구현한다.

## 다음 스켈레톤 추천

**2번의 코디네이터 분기와 3번의 세션 확정 흐름부터** 작성하는 것을 추천한다. 이미 구현한 Firebase 컨트롤러의 `proof-ready`를 받아 `exchange/prepare`로 갈라지고, 결과를 세션 확정·가입·병합 상태로 넘기는 경계다.

4~7번의 세부 상태를 한 번에 완성할 필요는 없다. 우선 기존 MEMBER 로그인 한 경로를 연결하고, 가입·Guest 분기는 명시적인 미완료 상태로 남긴 다음 확장할 수 있다. 기본 앱 전환은 지원하려는 가입·Guest 흐름까지 준비한 뒤 진행한다. 이는 제안 순서이며 이번 문서 작성으로 후속 구현을 시작하지 않는다.

## 기준 문서

- [최신 서버 계약 스냅샷](firebase-sns-auth-api-spec-2026-09-22.md)
- [Firebase 설정·실제 검증 범위](firebase-auth-sdk-setup.md)
- [Firebase 컨트롤러 결정과 사용자 뼈대](decisions/2026-09-28-Firebase-본인-인증-컨트롤러.md)
- [세션 복원·복구 행동 결정](decisions/2026-09-28-인증-세션-복원과-복구-행동.md)

과거 문서의 ‘미설치·미설정’ 설명보다 현재 코드와 최신 설정 기록을 우선한다. 이 문서만 추가했으며 앱 코드·기존 사용자 스켈레톤은 변경하지 않았다.
