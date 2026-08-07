import { MascotModal } from "@/components/ui/MascotModal";
import { useLandscapeDetection } from "@/features/orientation/use-landscape-detection";
import { useOrientation } from "@/features/orientation/orientation-context";

// public/은 `@/` 별칭 범위(./src) 밖이라 상대 경로로 require한다.
const rabbitFace = require("../../../public/mascots/rabbit_face.png");

/**
 * 기기를 가로로 눕혔을 때 세로 전용임을 알리는 전역 오버레이.
 *
 * `ConfirmModal`이 아니라 `MascotModal`을 직접 쓴다. 확인할 것이 없기 때문이다.
 *
 * 버튼을 두지 않는다. 세로로 되돌리면 자동으로 사라지고, 닫기 버튼을 두면
 * "닫았으니 가로로 쓸 수 있나"라는 잘못된 기대를 만든다. 해소 방법이 하나뿐이므로
 * 그 방법만 안내한다.
 *
 * `onRequestClose`(Android 뒤로 가기)도 넘기지 않는다. 뒤로 가기로 닫혀도 가로
 * 상태는 그대로라 즉시 다시 떠야 하는데, 그 왕복이 깜빡임으로 보인다.
 *
 * 감지 훅을 이 안에서 호출하는 이유: `App.tsx`에서 호출해 prop으로 내리면 가로
 * 상태가 바뀔 때마다 앱 트리 전체가 리렌더된다.
 */
export function PortraitOnlyNotice() {
  const isLandscape = useLandscapeDetection();
  const { isLandscapeTableRequested } = useOrientation();

  return (
    <MascotModal
      mascot={rabbitFace}
      message="토선생은 세로 화면만 지원해요. 기기를 세로로 돌리면 계속 이용할 수 있어요."
      title="세로로 돌려주세요"
      visible={isLandscape && !isLandscapeTableRequested}
    />
  );
}
