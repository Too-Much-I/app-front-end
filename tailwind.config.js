const {
  colors,
  fontFamily,
  fontSize,
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
    },
  },
  plugins: [],
};
