import * as Application from 'expo-application';
import { Platform } from 'react-native';

import type { SupportInquiry } from '@/features/support/support-inquiry';
import { getIdentityApiBaseUrl } from '@/lib/api/service-base-url';
import { serviceFetch } from '@/lib/api/transport';

type SupportPlatform = 'ANDROID' | 'IOS' | 'WEB' | 'UNKNOWN';

function currentPlatform(): SupportPlatform {
  switch (Platform.OS) {
    case 'android':
      return 'ANDROID';
    case 'ios':
      return 'IOS';
    case 'web':
      return 'WEB';
    default:
      return 'UNKNOWN';
  }
}

/** 서버 형식(`[A-Za-z0-9_.+-]`, 32자 이하)에 맞지 않으면 보내지 않는다. 버전 하나로 문의 전체가 400이 되지 않게 한다. */
function currentAppVersion(): string | undefined {
  const version = Application.nativeApplicationVersion;
  return version && version.length <= 32 && /^[A-Za-z0-9_.+-]+$/.test(version)
    ? version
    : undefined;
}

/**
 * 문의 접수(`POST /support/inquiries`). 토큰을 붙이지 않는다 — AUTH·GENERAL은 로그인이 선택이고, 인증 헤더를 붙이면
 * 서버가 검증해 만료 토큰에도 401을 준다(익명으로 바꾸지 않음). 201(새 접수)과 200(같은 키·내용 재전송) 모두 접수다.
 * `inquiryId`는 앱이 보관하지 않는다(2026-10-07 서버 답).
 *
 * `idempotencyKey`는 소문자 UUID v4이고, 같은 문의를 다시 보낼 때 같은 값을 써야 한다.
 */
export async function submitSupportInquiry(
  inquiry: SupportInquiry,
  idempotencyKey: string,
): Promise<void> {
  await serviceFetch<unknown>(`${getIdentityApiBaseUrl()}/api/v1/support/inquiries`, {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify({
      category: inquiry.category,
      message: inquiry.message,
      replyEmail: inquiry.replyEmail,
      context: {
        screen: inquiry.screen,
        appVersion: currentAppVersion(),
        platform: currentPlatform(),
      },
    }),
  });
}
