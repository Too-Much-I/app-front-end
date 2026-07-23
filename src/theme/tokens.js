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
    /** Android 리플/눌림 배경처럼 반투명이 필요한 곳. */
    subtle: "rgba(247, 105, 16, 0.15)",
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
 * fontSize에 lineHeight를 항상 붙여둔다.
 * lineHeight를 비워두면 플랫폼별 폰트 메트릭으로 행 높이가 갈려서
 * 탭바처럼 높이가 고정된 컨테이너의 수치를 다시 맞춰야 한다.
 */
const fontSize = {
  xs: ["12px", { lineHeight: "16px" }],
  sm: ["14px", { lineHeight: "20px" }],
  base: ["16px", { lineHeight: "24px" }],
  lg: ["18px", { lineHeight: "26px" }],
  xl: ["20px", { lineHeight: "28px" }],
  "2xl": ["24px", { lineHeight: "32px" }],
  "3xl": ["30px", { lineHeight: "38px" }],
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

module.exports = { colors, fontFamily, fontSize, shadow, tabBar };
