const API_VERSION_SEGMENT_PATTERN = /^v\d+$/;
/** 숫자가 섞인 경로 조각은 식별자(examId, 문항 번호 등)로 본다. 우리 API 경로 이름에는 숫자가 없다. */
const IDENTIFIER_SEGMENT_PATTERN = /\d/;

/**
 * 실제 요청 URL을 식별자 자리를 비운 경로 틀로 바꾼다. 호스트와 쿼리는 버린다.
 * `https://host/api/v1/exams/123/questions/4/upload-url?retryCount=0`
 * → `/api/v1/exams/{}/questions/{}/upload-url`
 */
export function toEndpointTemplate(url: string): string {
  const pathname = url.replace(/^[a-z]+:\/\/[^/]+/i, '').replace(/[?#].*$/, '');
  return pathname
    .split('/')
    .map((segment) =>
      IDENTIFIER_SEGMENT_PATTERN.test(segment) && !API_VERSION_SEGMENT_PATTERN.test(segment)
        ? '{}'
        : segment,
    )
    .join('/');
}
