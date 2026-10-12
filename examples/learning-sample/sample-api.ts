import { Image } from 'react-native';
import {
  learningDetailSchema,
  learningUnitSchema,
} from '@/features/learning/learning-content-schema';
import { mapLearningDetail } from '@/features/learning/map-learning-detail';
import { mapLearningUnit } from '@/features/learning/map-learning-unit';
import {
  parseLearningSubmission,
  type LearningSubmissionJob,
  type LearningCheckResult,
} from '@/features/learning/learning-submission';
import type {
  LearningLevel,
  LearningMedia,
  LearningPhoto,
} from '@/features/learning/learning-types';
import type { LearningCompletionInput } from '@/features/learning/api/put-learning-completion';
import { sampleAssets } from './assets';
import content from './content.json';

const sampleDetails = content.details.map((detail) => learningDetailSchema.parse(detail));

// This module is substituted only by the explicit sample Metro configuration.
// Never import it from production code or turn these fixtures into real grading.
const completions = new Set<string>();
const jobs = new Map<
  string,
  { job: LearningSubmissionJob; submittedAt: number | null; result: LearningCheckResult }
>();
const completionKey = (id: string, level: string, version: string) => `${id}:${level}:${version}`;
function checkSignal(signal?: AbortSignal) {
  if (signal?.aborted) throw new Error('cancelled');
}
function mediaFile(media: LearningMedia): LearningMedia {
  const asset = sampleAssets[media.id];
  if (!asset) throw new Error('샘플 미디어를 찾지 못했어요.');
  return { ...media, url: Image.resolveAssetSource(asset).uri };
}
function photoFile(photo: LearningPhoto | null): LearningPhoto | null {
  return photo ? { ...photo, ...mediaFile(photo) } : null;
}
function sampleDetail(id: string, level: LearningLevel | 'common') {
  const detail = sampleDetails.find(
    (d) => d.unit.id === id && d.lessons[0].level === (d.unit.part === 1 ? 'common' : level),
  );
  if (!detail) throw new Error('샘플 문항을 찾지 못했어요.');
  return learningDetailSchema.parse(detail);
}
export async function getLearningUnits(part: number, level: LearningLevel, signal?: AbortSignal) {
  checkSignal(signal);
  return content.units
    .filter((u) => u.part === part)
    .map((u) => {
      const detail = sampleDetail(u.id, level);
      const unit = mapLearningUnit(learningUnitSchema.parse(u));
      return {
        ...unit,
        thumbnail: photoFile(unit.thumbnail),
        completedLessonIds: detail.lessons
          .filter((l) => completions.has(completionKey(l.id, l.level, l.contentVersion)))
          .map((l) => l.id),
      };
    });
}
export async function getLearningUnit(id: string, level: LearningLevel, signal?: AbortSignal) {
  checkSignal(signal);
  const detail = mapLearningDetail(sampleDetail(id, level));
  return {
    unit: { ...detail.unit, thumbnail: photoFile(detail.unit.thumbnail) },
    lessons: detail.lessons.map((lesson) => ({
      ...lesson,
      photo: photoFile(lesson.photo),
      answers: Object.fromEntries(
        Object.entries(lesson.answers).map(([grade, a]) => [
          grade,
          {
            ...a,
            fullAudio: a.fullAudio ? mediaFile(a.fullAudio) : undefined,
            sentences: a.sentences.map((s) => ({ ...s, audio: mediaFile(s.audio) })),
          },
        ]),
      ),
    })),
  };
}
export async function resolveLearningMedia(media: LearningMedia, signal: AbortSignal) {
  checkSignal(signal);
  return mediaFile(media).url;
}

const partCriteria: Record<number, { label: string; good: string; improve: string }[]> = {
  2: [
    {
      label: '장소·장면 소개',
      good: '사진의 전체 장면을 소개했어요.',
      improve: '어디에서 찍힌 사진인지 먼저 소개해 보세요.',
    },
    {
      label: '주요 인물의 행동',
      good: '인물의 행동을 설명했어요.',
      improve: '눈에 보이는 행동을 하나 더 설명해 보세요.',
    },
    {
      label: '주변·배경 묘사',
      good: '주변 사물도 설명했어요.',
      improve: '주변 사물이나 배경을 한 문장 덧붙여 보세요.',
    },
  ],
  3: [
    {
      label: '질문에 직접 답하기',
      good: '질문의 핵심에 답했어요.',
      improve: '질문이 묻는 정보를 먼저 말해 보세요.',
    },
    {
      label: '요청한 정보 포함',
      good: '요청한 정보를 담았어요.',
      improve: '질문에 포함된 다른 요구도 확인해 보세요.',
    },
    {
      label: '구체적인 설명',
      good: '답을 구체화했어요.',
      improve: '구체적인 정보로 답을 보충해 보세요.',
    },
  ],
  4: [
    {
      label: '질문에 맞는 정보 선택',
      good: '관련 정보를 골랐어요.',
      improve: '질문에서 묻는 항목을 먼저 찾아보세요.',
    },
    {
      label: '표의 사실과 일치',
      good: '표의 정보에 맞게 답했어요.',
      improve: '표의 시간·장소·금액을 다시 확인해 보세요.',
    },
    {
      label: '필요한 항목 포함',
      good: '필요한 항목을 담았어요.',
      improve: '조건에 맞는 항목이 더 있는지 확인해 보세요.',
    },
  ],
  5: [
    {
      label: '분명한 의견',
      good: '자신의 의견을 분명히 말했어요.',
      improve: '어느 쪽에 동의하는지 먼저 말해 보세요.',
    },
    {
      label: '의견을 뒷받침하는 이유',
      good: '의견에 맞는 이유를 제시했어요.',
      improve: '그렇게 생각하는 이유를 덧붙여 보세요.',
    },
    {
      label: '구체적인 예시',
      good: '예시로 설명했어요.',
      improve: '경험이나 구체적인 예시를 덧붙여 보세요.',
    },
  ],
};
export async function getLearningGradingSupport(lessonId: string, signal: AbortSignal) {
  checkSignal(signal);
  const available = sampleDetails.some((d) =>
    d.lessons.some((l) => l.id === lessonId && l.part !== 1),
  );
  return available
    ? { kind: 'ready' as const }
    : { kind: 'unsupported' as const, message: '샘플 채점 대상이 아닙니다.' };
}
export async function createLearningSubmission(
  id: string,
  lessonId: string,
  level: LearningLevel,
  signal: AbortSignal,
  contentVersion: string,
) {
  checkSignal(signal);
  const previous = jobs.get(id);
  if (previous) {
    if (
      previous.job.lessonId !== lessonId ||
      previous.job.level !== level ||
      previous.job.contentVersion !== contentVersion
    )
      throw new Error('샘플 제출 ID가 일치하지 않습니다.');
    return previous.job;
  }
  const lesson = sampleDetails
    .flatMap((d) => d.lessons)
    .find((l) => l.id === lessonId && l.level === level && l.contentVersion === contentVersion);
  if (!lesson || lesson.part === 1) throw new Error('샘플 채점 문항을 확인해 주세요.');
  const items = partCriteria[lesson.part].map((c, i) => ({
    id: `sample-${lesson.part}-${i}`,
    label: c.label,
    verdict: i < 2 ? ('met' as const) : ('not_met' as const),
    probability: i < 2 ? 0.94 : 0.12,
    feedback: i < 2 ? c.good : c.improve,
  }));
  const result: LearningCheckResult = {
    checklistVersion: 'sample-fixture-v1',
    transcript: `[샘플 전사 예시 · 실제 녹음 분석 아님] ${lesson.answer.example}`,
    metCount: 2,
    totalCount: items.length,
    items,
  };
  const job = parseLearningSubmission({
    id,
    lessonId,
    level,
    contentVersion,
    status: 'awaiting_audio',
    result: null,
    error: null,
  });
  jobs.set(id, { job, submittedAt: null, result });
  return job;
}
export async function uploadLearningSubmission(id: string, _uri: string, signal: AbortSignal) {
  checkSignal(signal);
  const entry = jobs.get(id);
  if (!entry) throw new Error('샘플 제출을 찾지 못했어요.');
  if (entry.submittedAt === null) {
    entry.submittedAt = Date.now();
    entry.job = { ...entry.job, status: 'queued' };
  }
}
export async function getLearningSubmission(id: string, signal: AbortSignal) {
  checkSignal(signal);
  const entry = jobs.get(id);
  if (!entry) throw new Error('샘플 제출을 찾지 못했어요.');
  if (entry.submittedAt === null) return entry.job;
  const elapsed = Date.now() - entry.submittedAt;
  const status =
    elapsed < 800
      ? 'queued'
      : elapsed < 2000
        ? 'transcribing'
        : elapsed < 3200
          ? 'grading'
          : 'completed';
  entry.job = parseLearningSubmission({
    ...entry.job,
    status,
    result: status === 'completed' ? entry.result : null,
  });
  return entry.job;
}
export async function retryLearningSubmission(id: string, signal: AbortSignal) {
  return getLearningSubmission(id, signal);
}
export async function putLearningCompletion(input: LearningCompletionInput) {
  const lesson = sampleDetails
    .flatMap((d) => d.lessons)
    .find(
      (l) =>
        l.id === input.lessonId &&
        l.level === input.level &&
        l.contentVersion === input.contentVersion,
    );
  if (!lesson) throw new Error('샘플 완료 문항이 일치하지 않습니다.');
  if (lesson.part !== 1) {
    const job = input.submissionId ? jobs.get(input.submissionId)?.job : undefined;
    if (job?.status !== 'completed' || job.lessonId !== lesson.id || job.level !== input.level)
      throw new Error('샘플 채점을 먼저 마쳐 주세요.');
  }
  completions.add(completionKey(input.lessonId, input.level, input.contentVersion));
  return {
    lessonId: input.lessonId,
    level: input.level,
    contentVersion: input.contentVersion,
    completed: true as const,
  };
}
