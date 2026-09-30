import { createStore } from 'zustand/vanilla';

export type SignupDraftPolicy = 'terms' | 'privacy';
export type SignupDraftConsent =
  { version: null; agreed: false } | { version: string; agreed: boolean };

type SignupDraftState = {
  nickname: string;
  phone: string;
  /** 번호가 다시 원래 값으로 돌아와도 이전 인증 시도를 재사용하지 않는다. */
  phoneRevision: number;
  consents: Record<SignupDraftPolicy, SignupDraftConsent>;
};

function emptySignupDraft(phoneRevision = 0): SignupDraftState {
  return {
    nickname: '',
    phone: '',
    phoneRevision,
    consents: {
      terms: { version: null, agreed: false },
      privacy: { version: null, agreed: false },
    },
  };
}

function updateDraftConsentVersion(
  current: SignupDraftConsent,
  version: string | null,
): SignupDraftConsent {
  if (!version) return { version: null, agreed: false };
  return current.version === version ? current : { version, agreed: false };
}

/** 가입 흐름 소유자가 생성·초기화한다. 기기 저장, SMS 코드, 인증 증명을 포함하지 않는다. */
export function createSignupDraftStore() {
  const store = createStore<SignupDraftState>(() => emptySignupDraft());

  function setPolicyVersions(versions: Record<SignupDraftPolicy, string | null>): void {
    store.setState((current) => ({
      consents: {
        terms: updateDraftConsentVersion(current.consents.terms, versions.terms),
        privacy: updateDraftConsentVersion(current.consents.privacy, versions.privacy),
      },
    }));
  }

  function setConsent(policy: SignupDraftPolicy, agreed: boolean): void {
    store.setState((current) => {
      const consent = current.consents[policy];
      if (consent.version === null) return current;
      return {
        consents: {
          ...current.consents,
          [policy]: { version: consent.version, agreed },
        },
      };
    });
  }

  function setAllConsents(agreed: boolean): void {
    store.setState((current) => ({
      consents: {
        terms:
          current.consents.terms.version === null
            ? current.consents.terms
            : { version: current.consents.terms.version, agreed },
        privacy:
          current.consents.privacy.version === null
            ? current.consents.privacy
            : { version: current.consents.privacy.version, agreed },
      },
    }));
  }

  function setPhone(phone: string): void {
    store.setState((current) =>
      current.phone === phone ? current : { phone, phoneRevision: current.phoneRevision + 1 },
    );
  }

  return {
    ...store,
    setNickname: (nickname: string) => store.setState({ nickname }),
    setPhone,
    setConsent,
    setAllConsents,
    setPolicyVersions,
    reset: () => store.setState((current) => emptySignupDraft(current.phoneRevision + 1)),
  };
}
