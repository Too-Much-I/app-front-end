import type { Feather } from "@expo/vector-icons";
import type { ComponentProps } from "react";

export interface ExamReadyNotice {
  icon: ComponentProps<typeof Feather>["name"];
  title: string;
  /** 본문. `highlight`가 있으면 그 뒤에 이어 붙는다. */
  description: string;
  /** 강조해서 보여줄 꼬리 문장. 본문과 같은 문단으로 이어지되 색만 달라진다. */
  highlight?: string;
}

/**
 * 응시 전 안내 항목.
 *
 * 순서에 의미가 있다. 앞 두 개는 "지금 시작해도 되는지"를 판단하는 데 필요한 정보고,
 * 뒤 두 개는 "시작한 뒤에 겪을 일"이다. 사용자가 앞 두 줄만 읽고 버튼을 눌러도
 * 손해가 없도록 이 순서를 유지한다.
 *
 * 이 화면은 안내만 하고 아무것도 검증하지 않는다(마이크 권한·소리 테스트 없음).
 * 검증이 필요하다고 판단되면 이 목록을 늘리는 게 아니라 별도 단계를 두는 쪽이 맞다.
 */
export const EXAM_READY_NOTICES: ExamReadyNotice[] = [
  {
    icon: "volume-x",
    title: "조용한 곳에서 응시해주세요",
    description: "주변 소리가 함께 녹음되면 채점 정확도가 떨어져요.",
  },
  {
    icon: "clock",
    title: "약 20분이 걸려요",
    description: "앞 문제로 돌아갈 수 없으니 시간을 넉넉히 두고 시작해주세요.",
  },
  {
    icon: "columns",
    title: "준비 시간과 답변 시간이 나뉘어요",
    description: "파트마다 길이가 달라요.",
  },
  {
    icon: "skip-forward",
    title: "남은 시간은 건너뛸 수 있어요",
    description: "준비가 끝나면 바로 답변하고, 답변이 끝나면 바로 제출할 수 있어요.",
    highlight: "실제 시험에서는 안 되니, 실전처럼 연습하려면 시간을 그대로 써보세요.",
  },
];
