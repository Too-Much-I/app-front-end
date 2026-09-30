import { useEffect, useRef, useState } from 'react';

import {
  validateSupportInquiry,
  type SupportInquiry,
  type SupportInquirySender,
} from '@/features/support/support-inquiry';

type InquiryFormState =
  | { status: 'editing'; draft: SupportInquiry }
  | { status: 'submitting'; draft: SupportInquiry }
  | { status: 'failed'; draft: SupportInquiry; message: string }
  | { status: 'submitted' };

export function useSupportInquiry(send?: SupportInquirySender) {
  const [state, setState] = useState<InquiryFormState>({
    status: 'editing',
    draft: { message: '', replyEmail: '' },
  });
  const submitting = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  function update(field: keyof SupportInquiry, value: string): void {
    if (submitting.current) return;
    setState((current) =>
      current.status === 'submitted' || current.status === 'submitting'
        ? current
        : { status: 'editing', draft: { ...current.draft, [field]: value } },
    );
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
    const message = validateSupportInquiry(draft);
    if (message) {
      setState({ status: 'failed', draft, message });
      return;
    }
    submitting.current = true;
    setState({ status: 'submitting', draft });
    try {
      // 자동 재전송하지 않는다. 접수 확인은 실제 API 어댑터가 성공한 경우에만 표시한다.
      await send({
        message: draft.message.trim(),
        replyEmail: draft.replyEmail.trim(),
      });
      if (mounted.current) setState({ status: 'submitted' });
    } catch {
      if (mounted.current)
        setState({
          status: 'failed',
          draft,
          message: '전송 결과를 확인하지 못했어요. 입력한 내용은 그대로 남아 있어요.',
        });
    } finally {
      submitting.current = false;
    }
  }

  return { state, update, submit };
}
