/**
 * 모든 테스트에 공통으로 적용하는 mock.
 *
 * @sentry/react-native는 import되는 순간 setInterval을 켜서 jest worker가 끝나지 않는다.
 * API 전송 계층(src/lib/api/transport.ts)이 src/lib/sentry.ts를 거쳐 이 모듈을 불러오므로,
 * API를 거치는 모든 테스트가 영향을 받는다. 테스트에서 이벤트를 보낼 일도 없으므로 앱이 쓰는
 * 함수만 가짜로 바꾼다. src/lib/sentry.ts가 새 Sentry API를 쓰면 여기에도 추가한다.
 */
jest.mock('@sentry/react-native', () => {
  const scope = {
    setLevel: jest.fn(),
    setTag: jest.fn(),
    setTags: jest.fn(),
    setContext: jest.fn(),
    setFingerprint: jest.fn(),
  };
  return {
    init: jest.fn(),
    wrap: jest.fn((component) => component),
    flush: jest.fn(() => Promise.resolve(true)),
    setTag: jest.fn(),
    addBreadcrumb: jest.fn(),
    captureMessage: jest.fn(),
    withScope: jest.fn((callback) => callback(scope)),
    reactNavigationIntegration: jest.fn(() => ({ registerNavigationContainer: jest.fn() })),
    ErrorBoundary: ({ children }) => children,
  };
});
