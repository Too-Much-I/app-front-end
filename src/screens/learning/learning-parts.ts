import type { Feather } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

import type { LearningPart } from '@/features/learning/learning-level';

type LearningPartRow = {
  part: LearningPart;
  /** 시험지의 문항 번호 범위. */
  questions: string;
  name: string;
  description: string;
  icon: ComponentProps<typeof Feather>['name'];
  /** Part 1은 서버에 등급별 답이 없고 `common` 하나라 고른 등급과 상관없이 같은 문장으로 연습한다. */
  sharedAcrossLevels: boolean;
};

export const LEARNING_PART_ROWS = [
  {
    part: 1,
    questions: 'Q1–2',
    name: '문장 읽기',
    description: '지문을 또박또박 읽어요',
    icon: 'book',
    sharedAcrossLevels: true,
  },
  {
    part: 2,
    questions: 'Q3–4',
    name: '사진 묘사',
    description: '사진 속 장면을 설명해요',
    icon: 'image',
    sharedAcrossLevels: false,
  },
  {
    part: 3,
    questions: 'Q5–7',
    name: '듣고 답하기',
    description: '짧은 질문 세 개에 답해요',
    icon: 'headphones',
    sharedAcrossLevels: false,
  },
  {
    part: 4,
    questions: 'Q8–10',
    name: '표 보고 답하기',
    description: '일정표를 보고 정보를 알려 줘요',
    icon: 'grid',
    sharedAcrossLevels: false,
  },
  {
    part: 5,
    questions: 'Q11',
    name: '의견 말하기',
    description: '내 생각과 이유를 말해요',
    icon: 'message-square',
    sharedAcrossLevels: false,
  },
] as const satisfies readonly LearningPartRow[];
