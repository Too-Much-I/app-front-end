# RevenueCat 결제 계정 초기화

## 설계 논의

- 쟁점: 익명 SDK 초기화가 정상 회원 구매의 original ID를 익명으로 남길 수 있다.
- AI 제안: purchase-account 확보 뒤 직접 appUserID configure, 구매 전 SDK ID 확인, Billing은 인증된 거래와 전체 별칭 증거로 제한적 인정.
- 사용자 승인 원문: 「좋아 그렇게 해자 브랜치 파서 수정해줘」.
- 다룬 실패 범위: 준비 전 결제, 로그아웃 후 결제, 다른 회원 ref, SDK ID 불일치, 결제창 취소.
- 다루지 않은 것: 실제 Store 결제·운영 재처리·서버 권한 활성화.
- 사용자 반증 및 직접 설명은 아직 받지 않았으며 대신 작성하지 않는다.

## 시나리오 지도

1. 앱 첫 실행에서 결제 화면을 연다. SDK 초기화는 어떤 값으로 언제 시작되는가? loadPassOptions → purchaseIdentity.ensure → logInStoreCustomer.
2. A 로그아웃 뒤 B로 로그인한다. 이전 화면의 A 구매 요청이 통과할 수 있는가? reset → logOutStoreCustomer → requireStoreCustomer.
3. SDK 사용자와 앱의 ref가 달라졌다. 실제 Store 호출까지 진행되는가? purchasePassPackage → requireStoreCustomer.

## 내가 찾은 것
<!-- 사용자 작성 대기 -->

## 흐름 설명
<!-- 사용자 작성 대기 -->

## 설계와 달라진 것
<!-- 사용자 작성 대기 -->
