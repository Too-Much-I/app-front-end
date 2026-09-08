/**
 * 디자인 토큰 단일 소스.
 *
 * CommonJS인 이유: `tailwind.config.js`가 `require()`로 읽어야 하는데
 * tailwind 설정은 Metro/Babel을 거치지 않고 Node가 직접 실행하기 때문에 TS를 못 읽는다.
 * 그래서 여기만 `.js`로 두고, TS 쪽은 `@/theme`을 통해 타입이 붙은 형태로 가져다 쓴다.
 *
 * NativeWind로 스타일링할 수 없는 지점(react-navigation의 `tabBarStyle` 등)과
 * `className` 유틸리티가 같은 값을 보게 하는 게 목적이다.
 */

/**
 * brand 주황.
 *
 * 500은 목업 시안(`public/ChatGPT Image ....png`)의 주 버튼 두 개('시작하기',
 * '상세 피드백 보기')를 각각 크롭해 중앙값을 낸 값이다(둘 다 #F76810/#F86910으로 일치).
 * 나머지 단계는 색조 23.1°를 고정한 채 채도/명도만 옮겨 만들었다.
 *
 * `public/logo.png`의 주황(#FB7B10)은 이미지 자체의 색이라 그대로 유지하되,
 * 옆의 "토선생" 워드마크와 UI의 주황은 500으로 통일한다.
 */
const brand = {
  50: "#FFF7F2",
  100: "#FFECE0",
  200: "#FFD9C2",
  300: "#FFBD94",
  400: "#FC9351",
  500: "#F76910",
  600: "#E05B07",
  700: "#BD4900",
  800: "#993B00",
  900: "#752D00",
};

const colors = {
  brand: {
    ...brand,
    DEFAULT: brand[500],
    /**
     * 흰 배경 위 주황 "텍스트"는 반드시 이걸 쓴다.
     * 500은 흰 배경 대비 3.01:1이라 버튼·큰 글씨(3:1)는 통과하지만
     * 본문 기준 4.5:1에 미달한다. 700은 5.10:1로 통과.
     */
    text: brand[700],
    /** CTA도 브랜드 워드마크와 같은 500을 사용해 화면마다 주황이 갈리지 않게 한다. */
    cta: brand[500],
  },
  /**
   * 보조 하늘색.
   *
   * 브랜드 주황을 쓰지 않고도 카드끼리 구분해야 하는 자리를 위한 유일한 다른 색조다.
   * 임의로 고른 파랑이 아니라 마스코트 나비넥타이에서 뽑은 색(#80C8F0)을 기준으로,
   * 배경용으로 명도만 끌어올려 만들었다. 그래서 토끼 일러스트와 같은 세계로 읽힌다.
   *
   * 쓰는 이유: 주황을 옅게 깐 카드는 CTA 버튼과 같은 색조라 서로 힘을 나눠 갖는다.
   * 색조 자체를 바꾸면 CTA는 화면에서 유일한 강한 주황으로 남는다.
   */
  sky: {
    /** 마이크·음향 테스트처럼 긍정 상태를 또렷하게 표시하는 기본 하늘색. */
    DEFAULT: "#80C8F0",
    /** 카드 바탕. 페이지 배경(#FFF9F2)·흰 카드와 명도는 비슷하지만 색조로 갈린다. */
    surface: "#DCEDF9",
    /** 명도차가 작아 경계가 흐려지므로 헤어라인으로 형태를 잡아준다. */
    line: "#B9DCF2",
    /** `sky.surface` 위 텍스트용. 6.31:1로 본문 기준(4.5:1)을 넘긴다. */
    text: "#0E5A7D",
  },
  ink: {
    DEFAULT: "#111827",
    muted: "#6B7280",
    disabled: "#9CA3AF",
  },
  surface: {
    DEFAULT: "#FFFFFF",
    /** 목업의 카드 바탕에서 측정한 따뜻한 크림(#FFF9F2). 회색이 아니다. */
    subtle: "#FFF9F2",
    /** 입력·시간 정보처럼 흰 화면 위에서 조용히 구분되는 중립 배경. */
    muted: "#F7F7F7",
  },
  line: {
    DEFAULT: "#E5E7EB",
  },
  /**
   * 시험 진행 화면 전용 상태색.
   *
   * 원본 웹 화면의 blue-950 / red-500 계열을 그대로 옮긴다. 일반 앱 화면의
   * 브랜드·피드백 색과 역할이 다르므로 개별 화면에 hex를 흩뿌리지 않고 여기서 관리한다.
   */
  exam: {
    navy: "#172554",
    danger: "#EF4444",
    dangerLine: "#F87171",
    dangerSoft: "#FCA5A5",
  },
  /**
   * 채점 대기 화면의 "채점표" 전용 색.
   *
   * `ink`를 `exam.danger`(#EF4444)와 따로 두는 이유: 저건 오류·경고를 알리는 빨강이고
   * 이건 선생님이 답안지에 그은 획이다. 같은 값으로 묶으면 나중에 경고색을 조정할 때
   * 채점 체크까지 같이 끌려간다.
   *
   * `paper`는 `surface.subtle`(#FFF9F2)보다 살짝 밝고 노란기가 적다. 크림색 화면 위에
   * 종이 한 장이 올라간 것으로 보이려면 둘이 같은 값이면 안 된다.
   */
  grading: {
    /** 빨간펜 잉크 — 체크, 밑줄, 여백선의 기준색. */
    ink: "#DE3125",
    paper: "#FFFDF8",
    /** 종이의 가장자리. 그림자만으로는 크림 배경 위에서 경계가 흐려진다. */
    paperEdge: "#ECE2CF",
    /** 가로 괘선. 파랑기가 있는 회색이라 잉크의 빨강과 부딪히지 않는다. */
    rule: "#D9E3ED",
    /** 왼쪽 세로 여백선 — 잉크를 흐리게 뺀 값. */
    margin: "#F0B6AE",
  },
  /**
   * 10초 챌린지 노트 전용 색.
   *
   * 목업(`output/imagegen/10s-challenge/concept-b.png`)의 노트 영역에서 직접 뽑았다.
   * 점선·테이프는 `sky`, 문장 본문은 `ink`를 그대로 쓰므로 여기에는 노트라는 물건을
   * 만드는 데만 필요한 값을 남겼다.
   *
   * `grading`의 종이색과 따로 두는 이유: 저건 빨간펜이 지나간 채점표고 이건 연습장이다.
   * 한쪽 톤을 조정할 때 다른 쪽이 끌려가면 안 된다.
   */
  challenge: {
    /** 속지 아래 깔린 크림 대지. 페이지 배경(#FFF9F2)보다 살짝 노랗다. */
    mat: "#FDF5E5",
    /** 속지의 옅은 가로 괘선. 흰 종이 위에서 거의 보이지 않을 만큼 옅어야 한다. */
    rule: "#EFF6FC",
    /** "오늘의 문장" 라벨 바탕. 위에 올리는 글자는 `ink`. */
    label: "#FDE897",
    /** 왼쪽 가장자리 펀치 구멍의 테두리 — 구멍 자체는 대지 색으로 뚫는다. */
    holeEdge: "#DED3BE",
    /**
     * 결과 화면 문장 카드의 민트 톤.
     *
     * 하늘 톤은 기존 `sky`를 그대로 쓰므로 짝이 없는 민트만 여기 둔다. 두 톤을 나누는
     * 이유는 "내가 말한 것"과 "이렇게 말할 수 있다"가 같은 색이면 어느 쪽이 내 문장인지
     * 색으로 구분되지 않기 때문이다.
     */
    mint: {
      surface: "#E6F3E7",
      /** 라벨 칩 바탕. 카드 바탕보다 한 단계 진해야 칩으로 읽힌다. */
      label: "#CDE9D3",
      /** 민트 바탕 위 텍스트. 대비 5.9:1로 본문 기준(4.5:1)을 넘긴다. */
      text: "#2F6B4A",
    },
    /** "토선생의 한마디" 판정 카드. 노트의 라벨 노랑(`label`)보다 한 단계 짙다. */
    verdict: "#FBE7AC",
    /** 판정 카드 모서리에 붙는 별 스티커. */
    star: "#FBC02D",
    /** 완료를 축하하는 색종이. 네 색을 번갈아 뿌린다. */
    confetti: {
      pink: "#F9C6C9",
      yellow: "#FBD46A",
      mint: "#BFE3C8",
      sky: "#A8D2F0",
    },
    /**
     * 첨삭 심각도 3단계.
     *
     * 웹 상세 피드백(`web-front-end/src/components/exam/exam-marked-transcript.tsx`)에서
     * 쓰던 값을 그대로 가져왔다. 두 화면이 같은 AI 첨삭을 그리므로 색까지 갈리면
     * 같은 지적이 매체마다 다른 무게로 읽힌다.
     *
     * 색조를 늘리지 않고 주황의 진한 정도로만 구분하는 것도 그쪽 규칙을 따른 것이다 —
     * 빨강을 새로 들이면 `exam.danger`(오류)와 의미가 겹친다.
     */
    correction: {
      high: "#C2410C",
      medium: "#F97316",
      low: "#FDBA74",
    },
  },
  /** 결과 피드백 화면의 카드, 상태 배지와 교실 칠판에만 쓰는 의미 색. */
  feedback: {
    scoreSurface: "#07513D",
    scoreSurfaceSoft: "#116B53",
    scoreTrack: "#397464",
    chalkboard: "#174D3C",
    chalkboardDeep: "#0E382C",
    chalk: "#F7F2D7",
    chalkMuted: "#C8DCCF",
    wood: "#A76B3D",
    woodLight: "#D49A62",
    cardTint: "#FFF8EF",
    cardLine: "#FFC3A2",
    positive: "#169B5B",
    positiveSoft: "#EAF8F0",
    caution: "#E99A0B",
    cautionSoft: "#FFF6DF",
    improvement: "#EF5B62",
    improvementSoft: "#FFF0F1",
    history: {
      chartLine: "#C9DEF2",
      blue: "#2F86D5",
      blueSoft: "#E8F3FD",
      green: "#168C51",
      greenSoft: "#E8F6ED",
      purple: "#7057C9",
      purpleSoft: "#F0ECFC",
      orange: "#D95700",
      orangeSoft: "#FFF0E5",
    },
    radarGrid: "#89AA9D",
    radarFill: "#FFCD45",
    radarPoint: "#FF8B32",
    /** 파트별 피드백 카드는 색을 통일하고 상태 배지만 별도 색으로 구분한다. */
    part: {
      surface: "#FFFDF8",
      border: "#E9DED0",
      accent: "#F76910",
      body: "#374151",
      action: "#FFF1E7",
      actionText: "#993B00",
      positive: "#137A4B",
      positiveSoft: "#E8F5EE",
      caution: "#A86600",
      cautionSoft: "#FFF4D8",
      improvement: "#C8454B",
      improvementSoft: "#FDECEC",
    },
  },
};

/**
 * 그림자 원시값.
 *
 * 타입이 붙은 프리셋 조립은 `src/theme/index.ts`가 하고, 여기서는 색과 치수만 낸다.
 * `colors`에 두지 않은 이유: 그림자 색은 UI 팔레트가 아니라서
 * tailwind `theme.extend.colors`로 새어나가면 안 된다.
 *
 * iOS의 opacity/radius와 Android의 `elevation`은 서로 무관한 API지만
 * 같은 단계에서 비슷한 깊이로 보여야 하므로 한 덩어리로 묶어 둔다.
 */
const shadow = {
  color: "#000000",
  /** 그림자 끄기용. RN은 `shadowColor`를 비울 수 없어 투명색으로 끈다. */
  colorNone: "transparent",
  card: { offsetY: 2, opacity: 0.08, radius: 8, elevation: 3 },
  /** 위로 뜨는 그림자 — 하단 탭바처럼 화면 아래에 붙는 표면용. */
  raisedBottom: { offsetY: -2, opacity: 0.06, radius: 8, elevation: 8 },
};

/**
 * Jua 하나만 쓴다. 커스텀 폰트는 iOS/Android에서 동일하게 렌더링되므로
 * San Francisco/Roboto의 메트릭 차이를 아예 만들지 않는다.
 * `sans`도 같은 값으로 덮어써서, 별도 지정 없이 떨어지는 텍스트도 Jua가 되게 한다.
 */
const fontFamily = {
  jua: ["Jua_400Regular"],
  sans: ["Jua_400Regular"],
};

/**
 * px 값을 rem 문자열로 환산한다.
 *
 * 제수는 런타임 rem 기준(`src/theme/rem-scale.ts`의 `BASE_REM`)과 **반드시 같아야 한다.**
 * 둘이 같아야 `p-card`가 이름 그대로 16px로 렌더된다. 한쪽만 바꾸면 모든 토큰 값이
 * 그 비율만큼 어긋난다.
 *
 * 14에서 16으로 올린 이유: 14일 때 Tailwind 기본 스케일은 이름과 px가 어긋나서
 * (`p-4`는 16px이 아니라 14px) 토큰 스케일과 값이 겹치지 않았다. 그래서 `p-4` 597곳을
 * 토큰으로 옮기는 일이 이름 변경이 아니라 597번의 시각 변경이었다.
 *
 * 16에서는 기본 스케일이 곧 실제 px가 되어 두 스케일이 정확히 겹친다 —
 * `p-4` = 16px = `p-lg`, `gap-2` = 8px = `gap-sm`, `mt-5` = 20px = `mt-xl`.
 * 이관은 이제 시각 변화가 없는 리네이밍이고, 급할 것도 없어졌다.
 *
 * 대가는 한 번의 전면 변화다. 토큰을 쓰지 않는 여백 · 크기 · 행간이 전부 14.3% 커진다.
 * 토큰 여백과 글자 크기는 이 함수를 통과하므로 **움직이지 않는다.**
 */
const remFromPx = (px) => `${px / 16}rem`;

/**
 * fontSize에 lineHeight를 항상 붙여둔다.
 * lineHeight를 비워두면 플랫폼별 폰트 메트릭으로 행 높이가 갈려서
 * 탭바처럼 높이가 고정된 컨테이너의 수치를 다시 맞춰야 한다.
 *
 * px가 아니라 rem인 이유: 런타임 rem 스케일링(`src/theme/rem-scale.ts`)이
 * 글자와 여백을 같은 계수로 움직이게 하려면 둘이 같은 단위여야 한다.
 * 여백과 이미지는 Tailwind 기본 스케일을 따라 이미 rem이었고, fontSize만
 * px로 고정돼 있어 글자가 스케일링에서 빠져 있었다.
 */
const fontSize = {
  xs: [remFromPx(12), { lineHeight: remFromPx(16) }],
  sm: [remFromPx(14), { lineHeight: remFromPx(20) }],
  base: [remFromPx(16), { lineHeight: remFromPx(24) }],
  lg: [remFromPx(18), { lineHeight: remFromPx(26) }],
  xl: [remFromPx(20), { lineHeight: remFromPx(28) }],
  "2xl": [remFromPx(24), { lineHeight: remFromPx(32) }],
  "3xl": [remFromPx(30), { lineHeight: remFromPx(38) }],
};

/**
 * 간격 스케일 — px 원시값.
 *
 * 8px을 기본 리듬으로 쓰고 4px을 세부 단위로 보탠다. 12·20은 8의 배수가 아니지만
 * 각각 "컴포넌트 내부 분리"와 "화면 좌우 여백"이라는 확실한 역할이 있어 남겼다.
 * 목표는 모든 값을 8의 배수로 만드는 게 아니라 화면마다 17·19·21이 새로 생기는 걸 막는 것이다.
 *
 * `fontSize`와 달리 px 숫자로 두는 이유: 이 객체는 tailwind와 RN 스타일 객체
 * 양쪽이 본다. tailwind에 넘길 rem 환산은 아래 `spacingScale`이 한 번에 하고,
 * JS 계산이 필요한 곳(`tabBar.contentHeight` 같은 자리)은 숫자를 그대로 쓴다.
 */
const spacing = {
  0: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
  "5xl": 48,
  "6xl": 64,
};

/**
 * 의미를 가진 레이아웃 간격.
 *
 * `colors`가 `brand`·`sky`·`exam`처럼 역할별로 묶여 있는 것과 같은 이유로 둔다.
 * 숫자 스케일만 있으면 "여기는 md인가 lg인가"를 화면마다 다시 판단하게 되고,
 * 그 판단이 화면마다 갈리면 스케일이 있어도 간격은 여전히 제각각이 된다.
 *
 * 키 이름에 `Padding`/`Gap` 접미를 붙이지 않은 이유: tailwind는 padding·margin·gap이
 * 스케일 하나를 공유한다. `cardPadding`으로 이름 붙이면 `gap-card-padding`이 되어
 * 호출부 절반에서 이름이 거짓말을 한다. 그래서 "무엇의 안" / "무엇들 사이"라는
 * 대상으로만 이름을 짓고, 어떤 속성에 쓰는지는 유틸리티 접두사가 말하게 했다.
 *
 * | 토큰 | px | 쓰는 자리 |
 * | --- | --- | --- |
 * | `content` | 8 | 아이콘↔텍스트, 라벨↔값, 버튼 묶음 — 붙어 읽혀야 하는 것들 |
 * | `element` | 12 | 한 컴포넌트 안에서 성격이 다른 요소를 가를 때 (제목↔설명) |
 * | `card` | 16 | 카드·패널·리스트 아이템의 기본 내부 여백 |
 * | `screen` | 20 | 화면 좌우 edge와 콘텐츠 사이 |
 * | `section` | 24 | 콘텐츠 그룹과 다음 그룹 사이 |
 * | `section-lg` | 32 | 화면의 의미 단위가 바뀌는 자리 (헤더↔본문) |
 *
 * 4px(`spacing.xs`)와 40 이상(`4xl`~`6xl`)은 의미 토큰을 두지 않았다. 전자는 특정
 * 요소의 시각 보정이라 반복되는 규칙이 아니고, 후자는 hero처럼 화면마다 사정이 달라서
 * 이름을 붙이면 오히려 아무 데나 쓰이게 된다. 그 두 구간은 스케일에서 직접 고른다.
 */
const layout = {
  content: spacing.sm,
  element: spacing.md,
  card: spacing.lg,
  screen: spacing.xl,
  section: spacing["2xl"],
  "section-lg": spacing["3xl"],
};

/**
 * tailwind `theme.extend.spacing`에 넘기는 rem 환산본.
 *
 * rem인 이유는 `fontSize`와 같다 — 런타임 rem 스케일링(`src/theme/rem-scale.ts`)이
 * 글자와 여백을 같은 계수로 움직이려면 둘이 같은 단위여야 한다.
 *
 * 주의: rem 기준이 14라서 tailwind 기본 스케일(`p-4` = 1rem = 14px)은 여기 px 값과
 * 어긋난다. `p-card`(16px)와 `p-4`(14px)는 다른 값이다. 새 UI는 이 스케일을 쓰고,
 * 기본 스케일과 섞어 쓰지 않는다.
 *
 * 기본 스케일을 덮어쓰지 않고 키를 더하기만 하는 이유: `p-4`·`gap-2`가 이미
 * 수백 군데에 있어 값을 바꾸면 전 화면이 한 번에 움직인다. 두 스케일은 공존하고,
 * 마이그레이션은 의미가 확실한 자리부터 따로 진행한다.
 *
 * tailwind의 `width`/`height`/`maxWidth`는 spacing을 펼친 뒤 자기 키로 덮어쓰므로
 * `max-w-3xl`·`w-screen` 같은 기존 클래스는 여기 키를 더해도 그대로다.
 */
const toRemScale = (scale) =>
  Object.fromEntries(
    Object.entries(scale).map(([key, px]) => [key, remFromPx(px)]),
  );

const spacingScale = { ...toRemScale(spacing), ...toRemScale(layout) };

/**
 * 모서리 반경 — px 원시값.
 *
 * `spacing`과 같은 이유로 둔다. 지금은 `rounded-2xl`(14px) 61곳, `rounded-3xl`(21px)
 * 43곳, `rounded-full` 91곳이 섞여 있는데 셋을 가르는 규칙이 없다. 같은 성격의 카드가
 * 화면에 따라 14px와 21px로 갈리면 형태가 화면마다 다른 말을 한다.
 *
 * 값은 간격과 같은 4px 리듬을 따른다. 반경과 여백은 같은 표면 위에서 함께 보이므로
 * 리듬이 다르면 카드 모서리와 내부 여백이 서로 어긋나 보인다.
 *
 * | 토큰 | px | 쓰는 자리 |
 * | --- | --- | --- |
 * | `chip` | 8 | 배지 · 라벨 · 작은 태그 |
 * | `control` | 16 | 사각 버튼 · 입력 · 토글 |
 * | `card` | 20 | 카드 · 패널 · 리스트 아이템 |
 * | `sheet` | 24 | 바텀시트 · 모달처럼 화면을 덮는 표면 |
 * | `pill` | — | 알약 버튼 · 원형 (`radiusScale`에서 9999px) |
 *
 * `control`과 `pill`을 함께 두는 이유: 지금 `rounded-full` 91곳에는 알약 버튼뿐 아니라
 * 점 · 원형 아바타 · 진행 바가 섞여 있다. 버튼 모양을 사각(`control`)으로 할지
 * 알약(`pill`)으로 할지는 컴포넌트가 정할 판단이고, 토큰은 두 선택지를 다 갖고 있어야 한다.
 */
const radius = {
  chip: 8,
  control: 16,
  card: 20,
  sheet: 24,
};

/**
 * tailwind `theme.extend.borderRadius`에 넘기는 환산본.
 *
 * rem인 이유는 `spacingScale`과 같다 — 태블릿에서 여백과 글자가 커질 때 모서리만
 * 그대로면 카드가 상대적으로 각져 보인다. `pill`만 px인 것은 이 값이 "충분히 큰 수"라는
 * 뜻이지 치수가 아니어서 스케일링 대상이 아니기 때문이다.
 *
 * 기본 스케일(`rounded-2xl` 등)은 `spacing`과 마찬가지로 덮어쓰지 않고 키를 더하기만 한다.
 */
const radiusScale = { ...toRemScale(radius), pill: "9999px" };

/**
 * 요소 자체의 치수 — px 원시값.
 *
 * 간격 문서 §8이 말하는 "치수는 간격이 아니다"에 해당한다. `spacing.lg = 16`(요소 사이의
 * 빈 공간)과 `size.icon.md = 20`(요소 자체의 크기)은 한쪽을 조정할 때 다른 쪽이 끌려가면
 * 안 되는 값이다.
 *
 * 아이콘 크기를 토큰으로 만드는 이유: 지금 `size={20}`이 16곳인데 그 옆에 21 · 22 · 23 · 26이
 * 섞여 있다. 간격 문서가 막으려던 "화면마다 17 · 19 · 21이 새로 생기는" 문제가 아이콘에서
 * 그대로 재현되고 있다.
 *
 * 주의: 이 값들은 `@expo/vector-icons`의 `size` 프롭처럼 숫자를 그대로 받는 자리에 쓰는
 * 생값이라 rem 스케일링을 타지 않는다. 태블릿에서 글자만 커지고 아이콘은 그대로다.
 * 그 차이를 좁히는 것은 별도 판단이라 여기서는 지금 동작을 유지한다.
 */
const size = {
  icon: {
    /** 인라인 보조 아이콘 — 캡션 옆 화살표, 작은 상태 표시. */
    sm: 16,
    /** 기본값. 버튼 안 아이콘과 리스트 아이템의 아이콘은 여기서 시작한다. */
    md: 20,
    /** 탭바 · 헤더처럼 단독으로 의미를 갖는 아이콘. */
    lg: 24,
    /** 빈 상태 · 안내 화면의 큰 심볼. */
    xl: 32,
  },
  /**
   * 최소 터치 영역.
   *
   * iOS HIG는 44pt, Android Material은 48dp를 말한다. 둘 중 작은 44를 하한으로 잡되
   * 플랫폼별로 나누지 않는다 — 같은 버튼이 두 플랫폼에서 다른 크기가 되면
   * `Pressable`이 터치 피드백을 통일한 이유가 무너진다.
   *
   * 시각적 크기가 이보다 작아야 하는 아이콘 버튼은 `hitSlop`으로 영역만 넓힌다.
   */
  hitTarget: 44,
  /**
   * 누를 수 있는 요소의 높이 — 버튼 · 입력 · 토글.
   *
   * `md`가 `hitTarget`과 같은 값인 것이 이 그룹의 기준점이다. 기본 버튼은 최소 터치
   * 영역을 그대로 만족하고, 나머지 두 단계가 거기서 위아래로 갈라진다.
   *
   * 지금 코드의 `py-3`(10.5px) · `py-3.5`(12.25px) · `py-4`(14px)는 사람 눈에 구분되지
   * 않으면서 세 벌로 관리되고 있다. 높이를 직접 정하면 폰트 크기가 달라져도 버튼 열이
   * 흐트러지지 않는다 — 세로 여백으로 높이를 만들면 글자 크기가 높이를 좌우한다.
   *
   * `sm`(36)은 `hitTarget`보다 작다. 목록 행 안의 보조 버튼처럼 밀도가 필요한 자리에만
   * 쓰고, 그때는 `hitSlop`으로 터치 영역을 44까지 넓힌다.
   */
  control: {
    sm: 36,
    md: 44,
    lg: 52,
  },
};

/**
 * tailwind `theme.extend.minHeight`에 넘기는 환산본 — `min-h-control-md` 등.
 *
 * rem인 이유는 `spacingScale`과 같다. 태블릿에서 글자와 여백이 커질 때 버튼 높이만
 * 그대로면 글자가 버튼을 밀어낸다.
 */
const controlHeightScale = Object.fromEntries(
  Object.entries(size.control).map(([key, px]) => [
    `control-${key}`,
    remFromPx(px),
  ]),
);

/**
 * 모션 지속 시간 — ms.
 *
 * 지금 60 · 90 · 130 · 200 · 210 · 220 · 550 · 850 · 900이 파일마다 각자 상수로 선언돼 있다.
 * 200과 210과 220은 사람 눈에 같은 속도인데 세 벌로 관리되고 있다는 뜻이다.
 *
 * 단계를 다섯으로 줄이고 이름을 "얼마나 걸리나"가 아니라 "무엇의 속도인가"로 붙였다.
 * `easing` 프리셋은 여기 두지 않는다 — RN의 `Easing`은 react-native import가 필요한데
 * 이 파일은 tailwind 설정이 Node로 직접 읽으므로 RN을 import할 수 없다.
 * `shadow` → `shadows`와 같은 방식으로 `src/theme/index.ts`가 조립한다.
 */
const duration = {
  /** 제스처를 따라붙는 스냅 · 정착. 이보다 느리면 손가락과 어긋난 것으로 느껴진다. */
  snap: 90,
  /** 상태 배지 · 체크 표시처럼 작은 요소의 등장. */
  fast: 130,
  /** 기본값. 누름 해제, 펼침/접힘, 탭 전환. */
  base: 200,
  /** 화면을 덮는 표면(바텀시트 · 모달)의 등장처럼 거리가 먼 움직임. */
  slow: 550,
  /** 스켈레톤 펄스처럼 끝나지 않고 반복되는 루프 한 주기. */
  loop: 900,
};

/** 하단 탭바 치수. safe-area inset은 런타임에 더해지므로 여기 포함하지 않는다. */
const TAB_BAR_ICON_SIZE = 24;
const TAB_BAR_LABEL_LINE_HEIGHT = 14;
const TAB_BAR_ICON_LABEL_GAP = 4;
const TAB_BAR_VERTICAL_PADDING = 8;

const tabBar = {
  iconSize: TAB_BAR_ICON_SIZE,
  labelFontSize: 11,
  labelLineHeight: TAB_BAR_LABEL_LINE_HEIGHT,
  iconLabelGap: TAB_BAR_ICON_LABEL_GAP,
  verticalPadding: TAB_BAR_VERTICAL_PADDING,
  contentHeight:
    TAB_BAR_ICON_SIZE +
    TAB_BAR_ICON_LABEL_GAP +
    TAB_BAR_LABEL_LINE_HEIGHT +
    TAB_BAR_VERTICAL_PADDING * 2,
};

module.exports = {
  colors,
  controlHeightScale,
  duration,
  fontFamily,
  fontSize,
  layout,
  radius,
  radiusScale,
  shadow,
  size,
  spacing,
  spacingScale,
  tabBar,
};
