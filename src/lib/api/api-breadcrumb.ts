import { toEndpointTemplate } from '@/lib/api/endpoint-template';
import { emitBreadcrumb, type OperationalContextValue } from '@/lib/sentry';
import { getNetworkKind } from '@/lib/network-type';

/**
 * 요청 실패 단서. 보고(이벤트)는 기능이 포기한 지점에서만 하고, 길목은 "그 직전에 어떤 요청이
 * 왜 실패했나"만 남긴다 — 길목은 그 실패가 마지막 시도였는지 모른다.
 *
 * SDK가 자동으로 남기는 HTTP breadcrumb은 URL이 필터에 지워지고 타임아웃에는 status도 없어
 * 원인을 코드를 읽어 맞춰야 했다(TOSUNSAENG-APP-8). 그래서 식별자를 비운 경로 틀과 원인을
 * 따로 남긴다. 성공한 요청은 남기지 않는다 — 채점 폴링 같은 반복 요청이 breadcrumb 100개
 * 한도를 채워 정작 실패 앞의 기록을 밀어내기 때문이다.
 */
const API_BREADCRUMB_CATEGORY = 'api';

export type ApiFailureOutcome = 'timeout' | 'network' | 'http';

const SAFE_SERVER_CODE_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/;

export interface ApiFailure {
  url: string;
  method: string;
  outcome: ApiFailureOutcome;
  durationMs: number;
  httpStatus?: number;
  serverCode?: string;
}

export function emitApiFailureBreadcrumb(failure: ApiFailure): void {
  const data: Record<string, OperationalContextValue> = {
    endpoint: toEndpointTemplate(failure.url),
    method: failure.method.toUpperCase(),
    outcome: failure.outcome,
    durationMs: Math.round(failure.durationMs),
    network: getNetworkKind(),
  };
  if (failure.httpStatus !== undefined) data.httpStatus = failure.httpStatus;
  if (failure.serverCode && SAFE_SERVER_CODE_PATTERN.test(failure.serverCode)) {
    data.serverCode = failure.serverCode;
  }

  emitBreadcrumb(API_BREADCRUMB_CATEGORY, data, 'warning');
}
