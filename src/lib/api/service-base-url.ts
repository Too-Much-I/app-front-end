type ServiceName = "identity" | "learning";

function getConfiguredUrl(service: ServiceName): string {
  const serviceUrl =
    service === "identity"
      ? process.env.EXPO_PUBLIC_IDENTITY_API_BASE_URL
      : process.env.EXPO_PUBLIC_LEARNING_API_BASE_URL;
  const url = serviceUrl ?? process.env.EXPO_PUBLIC_API_BASE_URL;

  if (!url) {
    throw new Error(`${service} API 주소가 설정되지 않았습니다.`);
  }

  return url.replace(/\/$/, "");
}

export function getIdentityApiBaseUrl(): string {
  return getConfiguredUrl("identity");
}

export function getLearningApiBaseUrl(): string {
  return getConfiguredUrl("learning");
}
