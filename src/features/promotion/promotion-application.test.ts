import {
  checkPromotionReport,
  classifyPromotionSubmitError,
  isValidPromotionEmail,
  validatePromotionDraft,
  type PromotionApplicationDraft,
  type PromotionReport,
} from '@/features/promotion/promotion-application';
import { ApiError, TransportConnectionError } from '@/lib/api/transport';

const PHOTO: PromotionReport = {
  uri: 'file:///report.jpg',
  mimeType: 'image/jpeg',
  fileSize: 1_000_000,
};

const DRAFT: PromotionApplicationDraft = {
  gifticon: 'starbucks',
  email: '  toseon@example.com ',
  report: PHOTO,
  consented: true,
};

describe('isValidPromotionEmail', () => {
  it.each(['a@b.co', 'first.last+tag@mail.example.com', '  padded@example.com  '])(
    '%s는 받는다',
    (email) => {
      expect(isValidPromotionEmail(email)).toBe(true);
    },
  );

  it.each([
    '',
    'no-at.example.com',
    'no-dot@example',
    'two@@example.com',
    'space in@example.com',
    '한글@example.com',
    `${'a'.repeat(65)}@example.com`,
    `a@${'b'.repeat(250)}.com`,
  ])('%s는 받지 않는다', (email) => {
    expect(isValidPromotionEmail(email)).toBe(false);
  });
});

describe('checkPromotionReport', () => {
  it('HEIC는 바꾸지 않고 그대로 보낼 수 있다', () => {
    expect(checkPromotionReport({ ...PHOTO, mimeType: 'image/heic' })).toBeNull();
  });

  it('서버 목록 밖 형식과 9MiB 초과를 막는다', () => {
    expect(checkPromotionReport({ ...PHOTO, mimeType: 'image/webp' })).toBe('unsupported');
    expect(checkPromotionReport({ ...PHOTO, fileSize: 9 * 1024 * 1024 + 1 })).toBe('too-large');
  });

  it('크기를 모르면 서버에 맡긴다', () => {
    expect(checkPromotionReport({ ...PHOTO, fileSize: null })).toBeNull();
  });
});

describe('validatePromotionDraft', () => {
  it('기프티콘은 이름과 금액으로, 메일은 앞뒤 공백을 잘라 보낸다', () => {
    expect(validatePromotionDraft(DRAFT)).toEqual({
      ok: true,
      application: { gifticon: '스타벅스 5,000원', email: 'toseon@example.com', report: PHOTO },
    });
  });

  it('동의하지 않으면 보내지 않는다', () => {
    expect(validatePromotionDraft({ ...DRAFT, consented: false }).ok).toBe(false);
  });
});

describe('classifyPromotionSubmitError', () => {
  it('409는 코드로 이미 신청과 기간 종료를 가른다', () => {
    expect(
      classifyPromotionSubmitError(new ApiError(409, '', 'PROMOTION_ALREADY_APPLIED')),
    ).toEqual({ kind: 'already-applied' });
    expect(classifyPromotionSubmitError(new ApiError(409, '', 'PROMOTION_CLOSED'))).toEqual({
      kind: 'closed',
    });
  });

  it('기능이 꺼진 404는 기간 종료와 다르게 본다', () => {
    expect(classifyPromotionSubmitError(new ApiError(404, ''))).toEqual({ kind: 'unavailable' });
  });

  it('503과 응답 전 끊김은 접수됐을 수도 있어 결과 불명이다', () => {
    expect(classifyPromotionSubmitError(new ApiError(503, ''))).toEqual({ kind: 'unknown' });
    expect(classifyPromotionSubmitError(new TransportConnectionError())).toEqual({
      kind: 'unknown',
    });
  });

  it('400·413·415는 폼에 남아 고치게 한다', () => {
    for (const status of [400, 413, 415]) {
      expect(classifyPromotionSubmitError(new ApiError(status, '')).kind).toBe('retry');
    }
  });
});
