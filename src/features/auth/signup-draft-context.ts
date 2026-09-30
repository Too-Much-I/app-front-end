import { createContext, useContext } from 'react';

import type { createSignupDraftStore } from '@/features/auth/signup-draft-store';

export const SignupDraftContext = createContext<ReturnType<typeof createSignupDraftStore> | null>(
  null,
);

export function useSignupDraftStore() {
  const store = useContext(SignupDraftContext);
  if (!store) throw new Error('가입 입력 store가 연결되지 않았습니다.');
  return store;
}
