/** 끝 슬래시를 제거한 웹 서비스 베이스 URL. 없으면 빈 문자열이다. */
export const WEB_BASE_URL = (process.env.EXPO_PUBLIC_WEB_BASE_URL ?? "").replace(
  /\/+$/,
  "",
);
