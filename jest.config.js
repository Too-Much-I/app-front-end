/**
 * jest-expo preset이 React Native·Expo 모듈 변환과 기본 네이티브 mock을 맡는다.
 * `@/` 별칭은 babel.config.js의 module-resolver가 처리하므로 moduleNameMapper를 따로 두지 않는다.
 * @type {import('jest').Config}
 */
module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest.setup.js'],
  roots: ['<rootDir>/src'],
  // 테스트는 대상 파일 옆에 `*.test.ts(x)`로 둔다.
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
};
