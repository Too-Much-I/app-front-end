import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import {
  captureSentryValidationCatalog,
  captureSentryValidationItem,
  previewSentryValidationItem,
  SENTRY_VALIDATION_CATALOG,
  type SentryValidationCatalogItem,
} from "@/features/diagnostics/sentry-validation-catalog";
import type {
  OperationalErrorCode,
  OperationalReportReceipt,
} from "@/lib/operational-error-reporting";
import {
  flushOperationalEvents,
  getSentryRuntimeState,
  type OperationalEventPayload,
} from "@/lib/sentry";

type RunStatus =
  | "idle"
  | "previewed"
  | "sending"
  | "flushing"
  | "completed"
  | "failed"
  | "interrupted";

interface DisplayResult {
  eventId: string | null;
  preview: OperationalEventPayload;
  status: "previewed" | "captured" | "failed";
}

type DisplayResults = Partial<Record<OperationalErrorCode, DisplayResult>>;

function toDisplayResult(receipt: OperationalReportReceipt): DisplayResult {
  return {
    eventId: receipt.eventId,
    preview: receipt.preview,
    status: receipt.status === "captured" ? "captured" : "failed",
  };
}

function getStatusLabel(status: RunStatus): string {
  const labels: Record<RunStatus, string> = {
    idle: "대기",
    previewed: "로컬 미리보기 완료",
    sending: "Sentry 전송 중",
    flushing: "Sentry flush 확인 중",
    completed: "15/15 전송 완료",
    failed: "전송 확인 실패",
    interrupted: "실행 중단",
  };
  return labels[status];
}

function getResultClassName(status: DisplayResult["status"]): string {
  if (status === "captured") return "text-feedback-positive";
  if (status === "failed") return "text-exam-danger";
  return "text-sky-text";
}

function PreviewBlock({ preview }: { preview: OperationalEventPayload }) {
  const safePayload = useMemo(
    () =>
      JSON.stringify(
        {
          code: preview.code,
          feature: preview.feature,
          tags: preview.tags,
          context: preview.context,
        },
        null,
        2,
      ),
    [preview],
  );

  return (
    <View className="mt-3 rounded-2xl bg-surface-muted p-3">
      <Text selectable className="text-xs leading-5 text-ink-muted">
        {safePayload}
      </Text>
    </View>
  );
}

export function SentryValidationScreen() {
  const runtime = getSentryRuntimeState();
  const [results, setResults] = useState<DisplayResults>({});
  const [runStatus, setRunStatus] = useState<RunStatus>("idle");
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [isSendArmed, setIsSendArmed] = useState(false);
  const [activeCode, setActiveCode] = useState<OperationalErrorCode | null>(null);
  const [flushSucceeded, setFlushSucceeded] = useState<boolean | null>(null);
  const isMountedRef = useRef(true);
  const isAppActiveRef = useRef(AppState.currentState === "active");
  const runInFlightRef = useRef(false);
  const hasCompletedFullRunRef = useRef(false);

  const resultValues = Object.values(results);
  const capturedCount = resultValues.filter((result) => result?.status === "captured").length;
  const previewedCount = resultValues.filter(Boolean).length;

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      isAppActiveRef.current = nextState === "active";
      if (nextState !== "active" && runInFlightRef.current && isMountedRef.current) {
        setRunStatus("interrupted");
      }
    });

    return () => {
      isMountedRef.current = false;
      subscription.remove();
    };
  }, []);

  const updateReceipt = useCallback((receipt: OperationalReportReceipt) => {
    if (!isMountedRef.current || !isAppActiveRef.current) return;
    setResults((current) => ({
      ...current,
      [receipt.preview.code]: toDisplayResult(receipt),
    }));
  }, []);

  const previewAll = useCallback(() => {
    if (runInFlightRef.current) return;
    const previews: DisplayResults = {};
    for (const item of SENTRY_VALIDATION_CATALOG) {
      const preview = previewSentryValidationItem(item);
      previews[preview.code] = { eventId: null, preview, status: "previewed" };
    }
    setResults(previews);
    setRunStatus("previewed");
    setFlushSucceeded(null);
  }, []);

  const previewOne = useCallback((item: SentryValidationCatalogItem) => {
    if (runInFlightRef.current) return;
    const preview = previewSentryValidationItem(item);
    setResults((current) => ({
      ...current,
      [preview.code]: { eventId: null, preview, status: "previewed" },
    }));
  }, []);

  const captureOne = useCallback(
    async (item: SentryValidationCatalogItem) => {
      if (runInFlightRef.current || !runtime.enabled) return;
      runInFlightRef.current = true;
      setActiveCode(item.input.code);
      setStartedAt(new Date().toISOString());
      setRunStatus("sending");
      try {
        const receipt = captureSentryValidationItem(item);
        updateReceipt(receipt);
        setRunStatus("flushing");
        const flush = await flushOperationalEvents();
        if (!isMountedRef.current || !isAppActiveRef.current) return;
        const succeeded = receipt.status === "captured" && flush.status === "flushed";
        setFlushSucceeded(succeeded);
        setRunStatus(succeeded ? "completed" : "failed");
      } finally {
        runInFlightRef.current = false;
        if (isMountedRef.current) setActiveCode(null);
      }
    },
    [runtime.enabled, updateReceipt],
  );

  const captureAll = useCallback(async () => {
    if (
      runInFlightRef.current ||
      hasCompletedFullRunRef.current ||
      !runtime.enabled ||
      !isSendArmed
    ) {
      return;
    }

    runInFlightRef.current = true;
    setIsSendArmed(false);
    setStartedAt(new Date().toISOString());
    setResults({});
    setFlushSucceeded(null);
    setRunStatus("sending");

    try {
      const run = await captureSentryValidationCatalog(
        updateReceipt,
        () => isMountedRef.current && isAppActiveRef.current,
      );
      if (!isMountedRef.current || !isAppActiveRef.current) return;

      setRunStatus("flushing");
      const allCaptured =
        run.receipts.length === SENTRY_VALIDATION_CATALOG.length &&
        run.receipts.every((receipt) => receipt.status === "captured");
      const succeeded = allCaptured && run.flush.status === "flushed";
      setFlushSucceeded(run.flush.status === "flushed");
      setRunStatus(succeeded ? "completed" : "failed");
      hasCompletedFullRunRef.current = succeeded;
    } finally {
      runInFlightRef.current = false;
    }
  }, [isSendArmed, runtime.enabled, updateReceipt]);

  const reset = useCallback(() => {
    if (runInFlightRef.current) return;
    hasCompletedFullRunRef.current = false;
    setResults({});
    setRunStatus("idle");
    setStartedAt(null);
    setIsSendArmed(false);
    setFlushSucceeded(null);
  }, []);

  const isBusy = runStatus === "sending" || runStatus === "flushing";
  const canSend = runtime.enabled && !isBusy && !hasCompletedFullRunRef.current;

  return (
    <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-surface-subtle">
      <ScrollView
        className="flex-1"
        contentContainerClassName="mx-auto w-full max-w-3xl px-5 pb-10 pt-6"
      >
        <Text accessibilityRole="header" className="text-3xl text-exam-navy">
          Sentry 오류 검증
        </Text>
        <Text className="mt-2 text-sm leading-6 text-ink-muted">
          실제 API와 사용자 데이터 없이 운영 오류 카탈로그 15개를 검증합니다.
        </Text>

        <View className="mt-5 rounded-3xl border border-sky-line bg-sky-surface p-5">
          <Text className="text-lg text-sky-text">검증 환경</Text>
          <Text className="mt-2 text-sm text-sky-text">
            mode: {runtime.validationMode ? "synthetic-validation" : "disabled"}
          </Text>
          <Text className="mt-1 text-sm text-sky-text">
            Sentry: {runtime.enabled ? "enabled" : "disabled"}
          </Text>
          <Text className="mt-1 text-sm text-sky-text">
            상태: {getStatusLabel(runStatus)} · preview {previewedCount}/15 · captured{" "}
            {capturedCount}/15
          </Text>
          {startedAt ? (
            <Text selectable className="mt-1 text-xs text-sky-text">
              startedAt: {startedAt}
            </Text>
          ) : null}
          {flushSucceeded !== null ? (
            <Text className="mt-1 text-sm text-sky-text">
              flush: {flushSucceeded ? "success" : "failed"}
            </Text>
          ) : null}
        </View>

        <View className="mt-4 gap-3">
          <Pressable
            accessibilityRole="button"
            className="items-center rounded-2xl border border-brand-300 bg-surface py-3.5"
            disabled={isBusy}
            onPress={previewAll}
          >
            <Text className="text-base text-brand-text">15개 로컬 미리보기</Text>
          </Pressable>

          {!isSendArmed ? (
            <Pressable
              accessibilityRole="button"
              className="items-center rounded-2xl bg-brand-cta py-3.5"
              disabled={!canSend}
              onPress={() => setIsSendArmed(true)}
            >
              <Text className="text-base text-white">15개 Sentry 전송 준비</Text>
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              className="items-center rounded-2xl bg-exam-danger py-3.5"
              disabled={!canSend}
              onPress={() => void captureAll()}
            >
              <Text className="text-base text-white">확인: 합성 이벤트 15건 실제 전송</Text>
            </Pressable>
          )}

          <Pressable
            accessibilityRole="button"
            className="items-center rounded-2xl bg-surface-muted py-3.5"
            disabled={isBusy}
            onPress={reset}
          >
            <Text className="text-sm text-ink-muted">새 검증 실행으로 초기화</Text>
          </Pressable>
        </View>

        <View className="mt-6 gap-4">
          {SENTRY_VALIDATION_CATALOG.map((item, index) => {
            const code = item.input.code;
            const result = results[code];
            const isActive = activeCode === code;
            return (
              <View key={code} className="rounded-3xl border border-line bg-surface p-5">
                <Text className="text-xs text-ink-disabled">{index + 1}/15</Text>
                <Text className="mt-1 text-lg text-exam-navy">{item.title}</Text>
                <Text selectable className="mt-1 text-xs text-ink-muted">
                  {code}
                </Text>

                <View className="mt-4 flex-row gap-3">
                  <Pressable
                    accessibilityRole="button"
                    className="flex-1 items-center rounded-xl border border-sky-line bg-sky-surface py-3"
                    disabled={isBusy}
                    onPress={() => previewOne(item)}
                  >
                    <Text className="text-sm text-sky-text">미리보기</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    className="flex-1 items-center rounded-xl border border-brand-300 bg-brand-50 py-3"
                    disabled={!canSend}
                    onPress={() => void captureOne(item)}
                  >
                    <Text className="text-sm text-brand-text">
                      {isActive ? "전송 중" : "Sentry 1건 전송"}
                    </Text>
                  </Pressable>
                </View>

                {result ? (
                  <>
                    <Text className={`mt-3 text-sm ${getResultClassName(result.status)}`}>
                      {result.status}
                      {result.eventId ? ` · event ${result.eventId}` : ""}
                    </Text>
                    <PreviewBlock preview={result.preview} />
                  </>
                ) : null}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
