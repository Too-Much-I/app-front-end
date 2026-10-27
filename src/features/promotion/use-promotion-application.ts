import { useEffect, useRef, useState } from 'react';

import { submitPromotionApplication } from '@/features/promotion/api/submit-promotion-application';
import { pickPromotionReport } from '@/features/promotion/pick-promotion-report';
import {
  checkPromotionReport,
  classifyPromotionSubmitError,
  describeReportProblem,
  validatePromotionDraft,
  type PromotionApplication,
  type PromotionApplicationDraft,
  type PromotionGifticonId,
} from '@/features/promotion/promotion-application';
import { reportOperationalError } from '@/lib/operational-error-reporting';

/**
 * 신청 화면 상태. 폼(`editing`·`submitting`)과, 폼을 닫고 안내만 보이는 결과로 나뉜다.
 * `message`는 폼 아래 한 줄 안내다. 사진 문제(`reportMessage`)는 사진 칸 바로 아래에 따로 보인다.
 */
export type PromotionScreenState =
  | {
      status: 'editing';
      draft: PromotionApplicationDraft;
      message: string | null;
      reportMessage: string | null;
    }
  | { status: 'submitting'; draft: PromotionApplicationDraft }
  | { status: 'done'; application: PromotionApplication }
  | { status: 'already-applied' }
  | { status: 'closed' }
  | { status: 'unavailable' }
  | { status: 'unknown' };

const EMPTY_DRAFT: PromotionApplicationDraft = {
  gifticon: null,
  email: '',
  report: null,
  consented: false,
};

export function usePromotionApplication() {
  const [state, setState] = useState<PromotionScreenState>({
    status: 'editing',
    draft: EMPTY_DRAFT,
    message: null,
    reportMessage: null,
  });
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  function updateDraft(change: Partial<PromotionApplicationDraft>, reportMessage?: string | null) {
    setState((current) =>
      current.status === 'editing'
        ? {
            status: 'editing',
            draft: { ...current.draft, ...change },
            message: null,
            reportMessage: reportMessage === undefined ? current.reportMessage : reportMessage,
          }
        : current,
    );
  }

  const selectGifticon = (gifticon: PromotionGifticonId) => updateDraft({ gifticon });
  const changeEmail = (email: string) => updateDraft({ email });
  const toggleConsent = () =>
    setState((current) =>
      current.status === 'editing'
        ? { ...current, draft: { ...current.draft, consented: !current.draft.consented } }
        : current,
    );

  async function pickReport(): Promise<void> {
    if (busy.current || state.status !== 'editing') return;
    busy.current = true;
    try {
      const report = await pickPromotionReport();
      if (!report || !mounted.current) return;
      const problem = checkPromotionReport(report);
      // 보낼 수 없는 사진은 고른 것으로 남기지 않는다. 남기면 신청을 눌러야 같은 안내를 다시 본다.
      if (problem) {
        updateDraft({ report: null }, describeReportProblem(problem));
      } else {
        updateDraft({ report }, null);
      }
    } catch (error) {
      reportOperationalError({ code: 'PROMOTION_APPLICATION_FAILED', stage: 'pick', cause: error });
      if (mounted.current) updateDraft({}, '사진을 불러오지 못했어요. 다시 골라 주세요.');
    } finally {
      busy.current = false;
    }
  }

  async function submit(): Promise<void> {
    if (busy.current || state.status !== 'editing') return;
    const { draft } = state;
    const validation = validatePromotionDraft(draft);
    if (!validation.ok) {
      setState({ ...state, message: validation.message });
      return;
    }

    busy.current = true;
    setState({ status: 'submitting', draft });
    try {
      // 자동으로 다시 보내지 않는다. 같은 사람이 다시 보내면 409라 사용자가 다시 누를 때만 보낸다.
      await submitPromotionApplication(validation.application);
      if (mounted.current) setState({ status: 'done', application: validation.application });
    } catch (error) {
      const outcome = classifyPromotionSubmitError(error);
      // 이미 신청·기간 종료·기능 꺼짐은 정해진 응답이라 보고하지 않는다.
      if (outcome.kind === 'retry' || outcome.kind === 'unknown') {
        reportOperationalError({
          code: 'PROMOTION_APPLICATION_FAILED',
          stage: 'submit',
          cause: error,
        });
      }
      if (!mounted.current) return;
      setState(
        outcome.kind === 'retry'
          ? { status: 'editing', draft, message: outcome.message, reportMessage: null }
          : { status: outcome.kind },
      );
    } finally {
      busy.current = false;
    }
  }

  return { state, selectGifticon, changeEmail, toggleConsent, pickReport, submit };
}
