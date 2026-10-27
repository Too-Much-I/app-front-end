import { File } from 'expo-file-system';
import { z } from 'zod';

import type { PromotionApplication } from '@/features/promotion/promotion-application';
import { apiFetch } from '@/lib/api/client';
import { parseApiResult } from '@/lib/api/parse-api-result';
import type { ApiEnvelope } from '@/types/api';

/** 성적표가 최대 9 MiB라 기본 10초로는 느린 망에서 올리다 끊긴다. */
const SUBMIT_TIMEOUT_MS = 60_000;

const promotionApplicationSchema = z.object({ applicationId: z.string().min(1) });

/**
 * 프로모션 신청(`POST /api/v1/promotions/applications`, 테스트 서버 2026-10-27 배포 확인).
 *
 * multipart로 `gifticon`·`email`·`report`를 보낸다. Swagger가 `gifticon`·`email`을 query로 표시하지만 서버 안내대로
 * 본문 필드로만 보낸다(2026-10-24 결정 기록). 사용자·프로모션 ID는 보내지 않는다(서버가 현재 캠페인을 고른다).
 *
 * 성공은 접수됐다는 뜻일 뿐 지급 승인이 아니다. `applicationId`는 화면에 쓰지 않아 돌려주지 않는다.
 * 같은 사람이 다시 보내면 409라서 자동으로 다시 보내지 않는다.
 */
export async function submitPromotionApplication(application: PromotionApplication): Promise<void> {
  const body = new FormData();
  body.append('gifticon', application.gifticon);
  body.append('email', application.email);
  // 전역 fetch는 expo/fetch라 React Native식 `{ uri, name, type }` 파트를 보내지 못한다("Unsupported
  // FormDataPart implementation", 2026-10-27 리뷰 F1). `bytes()`를 가진 expo-file-system `File`로 붙인다 —
  // 파일 이름과 MIME 타입도 이 객체에서 나간다.
  body.append('report', new File(application.report.uri));

  const { result } = await apiFetch<ApiEnvelope<unknown>>(
    '/api/v1/promotions/applications',
    { method: 'POST', body },
    SUBMIT_TIMEOUT_MS,
  );
  parseApiResult(promotionApplicationSchema, result, 'PROMOTION_APPLICATION');
}
