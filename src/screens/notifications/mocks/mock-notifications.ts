export type NotificationCategory = "study" | "event" | "service";

export type NotificationType =
  | "study_reminder"
  | "grading_complete"
  | "growth"
  | "event"
  | "tip"
  | "service_notice"
  | "goal_achieved";

export type NotificationItem = {
  id: string;
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  body: string;
  createdAt: string;
  isRead: boolean;
};

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

/**
 * 서버 알림 API가 준비되기 전 화면 검증용 fixture.
 * `createdAt`을 렌더 시점 기준 상대 오프셋으로 만들어서, 언제 실행해도
 * "오늘" 섹션이 실제 오늘 날짜와 어긋나지 않게 한다.
 */
export const MOCK_NOTIFICATIONS: readonly NotificationItem[] = [
  {
    id: "n1",
    type: "study_reminder",
    category: "study",
    title: "오늘의 학습 리마인드",
    body: "오늘의 토익스피킹 모의고사를 풀어보세요!",
    createdAt: hoursAgo(0.5),
    isRead: false,
  },
  {
    id: "n2",
    type: "grading_complete",
    category: "study",
    title: "모의고사 완료!",
    body: "IM3 모의고사 채점이 완료되었어요.\n피드백을 확인해보세요!",
    createdAt: hoursAgo(1.5),
    isRead: false,
  },
  {
    id: "n3",
    type: "growth",
    category: "study",
    title: "실력이 성장하고 있어요! 🌱",
    body: "최근 3회 모의고사 평균 점수가 0.4점 상승했어요.",
    createdAt: hoursAgo(2),
    isRead: false,
  },
  {
    id: "n4",
    type: "event",
    category: "event",
    title: "여름 이벤트 참여하고 선물 받자! 🎁",
    body: "토선생 여름 이벤트가 진행 중이에요.\n지금 바로 참여해보세요!",
    createdAt: hoursAgo(26),
    isRead: false,
  },
  {
    id: "n5",
    type: "tip",
    category: "study",
    title: "새로운 표현 추천",
    body: "Part 2에서 유용하게 쓸 수 있는 표현을 추가했어요. 확인해보세요!",
    createdAt: hoursAgo(30),
    isRead: true,
  },
  {
    id: "n6",
    type: "service_notice",
    category: "service",
    title: "서비스 점검 안내",
    body: "더 나은 서비스 제공을 위해\n내일 새벽 2시~4시 점검이 진행됩니다.",
    createdAt: hoursAgo(32),
    isRead: true,
  },
  {
    id: "n7",
    type: "goal_achieved",
    category: "study",
    title: "학습 목표 달성! 🎉",
    body: "이번 주 학습 목표를 달성했어요!\n멋져요, 계속 응원할게요!",
    createdAt: hoursAgo(50),
    isRead: true,
  },
];
