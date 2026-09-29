/** UI와 향후 공개 문의 API 어댑터 사이의 계약. 서버 DTO가 아니다. */
export type SupportInquiry = {
  message: string;
  replyEmail: string;
};

export type SupportInquirySender = (inquiry: SupportInquiry) => Promise<void>;

// 문의 API 계약 확정 전 UI의 입력 한도. 서버 한도와 연결 단계에서 맞춘다.
export const SUPPORT_MESSAGE_LIMIT = 2000;

export function validateSupportInquiry(inquiry: SupportInquiry): string | null {
  if (!inquiry.message.trim()) return "문의 내용을 입력해 주세요.";
  if (inquiry.message.length > SUPPORT_MESSAGE_LIMIT)
    return `문의 내용은 ${SUPPORT_MESSAGE_LIMIT}자 이내로 입력해 주세요.`;
  if (
    inquiry.replyEmail.trim() &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inquiry.replyEmail.trim())
  ) {
    return "답변 받을 이메일 주소를 확인해 주세요.";
  }
  return null;
}
