import type { PhoneVerificationViewState } from "@/screens/auth/PhoneVerificationScreen";

/** 개발용 fixture. 실제 계정·번호·인증 증명이 아니며 API로 전송하지 않는다. */
export const AUTH_PREVIEW_FIXTURE = {
  nickname: "토스마스터",
  phone: "01012345678",
  code: "123456",
  policyVersions: { terms: "preview-terms-v1", privacy: "preview-privacy-v1" },
} as const;

export function validatePreviewNickname(nickname: string): string | null {
  return nickname.trim() === AUTH_PREVIEW_FIXTURE.nickname
    ? null
    : "사용할 수 없는 닉네임이에요. 다른 닉네임을 입력해 주세요.";
}

export function requestPreviewPhoneCode(
  state: PhoneVerificationViewState,
): PhoneVerificationViewState {
  if (state.step !== "number") return state;
  if (state.phone !== AUTH_PREVIEW_FIXTURE.phone) {
    return {
      ...state,
      error: "인증번호를 보낼 수 없는 번호예요. 번호를 확인해 주세요.",
    };
  }
  return { step: "code", phone: state.phone, code: "", error: null };
}

export function verifyPreviewPhoneCode(
  state: PhoneVerificationViewState,
): PhoneVerificationViewState {
  if (state.step !== "code") return state;
  if (
    state.phone !== AUTH_PREVIEW_FIXTURE.phone ||
    state.code !== AUTH_PREVIEW_FIXTURE.code
  ) {
    return {
      ...state,
      error: "인증번호가 일치하지 않아요. 다시 확인해 주세요.",
    };
  }
  return { step: "complete", phone: state.phone };
}
