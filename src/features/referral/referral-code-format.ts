/** 추천 코드 길이. 서버가 발급하는 코드는 늘 10자리다(추천 코드 명세). */
export const REFERRAL_CODE_LENGTH = 10;

/** 영문 대문자와 숫자 중 헷갈리는 I·O·0·1을 뺀 글자. 서버가 발급하는 코드에 쓰는 글자와 같다. */
const SUPPORTED_CHARACTERS = /^[A-HJ-NP-Z2-9]*$/;

/**
 * 가입 화면 입력 칸의 값을 서버가 받는 모양에 맞춘다. 대문자로 바꾸고 공백은 어디에 있든 모두 뺀다
 * (2026-10-29 결정). 서버는 앞뒤 공백만 지우고 가운데 공백은 거절한다.
 */
export function normalizeReferralCodeInput(value: string): string {
  return value.replace(/\s/g, '').toUpperCase();
}

/**
 * - `empty`: 입력하지 않았다. 추천 코드는 선택이라 가입을 막지 않는다.
 * - `valid`: 보낼 수 있다. 있는 코드인지는 서버에 보내야 안다.
 * - 나머지: 보내면 가입 뒤에야 거절되고 다시 넣을 기회가 없어 가입 화면에서 막는다.
 */
export type ReferralCodeFormat =
  'empty' | 'valid' | 'too-short' | 'too-long' | 'unsupported-characters';

/** 정규화한 값을 받는다. 안 되는 글자가 있으면 길이보다 먼저 알린다 — 지워야 할 글자부터 보여 준다. */
export function checkReferralCodeFormat(code: string): ReferralCodeFormat {
  if (code.length === 0) return 'empty';
  if (!SUPPORTED_CHARACTERS.test(code)) return 'unsupported-characters';
  if (code.length < REFERRAL_CODE_LENGTH) return 'too-short';
  if (code.length > REFERRAL_CODE_LENGTH) return 'too-long';
  return 'valid';
}

/** 가입을 계속할 수 있는 입력인가. 비어 있어도 된다. */
export function isReferralCodeAcceptable(format: ReferralCodeFormat): boolean {
  return format === 'empty' || format === 'valid';
}

/** 칸을 벗어날 때 보여 줄 안내. 문구 원문은 정하지 않았고 뜻만 정했다(2026-10-29 결정). */
export const REFERRAL_CODE_FORMAT_MESSAGES = {
  empty: null,
  valid: null,
  'too-short': '코드가 부족해요. 10자리를 모두 입력해 주세요.',
  'too-long': '10자리를 넘었어요. 코드를 다시 확인해 주세요.',
  'unsupported-characters': '한글, 특수문자, I·O·0·1은 입력할 수 없어요.',
} as const satisfies Record<ReferralCodeFormat, string | null>;
