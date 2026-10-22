import type { NetworkState } from 'expo-network';

/**
 * 네이티브 모듈 mock 예시. expo-network를 가짜로 바꿔 리스너를 직접 호출하고,
 * 모듈 안의 상태(`started`, 마지막 값)가 테스트끼리 섞이지 않게 매번 새로 불러온다.
 */
const mockAddNetworkStateListener = jest.fn();
const mockGetNetworkStateAsync = jest.fn();

jest.mock('expo-network', () => ({
  // 실제 enum 값을 그대로 쓰도록 enum만 진짜 모듈에서 가져온다.
  NetworkStateType: jest.requireActual('expo-network').NetworkStateType,
  addNetworkStateListener: (...args: unknown[]) => mockAddNetworkStateListener(...args),
  getNetworkStateAsync: () => mockGetNetworkStateAsync(),
}));

function loadModule(): typeof import('@/lib/network-type') {
  let loaded: typeof import('@/lib/network-type') | undefined;
  jest.isolateModules(() => {
    loaded = jest.requireActual('@/lib/network-type');
  });
  if (!loaded) throw new Error('network-type 모듈을 불러오지 못했다');
  return loaded;
}

beforeEach(() => {
  mockAddNetworkStateListener.mockReset();
  mockGetNetworkStateAsync.mockReset();
});

describe('네트워크 종류 추적', () => {
  it('리스너가 받은 값으로 현재 네트워크 종류를 바꾼다', () => {
    const { NetworkStateType } = jest.requireActual('expo-network');
    mockGetNetworkStateAsync.mockReturnValue(new Promise(() => undefined));
    const { startNetworkKindTracking, getNetworkKind } = loadModule();

    startNetworkKindTracking();
    const listener = mockAddNetworkStateListener.mock.calls[0]?.[0] as (
      state: NetworkState,
    ) => void;
    listener({ type: NetworkStateType.CELLULAR });

    expect(getNetworkKind()).toBe('cellular');
  });

  it('두 번 불러도 리스너는 한 번만 등록한다', () => {
    mockGetNetworkStateAsync.mockResolvedValue({});
    const { startNetworkKindTracking } = loadModule();

    startNetworkKindTracking();
    startNetworkKindTracking();

    expect(mockAddNetworkStateListener).toHaveBeenCalledTimes(1);
  });

  it('네이티브 모듈이 없어 등록이 던져도 앱 흐름을 막지 않고 unknown으로 남는다', () => {
    mockAddNetworkStateListener.mockImplementation(() => {
      throw new Error('native module missing');
    });
    const { startNetworkKindTracking, getNetworkKind } = loadModule();

    expect(() => startNetworkKindTracking()).not.toThrow();
    expect(getNetworkKind()).toBe('unknown');
  });
});
