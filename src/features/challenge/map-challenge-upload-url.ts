import { z } from "zod";

import { toEpochMs } from "@/features/challenge/epoch-ms";
import type { ChallengeUploadUrl } from "@/types/challenge";

/**
 * `POST /api/v1/challenges/attempts/{attemptId}/upload-url` 응답의 와이어 모양(명세 v1 §6.4).
 *
 * `upload.method`는 선언하지 않는다. 명세가 PUT으로 고정했고 앱이 분기하지 않는다.
 * 업로드 요청은 이 값이 아니라 `contentType`을 그대로 써야 하므로 그쪽만 읽는다.
 */
export const challengeUploadUrlSchema = z.object({
  /**
   * 발급 시점에 서버가 다시 알려준 제출 유효시각.
   *
   * attempt 생성 응답에도 같은 값이 있지만 이쪽이 최신이라 업로드 예산은 이 값으로 잰다.
   * 명세상 `upload.expiresAt`은 이 시각을 넘지 않는다.
   */
  submissionDeadlineAt: z.string(),
  upload: z.object({
    url: z.string(),
    expiresAt: z.string(),
    /** S3 PUT의 `Content-Type`. 서버가 지정한 값을 그대로 보내야 한다. */
    contentType: z.string(),
    maxBytes: z.number(),
  }),
});

export function mapChallengeUploadUrl(
  raw: z.infer<typeof challengeUploadUrlSchema>,
): ChallengeUploadUrl {
  return {
    url: raw.upload.url,
    expiresAtMs: toEpochMs(raw.upload.expiresAt),
    contentType: raw.upload.contentType,
    maxBytes: raw.upload.maxBytes,
    submissionDeadlineAtMs: toEpochMs(raw.submissionDeadlineAt),
  };
}
