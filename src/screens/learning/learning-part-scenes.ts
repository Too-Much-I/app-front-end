import type { ImageSourcePropType } from 'react-native';

import type { LearningLevel } from '@/features/learning/learning-level';
import { colors } from '@/theme';

// public/은 `@/` 별칭 범위(./src) 밖이라 상대 경로로 require한다.
const seaScene = require('../../../public/learning/scene-easy.jpg');
const sunriseScene = require('../../../public/learning/scene-medium.jpg');
const meadowScene = require('../../../public/learning/scene-hard.jpg');

type LearningPartScene = {
  image: ImageSourcePropType;
  imageLabel: string;
  /** 그림 아래 목록 바탕. 그림 맨 아래 색과 같아야 이어져 보인다. */
  ground: string;
};

/**
 * 파트 화면 위쪽 풍경. 등급 카드 색과 그림의 주된 색을 짝지었다(2026-10-22 결정).
 * Easy 하늘색 → 바다, Medium 주황 → 해돋이, Hard 초록 → 꽃 언덕.
 */
export const LEARNING_PART_SCENES = {
  IM3: { image: seaScene, imageLabel: '등대가 있는 바다', ground: colors.learningScene.easy },
  IH: { image: sunriseScene, imageLabel: '해가 뜨는 언덕', ground: colors.learningScene.medium },
  AL: { image: meadowScene, imageLabel: '꽃이 핀 초록 언덕', ground: colors.learningScene.hard },
} as const satisfies Record<LearningLevel, LearningPartScene>;
