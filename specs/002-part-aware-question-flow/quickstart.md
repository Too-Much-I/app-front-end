# Quickstart: 파트별 시험 흐름 수동 검증

## Static checks

```sh
pnpm lint
pnpm exec tsc --noEmit
pnpm exec expo export --platform all --output-dir /tmp/app-front-end-dist
git diff --check
```

## Validation record — 2026-07-28

- `pnpm lint`: exit 0. 변경 범위 밖 `src/screens/home/HomeScreen.tsx:69`의 기존 미사용
  `DebugGrid` warning 1건이 남아 있다.
- `pnpm exec tsc --noEmit`: exit 2. 같은 기존 `DebugGrid`의 TS6133 한 건만 보고했다.
- `pnpm exec tsc --noEmit --noUnusedLocals false`: exit 0.
- `pnpm exec expo export --platform all --output-dir /tmp/app-front-end-dist`: exit 0. Android와
  iOS bundle을 모두 생성했다.
- `git diff --check`: exit 0.
- iOS/Android 실기기 audio·AppState 검증: 현재 workspace에 기기가 없어 실행하지 않았다.

## Mock happy path

1. 음향 테스트를 완료하고 mock 시험을 시작한다.
2. 모든 directions에서 rounded card 없이 화면 전체가 베이지색인지 확인한다.
3. Part 3 directions 종료 후 별도 "상황 안내" 제목 없이 text와 guide audio가 한 번 제공되는지 확인한다.
4. guide audio 정상 종료 후 Q5의 3초 준비가 시작되는지 확인한다.
5. Q6/Q7 및 Q5 녹음 재시도에서 상황 안내가 반복되지 않는지 확인한다.
6. Part 4 directions 종료 후 질문 없이 표와 45초 timer만 보이는지 확인한다.
7. 준비 완료 버튼을 누르면 남은 읽기 시간을 생략하고 Q8의 3초 준비로 이동하는지 확인한다.
8. 버튼을 누르지 않으면 45초 후 Q8 준비로 이동하고 Q8~Q10에서 동일한 표가 계속 보이는지 확인한다.

## Interruption and invalid data

1. Part 3 재생 중 앱을 background로 보내 audio가 멈추고 Q5로 진행하지 않는지 확인한다.
2. foreground 복귀 시 안내가 처음부터 다시 재생되는지 확인한다.
3. Part 4 읽기 중 background로 보낸 시간만큼 timer가 줄지 않는지 확인한다.
4. mock에서 Part 3 guide URL 또는 Q8 표를 임시 누락해 오류 화면이 문제/녹음을 차단하는지 확인한다.
5. Q9에 Q8과 다른 표를 임시 주입해 충돌 오류가 Part 4 시작 전에 표시되는지 확인한다.

## Submission overflow

1. 최대 11개 실패 job 또는 큰 글자 설정으로 실패 목록을 viewport보다 길게 만든다.
2. 첫 카드부터 마지막 카드까지 스크롤되는지 확인한다.
3. 마지막 retry 버튼 전체가 home indicator/system navigation 위에 있고 눌리는지 확인한다.
4. retry 중 카드가 제거되어도 남은 카드의 action을 계속 사용할 수 있는지 확인한다.

실제 backend 연결 전에는 remote Part 3 audio와 production 표 계약을 통합 완료로 간주하지 않는다.
