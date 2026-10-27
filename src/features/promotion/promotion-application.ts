import { ApiError } from '@/lib/api/transport';

/**
 * 프로모션(기프티콘) 신청 규칙(2026-10-27 결정, 서버 명세 같은 날 확인).
 *
 * 서버는 받고 싶은 기프티콘을 자유 입력 상품명(`gifticon`)으로 받지만, 앱은 정해 둔 넷 중 하나만 고르게 한다.
 * 담당자가 보고 바로 보낼 수 있게 이름과 금액을 함께 보낸다(AI 제안).
 */
export const PROMOTION_GIFTICONS = [
  { id: 'baemin', name: '배달의민족' },
  { id: 'oliveyoung', name: '올리브영' },
  { id: 'starbucks', name: '스타벅스' },
  { id: 'naverpay', name: '네이버페이 포인트' },
] as const;

export type PromotionGifticonId = (typeof PROMOTION_GIFTICONS)[number]['id'];

export const PROMOTION_GIFTICON_AMOUNT_LABEL = '5,000원';

export function gifticonLabel(id: PromotionGifticonId): string {
  const gifticon = PROMOTION_GIFTICONS.find((candidate) => candidate.id === id);
  return `${gifticon?.name ?? ''} ${PROMOTION_GIFTICON_AMOUNT_LABEL}`;
}

/** 서버 한도(9 MiB). 넘는 사진은 보내기 전에 막는다. */
export const PROMOTION_REPORT_MAX_BYTES = 9 * 1024 * 1024;

/**
 * 서버가 받는 이미지 형식. PDF도 받지만 앱은 사진만 고르게 했다(2026-10-24 결정). 고른 사진은 바꾸지 않고
 * 원본 그대로 보낸다(2026-10-27 결정) — 그래서 WebP처럼 목록 밖 형식은 보내기 전에 알린다.
 */
const PROMOTION_REPORT_MIME_TYPES: ReadonlySet<string> = new Set([
  'image/jpeg',
  'image/png',
  'image/heic',
]);

const EMAIL_MAX_LENGTH = 254;
const EMAIL_LOCAL_MAX_LENGTH = 64;
/** ASCII 일반 이메일 형식. 공백·`@` 없는 local-part, 점이 있는 도메인. 길이는 따로 잰다. */
const EMAIL_PATTERN = /^[\x21-\x3F\x41-\x7E]+@[\x21-\x3F\x41-\x7E]+\.[\x21-\x3F\x41-\x7E]+$/;

/** 서버와 같은 규칙으로 받을 메일을 검사한다. 앞뒤 공백은 서버처럼 잘라서 본다. */
export function isValidPromotionEmail(value: string): boolean {
  const email = value.trim();
  const local = email.slice(0, email.indexOf('@'));
  return (
    email.length <= EMAIL_MAX_LENGTH &&
    local.length <= EMAIL_LOCAL_MAX_LENGTH &&
    EMAIL_PATTERN.test(email)
  );
}

export interface PromotionReport {
  uri: string;
  mimeType: string;
  fileSize: number | null;
}

export interface PromotionApplicationDraft {
  gifticon: PromotionGifticonId | null;
  email: string;
  report: PromotionReport | null;
  consented: boolean;
}

export interface PromotionApplication {
  gifticon: string;
  email: string;
  report: PromotionReport;
}

export type PromotionReportProblem = 'too-large' | 'unsupported';

/** 고른 사진을 서버에 보낼 수 있는지. 크기를 모르면(일부 기기) 서버 413에 맡긴다. */
export function checkPromotionReport(report: PromotionReport): PromotionReportProblem | null {
  if (!PROMOTION_REPORT_MIME_TYPES.has(report.mimeType)) return 'unsupported';
  if (report.fileSize !== null && report.fileSize > PROMOTION_REPORT_MAX_BYTES) return 'too-large';
  return null;
}

export type PromotionDraftValidation =
  { ok: true; application: PromotionApplication } | { ok: false; message: string };

export function validatePromotionDraft(draft: PromotionApplicationDraft): PromotionDraftValidation {
  if (!draft.gifticon) return { ok: false, message: '받고 싶은 기프티콘을 골라 주세요.' };
  if (!isValidPromotionEmail(draft.email)) {
    return { ok: false, message: '기프티콘 받을 메일 주소를 확인해 주세요.' };
  }
  if (!draft.report) return { ok: false, message: '성적표 사진을 올려 주세요.' };
  const problem = checkPromotionReport(draft.report);
  if (problem) return { ok: false, message: describeReportProblem(problem) };
  if (!draft.consented) {
    return { ok: false, message: '개인정보 수집·이용에 동의해야 신청할 수 있어요.' };
  }
  return {
    ok: true,
    application: {
      gifticon: gifticonLabel(draft.gifticon),
      email: draft.email.trim(),
      report: draft.report,
    },
  };
}

export function describeReportProblem(problem: PromotionReportProblem): string {
  switch (problem) {
    case 'too-large':
      return '9MB 이하 사진만 올릴 수 있어요. 성적표 화면을 캡처해 올려 주세요.';
    case 'unsupported':
      return 'JPG·PNG·HEIC 사진만 올릴 수 있어요. 성적표 화면을 캡처해 올려 주세요.';
  }
}

/**
 * 신청을 보낸 뒤의 결과. 폼에 남아 다시 고칠 수 있는 실패(`retry`)와, 폼을 닫고 안내 화면으로 바꾸는 결과로 나눈다.
 *
 * - `already-applied`: 409. 응답을 잃고 다시 보낸 경우도 여기로 온다. 신청 여부는 기기에 저장하지 않고 이 응답으로만
 *   안다(2026-10-27 결정).
 * - `closed`: 409 접수 기간 밖. `unavailable`: 기능이 꺼져 경로 자체가 없는 404 — 기간 종료와 구분한다.
 * - `unknown`: 503이나 응답 전에 끊김. 접수됐을 수도 있어 성공으로도 실패로도 단정하지 않는다.
 */
export type PromotionSubmitOutcome =
  | { kind: 'already-applied' }
  | { kind: 'closed' }
  | { kind: 'unavailable' }
  | { kind: 'unknown' }
  | { kind: 'retry'; message: string };

export function classifyPromotionSubmitError(error: unknown): PromotionSubmitOutcome {
  if (!(error instanceof ApiError)) return { kind: 'unknown' };
  switch (error.status) {
    case 409:
      return error.code === 'PROMOTION_ALREADY_APPLIED'
        ? { kind: 'already-applied' }
        : { kind: 'closed' };
    case 404:
      return { kind: 'unavailable' };
    case 413:
      return { kind: 'retry', message: describeReportProblem('too-large') };
    case 415:
      return { kind: 'retry', message: describeReportProblem('unsupported') };
    // 같은 요청을 다시 보내도 같은 결과라 자동으로 다시 보내지 않는다. 사용자가 고쳐서 다시 누른다.
    case 400:
      return { kind: 'retry', message: '입력한 내용을 확인해 주세요.' };
    case 403:
      return { kind: 'retry', message: '지금은 신청할 수 없어요. 문의하기로 알려 주세요.' };
    case 503:
      return { kind: 'unknown' };
    default:
      return { kind: 'retry', message: '신청하지 못했어요. 잠시 후 다시 시도해 주세요.' };
  }
}
