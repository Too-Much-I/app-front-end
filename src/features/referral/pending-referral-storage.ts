import AsyncStorage from '@react-native-async-storage/async-storage';
import { z } from 'zod';

/**
 * 가입 때 입력했지만 아직 결과를 모르는 추천 코드. 적용 요청은 회원 토큰이 있어야 보낼 수 있어 가입이 끝난 뒤에
 * 나간다. 그 사이 앱이 꺼져도 다음 실행에 다시 보내려고 기기에 둔다(2026-10-29 결정). `uid`는 가입한 Firebase
 * 사용자다 — 다른 계정으로 보내지 않는다(추천 코드 명세).
 */
export type PendingReferral = { uid: string; code: string };

const PENDING_KEY = 'pending-referral-code.v1';

const pendingSchema = z.object({ uid: z.string().min(1), code: z.string().min(1) });

/** 읽지 못하거나 형식이 깨졌으면 없는 것으로 본다. */
export async function readPendingReferral(): Promise<PendingReferral | null> {
  try {
    const value = await AsyncStorage.getItem(PENDING_KEY);
    if (!value) return null;
    const parsed = pendingSchema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function writePendingReferral(pending: PendingReferral | null): Promise<void> {
  return pending === null
    ? AsyncStorage.removeItem(PENDING_KEY)
    : AsyncStorage.setItem(PENDING_KEY, JSON.stringify(pending));
}
