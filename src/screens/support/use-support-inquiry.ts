import * as Crypto from 'expo-crypto';
import { useEffect, useRef, useState } from 'react';

import {
  describeSupportInquiryFailure,
  isSameSupportInquiry,
  validateSupportInquiry,
  type SupportInquiry,
  type SupportInquiryDraft,
  type SupportInquiryEntry,
  type SupportInquirySender,
} from '@/features/support/support-inquiry';

type InquiryFormState =
  | { status: 'editing'; draft: SupportInquiryDraft }
  | { status: 'submitting'; draft: SupportInquiryDraft }
  | { status: 'failed'; draft: SupportInquiryDraft; message: string }
  | { status: 'submitted' };

type InquiryField = 'message' | 'replyEmail';

export function useSupportInquiry(entry: SupportInquiryEntry, send?: SupportInquirySender) {
  const [state, setState] = useState<InquiryFormState>({
    status: 'editing',
    draft: { category: entry.category ?? null, message: '', replyEmail: '' },
  });
  const submitting = useRef(false);
  const mounted = useRef(true);
  // 마지막으로 보낸 문의와 그 키. 같은 문의를 다시 보낼 때만 키를 재사용한다.
  const lastAttempt = useRef<{ inquiry: SupportInquiry; idempotencyKey: string } | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  function updateDraft(change: Partial<SupportInquiryDraft>): void {
    if (submitting.current) return;
    setState((current) =>
      current.status === 'submitted' || current.status === 'submitting'
        ? current
        : { status: 'editing', draft: { ...current.draft, ...change } },
    );
  }

  function update(field: InquiryField, value: string): void {
    updateDraft(field === 'message' ? { message: value } : { replyEmail: value });
  }

  function selectCategory(category: SupportInquiryDraft['category']): void {
    updateDraft({ category });
  }

  async function submit(): Promise<void> {
    if (
      !send ||
      submitting.current ||
      state.status === 'submitted' ||
      state.status === 'submitting'
    )
      return;
    const draft = state.draft;
    const validation = validateSupportInquiry(draft, entry.screen);
    if (!validation.ok) {
      setState({ status: 'failed', draft, message: validation.message });
      return;
    }
    const { inquiry } = validation;
    const previous = lastAttempt.current;
    // 서버는 소문자 UUID v4를 요구한다. 플랫폼마다 대소문자가 다를 수 있어 직접 맞춘다.
    const idempotencyKey =
      previous && isSameSupportInquiry(previous.inquiry, inquiry)
        ? previous.idempotencyKey
        : Crypto.randomUUID().toLowerCase();
    lastAttempt.current = { inquiry, idempotencyKey };

    submitting.current = true;
    setState({ status: 'submitting', draft });
    try {
      // 자동 재전송하지 않는다. 사용자가 다시 누르면 같은 문의는 같은 키로 보내 중복 접수를 막는다.
      await send(inquiry, idempotencyKey);
      if (mounted.current) setState({ status: 'submitted' });
    } catch (error) {
      if (mounted.current)
        setState({ status: 'failed', draft, message: describeSupportInquiryFailure(error) });
    } finally {
      submitting.current = false;
    }
  }

  return { state, update, selectCategory, submit };
}
