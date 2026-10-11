import { z } from 'zod';

import type { MyProfile } from '@/types/profile';

/**
 * `GET /api/v1/users/me`에서 마이페이지가 읽는 값.
 *
 * 닉네임만 선언한다. 같은 응답의 `accountType`은 세션 복구가 따로 읽고
 * (`get-current-account.ts`), 나머지는 화면이 쓰지 않는다.
 * 닉네임이 없어도 실패로 보지 않는다 — 인사말에서 그 자리만 빼면 된다.
 */
export const myProfileSchema = z.object({
  nickname: z.string().nullish(),
});

export function mapMyProfile(raw: z.infer<typeof myProfileSchema>): MyProfile {
  const nickname = raw.nickname?.trim();
  return { nickname: nickname ? nickname : null };
}
