import {
  checkReferralCodeFormat,
  isReferralCodeAcceptable,
  normalizeReferralCodeInput,
} from '@/features/referral/referral-code-format';

describe('normalizeReferralCodeInput', () => {
  it('대문자로 바꾸고 앞뒤·가운데 공백을 모두 뺀다', () => {
    expect(normalizeReferralCodeInput(' abc de\tfgh jk ')).toBe('ABCDEFGHJK');
  });
});

describe('checkReferralCodeFormat', () => {
  it.each([
    ['', 'empty'],
    ['ABCDEFGHJK', 'valid'],
    ['ABCDE', 'too-short'],
    ['ABCDEFGHJKL', 'too-long'],
    ['ABCDEFGHJ1', 'unsupported-characters'],
    ['ABCDEFGHJO', 'unsupported-characters'],
    ['ABCDEFGHJㅇ', 'unsupported-characters'],
    ['ABCD-FGHJK', 'unsupported-characters'],
  ] as const)('%s → %s', (code, expected) => {
    expect(checkReferralCodeFormat(code)).toBe(expected);
  });

  it('안 되는 글자가 있으면 길이보다 먼저 알린다', () => {
    expect(checkReferralCodeFormat('AB1')).toBe('unsupported-characters');
  });
});

describe('isReferralCodeAcceptable', () => {
  it('비어 있거나 형식이 맞으면 가입을 계속한다', () => {
    expect(isReferralCodeAcceptable('empty')).toBe(true);
    expect(isReferralCodeAcceptable('valid')).toBe(true);
    expect(isReferralCodeAcceptable('too-short')).toBe(false);
  });
});
