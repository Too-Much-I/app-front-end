import { ApiError } from '@/lib/api/transport';

/** REFUND는 로그인이 필요해 결제가 생길 때 토큰과 함께 추가한다. */
export type SupportInquiryCategory = 'AUTH' | 'GENERAL';

/** 문의 화면을 연 곳. 서버 `context.screen`(`[A-Za-z0-9_.-]`, 64자 이하)으로 그대로 보낸다. */
export type SupportInquiryEntryScreen =
  'auth-recovery' | 'guest-merge' | 'account-recovery' | 'settings';

/** 진입하는 쪽이 정한다. `category`가 없으면 사용자가 화면에서 고른다. */
export type SupportInquiryEntry = {
  screen: SupportInquiryEntryScreen;
  category?: SupportInquiryCategory;
};

export const SUPPORT_CATEGORY_OPTIONS = [
  { category: 'AUTH', label: '인증 에러' },
  { category: 'GENERAL', label: '일반 문의' },
] as const satisfies readonly { category: SupportInquiryCategory; label: string }[];

/** 화면 입력. 서버 DTO가 아니다. */
export type SupportInquiryDraft = {
  category: SupportInquiryCategory | null;
  message: string;
  replyEmail: string;
};

/** 검증을 통과해 보낼 수 있는 문의. */
export type SupportInquiry = {
  category: SupportInquiryCategory;
  screen: SupportInquiryEntryScreen;
  message: string;
  replyEmail: string | null;
};

export type SupportInquirySender = (
  inquiry: SupportInquiry,
  idempotencyKey: string,
) => Promise<void>;

// 서버 한도: 앞뒤 공백 제거 후 10~2000자(Java 문자열 길이 = JS length), 이메일 254자.
// 본문 16KiB 한도는 이 길이 안에서 넘지 않는다(2000자 × UTF-8 3바이트).
export const SUPPORT_MESSAGE_MIN_LENGTH = 10;
export const SUPPORT_MESSAGE_LIMIT = 2000;
const REPLY_EMAIL_LIMIT = 254;

export type SupportInquiryValidation =
  { ok: true; inquiry: SupportInquiry } | { ok: false; message: string };

export function validateSupportInquiry(
  draft: SupportInquiryDraft,
  screen: SupportInquiryEntryScreen,
): SupportInquiryValidation {
  if (!draft.category) return { ok: false, message: '문의 유형을 골라 주세요.' };
  const message = draft.message.trim();
  if (!message) return { ok: false, message: '문의 내용을 입력해 주세요.' };
  if (message.length < SUPPORT_MESSAGE_MIN_LENGTH)
    return {
      ok: false,
      message: `문의 내용은 ${SUPPORT_MESSAGE_MIN_LENGTH}자 이상 입력해 주세요.`,
    };
  if (message.length > SUPPORT_MESSAGE_LIMIT)
    return { ok: false, message: `문의 내용은 ${SUPPORT_MESSAGE_LIMIT}자 이내로 입력해 주세요.` };
  const replyEmail = draft.replyEmail.trim();
  if (
    replyEmail &&
    (replyEmail.length > REPLY_EMAIL_LIMIT || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(replyEmail))
  ) {
    return { ok: false, message: '답변 받을 이메일 주소를 확인해 주세요.' };
  }
  return {
    ok: true,
    inquiry: { category: draft.category, screen, message, replyEmail: replyEmail || null },
  };
}

/**
 * 같은 키는 같은 문의에만 쓴다. 서버는 같은 키에 다른 내용이면 409로 거절하므로, 보낼 내용이 바뀌면 새 키를
 * 만든다. 같은 내용을 다시 보내면 서버가 기존 접수를 돌려준다(200).
 */
export function isSameSupportInquiry(a: SupportInquiry, b: SupportInquiry): boolean {
  return (
    a.category === b.category &&
    a.screen === b.screen &&
    a.message === b.message &&
    a.replyEmail === b.replyEmail
  );
}

const CONNECTION_FAILURE_MESSAGE =
  '전송 결과를 확인하지 못했어요. 입력한 내용은 그대로 남아 있어요.';

/** 접수 실패 안내. 서버 메시지 대신 앱 문구를 쓴다. */
export function describeSupportInquiryFailure(error: unknown): string {
  if (!(error instanceof ApiError)) return CONNECTION_FAILURE_MESSAGE;
  switch (error.status) {
    case 400:
    case 413:
      return '문의 내용을 보낼 수 없어요. 입력한 내용을 확인해 주세요.';
    case 429:
      return '문의가 많아요. 잠시 후 다시 보내 주세요.';
    case 503:
      return '지금은 문의를 접수할 수 없어요. 잠시 후 다시 보내 주세요.';
    default:
      return CONNECTION_FAILURE_MESSAGE;
  }
}
