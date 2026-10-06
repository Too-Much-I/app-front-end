// 신규 가입 흐름과 가입용 전화 인증의 상태 전이를 검사한다. Native SDK·네트워크 경계만 대체한다.
// 실행: node scripts/check-signup-flow.mjs (추가 테스트 러너 불필요)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const modules = new Map();

// 시간은 테스트가 직접 움직인다. 모듈은 호출 시점의 전역 setTimeout·Date.now를 읽는다.
let now = 1_800_000_000_000;
const timers = new Map();
let timerId = 0;
Date.now = () => now;
globalThis.setTimeout = (callback, delay = 0) => {
  timerId += 1;
  timers.set(timerId, { at: now + delay, callback });
  return timerId;
};
globalThis.clearTimeout = (id) => timers.delete(id);
async function flush() {
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
}
async function advance(ms) {
  const target = now + ms;
  for (;;) {
    const due = [...timers.entries()]
      .filter(([, timer]) => timer.at <= target)
      .sort((a, b) => a[1].at - b[1].at)[0];
    if (!due) break;
    timers.delete(due[0]);
    now = due[1].at;
    due[1].callback();
    await flush();
  }
  now = target;
  await flush();
}

const appStateListeners = new Set();
const appState = {
  currentState: 'active',
  addEventListener: (_event, listener) => {
    appStateListeners.add(listener);
    return { remove: () => appStateListeners.delete(listener) };
  },
};
function changeAppState(next) {
  appState.currentState = next;
  appStateListeners.forEach((listener) => listener(next));
}

const firebase = {
  user: { uid: 'firebase-user', phoneNumber: null },
  sends: [],
  links: [],
  updates: [],
  linkError: null,
  lastSentPhone: null,
};
const mocks = {
  'react-native': { Platform: { OS: 'ios' }, AppState: appState },
  '@react-native-firebase/auth': {
    getAuth: () => ({ currentUser: firebase.user }),
    verifyPhoneNumber: (_auth, phone, _timeout, forceResend) => {
      firebase.lastSentPhone = phone;
      return { on: (_event, observer) => firebase.sends.push({ phone, forceResend, observer }) };
    },
    PhoneAuthProvider: { credential: (verificationId, code) => ({ verificationId, code }) },
    // 실제 SDK처럼 사용자에 번호는 하나다. 이미 있으면 link는 실패하고 update로 교체한다.
    linkWithCredential: async (user, credential) => {
      firebase.links.push(credential);
      if (typeof firebase.linkError === 'function') throw firebase.linkError(user);
      if (firebase.linkError) throw firebase.linkError;
      if (user.phoneNumber) throw { code: 'auth/provider-already-linked' };
      user.phoneNumber = firebase.lastSentPhone;
    },
    updatePhoneNumber: async (user, credential) => {
      firebase.updates.push(credential);
      user.phoneNumber = firebase.lastSentPhone;
    },
  },
};

function load(file) {
  const path = resolve(root, file);
  if (modules.has(path)) return modules.get(path).exports;
  const module = { exports: {} };
  modules.set(path, module);
  const source = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const localRequire = (name) => {
    if (name in mocks) return mocks[name];
    if (name.startsWith('@/')) return load(`src/${name.slice(2)}.ts`);
    return require(name);
  };
  new Function('require', 'module', 'exports', source)(localRequire, module, module.exports);
  return module.exports;
}

const { createSignupFlow, decideSignupSteps, decideSignupRecovery } = load(
  'src/features/auth/signup-flow.ts',
);
const { createSignupPhoneVerification } = load('src/features/auth/signup-phone-verification.ts');
const { createSignupDraftStore } = load('src/features/auth/signup-draft-store.ts');
const { ApiError, TransportConnectionError } = load('src/lib/api/transport.ts');
const { AuthProtocolError } = load('src/features/auth/types.ts');

const session = { schemaVersion: 1, accessToken: 'member-access' };
const versions = { terms: 'term-v1', privacy: 'privacy-v1', qualityReview: 'qr-v1' };
function enrollment(overrides = {}) {
  return {
    origin: 'noSession',
    enrollmentId: 'enrollment-1',
    missingRequirements: ['PHONE_VERIFICATION', 'PROFILE', 'CONSENTS'],
    expiresAt: now + 600_000,
    ...overrides,
  };
}

function harness(options = {}) {
  const draftStore = createSignupDraftStore();
  const calls = { submit: [], exchange: 0, refresh: 0, policies: 0, completed: [], resets: [] };
  let verified = options.phoneVerified ?? true;
  const phone = {
    isVerified: () => verified,
    reset: (message) => {
      verified = false;
      calls.resets.push(message);
    },
    dispose: () => {},
  };
  const dependencies = {
    refreshProof: async () => {
      calls.refresh += 1;
      return {
        kind: 'proof-ready',
        uid: 'firebase-user',
        firebaseIdToken: `proof-${calls.refresh}`,
      };
    },
    exchange: async () => {
      calls.exchange += 1;
      return {
        kind: 'enrollment-required',
        enrollment: enrollment({ enrollmentId: `enrollment-${calls.exchange + 1}` }),
      };
    },
    submitSignup: async (request) => {
      calls.submit.push(request);
      return session;
    },
    loadPolicyVersions: async () => {
      calls.policies += 1;
      return versions;
    },
    ...options.dependencies,
  };
  const flow = createSignupFlow({
    enrollment: options.enrollment ?? enrollment(),
    uid: 'firebase-user',
    draftStore,
    phone,
    dependencies,
    onComplete: async (value) => {
      calls.completed.push(value);
    },
  });
  const state = () => flow.getState().state;
  async function fillUntilPhone() {
    draftStore.setNickname('  토스마스터  ');
    flow.completeNickname();
    await flush();
    draftStore.setConsent('terms', true);
    draftStore.setConsent('privacy', true);
    flow.completeConsents();
    await flush();
  }
  return {
    flow,
    draftStore,
    dependencies,
    calls,
    state,
    fillUntilPhone,
    setVerified: (v) => (verified = v),
  };
}

let passed = 0;
async function check(name, run) {
  await run();
  passed += 1;
  console.log(`PASS ${name}`);
}

await check('닉네임·약관은 항상, 전화 인증은 요구될 때만 단계에 포함', async () => {
  assert.deepEqual(decideSignupSteps(enrollment()), ['nickname', 'consents', 'phone']);
  assert.deepEqual(
    decideSignupSteps(enrollment({ missingRequirements: ['PROFILE', 'CONSENTS'] })),
    ['nickname', 'consents'],
  );
});

await check(
  '제출 실패 판단: 같은 자동 복구는 한 번만, 알 수 없는 code는 요청 실패 분류',
  async () => {
    const fresh = { proofRetried: false, restarted: false };
    const used = { proofRetried: true, restarted: true };
    const decide = (error, attempts = fresh) => {
      const decision = decideSignupRecovery(error, attempts);
      return decision.kind === 'fail' ? `fail:${decision.nextAction}` : decision.kind;
    };
    const coded = (status, code) => new ApiError(status, code, code);
    assert.equal(decide(coded(401, 'INVALID_FIREBASE_ID_TOKEN')), 'resubmit');
    assert.equal(decide(coded(401, 'INVALID_FIREBASE_ID_TOKEN'), used), 'fail:sign-in-again');
    assert.equal(decide(coded(409, 'FIREBASE_ENROLLMENT_CONFLICT')), 'restart-enrollment');
    assert.equal(decide(coded(409, 'FIREBASE_ENROLLMENT_RESTART_REQUIRED'), used), 'fail:retry');
    assert.equal(decide(coded(403, 'FIREBASE_PHONE_VERIFICATION_REQUIRED')), 'phone-required');
    assert.equal(decide(coded(401, 'FIREBASE_RECENT_AUTH_REQUIRED')), 'fail:sign-in-again');
    assert.equal(decide(coded(409, 'WITHDRAWAL_CLEANUP_PENDING')), 'fail:exit');
    assert.equal(decide(coded(400, 'UNKNOWN_VALIDATION')), 'fail:edit');
    assert.equal(decide(coded(404, 'NOT_FOUND')), 'fail:exit');
    assert.equal(decide(new TransportConnectionError()), 'fail:retry');
  },
);

await check(
  '닉네임 → 약관(진입 시 버전 조회) → 전화 순서, 필수 동의 없이는 진행 불가',
  async () => {
    const h = harness();
    assert.deepEqual(h.state(), { status: 'editing', step: 'nickname' });
    h.draftStore.setNickname('가');
    h.flow.completeNickname();
    assert.equal(h.state().step, 'nickname');
    h.draftStore.setNickname('가입자');
    h.flow.completeNickname();
    assert.deepEqual(h.state(), { status: 'editing', step: 'consents', policies: 'loading' });
    await flush();
    assert.equal(h.state().policies, 'ready');
    assert.equal(h.draftStore.getState().consents.terms.version, 'term-v1');
    h.draftStore.setConsent('terms', true);
    h.flow.completeConsents();
    assert.equal(h.state().step, 'consents');
    h.draftStore.setConsent('privacy', true);
    h.flow.completeConsents();
    assert.deepEqual(h.state(), { status: 'editing', step: 'phone' });
    h.flow.dispose();
  },
);

await check('뒤로 가기는 이전 단계, 약관 재진입 시 다시 조회, 첫 단계는 종료 확인', async () => {
  const h = harness();
  await h.fillUntilPhone();
  assert.equal(h.flow.goBack(), 'handled');
  assert.equal(h.state().step, 'consents');
  await flush();
  assert.equal(h.calls.policies, 2);
  // 같은 버전이면 기존 동의를 유지한다.
  assert.equal(h.draftStore.getState().consents.terms.agreed, true);
  h.flow.goBack();
  assert.equal(h.state().step, 'nickname');
  assert.equal(h.flow.goBack(), 'confirm-exit');
  h.flow.dispose();
});

await check(
  '약관 조회 실패는 5/10/20초 재시도 후 오류 화면, 포그라운드 복귀 시 재조회',
  async () => {
    let fail = true;
    const h = harness({
      dependencies: {
        loadPolicyVersions: async () => {
          if (fail) throw new TransportConnectionError();
          return versions;
        },
      },
    });
    h.draftStore.setNickname('가입자');
    h.flow.completeNickname();
    await flush();
    assert.equal(h.state().policies, 'loading');
    await advance(4_999);
    assert.equal(h.state().policies, 'loading');
    await advance(5_000 * 1.2 + 10_000 * 1.2 + 20_000 * 1.2);
    assert.equal(h.state().status, 'policyUnavailable');
    fail = false;
    changeAppState('background');
    changeAppState('active');
    await advance(0);
    assert.deepEqual(h.state(), { status: 'editing', step: 'consents', policies: 'ready' });
    h.flow.dispose();
  },
);

await check('재시도해도 소용없는 약관 응답 오류는 즉시 오류 화면, 이전 단계로 복귀', async () => {
  const h = harness({
    dependencies: {
      loadPolicyVersions: async () => {
        throw new AuthProtocolError();
      },
    },
  });
  h.draftStore.setNickname('가입자');
  h.flow.completeNickname();
  await flush();
  assert.equal(h.state().status, 'policyUnavailable');
  assert.equal(timers.size, 0);
  h.flow.goBack();
  assert.equal(h.state().step, 'nickname');
  h.flow.dispose();
});

await check('전화 인증 후 제출: 강제 갱신 증명·다듬은 닉네임·동의 버전으로 signup', async () => {
  const h = harness();
  await h.fillUntilPhone();
  h.flow.completePhoneVerification();
  await flush();
  // 품질 검토는 선택 동의라 동의하지 않아도 false와 version을 보낸다.
  assert.deepEqual(h.calls.submit, [
    {
      enrollmentId: 'enrollment-1',
      firebaseIdToken: 'proof-1',
      nickname: '토스마스터',
      privacyConsentVersion: 'privacy-v1',
      termConsentVersion: 'term-v1',
      isQualityReviewConsented: false,
      qualityReviewConsentVersion: 'qr-v1',
    },
  ]);
  assert.deepEqual(h.calls.completed, [session]);
  h.flow.dispose();
});

await check(
  '전화 인증이 요구되지 않으면 약관 다음 바로 제출, 미인증이면 전화 단계 유지',
  async () => {
    const h = harness({ enrollment: enrollment({ missingRequirements: ['PROFILE', 'CONSENTS'] }) });
    await h.fillUntilPhone();
    assert.equal(h.calls.submit.length, 1);
    h.flow.dispose();

    const unverified = harness({ phoneVerified: false });
    await unverified.fillUntilPhone();
    unverified.flow.completePhoneVerification();
    assert.equal(unverified.state().step, 'phone');
    unverified.flow.dispose();
  },
);

await check(
  'INVALID_FIREBASE_ID_TOKEN은 한 번만 갱신 후 재제출, 두 번째는 SNS 재로그인',
  async () => {
    let failures = 1;
    const invalid = () => new ApiError(401, 'invalid', 'INVALID_FIREBASE_ID_TOKEN');
    const h = harness({
      dependencies: {
        submitSignup: async (request) => {
          h.calls.submit.push(request);
          if (failures-- > 0) throw invalid();
          return session;
        },
      },
    });
    await h.fillUntilPhone();
    h.flow.completePhoneVerification();
    await flush();
    assert.deepEqual(
      h.calls.submit.map((request) => request.firebaseIdToken),
      ['proof-1', 'proof-2'],
    );
    assert.deepEqual(h.calls.completed, [session]);
    h.flow.dispose();

    failures = 2;
    const twice = harness({
      dependencies: {
        submitSignup: async () => {
          if (failures-- > 0) throw invalid();
          return session;
        },
      },
    });
    await twice.fillUntilPhone();
    twice.flow.completePhoneVerification();
    await flush();
    assert.equal(twice.state().nextAction, 'sign-in-again');
    twice.flow.dispose();
  },
);

await check(
  'enrollment 충돌·만료는 같은 ID 대신 exchange로 새 ID를 받아 입력을 유지한 채 제출',
  async () => {
    let conflicted = false;
    const h = harness({
      dependencies: {
        submitSignup: async (request) => {
          h.calls.submit.push(request);
          if (!conflicted) {
            conflicted = true;
            throw new ApiError(409, 'conflict', 'FIREBASE_ENROLLMENT_CONFLICT');
          }
          return session;
        },
      },
    });
    await h.fillUntilPhone();
    h.flow.completePhoneVerification();
    await flush();
    assert.deepEqual(
      h.calls.submit.map((request) => request.enrollmentId),
      ['enrollment-1', 'enrollment-2'],
    );
    assert.equal(h.calls.submit[1].nickname, '토스마스터');
    h.flow.dispose();

    const expired = harness({ enrollment: enrollment({ expiresAt: now + 1_000 }) });
    await expired.fillUntilPhone();
    await advance(1_000);
    expired.flow.completePhoneVerification();
    await flush();
    assert.equal(expired.calls.exchange, 1);
    assert.deepEqual(
      expired.calls.submit.map((request) => request.enrollmentId),
      ['enrollment-2'],
    );
    expired.flow.dispose();
  },
);

await check(
  '재시작 exchange가 AUTHENTICATED면(응답 유실된 이전 가입) 그 세션으로 완료',
  async () => {
    const member = { ...session, accessToken: 'already-member' };
    const h = harness({
      enrollment: enrollment({ expiresAt: now }),
      dependencies: { exchange: async () => ({ kind: 'authenticated', session: member }) },
    });
    await h.fillUntilPhone();
    h.flow.completePhoneVerification();
    await flush();
    assert.equal(h.calls.submit.length, 0);
    assert.deepEqual(h.calls.completed, [member]);
    h.flow.dispose();
  },
);

await check('서버가 전화 인증을 요구하면 인증을 초기화하고 전화 단계로', async () => {
  const h = harness({
    enrollment: enrollment({ missingRequirements: ['PROFILE', 'CONSENTS'] }),
    dependencies: {
      submitSignup: async () => {
        throw new ApiError(403, 'phone', 'FIREBASE_PHONE_VERIFICATION_REQUIRED');
      },
    },
  });
  await h.fillUntilPhone();
  assert.deepEqual(h.state(), { status: 'editing', step: 'phone' });
  assert.deepEqual(h.flow.getSteps(), ['nickname', 'consents', 'phone']);
  assert.equal(h.calls.resets.length, 1);
  h.flow.dispose();
});

await check('오류 code별 다음 행동: 재인증·탈퇴 정리 중·입력 오류·일시 장애', async () => {
  const cases = [
    [new ApiError(401, 'recent', 'FIREBASE_RECENT_AUTH_REQUIRED'), 'sign-in-again'],
    [new ApiError(409, 'pending', 'WITHDRAWAL_CLEANUP_PENDING'), 'exit'],
    [new ApiError(400, 'bad nickname', 'SOME_VALIDATION'), 'edit'],
    [new ApiError(422, 'bad version'), 'edit'],
    // 입력과 무관한 4xx는 정보 수정으로 보내지 않는다.
    [new ApiError(404, 'not found'), 'exit'],
    [new ApiError(401, 'unknown auth'), 'exit'],
    [new ApiError(503, 'down'), 'retry'],
    [new TransportConnectionError(), 'retry'],
  ];
  for (const [error, nextAction] of cases) {
    const h = harness({
      dependencies: {
        submitSignup: async () => {
          throw error;
        },
      },
    });
    await h.fillUntilPhone();
    h.flow.completePhoneVerification();
    await flush();
    assert.equal(h.state().status, 'failed');
    assert.equal(h.state().nextAction, nextAction, error.code ?? error.name);
    h.flow.dispose();
  }
});

await check(
  '재시도는 같은 단계에서 다시 제출, 입력 오류는 첫 단계로, 이전 단계는 실패 단계로',
  async () => {
    let fail = true;
    const h = harness({
      dependencies: {
        submitSignup: async (request) => {
          h.calls.submit.push(request);
          if (fail) throw new ApiError(503, 'down');
          return session;
        },
      },
    });
    await h.fillUntilPhone();
    h.flow.completePhoneVerification();
    await flush();
    h.flow.goBack();
    assert.equal(h.state().step, 'phone');
    h.flow.completePhoneVerification();
    await flush();
    fail = false;
    h.flow.retrySubmit();
    await flush();
    assert.deepEqual(h.calls.completed, [session]);
    h.flow.dispose();

    const edit = harness({
      dependencies: {
        submitSignup: async () => {
          throw new ApiError(400, 'bad');
        },
      },
    });
    await edit.fillUntilPhone();
    edit.flow.completePhoneVerification();
    await flush();
    edit.flow.retrySubmit();
    assert.equal(edit.state().step, 'nickname');
    edit.flow.dispose();
  },
);

await check('세션 활성화 실패는 가입 실패로 분류하지 않고 재제출 없이 재로그인 안내', async () => {
  for (const path of ['submit', 'restart']) {
    const member = { ...session, accessToken: `member-${path}` };
    const h = harness({
      enrollment: path === 'restart' ? enrollment({ expiresAt: now }) : enrollment(),
      dependencies:
        path === 'restart'
          ? { exchange: async () => ({ kind: 'authenticated', session: member }) }
          : {},
    });
    const flow = createSignupFlow({
      enrollment: path === 'restart' ? enrollment({ expiresAt: now }) : enrollment(),
      uid: 'firebase-user',
      draftStore: h.draftStore,
      phone: { isVerified: () => true, reset: () => {}, dispose: () => {} },
      dependencies: h.dependencies,
      onComplete: async () => {
        throw new Error('activation');
      },
    });
    h.flow.dispose();
    h.draftStore.setNickname('가입자');
    flow.completeNickname();
    await flush();
    h.draftStore.setConsent('terms', true);
    h.draftStore.setConsent('privacy', true);
    flow.completeConsents();
    await flush();
    flow.completePhoneVerification();
    await flush();
    assert.equal(flow.getState().state.status, 'failed', path);
    assert.equal(flow.getState().state.nextAction, 'sign-in-again', path);
    assert.match(flow.getState().state.message, /가입은 완료됐어요/);
    assert.equal(h.calls.submit.length, path === 'submit' ? 1 : 0, path);
    flow.dispose();
  }
});

await check(
  '증명 갱신 실패는 SNS 재로그인, dispose 후 늦은 성공은 완료로 전달하지 않음',
  async () => {
    const h = harness({
      dependencies: {
        refreshProof: async () => ({
          kind: 'failed',
          reason: 'reauthentication-required',
          nextAction: 'sign-in-again',
        }),
      },
    });
    await h.fillUntilPhone();
    h.flow.completePhoneVerification();
    await flush();
    assert.equal(h.state().nextAction, 'sign-in-again');
    h.flow.dispose();

    let finish;
    const late = harness({
      dependencies: {
        submitSignup: () =>
          new Promise((resolveSubmit) => {
            finish = () => resolveSubmit(session);
          }),
      },
    });
    await late.fillUntilPhone();
    late.flow.completePhoneVerification();
    await flush();
    assert.equal(late.state().status, 'submitting');
    late.flow.dispose();
    finish();
    await flush();
    assert.deepEqual(late.calls.completed, []);
  },
);

function phoneHarness() {
  firebase.user = { uid: 'firebase-user', phoneNumber: null };
  firebase.sends = [];
  firebase.links = [];
  firebase.updates = [];
  firebase.linkError = null;
  firebase.lastSentPhone = null;
  timers.clear();
  const draftStore = createSignupDraftStore();
  let reauth = 0;
  const phone = createSignupPhoneVerification({
    uid: 'firebase-user',
    draftStore,
    onReauthRequired: () => {
      reauth += 1;
    },
  });
  return { phone, draftStore, reauth: () => reauth, stage: () => phone.getState().stage };
}

await check('전화 인증: 입력 번호로 발송 → 코드 → 같은 사용자에 link → 완료 유지', async () => {
  const h = phoneHarness();
  h.phone.requestCode();
  assert.equal(h.phone.getState().error, '휴대전화 번호를 확인해 주세요.');
  h.draftStore.setPhone('01012345678');
  h.phone.requestCode();
  assert.equal(firebase.sends[0].phone, '+821012345678');
  assert.equal(firebase.sends[0].forceResend, false);
  firebase.sends[0].observer({ state: 'sent', verificationId: 'verification-1' });
  assert.deepEqual(h.stage(), { status: 'code', verificationId: 'verification-1' });
  h.phone.setCode('12a3456');
  await h.phone.verifyCode();
  assert.deepEqual(firebase.links, [{ verificationId: 'verification-1', code: '123456' }]);
  assert.equal(h.phone.isVerified(), true);
  // 번호를 바꾸면 이전 인증을 버린다.
  h.draftStore.setPhone('01098765432');
  assert.equal(h.phone.isVerified(), false);
  h.phone.dispose();
});

await check('전화 인증: 재전송 대기·다른 계정 번호·이미 연결된 번호·사용자 변경', async () => {
  const h = phoneHarness();
  h.draftStore.setPhone('01012345678');
  h.phone.requestCode();
  firebase.sends[0].observer({ state: 'sent', verificationId: 'verification-1' });
  h.phone.requestCode();
  assert.match(h.phone.getState().error, /초 후에/);
  assert.equal(firebase.sends.length, 1);
  await advance(15_000);
  h.phone.requestCode();
  assert.equal(firebase.sends.length, 2);
  assert.equal(firebase.sends[1].forceResend, true);
  firebase.sends[1].observer({ state: 'sent', verificationId: 'verification-2' });
  // 이전 발송 응답은 무시한다.
  firebase.sends[0].observer({ state: 'sent', verificationId: 'stale' });
  assert.equal(h.stage().verificationId, 'verification-2');
  firebase.linkError = { code: 'auth/credential-already-in-use' };
  h.phone.setCode('123456');
  await h.phone.verifyCode();
  assert.deepEqual(h.stage(), { status: 'idle' });
  assert.equal(h.phone.getState().error, '다른 계정에 연결된 번호예요. 다른 번호로 인증해 주세요.');
  h.phone.dispose();

  const linked = phoneHarness();
  firebase.user.phoneNumber = '+821012345678';
  linked.draftStore.setPhone('01012345678');
  linked.phone.requestCode();
  assert.equal(firebase.sends.length, 0);
  assert.equal(linked.phone.isVerified(), true);
  linked.phone.dispose();

  const switched = phoneHarness();
  switched.draftStore.setPhone('01012345678');
  firebase.user = { uid: 'other-user', phoneNumber: null };
  switched.phone.requestCode();
  assert.equal(switched.reauth(), 1);
  switched.phone.dispose();
});

await check(
  '전화 인증: 인증 후 번호를 고치면 새 번호로 교체, 남은 다른 번호는 완료로 보지 않음',
  async () => {
    const h = phoneHarness();
    h.draftStore.setPhone('01012345678');
    h.phone.requestCode();
    firebase.sends[0].observer({ state: 'sent', verificationId: 'verification-a' });
    h.phone.setCode('111111');
    await h.phone.verifyCode();
    assert.equal(firebase.user.phoneNumber, '+821012345678');

    h.draftStore.setPhone('01098765432');
    assert.equal(h.phone.isVerified(), false);
    await advance(15_000);
    h.phone.requestCode();
    assert.equal(firebase.sends[1].phone, '+821098765432');
    firebase.sends[1].observer({ state: 'sent', verificationId: 'verification-b' });
    h.phone.setCode('222222');
    await h.phone.verifyCode();
    assert.deepEqual(firebase.updates, [{ verificationId: 'verification-b', code: '222222' }]);
    assert.equal(firebase.user.phoneNumber, '+821098765432');
    assert.equal(h.phone.isVerified(), true);
    h.phone.dispose();

    // link 시점에 다른 번호가 이미 연결돼 있으면(경합) 완료로 넘기지 않는다.
    const raced = phoneHarness();
    raced.draftStore.setPhone('01098765432');
    raced.phone.requestCode();
    firebase.sends[0].observer({ state: 'sent', verificationId: 'verification-c' });
    // 확인을 시작할 땐 번호가 없었지만 link 도중 다른 번호가 연결된 경우.
    firebase.linkError = (user) => {
      user.phoneNumber = '+821012345678';
      return { code: 'auth/provider-already-linked' };
    };
    raced.phone.setCode('333333');
    await raced.phone.verifyCode();
    assert.deepEqual(raced.stage(), { status: 'idle' });
    assert.equal(raced.phone.isVerified(), false);
    raced.phone.dispose();
  },
);

assert.equal(appStateListeners.size, 0);

// ---- Guest 승격: 같은 화면 상태를 쓰고, 결과를 모르면 exchange + Guest 토큰 prepare로 판별한다 ----
const { createGuestUpgradeFlow, decideGuestUpgradeRecovery, isUpgradeOutcomeUnknown } = load(
  'src/features/auth/guest-upgrade-flow.ts',
);

function guestEnrollment(overrides = {}) {
  return {
    origin: 'guest',
    enrollmentId: 'enrollment-g1',
    missingRequirements: ['PROFILE', 'CONSENTS'],
    expiresAt: now + 600_000,
    privacyConsentVersion: 'privacy-v1',
    termConsentVersion: 'term-v1',
    ...overrides,
  };
}

function guestHarness(options = {}) {
  const draftStore = createSignupDraftStore();
  const calls = {
    submit: [],
    prepare: [],
    exchange: 0,
    refresh: 0,
    completed: [],
    merged: 0,
  };
  const phone = { isVerified: () => true, reset: () => {}, dispose: () => {} };
  const dependencies = {
    refreshProof: async () => {
      calls.refresh += 1;
      return {
        kind: 'proof-ready',
        uid: 'firebase-user',
        firebaseIdToken: `proof-${calls.refresh}`,
      };
    },
    prepareRequest: async () => ({ accessToken: 'guest-access', generation: 1 }),
    prepare: async (proof, guestToken) => {
      calls.prepare.push({ proof, guestToken });
      return {
        kind: 'enrollment-required',
        enrollment: guestEnrollment({ enrollmentId: 'enrollment-g2' }),
      };
    },
    exchange: async () => {
      calls.exchange += 1;
      return { kind: 'authenticated', session: { accessToken: 'exchanged-member' } };
    },
    submitUpgrade: async (request, guestToken) => {
      calls.submit.push({ request, guestToken });
      return session;
    },
    // 공개 API도 필수 약관 version을 주지만 승격은 prepare 값을 써야 한다.
    loadPolicyVersions: async () => ({
      terms: 'public-term',
      privacy: 'public-privacy',
      qualityReview: 'qr-v1',
    }),
    ...options.dependencies,
  };
  const flow = createGuestUpgradeFlow({
    enrollment: options.enrollment ?? guestEnrollment(),
    uid: 'firebase-user',
    draftStore,
    phone,
    dependencies,
    onComplete: async (value) => {
      calls.completed.push(value);
    },
    onMergeRequired: () => {
      calls.merged += 1;
    },
  });
  async function fillAndSubmit({ qualityReview = true } = {}) {
    draftStore.setNickname('게스트');
    flow.completeNickname();
    await flush();
    draftStore.setConsent('terms', true);
    draftStore.setConsent('privacy', true);
    draftStore.setConsent('qualityReview', qualityReview);
    flow.completeConsents();
    await flush();
  }
  return { flow, draftStore, calls, state: () => flow.getState().state, fillAndSubmit };
}

/** 첫 upgrade만 실패시키고 다음 제출은 성공한다. */
function failFirstSubmit(error, calls) {
  return async (request, guestToken) => {
    calls().submit.push({ request, guestToken });
    if (calls().submit.length === 1) throw error;
    return session;
  };
}

await check(
  '승격 판단: 결과 불명은 code 없는 5xx·연결 오류, 판별은 제출 한 번에 한 번',
  async () => {
    const fresh = { proofRetried: false, restarted: false, reconciled: false };
    const used = { proofRetried: true, restarted: true, reconciled: true };
    const decide = (error, attempts = fresh) => decideGuestUpgradeRecovery(error, attempts).kind;
    assert.equal(isUpgradeOutcomeUnknown(new TransportConnectionError()), true);
    assert.equal(isUpgradeOutcomeUnknown(new ApiError(502, 'bad gateway')), true);
    assert.equal(isUpgradeOutcomeUnknown(new ApiError(500, 'x', 'COMMON500')), true);
    assert.equal(isUpgradeOutcomeUnknown(new ApiError(503, 'x', 'FIREBASE_UNAVAILABLE')), false);
    assert.equal(
      isUpgradeOutcomeUnknown(new ApiError(503, 'x', 'SESSION_SECURITY_UNAVAILABLE')),
      false,
    );
    assert.equal(isUpgradeOutcomeUnknown(new ApiError(400, 'x')), false);
    assert.equal(decide(new TransportConnectionError()), 'reconcile');
    assert.equal(decide(new TransportConnectionError(), used), 'fail');
    assert.equal(decide(new ApiError(403, 'x', 'GUEST_UPGRADE_NOT_ALLOWED')), 'reconcile');
    assert.equal(decide(new ApiError(409, 'x', 'MERGE_REQUIRED')), 'merge-required');
    assert.equal(
      decide(new ApiError(409, 'x', 'FIREBASE_ENROLLMENT_CONFLICT')),
      'restart-enrollment',
    );
    assert.equal(decide(new ApiError(409, 'x', 'IDENTITY_STATE_CONFLICT')), 'fail');
    assert.equal(decide(new ApiError(503, 'x', 'FIREBASE_UNAVAILABLE')), 'fail');
  },
);

await check(
  '승격 제출: 필수 약관은 prepare 버전, 품질 검토는 공개 API 버전, Guest 토큰으로 upgrade',
  async () => {
    const h = guestHarness();
    await h.fillAndSubmit();
    assert.deepEqual(h.calls.submit, [
      {
        request: {
          enrollmentId: 'enrollment-g1',
          firebaseIdToken: 'proof-1',
          nickname: '게스트',
          privacyConsentVersion: 'privacy-v1',
          termConsentVersion: 'term-v1',
          isQualityReviewConsented: true,
          qualityReviewConsentVersion: 'qr-v1',
        },
        guestToken: 'guest-access',
      },
    ]);
    assert.deepEqual(h.calls.completed, [session]);
    assert.equal(h.calls.exchange, 0);
    h.flow.dispose();
  },
);

await check(
  '결과 불명 → exchange AUTHENTICATED → Guest 토큰 prepare가 GUEST_UPGRADE_NOT_ALLOWED면 승격 성공',
  async () => {
    let h;
    h = guestHarness({
      dependencies: {
        submitUpgrade: failFirstSubmit(new TransportConnectionError(), () => h.calls),
        prepare: async (proof, guestToken) => {
          h.calls.prepare.push({ proof, guestToken });
          throw new ApiError(403, 'not guest', 'GUEST_UPGRADE_NOT_ALLOWED');
        },
      },
    });
    await h.fillAndSubmit();
    assert.equal(h.calls.submit.length, 1);
    assert.equal(h.calls.exchange, 1);
    // 판별에는 승격 요청에 썼던 Guest 토큰을 쓴다.
    assert.deepEqual(h.calls.prepare, [{ proof: 'proof-2', guestToken: 'guest-access' }]);
    assert.deepEqual(h.calls.completed, [{ accessToken: 'exchanged-member' }]);
    h.flow.dispose();
  },
);

await check(
  '결과 불명 → exchange AUTHENTICATED → prepare MERGE_REQUIRED면 다른 MEMBER 소유: 병합으로 넘김',
  async () => {
    for (const prepare of [
      async () => ({ kind: 'merge-required' }),
      async () => {
        throw new ApiError(409, 'merge', 'MERGE_REQUIRED');
      },
    ]) {
      let h;
      h = guestHarness({
        dependencies: {
          submitUpgrade: failFirstSubmit(new ApiError(500, 'oops'), () => h.calls),
          prepare,
        },
      });
      await h.fillAndSubmit();
      assert.equal(h.calls.merged, 1);
      assert.deepEqual(h.calls.completed, []);
      h.flow.dispose();
    }
  },
);

await check(
  '결과 불명 → exchange ENROLLMENT_REQUIRED면 승격 안 됨: direct signup이 아니라 prepare로 새 enrollment',
  async () => {
    let h;
    h = guestHarness({
      dependencies: {
        submitUpgrade: failFirstSubmit(new TransportConnectionError(), () => h.calls),
        exchange: async () => {
          h.calls.exchange += 1;
          return { kind: 'enrollment-required', enrollment: enrollment() };
        },
      },
    });
    await h.fillAndSubmit();
    assert.equal(h.calls.exchange, 1);
    assert.equal(h.calls.prepare.length, 1);
    assert.deepEqual(
      h.calls.submit.map((call) => call.request.enrollmentId),
      ['enrollment-g1', 'enrollment-g2'],
    );
    assert.deepEqual(h.calls.completed, [session]);
    h.flow.dispose();
  },
);

await check(
  '판별은 한 번: 다시 결과를 모르면 수동 재시도 실패, code 있는 503은 판별하지 않음',
  async () => {
    const h = guestHarness({
      dependencies: {
        submitUpgrade: async () => {
          throw new TransportConnectionError();
        },
        prepare: async () => ({
          kind: 'enrollment-required',
          enrollment: guestEnrollment({ enrollmentId: 'enrollment-g2' }),
        }),
      },
    });
    await h.fillAndSubmit();
    assert.equal(h.calls.exchange, 1);
    assert.equal(h.state().status, 'failed');
    assert.equal(h.state().nextAction, 'retry');
    h.flow.dispose();

    const unavailable = guestHarness({
      dependencies: {
        submitUpgrade: async () => {
          throw new ApiError(503, 'down', 'FIREBASE_UNAVAILABLE');
        },
      },
    });
    await unavailable.fillAndSubmit();
    assert.equal(unavailable.calls.exchange, 0);
    assert.equal(unavailable.state().nextAction, 'retry');
    unavailable.flow.dispose();
  },
);

await check(
  'enrollment 충돌은 prepare로 재시작, 필수 약관 버전이 바뀌면 동의를 다시 받음',
  async () => {
    let h;
    h = guestHarness({
      dependencies: {
        submitUpgrade: failFirstSubmit(
          new ApiError(409, 'x', 'FIREBASE_ENROLLMENT_CONFLICT'),
          () => h.calls,
        ),
        prepare: async (proof, guestToken) => {
          h.calls.prepare.push({ proof, guestToken });
          return {
            kind: 'enrollment-required',
            enrollment: guestEnrollment({
              enrollmentId: 'enrollment-g2',
              privacyConsentVersion: 'privacy-v2',
            }),
          };
        },
      },
    });
    await h.fillAndSubmit();
    assert.equal(h.calls.exchange, 0);
    assert.equal(h.calls.prepare.length, 1);
    assert.equal(h.calls.submit.length, 1);
    assert.equal(h.state().step, 'consents');
    assert.equal(h.draftStore.getState().consents.privacy.version, 'privacy-v2');
    assert.equal(h.draftStore.getState().consents.privacy.agreed, false);
    // 품질 검토 동의는 버전이 같아 유지된다.
    assert.equal(h.draftStore.getState().consents.qualityReview.agreed, true);
    h.flow.dispose();
  },
);

const { createGuestMergeFlow, decideGuestMergeRecovery, isMergeOutcomeUnknown } = load(
  'src/features/auth/guest-merge-flow.ts',
);

function mergeHarness(options = {}) {
  const calls = { merge: [], prepare: [], exchange: 0, refresh: 0, completed: [], enrollments: [] };
  let conflictSeen = options.conflictSeen ?? false;
  const dependencies = {
    refreshProof: async () => {
      calls.refresh += 1;
      return {
        kind: 'proof-ready',
        uid: 'firebase-user',
        firebaseIdToken: `proof-${calls.refresh}`,
      };
    },
    prepareRequest: async () => ({ accessToken: 'guest-access', generation: 1 }),
    prepare: async (proof, guestToken) => {
      calls.prepare.push({ proof, guestToken });
      return { kind: 'merge-required' };
    },
    exchange: async () => {
      calls.exchange += 1;
      return { kind: 'authenticated', session: { accessToken: 'exchanged-member' } };
    },
    submitMerge: async (proof, guestToken) => {
      calls.merge.push({ proof, guestToken });
      return { session, mergeId: 'merge-1' };
    },
    targetConflicts: {
      hasSeen: () => conflictSeen,
      record: () => {
        conflictSeen = true;
      },
    },
    ...options.dependencies,
  };
  const flow = createGuestMergeFlow({
    uid: 'firebase-user',
    dependencies,
    onComplete: async (value) => {
      calls.completed.push(value);
    },
    onEnrollmentRequired: (value) => {
      calls.enrollments.push(value);
    },
  });
  async function confirm() {
    flow.confirm();
    await flush();
  }
  return { flow, calls, state: () => flow.getState().state, confirm };
}

/** 앞의 merge만 실패시키고 이후는 성공한다. */
function failMerges(errors, calls) {
  return async (proof, guestToken) => {
    calls().merge.push({ proof, guestToken });
    const error = errors[calls().merge.length - 1];
    if (error) throw error;
    return { session, mergeId: 'merge-1' };
  };
}

await check('병합 판단: 결과 불명·판별 1회·대상 상태별 행동', async () => {
  const fresh = { proofRetried: false, reconciled: false };
  const used = { proofRetried: true, reconciled: true };
  const decide = (error, attempts = fresh) => decideGuestMergeRecovery(error, attempts);
  assert.equal(isMergeOutcomeUnknown(new TransportConnectionError()), true);
  assert.equal(isMergeOutcomeUnknown(new ApiError(500, 'x', 'INTERNAL_SERVER_ERROR')), true);
  assert.equal(isMergeOutcomeUnknown(new ApiError(409, 'x', 'GUEST_MERGE_CONFLICT')), true);
  assert.equal(isMergeOutcomeUnknown(new ApiError(503, 'x', 'FIREBASE_UNAVAILABLE')), false);
  assert.equal(decide(new TransportConnectionError()).kind, 'reconcile');
  assert.equal(decide(new TransportConnectionError(), used).kind, 'outcome-unknown');
  assert.equal(decide(new ApiError(401, 'x', 'INVALID_FIREBASE_ID_TOKEN')).kind, 'resubmit');
  assert.equal(decide(new ApiError(401, 'x', 'INVALID_FIREBASE_ID_TOKEN'), used).kind, 'fail');
  for (const code of ['ACCOUNT_MERGED_TOKEN_REJECTED', 'GUEST_MERGE_NOT_ALLOWED', 'USER_NOT_FOUND'])
    assert.equal(decide(new ApiError(403, 'x', code)).kind, 'exchange');
  const withdrawn = decide(new ApiError(403, 'x', 'GUEST_MERGE_TARGET_WITHDRAWN'));
  assert.equal(withdrawn.notice.nextAction, 'continue-signup');
  const suspended = decide(new ApiError(403, 'x', 'GUEST_MERGE_TARGET_NOT_ACTIVE'));
  assert.equal(suspended.notice.nextAction, 'get-help');
  assert.equal(
    decide(new ApiError(409, 'x', 'GUEST_MERGE_TARGET_CONFLICT')).kind,
    'target-conflict',
  );
});

await check('병합 제출: 확인 전에는 보내지 않고, 갱신한 증명과 Guest 토큰으로 merge', async () => {
  const h = mergeHarness();
  assert.equal(h.state().status, 'confirming');
  assert.deepEqual(h.calls.merge, []);
  await h.confirm();
  assert.deepEqual(h.calls.merge, [{ proof: 'proof-1', guestToken: 'guest-access' }]);
  assert.deepEqual(h.calls.completed, [{ session, mergeId: 'merge-1' }]);
  h.flow.dispose();
});

await check(
  '병합 결과 불명 → Guest 토큰 prepare가 403이면 병합됨: exchange, mergeId 없음',
  async () => {
    for (const rejected of [
      new ApiError(403, 'x', 'GUEST_UPGRADE_NOT_ALLOWED'),
      new ApiError(401, 'x', 'ACCOUNT_MERGED_TOKEN_REJECTED'),
    ]) {
      let h;
      h = mergeHarness({
        dependencies: {
          submitMerge: failMerges([new TransportConnectionError()], () => h.calls),
          prepare: async (proof, guestToken) => {
            h.calls.prepare.push({ proof, guestToken });
            throw rejected;
          },
        },
      });
      await h.confirm();
      assert.equal(h.calls.merge.length, 1);
      assert.deepEqual(h.calls.prepare, [{ proof: 'proof-2', guestToken: 'guest-access' }]);
      assert.equal(h.calls.exchange, 1);
      assert.deepEqual(h.calls.completed, [
        { session: { accessToken: 'exchanged-member' }, mergeId: null },
      ]);
      h.flow.dispose();
    }
  },
);

await check('병합 결과 불명 → prepare MERGE_REQUIRED면 확인 없이 merge를 다시 보냄', async () => {
  let h;
  h = mergeHarness({
    dependencies: { submitMerge: failMerges([new ApiError(500, 'oops')], () => h.calls) },
  });
  await h.confirm();
  assert.equal(h.calls.merge.length, 2);
  assert.equal(h.calls.exchange, 0);
  assert.deepEqual(h.calls.completed, [{ session, mergeId: 'merge-1' }]);
  h.flow.dispose();
});

await check('병합 판별은 제출당 한 번: 두 번째 실패부터 도움 요청을 함께 보임', async () => {
  let h;
  const unknown = () => new ApiError(409, 'x', 'GUEST_MERGE_CONFLICT');
  h = mergeHarness({
    dependencies: {
      submitMerge: failMerges([unknown(), unknown(), unknown(), unknown()], () => h.calls),
    },
  });
  await h.confirm();
  assert.equal(h.calls.merge.length, 2);
  assert.equal(h.state().nextAction, 'retry');
  h.flow.retry();
  await flush();
  assert.equal(h.calls.merge.length, 4);
  assert.equal(h.state().nextAction, 'retry-or-help');
  h.flow.dispose();
});

await check('대상 충돌은 다시 로그인을 한 번 허용한 뒤 도움 요청', async () => {
  const conflict = async () => {
    throw new ApiError(409, 'x', 'GUEST_MERGE_TARGET_CONFLICT');
  };
  const first = mergeHarness({ dependencies: { submitMerge: conflict } });
  await first.confirm();
  assert.equal(first.state().nextAction, 'sign-in-again');
  first.flow.dispose();
  const second = mergeHarness({ conflictSeen: true, dependencies: { submitMerge: conflict } });
  await second.confirm();
  assert.equal(second.state().nextAction, 'get-help');
  second.flow.dispose();
});

await check('대상 탈퇴 → 가입 이어가기는 prepare의 새 enrollment로 승격 흐름에 넘김', async () => {
  let h;
  h = mergeHarness({
    dependencies: {
      submitMerge: async () => {
        throw new ApiError(403, 'x', 'GUEST_MERGE_TARGET_WITHDRAWN');
      },
      prepare: async (proof, guestToken) => {
        h.calls.prepare.push({ proof, guestToken });
        return { kind: 'enrollment-required', enrollment: guestEnrollment() };
      },
    },
  });
  await h.confirm();
  assert.equal(h.state().nextAction, 'continue-signup');
  h.flow.retry();
  await flush();
  assert.deepEqual(h.calls.enrollments, [guestEnrollment()]);
  h.flow.dispose();
});

console.log(`가입·승격 흐름 검사 ${passed}개 통과`);
