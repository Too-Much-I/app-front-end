import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";

/**
 * 피드백 응답에 담긴 사용자 답변 오디오 URL은 presigned라 발급 후 1시간이면 만료된다.
 * 서버가 서명에 만료 시각을 박아 두고 요청 시점에 대조하므로, 앱이 백그라운드에 있든
 * 종료돼 있든 벽시계 시간이 흐르면 그대로 만료된다.
 */
const PRESIGNED_URL_TTL_MS = 60 * 60 * 1000;

/**
 * 만료 직전까지 끌지 않고 남겨 두는 여유.
 *
 * 만료 판정은 서버 시각 기준인데 우리 계산은 기기 시각 기준이라, 두 시계가 어긋나면
 * 경과 시간을 아무리 정확히 재도 답이 틀린다. 이 여유가 웬만한 오차를 흡수한다.
 * 경과 시간은 "갱신할까 말까"의 휴리스틱이지 유효성의 근거가 아니다.
 */
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

const REFRESH_AFTER_MS = PRESIGNED_URL_TTL_MS - REFRESH_MARGIN_MS;

type FeedbackDataRefreshOptions = {
  /** 웹에 "데이터를 다시 받아라"라고 알린다. */
  onRefresh: () => void;
};

type FeedbackDataRefresh = {
  /** 웹에 데이터를 전달한 직후 호출한다. */
  markDataDelivered: () => void;
  /** 웹뷰가 새 주소를 열거나 리로드돼 들고 있던 데이터가 사라졌을 때 호출한다. */
  reset: () => void;
};

/**
 * 웹뷰가 들고 있는 피드백 데이터가 만료되기 전에 다시 받아오게 한다.
 *
 * 규칙은 하나다 — **데이터를 받은 지 `REFRESH_AFTER_MS`가 지났으면 갱신한다.**
 * 이 규칙을 평가하는 계기가 둘이라 언뜻 두 가지 장치처럼 보이지만, 판단 기준은 같다.
 *
 * 1. 타이머: 앱을 계속 켜 둔 채 만료를 넘기는 경우를 잡는다. 이때는 AppState 변화가
 *    아예 없어서 복귀 신호만으로는 잡을 수 없다.
 * 2. 포그라운드 복귀: 백그라운드에서는 JS 스레드가 서스펜드되어 타이머가 시간을 잃는다.
 *    30분 뒤에 돌아와도 타이머는 자기가 몇 초밖에 안 흘렀다고 알고 있으므로, 복귀할 때마다
 *    기준 시각과 벽시계로 다시 계산해 타이머를 고쳐 건다.
 *
 * 화면 꺼짐(절전·전원 버튼)과 Android Doze도 같은 경로로 처리된다. 타이머를 신뢰하지 않고
 * 매번 벽시계로 다시 재기 때문에 무엇 때문에 멈췄는지 구분할 필요가 없다.
 *
 * 기준 시각은 **복귀만으로는 갱신하지 않는다.** 갱신했다면 그때가 새 기준이 된다.
 * 복귀할 때마다 기준을 현재로 당기면, 알림 센터를 잠깐 내리는 것만으로도 만료 시계가
 * 뒤로 밀려 영원히 갱신되지 않는다(iOS는 그런 전환을 하루에도 수십 번 보낸다).
 */
export function useFeedbackDataRefresh({
  onRefresh,
}: FeedbackDataRefreshOptions): FeedbackDataRefresh {
  /**
   * 지금 웹이 들고 있는 데이터 중 **가장 오래된 것**을 받은 시각. 없으면 null이다.
   *
   * 마지막 응답이 아니라 가장 오래된 응답을 기준으로 삼는다 — 사용자가 회차 칩을 오가면
   * 웹 캐시에 회차별 데이터가 따로 쌓이고, 마지막 응답만 보면 먼저 받아 둔 회차가 먼저
   * 만료된다. 갱신은 웹 캐시를 통째로 무효화하므로 가장 오래된 것에 맞추면 전부 안전하다.
   */
  const oldestDeliveryAtRef = useRef<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 갱신 시점마다 최신 콜백을 쓰되, 콜백이 바뀌어도 예약된 타이머를 다시 걸지는 않는다.
  const onRefreshRef = useRef(onRefresh);
  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current === null) return;
    clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }, []);

  /**
   * 기준 시각을 읽어 지금 갱신할지 정하고, 다음 점검을 예약한다.
   *
   * 이름 붙인 함수 표현식이라 자기 자신을 안전하게 다시 예약할 수 있다.
   */
  const evaluate = useCallback(
    function run() {
      clearTimer();

      const oldestDeliveryAt = oldestDeliveryAtRef.current;
      if (oldestDeliveryAt === null) return;

      const remainingMs = oldestDeliveryAt + REFRESH_AFTER_MS - Date.now();
      if (remainingMs > 0) {
        timeoutRef.current = setTimeout(run, remainingMs);
        return;
      }

      /*
       * 응답을 받은 시각이 아니라 요청한 시각을 새 기준으로 삼는다.
       *
       * null로 비워 두고 다음 응답을 기다리면, 이 신호를 아직 모르는 웹 배포가 떠 있을 때
       * 응답이 영영 오지 않아 다시는 아무 점검도 하지 않게 된다. 조용히 멈추는 쪽보다
       * 55분 뒤에 한 번 더 시도하는 쪽이 낫다. 정상 동작할 때는 응답이 몇 초 뒤에 오므로
       * 차이가 없다.
       */
      oldestDeliveryAtRef.current = Date.now();
      onRefreshRef.current();
      timeoutRef.current = setTimeout(run, REFRESH_AFTER_MS);
    },
    [clearTimer],
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") return;
      evaluate();
    });
    return () => subscription.remove();
  }, [evaluate]);

  useEffect(() => clearTimer, [clearTimer]);

  const markDataDelivered = useCallback(() => {
    // 이미 기준이 있으면 그대로 둔다. 기준은 가장 오래된 데이터를 가리켜야 한다.
    if (oldestDeliveryAtRef.current !== null) return;
    oldestDeliveryAtRef.current = Date.now();
    evaluate();
  }, [evaluate]);

  const reset = useCallback(() => {
    oldestDeliveryAtRef.current = null;
    clearTimer();
  }, [clearTimer]);

  return { markDataDelivered, reset };
}
