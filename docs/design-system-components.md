# 디자인 시스템 — 컴포넌트

토큰이 "무슨 값을 쓰나"라면 이 문서는 **"그 값들을 어떤 모양으로 묶어 두었나"** 다.
값 문서는 [간격](./design-system-spacing.md) · [반경 · 모션 · 치수](./design-system-tokens.md)에 있다.

컴포넌트를 만드는 기준은 하나다 — **같은 규칙이 여러 화면에서 반복되는데, 그 규칙이 문자열로만
존재해서 화면마다 조금씩 어긋나고 있을 때.** 단지 코드가 비슷하다는 이유로는 만들지 않는다.

---

## `Button`

[`src/components/ui/Button.tsx`](../src/components/ui/Button.tsx)

### 왜 있나

도입 전에는 같은 "브랜드 CTA"가 59곳에 서로 다른 문자열로 흩어져 있었다. 모서리까지
`rounded-2xl`과 `rounded-full`로 갈려 있었다.

```text
rounded-2xl bg-brand-cta py-4      ← StartMockExamButton
rounded-full bg-brand px-6 py-3    ← HistoryPanelNotice
rounded-2xl bg-brand px-6 py-4     ← EmptyReanswerHistory
```

세로 여백이 `py-3` · `py-3.5` · `py-4`로 갈리고, **같은 색(brand 500)을 가리키는 `bg-brand`와
`bg-brand-cta`라는 두 이름까지 함께 굳고 있었다.**

### 프롭

| 프롭 | 값 | 기본값 |
|---|---|---|
| `variant` | `primary` · `secondary` · `neutral` · `danger` | `primary` |
| `size` | `sm`(36) · `md`(44) · `lg`(52) | `md` |
| `loading` | 스피너 + 잠금 | `false` |
| `disabled` | 잠금 | `false` |
| `renderIcon` | `({ size, color }) => ReactNode` | — |
| `elevated` | 그림자 | `false` |
| `className` | **배치만** | — |

### variant 고르기

역할은 배경색이 아니라 **"화면에서 이 버튼이 무슨 무게인가"** 로 나뉜다.

| variant | 모양 | 언제 |
|---|---|---|
| `primary` | 주황 채움 · 흰 글자 | 화면이 사용자에게 기대하는 그 행동 |
| `secondary` | 흰 바탕 · 주황 테두리 | 주 행동 옆의 대안 |
| `neutral` | 흰 바탕 · 회색 테두리 | 무게가 없는 행동 — 닫기, 나중에 하기 |
| `danger` | 흰 바탕 · **빨간 테두리** | 되돌아갈 길이 나란히 놓인 상태에서 고르는 파괴적인 쪽 |

`danger`의 기준은 **무엇을 하느냐가 아니라 옆에 대안이 있느냐**다. 확인 모달의 "삭제"는
danger지만, 시험 정보를 못 불러온 오류 화면의 "시험 나가기"는 `primary`다 — 거기서는
나가기가 파괴가 아니라 그 화면이 기대하는 유일한 행동이다.

**`danger`가 채움이 아니라 외곽선인 것도 이 앱의 규칙이다.** `ConfirmModal`이 "파괴적인 쪽을
시각적 기본값으로 두지 않는다"고 정해 두었고, 실제로 되돌아가는 쪽(취소)이 채움 버튼을
가져간다. 빨강으로 채운 버튼은 앱 전체에서 dev 전용 진단 화면 한 곳뿐이다.

### size 고르기

- **`lg`(52)** — 화면 폭을 채우는 주 CTA. 빈 상태의 행동 유도, 모달의 버튼.
- **`md`(44)** — 기본값. 최소 터치 영역과 같은 높이다. 확신이 없으면 이것.
- **`sm`(36)** — 목록 행 안의 보조 버튼처럼 밀도가 필요할 때만. `hitSlop`은 `Button`이 자동으로 붙인다.

### 이렇게 쓴다

```tsx
<Button
  className="mt-section w-full"
  label="시험 나가기"
  size="lg"
  onPress={onExit}
/>
```

아이콘은 **글리프만** 고른다. 크기와 색은 variant · size가 정해서 넘겨준다.

```tsx
<Button
  label="모의고사 시작하기"
  renderIcon={({ color, size }) => <AntDesign color={color} name="audio" size={size} />}
  size="lg"
  onPress={onPress}
/>
```

### 이렇게 쓰지 않는다

```tsx
// ✗ className으로 색·높이·반경을 덮어쓴다
<Button className="rounded-full bg-sky py-2" label="확인" onPress={onOk} />

// ✗ 아이콘 색을 호출부가 정한다 — "주황 버튼 위 아이콘은 흰색" 규칙이 버튼 밖으로 샌다
<Button renderIcon={() => <AntDesign color="#fff" name="audio" size={20} />} ... />

// ✗ 라벨을 지우고 스피너만 남긴다 — 폭이 줄어 옆 요소가 밀린다
{loading ? <ActivityIndicator /> : <Button label="저장" onPress={save} />}
```

모서리는 프롭이 없다. `rounded-control`(16px) 하나이고, 알약이 남는 자리는
[반경 문서 §4](./design-system-tokens.md#4-버튼은-사각-알약은-어디에-남았나)에 있다.

`className`이 정하는 것은 **배치뿐이다** — 바깥 여백(`mt-section`), 너비(`w-full`, `flex-1`).
색 · 높이 · 반경을 여기서 바꾸고 싶어지면 그건 새 variant가 필요하다는 신호이므로,
덮어쓰지 말고 `Button`에 추가한다.

### 상태

| 상태 | 모양 | 접근성 |
|---|---|---|
| 기본 | variant의 색 | `accessibilityRole="button"` |
| 누름 | 불투명도 0.7 → 200ms 복귀 | `Pressable`이 담당 |
| `loading` | 아이콘 자리에 스피너, **라벨 유지**, 잠김 | `accessibilityState.busy` |
| `disabled` | variant의 **채움 여부를 유지**한다 (채움→`bg-line`, 외곽선→흰 바탕에 회색 테두리) | `accessibilityState.disabled` |

비활성이 채움 여부를 유지하는 이유: 외곽선 버튼이 비활성일 때 회색으로 채워지면 같은
버튼이 상태에 따라 다른 종류로 보인다. **색만 힘을 잃고 형태는 남아야** 사용자가
"같은 버튼인데 지금은 못 누른다"로 읽는다.

글자색이 배경에 따라 갈리는 것도 같은 이유다. `ink.disabled`(#9CA3AF)는 `line`(#E5E7EB)
위에서 1.87:1이라 읽히지 않지만 흰 배경 위에서는 2.54:1로 읽힌다. 채움 쪽은 한 단계 진한
`ink.muted`(4.02:1)를 쓴다. **WCAG가 비활성 컨트롤을 대비 기준에서 빼주더라도 라벨은
정보다.**

---

## 아직 만들지 않은 것과 그 이유

디자인 시스템 문서는 만든 것만큼 **만들지 않기로 한 것**도 적어야 한다. 적어두지 않으면
다음 사람이 같은 검토를 처음부터 다시 한다.

### `Card`

`rounded-3xl bg-surface p-card`가 14곳에 있지만, 테두리 유무 · 반경(`2xl`/`3xl`) ·
여백(`p-card`/`p-6`)이 자리마다 다른 의도로 갈린다. 지금 컴포넌트로 묶으면 variant가
쓰는 곳 수만큼 생긴다. **먼저 `rounded-card` 토큰으로 반경을 모으고, 그래도 남는 조합이
두세 개면 그때 만든다.**

### `EmptyState` · `ErrorState`

이미 `HistoryPanelNotice` · `EmptyExamHistory` · `EmptyReanswerHistory` ·
`GradingRetryNotice` · `ExamPreludeError`가 있고, **각자 다른 마스코트 · 다른 일러스트 ·
다른 행동을 가진다.** 공통은 "제목 + 설명 + 버튼" 골격뿐인데 그건 이미 `Text` 두 개와
`Button` 하나다. 여기서 한 겹 더 추상화하면 관련 없는 화면들이 한 파일에 묶인다
([AGENTS.md](../AGENTS.md)의 결합도 기준: 중복 제거가 결합을 만들면 중복을 허용한다).

### `ScreenLayout`

safe-area inset을 어느 변에 적용할지가 화면마다 다르고(`edges` 조합), 그 판단은 화면이
스크롤인지 · 하단 고정 바가 있는지 · 시험 중인지에 달려 있다. 컴포넌트가 감추면 그 판단이
보이지 않는 곳으로 들어간다. `px-screen` 토큰이 이미 좌우 여백은 통일하고 있다.
