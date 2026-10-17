type ServiceName = 'identity' | 'learning' | 'billing';

// EXPO_PUBLIC_* 값은 빌드 때 그 자리에 박히므로 process.env[name]처럼 동적으로 읽지 않는다.
function readServiceUrl(service: ServiceName): string | undefined {
  switch (service) {
    case 'identity':
      return process.env.EXPO_PUBLIC_IDENTITY_API_BASE_URL;
    case 'learning':
      return process.env.EXPO_PUBLIC_LEARNING_API_BASE_URL;
    case 'billing':
      return process.env.EXPO_PUBLIC_BILLING_API_BASE_URL;
  }
}

function getConfiguredUrl(service: ServiceName): string {
  const url = readServiceUrl(service) ?? process.env.EXPO_PUBLIC_API_BASE_URL;

  if (!url) {
    throw new Error(`${service} API 주소가 설정되지 않았습니다.`);
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error(`${service} API 주소 형식이 올바르지 않습니다.`);
  }
  if (parsedUrl.protocol !== 'https:') {
    throw new Error(`${service} API 주소는 HTTPS여야 합니다.`);
  }

  return url.replace(/\/$/, '');
}

export function getIdentityApiBaseUrl(): string {
  return getConfiguredUrl('identity');
}

export function getLearningApiBaseUrl(): string {
  return getConfiguredUrl('learning');
}

/** 결제·이용권(Billing 서버). Identity Access Token의 audience에 Billing이 들어 있어 같은 토큰을 쓴다(2026-10-14 서버 답). */
export function getBillingApiBaseUrl(): string {
  return getConfiguredUrl('billing');
}
