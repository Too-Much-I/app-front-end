import { View } from "react-native";

export type TapeTone = "sky" | "mint";
export type TapeSide = "left" | "right";

const TONE_CLASSNAME: Record<TapeTone, string> = {
  sky: "bg-sky/90",
  mint: "bg-challenge-mint-label",
};

/** 종이 밖으로 나가야 "붙인 것"으로 보인다. 부모가 클리핑하면 이 여분이 잘린다. */
const SIDE_CLASSNAME: Record<TapeSide, string> = {
  left: "-left-2",
  right: "-right-2",
};

const TAPE_DOT_COLUMNS = 4;

interface TapeProps {
  tone: TapeTone;
  side: TapeSide;
}

/**
 * 종이 아래쪽 모서리를 눌러 붙인 워시 테이프.
 *
 * 아래에 작게 붙인다. 위쪽은 라벨 칩과 글의 첫 줄이 지나는 자리라, 거기 붙이면 카드가
 * 테이프 폭만큼 자리를 비워야 하고 그러지 않으면 문장 일부가 테이프에 가려 사라진다.
 * 아래 모서리는 글 상자 바깥이라 무엇도 비켜줄 필요가 없다.
 *
 * 기울이지 않는다. 기울이면 들린 끝이 카드 모서리를 넘어 그림자와 겹친다.
 *
 * 각도와 크기를 prop으로 열지 않는 이유도 같다 — 그건 화면이 아니라 디자인이 정하는
 * 값이라, 호출부마다 다른 숫자가 들어가면 같은 테이프가 화면마다 달라진다.
 *
 * 밖으로 나가는 양(8px)은 화면 좌우 여백(20px)보다 작아야 한다. 더 내밀면 카드가 아니라
 * 화면 가장자리에서 테이프 끝이 잘린다.
 */
export function Tape({ tone, side }: TapeProps) {
  return (
    <View
      accessibilityElementsHidden
      className={`absolute bottom-3 h-5 w-16 justify-center gap-0.5 rounded-sm px-1.5 ${TONE_CLASSNAME[tone]} ${SIDE_CLASSNAME[side]}`}
      pointerEvents="none"
    >
      {[0, 1].map((row) => (
        <View className="flex-row justify-between" key={row}>
          {Array.from({ length: TAPE_DOT_COLUMNS }, (_, index) => index).map((index) => (
            <View className="h-1 w-1 rounded-full bg-white/80" key={index} />
          ))}
        </View>
      ))}
    </View>
  );
}
