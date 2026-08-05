import type { ApiEnvelope, ApiErrorPayload } from "@/types/api";

const DEFAULT_TIMEOUT_MS = 10_000;
const FALLBACK_ERROR_MESSAGE = "요청을 처리하지 못했습니다.";
const apiErrorResults = new WeakMap<ApiError, unknown>();

export type JsonRequestInit = Omit<RequestInit, "body"> & {
  body?: string;
};

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
    result?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
    apiErrorResults.set(this, result);
  }

  get result(): unknown {
    return apiErrorResults.get(this);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseEnvelope(value: unknown): ApiErrorPayload | ApiEnvelope<unknown> | null {
  if (!isRecord(value) || typeof value.isSuccess !== "boolean") {
    return null;
  }

  return {
    isSuccess: value.isSuccess,
    code: typeof value.code === "string" ? value.code : undefined,
    message: typeof value.message === "string" ? value.message : undefined,
    result: value.result,
  } as ApiErrorPayload | ApiEnvelope<unknown>;
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return undefined;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function createApiError(response: Response, body: unknown): ApiError {
  const envelope = parseEnvelope(body);
  const message =
    envelope?.message || response.statusText || (typeof body === "string" ? body : "") ||
    FALLBACK_ERROR_MESSAGE;

  return new ApiError(response.status, message, envelope?.code, envelope?.result);
}

export async function serviceFetch<T>(
  url: string,
  init: JsonRequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<ApiEnvelope<T>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const callerSignal = init.signal;
  const abortFromCaller = () => controller.abort(callerSignal?.reason);

  if (callerSignal?.aborted) {
    abortFromCaller();
  } else {
    callerSignal?.addEventListener("abort", abortFromCaller, { once: true });
  }

  try {
    const response = await fetch(url, {
      ...init,
      headers: {
        ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
        ...init.headers,
      },
      signal: controller.signal,
    });
    const body = await parseResponseBody(response);

    if (!response.ok) {
      throw createApiError(response, body);
    }

    const envelope = parseEnvelope(body);
    if (
      !envelope ||
      envelope.isSuccess !== true ||
      typeof envelope.code !== "string" ||
      typeof envelope.message !== "string"
    ) {
      if (envelope?.isSuccess === false) {
        throw new ApiError(
          response.status,
          envelope.message || FALLBACK_ERROR_MESSAGE,
          envelope.code,
          envelope.result,
        );
      }
      throw new ApiError(response.status, "서버 응답 형식이 올바르지 않습니다.");
    }

    return envelope as ApiEnvelope<T>;
  } finally {
    clearTimeout(timeoutId);
    callerSignal?.removeEventListener("abort", abortFromCaller);
  }
}
