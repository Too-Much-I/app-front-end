/**
 * 당근밭 한 자리의 치수.
 *
 * 자리를 그리는 쪽(`ChallengeStageStop`)과 밭 위에 놓는 쪽(`ChallengeStageField`)이
 * 같은 숫자를 봐야 해서 컴포넌트 밖에 둔다. 컴포넌트 파일에서 내보내면 파일 하나가
 * 컴포넌트와 상수를 겸하게 되고, 그러면 이름 규칙도 Fast Refresh도 어긋난다.
 *
 * 그림을 갈아 끼우면 아래 비(比)도 함께 맞춘다. 어긋나면 당근이 구멍에서 벗어난다.
 */

/** 구덩이 그림(`hole.png`, 1641×819)의 가로세로 비. */
const HOLE_ASPECT_RATIO = 1641 / 819;
/** 구덩이 지름. 이 값 하나가 자리 전체의 크기를 정한다. */
export const HOLE_WIDTH = 128;
export const HOLE_HEIGHT = HOLE_WIDTH / HOLE_ASPECT_RATIO;

/**
 * 자리 하나가 차지하는 크기이자 탭 영역.
 *
 * 구덩이보다 세로로 넉넉해야 위로 솟은 당근까지 눌린다. 밭은 이 값으로 자리를
 * 길 위 좌표에 중앙 정렬한다.
 */
export const CHALLENGE_STAGE_STOP_SIZE = { width: HOLE_WIDTH, height: 148 };

/** 당근 그림(`carrot.png`, 1418×1602)의 비를 그대로 따른 칸. 어긋나면 번호가 뿌리를 벗어난다. */
export const CARROT_WIDTH = 54;
export const CARROT_HEIGHT = Math.round((CARROT_WIDTH * 1602) / 1418);

/**
 * 뽑아 눕힌 당근의 배율.
 *
 * 꽂힌 당근보다 조금만 작다. 더 줄이면 구덩이 옆의 얼룩처럼 보여서 "뽑았다"가 아니라
 * "비었다"로 읽힌다 — 완료를 알리는 건 빈 구멍이 아니라 뽑혀 나온 당근이다.
 */
const DONE_CARROT_SCALE = 0.9;
export const DONE_CARROT_WIDTH = CARROT_WIDTH * DONE_CARROT_SCALE;
export const DONE_CARROT_HEIGHT = CARROT_HEIGHT * DONE_CARROT_SCALE;
