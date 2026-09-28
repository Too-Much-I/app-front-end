import { useEffect } from "react";

/** 코디네이터 인스턴스는 루트 밖 또는 useState 초기화로 한 번만 생성한다. */
export function useAuthBootstrap(coordinator: { bootstrap: () => Promise<void> }): void {
  useEffect(() => {
    void coordinator.bootstrap();
  }, [coordinator]);
}
