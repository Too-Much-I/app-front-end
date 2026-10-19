import type { ImageSourcePropType } from 'react-native';

import type { LearningLevel } from '@/features/learning/learning-level';
import { colors } from '@/theme';

// public/은 `@/` 별칭 범위(./src) 밖이라 상대 경로로 require한다.
const catMascot = require('../../../public/mascots/greeting_cat.png');
const turtleMascot = require('../../../public/mascots/study_turtle.png');
const birdMascot = require('../../../public/mascots/music_bird.png');

type LearningLevelCard = {
  /** 사용자에게 보여 주는 등급 이름. 서버 값(`IM3` 등)과 따로 둔다. */
  label: string;
  /** 이름 아래 한 줄. 이 등급의 답이 어떻게 말하는지를 태그처럼 적는다. */
  tag: string;
  /** 카드 위쪽 색 면이자 이 카드가 가운데일 때의 시작 버튼 색. */
  color: string;
  mascot: ImageSourcePropType;
  mascotLabel: string;
  /**
   * 그림의 가로/세로 비율. 세 캐릭터의 높이를 같게 맞추려고 높이를 고정하고 폭을 이 비율로 정한다.
   * 원본 크기: greeting_cat 937×1172, study_turtle 905×1274, music_bird 1327×1433.
   */
  mascotAspectRatio: number;
  /**
   * 같은 질문에 이 등급이 하는 답. 질문은 화면에 보여 주지 않는다(2026-10-19 사용자 요청).
   *
   * 목데이터(`docs/answer-learning-mock.json`, 원본 `85eb8df`의 `examples/learning-sample/content.json`)의
   * `p3_reference_variant_100_q6`이다. 질문: "Would you be more likely to attend an event if a famous
   * performer appeared in its advertisement?" 목데이터는 16문항 중 6개가 세 등급 답이 같고 나머지도 차이가
   * 작아서, 세 등급 답이 모두 다르면서 카드에 들어갈 만큼 짧은 문항을 골랐다. 서버를 부르지 않는다.
   */
  exampleAnswer: string;
};

/** 카드 순서. 왼쪽부터 쉬운 등급이다. */
export const LEVEL_CARD_ORDER = ['IM3', 'IH', 'AL'] as const satisfies readonly LearningLevel[];

export const LEVEL_CARDS = {
  IM3: {
    label: 'Easy',
    tag: '#짧고_쉬운_핵심',
    color: colors.learningLevel.easy,
    mascot: catMascot,
    mascotLabel: '가방을 멘 학생 고양이',
    mascotAspectRatio: 937 / 1172,
    exampleAnswer:
      'I would be more likely to attend the event. This is because the advertisement looks exciting with a famous performer.',
  },
  IH: {
    label: 'Medium',
    tag: '#이유를_자연스럽게',
    color: colors.learningLevel.medium,
    mascot: turtleMascot,
    mascotLabel: '책 위에 앉아 책을 읽는 거북이',
    mascotAspectRatio: 905 / 1274,
    exampleAnswer:
      'I would be more likely to attend the event. This is because the advertisement makes the event look more exciting.',
  },
  AL: {
    label: 'Hard',
    tag: '#다양한_표현으로',
    color: colors.learningLevel.hard,
    mascot: birdMascot,
    mascotLabel: '헤드셋을 쓰고 앉아 있는 새',
    mascotAspectRatio: 1327 / 1433,
    exampleAnswer:
      'I would be more likely to attend the event. This is because an advertisement featuring a famous performer makes the event seem exciting.',
  },
} as const satisfies Record<LearningLevel, LearningLevelCard>;
