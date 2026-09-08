const {
  colors,
  controlHeightScale,
  fontFamily,
  fontSize,
  radiusScale,
  spacingScale,
} = require("./src/theme/tokens");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.tsx", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors,
      fontFamily,
      fontSize,
      /**
       * 기본 스케일을 덮어쓰지 않고 의미 키를 더하기만 한다.
       * `p-4`·`gap-2`가 이미 수백 군데에 있어 값을 바꾸면 전 화면이 한 번에 움직인다.
       */
      spacing: spacingScale,
      /** 간격과 같은 이유로 기본 반경(`rounded-2xl` 등)은 두고 의미 키만 더한다. */
      borderRadius: radiusScale,
      /** 버튼·입력 높이. `minHeight`는 spacing을 펼친 뒤 자기 키로 덮으므로 여기 더한다. */
      minHeight: controlHeightScale,
    },
  },
  plugins: [],
};
