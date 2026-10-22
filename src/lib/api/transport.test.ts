import { emitApiFailureBreadcrumb } from '@/lib/api/api-breadcrumb';
import { ApiError, serviceFetch, TransportConnectionError } from '@/lib/api/transport';

jest.mock('@/lib/api/api-breadcrumb', () => ({ emitApiFailureBreadcrumb: jest.fn() }));

type FakeResponse = {
  ok: boolean;
  status: number;
  statusText: string;
  headers: { get: (name: string) => string | null };
  text: () => Promise<string>;
};

function response(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): FakeResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: '',
    headers: { get: (name) => headers[name] ?? null },
    text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
  };
}

const fetchMock = jest.fn();
const originalFetch = globalThis.fetch;

beforeAll(() => {
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});
afterAll(() => {
  globalThis.fetch = originalFetch;
});
beforeEach(() => {
  fetchMock.mockReset();
  jest.mocked(emitApiFailureBreadcrumb).mockClear();
});

async function catchError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('요청이 실패하지 않았다');
}

describe('serviceFetch 성공', () => {
  it('성공 envelope을 그대로 돌려주고 본문이 있으면 JSON 헤더를 붙인다', async () => {
    const envelope = { isSuccess: true, code: 'OK', message: 'ok', result: { id: 1 } };
    fetchMock.mockResolvedValue(response(200, envelope));

    await expect(
      serviceFetch('https://api.test/a', { method: 'POST', body: '{}' }),
    ).resolves.toEqual(envelope);
    expect(fetchMock.mock.calls[0][1].headers).toEqual({ 'Content-Type': 'application/json' });
  });
});

describe('serviceFetch 실패를 ApiError로 바꾸기', () => {
  it('HTTP 오류의 상태·코드·메시지·result·Retry-After를 담는다', async () => {
    fetchMock.mockResolvedValue(
      response(
        429,
        { isSuccess: false, code: 'RATE_LIMITED', message: '천천히', result: { a: 1 } },
        { 'Retry-After': '7' },
      ),
    );

    const error = await catchError(serviceFetch('https://api.test/a'));

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 429,
      code: 'RATE_LIMITED',
      message: '천천히',
      result: { a: 1 },
      retryAfterSeconds: 7,
    });
    expect(emitApiFailureBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'http', httpStatus: 429, serverCode: 'RATE_LIMITED' }),
    );
  });

  it('날짜 형식 Retry-After는 읽지 않는다', async () => {
    fetchMock.mockResolvedValue(
      response(503, { isSuccess: false }, { 'Retry-After': 'Wed, 21 Oct 2026 07:28:00 GMT' }),
    );

    await expect(serviceFetch('https://api.test/a')).rejects.toMatchObject({
      retryAfterSeconds: undefined,
    });
  });

  it('200이라도 isSuccess가 false면 실패다', async () => {
    fetchMock.mockResolvedValue(
      response(200, { isSuccess: false, code: 'NOPE', message: '안 됨' }),
    );

    await expect(serviceFetch('https://api.test/a')).rejects.toMatchObject({
      status: 200,
      code: 'NOPE',
    });
  });

  it.each([['<html>gateway</html>'], [''], [{ isSuccess: true }]])(
    '200인데 envelope 형식이 아니면(%p) 형식 오류다',
    async (body) => {
      fetchMock.mockResolvedValue(response(200, body));

      await expect(serviceFetch('https://api.test/a')).rejects.toMatchObject({
        status: 200,
        message: '서버 응답 형식이 올바르지 않습니다.',
      });
    },
  );

  it('JSON이 아닌 오류 본문은 메시지로 쓴다', async () => {
    fetchMock.mockResolvedValue(response(502, 'Bad Gateway'));

    await expect(serviceFetch('https://api.test/a')).rejects.toMatchObject({
      status: 502,
      message: 'Bad Gateway',
      code: undefined,
    });
  });
});

describe('serviceFetch 연결 실패', () => {
  it.each([
    ['RN 기본 fetch의 TypeError', new TypeError('Network request failed')],
    ['expo/fetch의 FetchError', new Error('fetch failed: java.net.UnknownHostException')],
  ])('%s는 TransportConnectionError다', async (_label, cause) => {
    fetchMock.mockRejectedValue(cause);

    await expect(serviceFetch('https://api.test/a')).rejects.toBeInstanceOf(
      TransportConnectionError,
    );
    expect(emitApiFailureBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'network' }),
    );
  });

  it('시간 안에 응답이 없으면 끊고 timeout으로 남긴다', async () => {
    jest.useFakeTimers();
    try {
      fetchMock.mockImplementation(
        (_url: string, init: { signal: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            init.signal.addEventListener('abort', () => reject(new Error('Aborted')));
          }),
      );

      const request = catchError(serviceFetch('https://api.test/a', {}, 1_000));
      jest.advanceTimersByTime(1_000);

      expect(await request).toBeInstanceOf(TransportConnectionError);
      expect(emitApiFailureBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({ outcome: 'timeout' }),
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('호출자가 취소한 요청은 실패로 남기지 않고 원래 오류를 그대로 던진다', async () => {
    const controller = new AbortController();
    const cancelled = new Error('cancelled');
    fetchMock.mockImplementation(() => {
      controller.abort();
      return Promise.reject(cancelled);
    });

    await expect(serviceFetch('https://api.test/a', { signal: controller.signal })).rejects.toBe(
      cancelled,
    );
    expect(emitApiFailureBreadcrumb).not.toHaveBeenCalled();
  });
});
