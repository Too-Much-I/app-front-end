import { toEpochMs } from "@/features/challenge/epoch-ms";
import type { ChallengeUploadUrl, RawChallengeUploadUrl } from "@/types/challenge";

export function mapChallengeUploadUrl(raw: RawChallengeUploadUrl): ChallengeUploadUrl {
  return {
    url: raw.upload.url,
    expiresAtMs: toEpochMs(raw.upload.expiresAt),
    contentType: raw.upload.contentType,
    maxBytes: raw.upload.maxBytes,
    submissionDeadlineAtMs: toEpochMs(raw.submissionDeadlineAt),
  };
}
