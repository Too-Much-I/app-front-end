import { useCallback, useRef, useState } from "react";

import { useAuth } from "@/features/auth/auth-context";

export type DeleteRecordsStatus = "idle" | "confirming" | "deleting" | "error";

/**
 * 설정 화면의 "모든 학습 기록 삭제" 확인 흐름.
 *
 * 성공 경로에서 상태를 되돌리지 않는 것이 이 훅의 핵심 규칙이다. 삭제가 성공하면
 * 재부트스트랩이 NavigationContainer를 언마운트하므로 되돌릴 컴포넌트가 이미 없다.
 * 실패했을 때만 화면으로 돌아온다.
 */
export function useDeleteLearningRecords() {
  const { deleteGuestAccount } = useAuth();
  const [status, setStatus] = useState<DeleteRecordsStatus>("idle");
  // 상태 반영을 기다리는 사이의 연타를 막는다. status만으로는 한 프레임이 비어 있다.
  const isDeletingRef = useRef(false);

  const request = useCallback(() => {
    setStatus("confirming");
  }, []);

  const cancel = useCallback(() => {
    // 요청이 나간 뒤에는 되돌릴 수 없으므로 닫기를 무시한다.
    if (isDeletingRef.current) {
      return;
    }
    setStatus("idle");
  }, []);

  const confirm = useCallback(async () => {
    if (isDeletingRef.current) {
      return;
    }
    isDeletingRef.current = true;
    setStatus("deleting");

    try {
      await deleteGuestAccount();
      // 성공: 이 컴포넌트는 곧 언마운트된다. 여기서 상태를 만지지 않는다.
    } catch (error) {
      console.error("[Settings] 학습 기록 삭제 실패", error);
      isDeletingRef.current = false;
      setStatus("error");
    }
  }, [deleteGuestAccount]);

  return { status, request, cancel, confirm };
}
