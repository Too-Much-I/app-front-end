# RevenueCat 익명 초기화 제거

## 확인된 문제

익명 configure 후 logIn하면 original App User ID가 익명으로 남을 수 있다. Billing의 strict original 검사 때문에 검토 기록이 남았다. 구매 취소 callback 자체가 지급 근거가 되는 문제는 아니다.

## 결정

사용자 「좋아 그렇게 해자 브랜치 파서 수정해줘」 승인에 따라 purchase-account를 먼저 확보하고 configure({apiKey, appUserID})한다. Offering 조회도 같은 준비를 기다린다. SDK current ID가 기대 ref와 다르면 결제 호출을 막는다.

로그아웃은 SDK에 새 익명 고객을 만들지 않고 로컬 구매 접근을 닫는다. 다음 회원은 logIn으로 전환한다. UI의 사용자 정보는 앱 인증이 소유하며 SDK의 이전 고객 정보를 노출하지 않는다.

## 범위와 한계

Billing은 별도 브랜치에서 인증된 거래+완전한 별칭 목록으로 익명 original을 확인한다. 앱 callback으로 권리를 지급하지 않는다. 이미 생긴 검토 기록은 서버에서 검증·원본 재전송해야 한다. 이번에 배포/Store 결제/운영 재처리는 하지 않았다.

## 검증

pnpm typecheck, lint, check:architecture, check:naming 및 node scripts/check-revenuecat-owner.mjs. 스크립트는 실제 wrapper를 fake native SDK로 실행해 초기화 전 거절·직접 ID configure·로그아웃 차단·다른 계정 거절·SDK ID 불일치·취소 반환을 검사한다. 실제 기기 검증은 별도다.
