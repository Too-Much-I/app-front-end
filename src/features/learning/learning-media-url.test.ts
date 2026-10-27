import type { LearningMedia } from '@/types/learning';

const mockGetLearningMediaUrl = jest.fn<Promise<LearningMedia>, [string]>();

jest.mock('@/features/learning/api/learning-api', () => ({
  getLearningMediaUrl: (mediaId: string) => mockGetLearningMediaUrl(mediaId),
}));

const NOW = Date.parse('2026-10-23T03:00:00Z');

function media(url: string, expiresInMs: number): LearningMedia {
  return { id: 'audio-1', url, expiresAtMs: NOW + expiresInMs };
}

/** 새로 받은 주소를 모듈 안에 들고 있어서, 테스트마다 모듈을 새로 읽는다. */
function loadModule() {
  let loaded: typeof import('@/features/learning/learning-media-url') | undefined;
  jest.isolateModules(() => {
    loaded = jest.requireActual('@/features/learning/learning-media-url');
  });
  if (!loaded) throw new Error('모듈을 읽지 못했습니다.');
  return loaded;
}

beforeEach(() => {
  mockGetLearningMediaUrl.mockReset();
});

describe('resolveLearningMediaUrl', () => {
  it('만료까지 여유가 있으면 받은 주소를 그대로 쓴다', async () => {
    const { resolveLearningMediaUrl } = loadModule();

    await expect(resolveLearningMediaUrl(media('old', 10 * 60_000), NOW)).resolves.toBe('old');
    expect(mockGetLearningMediaUrl).not.toHaveBeenCalled();
  });

  it('만료됐거나 1분 안에 만료되면 새 주소를 받는다', async () => {
    const { resolveLearningMediaUrl } = loadModule();
    mockGetLearningMediaUrl.mockResolvedValue(media('fresh', 60 * 60_000));

    await expect(resolveLearningMediaUrl(media('old', 30_000), NOW)).resolves.toBe('fresh');
    expect(mockGetLearningMediaUrl).toHaveBeenCalledWith('audio-1');
  });

  it('한 번 새로 받은 주소는 만료 전까지 다시 받지 않는다', async () => {
    const { resolveLearningMediaUrl } = loadModule();
    mockGetLearningMediaUrl.mockResolvedValue(media('fresh', 60 * 60_000));

    await resolveLearningMediaUrl(media('old', -1), NOW);
    await expect(resolveLearningMediaUrl(media('old', -1), NOW)).resolves.toBe('fresh');
    expect(mockGetLearningMediaUrl).toHaveBeenCalledTimes(1);
  });

  it('만료 시각을 읽지 못한 주소는 만료된 것으로 본다', async () => {
    const { resolveLearningMediaUrl } = loadModule();
    mockGetLearningMediaUrl.mockResolvedValue(media('fresh', 60 * 60_000));

    const unreadable = { id: 'audio-1', url: 'old', expiresAtMs: Number.NaN };
    await expect(resolveLearningMediaUrl(unreadable, NOW)).resolves.toBe('fresh');
  });
});
