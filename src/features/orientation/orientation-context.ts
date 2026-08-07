import { createContext, useContext } from "react";

export type OrientationMode =
  | "portrait"
  | "entering-landscape"
  | "landscape"
  | "restoring-portrait";

export interface OrientationContextValue {
  mode: OrientationMode;
  /** Part 4의 명시적 가로 예외가 시작돼 일반 세로 안내를 숨겨야 하는지 여부. */
  isLandscapeTableRequested: boolean;
  /** 지원되는 기기에서 가로 잠금이 적용된 경우에만 true를 반환한다. */
  requestTableLandscape: () => Promise<boolean>;
  /** 겹친 native 요청 뒤에 세로 잠금을 마지막 작업으로 예약한다. */
  restorePortrait: () => Promise<void>;
}

export const OrientationContext = createContext<OrientationContextValue | null>(null);

export function useOrientation(): OrientationContextValue {
  const context = useContext(OrientationContext);
  if (!context) {
    throw new Error("useOrientation must be used within an OrientationProvider");
  }
  return context;
}
