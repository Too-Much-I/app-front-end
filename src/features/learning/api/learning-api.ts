import { z } from 'zod';

import {
  toLearningServerLevel,
  type LearningLevel,
  type LearningPart,
} from '@/features/learning/learning-level';
import { learningMediaSchema, mapLearningMedia } from '@/features/learning/map-learning-media';
import {
  learningCapabilitiesSchema,
  mapLearningCapabilities,
} from '@/features/learning/map-learning-capabilities';
import {
  learningSubmissionSchema,
  mapLearningSubmission,
} from '@/features/learning/map-learning-submission';
import {
  learningUploadUrlSchema,
  mapLearningUploadUrl,
} from '@/features/learning/map-learning-upload-url';
import {
  learningUnitDetailSchema,
  mapLearningUnitDetail,
} from '@/features/learning/map-learning-unit-detail';
import { learningUnitsSchema, mapLearningUnit } from '@/features/learning/map-learning-unit';
import { apiFetch, apiFetchWithAuthRetry } from '@/lib/api/client';
import { parseApiResult } from '@/lib/api/parse-api-result';
import type { ApiEnvelope } from '@/types/api';
import type {
  LearningCapabilities,
  LearningMedia,
  LearningSubmission,
  LearningUnitDetail,
  LearningUnitSummary,
  LearningUploadUrl,
} from '@/types/learning';

/** 채점 녹음 형식. 업로드 주소 발급과 S3 PUT의 `Content-Type`이 정확히 이 값이어야 한다. */
export const LEARNING_AUDIO_CONTENT_TYPE = 'audio/mp4';

/**
 * 답변 학습 API(테스트 서버 Swagger, 2026-10-23 확인).
 *
 * `result`를 `unknown`으로 받고 `parseApiResult`로 확인한 뒤 매퍼에 넘긴다. Part 1은 등급 구분이 없어
 * 목록·상세 모두 `common`으로 부른다.
 */

/** 파트·등급별 세트 전체와 현재 사용자의 문항 완료 여부. 최대 100개, 페이지네이션 없음. */
export async function getLearningUnits(
  part: LearningPart,
  level: LearningLevel,
  signal?: AbortSignal,
): Promise<LearningUnitSummary[]> {
  const query = `part=${part}&level=${toLearningServerLevel(part, level)}`;
  const { result } = await apiFetchWithAuthRetry<ApiEnvelope<unknown>>(
    `/api/v1/learning/units?${query}`,
    { signal },
  );
  return parseApiResult(learningUnitsSchema, result, 'LEARNING_UNITS').units.map(mapLearningUnit);
}

/** 세트의 문항·모범답안·문장 음성과 단어 시각. */
export async function getLearningUnitDetail(
  unitId: string,
  part: LearningPart,
  level: LearningLevel,
  signal?: AbortSignal,
): Promise<LearningUnitDetail> {
  const { result } = await apiFetchWithAuthRetry<ApiEnvelope<unknown>>(
    `/api/v1/learning/units/${encodeURIComponent(unitId)}?level=${toLearningServerLevel(part, level)}`,
    { signal },
  );
  return mapLearningUnitDetail(
    parseApiResult(learningUnitDetailSchema, result, 'LEARNING_UNIT_DETAIL'),
  );
}

/** 만료된 미디어 주소를 다시 받는다. 새 주소도 1시간짜리다. */
export async function getLearningMediaUrl(mediaId: string): Promise<LearningMedia> {
  const { result } = await apiFetchWithAuthRetry<ApiEnvelope<unknown>>(
    `/api/v1/learning/media/${encodeURIComponent(mediaId)}/url`,
  );
  return mapLearningMedia(parseApiResult(learningMediaSchema, result, 'LEARNING_MEDIA_URL'));
}

const learningCompletionSchema = z.object({ completed: z.boolean() });

/**
 * Part 1 문항 완료를 저장한다. 같은 문항·등급·버전이면 여러 번 불러도 결과가 같다.
 *
 * Part 2~5는 채점이 completed가 될 때 서버가 완료를 저장해서 이 함수를 쓰지 않는다.
 * 401 자동 재시도는 읽기 요청에만 있어서 다른 쓰기 요청처럼 `apiFetch`로 한 번 보낸다. 실패하면 사용자가
 * 다시 누른다. 응답 형식이 맞아도 `completed`가 false면 저장되지 않은 것으로 보고 실패로 던진다.
 */
export async function putLearningReadingCompletion(
  lessonId: string,
  contentVersion: string,
): Promise<void> {
  const { result } = await apiFetch<ApiEnvelope<unknown>>(
    `/api/v1/learning/lessons/${encodeURIComponent(lessonId)}/completion`,
    { method: 'PUT', body: JSON.stringify({ level: 'common', contentVersion }) },
  );
  const { completed } = parseApiResult(learningCompletionSchema, result, 'LEARNING_COMPLETION');
  if (!completed) throw new Error('서버가 문항 완료를 확인하지 않았어요.');
}

/*
 * Part 2~5 채점: 제출 생성 → 업로드 주소 → S3 PUT → 접수 → 상태 조회. 제출 ID는 앱이 녹음마다 만든 UUID이고,
 * 같은 녹음을 다시 보낼 때는 같은 ID를 써서 서버가 기존 제출을 돌려준다. 쓰기 요청은 Part 1 완료처럼
 * `apiFetch`로 한 번 보내고, 실패하면 화면의 재시도가 같은 ID로 다시 보낸다.
 */

/** 이 문항을 지금 채점할 수 있는지. */
export async function getLearningCapabilities(
  lessonId: string,
  signal?: AbortSignal,
): Promise<LearningCapabilities> {
  const { result } = await apiFetchWithAuthRetry<ApiEnvelope<unknown>>(
    `/api/v1/learning/capabilities?lessonId=${encodeURIComponent(lessonId)}`,
    { signal },
  );
  return mapLearningCapabilities(
    parseApiResult(learningCapabilitiesSchema, result, 'LEARNING_CAPABILITIES'),
  );
}

export interface CreateLearningSubmissionInput {
  submissionId: string;
  lessonId: string;
  level: LearningLevel;
  contentVersion: string;
}

export async function createLearningSubmission(
  input: CreateLearningSubmissionInput,
  signal?: AbortSignal,
): Promise<LearningSubmission> {
  const { result } = await apiFetch<ApiEnvelope<unknown>>('/api/v1/learning/submissions', {
    method: 'POST',
    body: JSON.stringify(input),
    signal,
  });
  return parseSubmission(result);
}

/** 녹음 파일 크기를 알려 주고 S3 PUT 주소를 받는다. 형식은 `audio/mp4` 하나다. */
export async function issueLearningUploadUrl(
  submissionId: string,
  sizeBytes: number,
  signal?: AbortSignal,
): Promise<LearningUploadUrl> {
  const { result } = await apiFetch<ApiEnvelope<unknown>>(
    `/api/v1/learning/submissions/${encodeURIComponent(submissionId)}/upload-url`,
    {
      method: 'POST',
      body: JSON.stringify({ contentType: LEARNING_AUDIO_CONTENT_TYPE, sizeBytes }),
      signal,
    },
  );
  return mapLearningUploadUrl(
    parseApiResult(learningUploadUrlSchema, result, 'LEARNING_UPLOAD_URL'),
  );
}

/** 업로드를 마쳤다고 알리고 채점을 접수한다. */
export async function submitLearningSubmission(
  submissionId: string,
  signal?: AbortSignal,
): Promise<LearningSubmission> {
  const { result } = await apiFetch<ApiEnvelope<unknown>>(
    `/api/v1/learning/submissions/${encodeURIComponent(submissionId)}/submit`,
    { method: 'POST', body: JSON.stringify({}), signal },
  );
  return parseSubmission(result);
}

export async function getLearningSubmission(
  submissionId: string,
  signal?: AbortSignal,
): Promise<LearningSubmission> {
  const { result } = await apiFetchWithAuthRetry<ApiEnvelope<unknown>>(
    `/api/v1/learning/submissions/${encodeURIComponent(submissionId)}`,
    { signal },
  );
  return parseSubmission(result);
}

/** 서버가 `retryable`이라고 한 실패를 같은 녹음으로 다시 채점한다. */
export async function retryLearningSubmission(
  submissionId: string,
  signal?: AbortSignal,
): Promise<LearningSubmission> {
  const { result } = await apiFetch<ApiEnvelope<unknown>>(
    `/api/v1/learning/submissions/${encodeURIComponent(submissionId)}/retry`,
    { method: 'POST', body: JSON.stringify({}), signal },
  );
  return parseSubmission(result);
}

function parseSubmission(result: unknown): LearningSubmission {
  return mapLearningSubmission(
    parseApiResult(learningSubmissionSchema, result, 'LEARNING_SUBMISSION'),
  );
}
