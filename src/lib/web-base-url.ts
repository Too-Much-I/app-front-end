/** 끝 슬래시를 제거한 웹 서비스 베이스 URL. 없으면 빈 문자열이다. */
export const WEB_BASE_URL = (process.env.EXPO_PUBLIC_WEB_BASE_URL ?? "").replace(
  /\/+$/,
  "",
);

/**
 * 웹뷰 URL에 앱의 rem 스케일을 실어 보낸다.
 *
 * 웹은 이 값으로 루트 font-size를 맞춰 앱과 같은 비율로 커진다. 주입 스크립트가
 * 아니라 쿼리로 넘기는 이유: 웹의 진입 페이지가 클라이언트 컴포넌트라 다른 경로로
 * 전달하면 하이드레이션 이후에야 값이 잡혀 글자 크기가 한 번 튄다.
 *
 * 소수점 세 자리로 자르는 것은 같은 폭에서 항상 같은 문자열이 나오게 하기 위해서다.
 * 주소가 미세하게 흔들리면 웹뷰가 불필요하게 재로드된다.
 */
export function withRemScale(url: string, scale: number): string {
  const parsedUrl = new URL(url);
  parsedUrl.searchParams.set("scale", scale.toFixed(3));
  return parsedUrl.toString();
}
