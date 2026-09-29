// 실제 controller·adapter를 실행하고 native SDK 경계만 대체한다.
// 실행: node scripts/check-firebase-auth.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cache = new Map();
const platform = { OS: "ios" };
let nativeUser = { uid: "a" };
let providerResult;
let googleResult;
let appleResult;
const nativeCalls = [];
const googleCalls = [];
const mocks = {
  "react-native": { Platform: platform },
  "@react-native-firebase/auth": {
    getAuth: () => ({ currentUser: nativeUser }),
    getIdToken: async (user, force) => `${user.uid}:${force}`,
    GoogleAuthProvider: {
      credential: (token) => ({ providerId: "google.com", token }),
    },
    OAuthProvider: class {
      constructor(id) {
        this.PROVIDER_ID = id;
        this.scopes = [];
      }
      addScope(scope) {
        this.scopes.push(scope);
      }
      toObject() {
        return {
          providerId: this.PROVIDER_ID,
          scopes: this.scopes,
          customParameters: {},
        };
      }
      credential(data) {
        return { providerId: this.PROVIDER_ID, ...data };
      }
    },
    signInWithCredential: async (_auth, credential) => {
      nativeCalls.push(credential);
      return providerResult();
    },
    signInWithPopup: async (_auth, provider) => {
      // 26.4.0의 modular wrapper와 native bridge가 각각 사용하는 두 값 검증.
      assert.equal(provider.providerId, provider.toObject().providerId);
      nativeCalls.push(provider.toObject());
      return providerResult();
    },
  },
  "@react-native-google-signin/google-signin": {
    GoogleSignin: {
      configure: (config) => googleCalls.push(config),
      hasPlayServices: async () => true,
      signIn: () => googleResult(),
    },
    isCancelledResponse: (response) => response.type === "cancelled",
    statusCodes: {
      SIGN_IN_CANCELLED: "SIGN_IN_CANCELLED",
      IN_PROGRESS: "IN_PROGRESS",
      PLAY_SERVICES_NOT_AVAILABLE: "PLAY_SERVICES_NOT_AVAILABLE",
      SIGN_IN_REQUIRED: "SIGN_IN_REQUIRED",
    },
  },
  "expo-apple-authentication": {
    isAvailableAsync: async () => true,
    AppleAuthenticationScope: { EMAIL: 0 },
    signInAsync: (options) => appleResult(options),
  },
  "expo-crypto": {
    randomUUID: () => "random-raw-nonce",
    CryptoDigestAlgorithm: { SHA256: "SHA-256" },
    digestStringAsync: async (algorithm, raw) => {
      assert.equal(algorithm, "SHA-256");
      return `hashed:${raw}`;
    },
  },
};
function load(file) {
  const path = resolve(root, file);
  if (cache.has(path)) return cache.get(path).exports;
  const module = { exports: {} };
  cache.set(path, module);
  const source = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  new Function("require", "module", "exports", source)(
    (name) => {
      if (name in mocks) return mocks[name];
      if (name.startsWith("@/")) return load(`src/${name.slice(2)}.ts`);
      return require(name);
    },
    module,
    module.exports,
  );
  return module.exports;
}
const { createFirebaseAuthController } = load(
  "src/features/auth/firebase-auth-controller.ts",
);
const { createFirebaseAuthSdk } = load(
  "src/features/auth/firebase-auth-sdk.ts",
);
const { classifyFirebaseAuthFailure, isFirebaseProviderCancellation } = load(
  "src/features/auth/firebase-auth-errors.ts",
);
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const flush = () => new Promise((resolve) => setImmediate(resolve));
function harness() {
  const calls = { signIn: [], token: [] };
  let uid = "a";
  const sdk = {
    signInProvider: async (provider, signal) => {
      calls.signIn.push({ provider, signal });
      return { kind: "signed-in", user: { uid } };
    },
    getIdToken: async (user, forceRefresh) => {
      calls.token.push({ user, forceRefresh });
      return "firebase-proof";
    },
    getCurrentUid: () => uid,
  };
  return {
    sdk,
    calls,
    setUid: (value) => {
      uid = value;
    },
    create: () => createFirebaseAuthController(sdk),
  };
}
let passed = 0;
async function check(name, run) {
  await run();
  passed++;
  console.log(`PASS ${name}`);
}
await check(
  "정상 proof 반환 / 공개 상태에는 User·Token 없음 / 성공 후 초기화",
  async () => {
    const h = harness();
    const c = h.create();
    const snapshots = [];
    c.subscribe((state) => snapshots.push(state));
    assert.deepEqual(await c.signIn("google"), {
      kind: "proof-ready",
      uid: "a",
      firebaseIdToken: "firebase-proof",
    });
    assert.deepEqual(c.getState().operation, { status: "idle" });
    assert.ok(!JSON.stringify(snapshots).includes("firebase-proof"));
    assert.ok(!JSON.stringify(snapshots).includes('"user"'));
    assert.equal(h.calls.token[0].forceRefresh, false);
    assert.deepEqual(await c.retry(), { kind: "ignored", reason: "no-retry" });
  },
);
await check(
  "다른 Provider의 중복 요청·재시도도 busy이며 원래 작업은 유지",
  async () => {
    const h = harness();
    const native = deferred();
    h.sdk.signInProvider = () => native.promise;
    const c = h.create();
    const result = c.signIn("google");
    assert.deepEqual(await c.signIn("apple"), {
      kind: "ignored",
      reason: "busy",
    });
    assert.deepEqual(await c.retry(), { kind: "ignored", reason: "busy" });
    native.resolve({ kind: "signed-in", user: { uid: "a" } });
    assert.equal((await result).kind, "proof-ready");
  },
);
await check(
  "화면 취소 즉시 반환 / native 종료 전 차단 / 늦은 성공의 토큰 요청 차단",
  async () => {
    const h = harness();
    const native = deferred();
    h.sdk.signInProvider = () => native.promise;
    const c = h.create();
    const result = c.signIn("google");
    c.cancel();
    c.cancel();
    assert.deepEqual(await result, { kind: "cancelled" });
    assert.equal(c.getState().operation.status, "cancelling");
    assert.equal((await c.signIn("kakao")).kind, "ignored");
    native.resolve({ kind: "signed-in", user: { uid: "a" } });
    await flush();
    assert.equal(h.calls.token.length, 0);
    assert.equal(c.getState().operation.status, "idle");
    assert.equal((await c.signIn("apple")).kind, "proof-ready");
  },
);
await check("토큰 획득 중 취소 후 늦은 성공·실패는 모두 폐기", async () => {
  for (const fail of [false, true]) {
    const h = harness();
    const token = deferred();
    h.sdk.getIdToken = () => token.promise;
    const c = h.create();
    const result = c.signIn("google");
    await flush();
    c.cancel();
    assert.equal((await result).kind, "cancelled");
    assert.equal((await c.retry()).reason, "busy");
    if (fail)
      token.reject({ code: "auth/network-request-failed", message: "secret" });
    else token.resolve("late-secret");
    await flush();
    assert.equal(c.getState().operation.status, "idle");
  }
});
await check("Provider 사용자 취소는 idle / 다음 로그인 허용", async () => {
  const h = harness();
  h.sdk.signInProvider = async () => ({ kind: "cancelled" });
  const c = h.create();
  assert.equal((await c.signIn("kakao")).kind, "cancelled");
  assert.equal(c.getState().operation.status, "idle");
  assert.equal((await c.retry()).reason, "no-retry");
});
await check("토큰 실패 재시도는 같은 user로 토큰만 재요청", async () => {
  const h = harness();
  let count = 0;
  h.sdk.getIdToken = async (user) => {
    assert.equal(user.uid, "a");
    if (++count === 1) throw { code: "auth/network-request-failed" };
    return "proof";
  };
  const c = h.create();
  assert.equal((await c.signIn("google")).reason, "connection");
  assert.equal((await c.retry()).kind, "proof-ready");
  assert.equal(count, 2);
  assert.equal(h.calls.signIn.length, 1);
});
await check(
  "Provider 일시 오류는 Provider부터 재시도 / 재인증·설정 오류는 retry 금지",
  async () => {
    const h = harness();
    let count = 0;
    h.sdk.signInProvider = async () => {
      if (++count === 1) throw { code: "auth/too-many-requests" };
      return { kind: "signed-in", user: { uid: "a" } };
    };
    const c = h.create();
    assert.equal((await c.signIn("google")).nextAction, "retry");
    assert.equal((await c.retry()).kind, "proof-ready");
    assert.equal(count, 2);
    for (const code of [
      "auth/invalid-user-token",
      "auth/operation-not-allowed",
      "auth/user-disabled",
    ]) {
      h.sdk.signInProvider = async () => {
        throw { code };
      };
      const result = await c.signIn("google");
      assert.equal(result.kind, "failed");
      assert.notEqual(result.nextAction, "retry");
      assert.equal((await c.retry()).reason, "no-retry");
    }
  },
);
await check(
  "재시도 전 로그아웃·UID 변경이면 토큰 요청 대신 재인증",
  async () => {
    for (const uid of [null, "b"]) {
      const h = harness();
      let count = 0;
      h.sdk.getIdToken = async () => {
        count++;
        throw { code: "auth/network-request-failed" };
      };
      const c = h.create();
      await c.signIn("google");
      h.setUid(uid);
      assert.equal((await c.retry()).nextAction, "sign-in-again");
      assert.equal(count, 1);
    }
  },
);
await check(
  "토큰 획득 도중 UID 변경도 감지 / 빈 토큰은 성공 아님",
  async () => {
    const h = harness();
    const token = deferred();
    h.sdk.getIdToken = () => token.promise;
    const c = h.create();
    const result = c.signIn("google");
    await flush();
    h.setUid("b");
    token.resolve("a-token");
    assert.equal((await result).nextAction, "sign-in-again");
    h.sdk.getIdToken = async () => " ";
    assert.equal((await c.signIn("google")).reason, "unexpected");
  },
);
await check(
  "새 시도로 이전 실패의 user를 재사용하지 않음 / 취소된 실패 재시도 불가",
  async () => {
    const h = harness();
    h.sdk.getIdToken = async () => {
      throw { code: "auth/network-request-failed" };
    };
    const c = h.create();
    await c.signIn("google");
    c.cancel();
    assert.equal((await c.retry()).reason, "no-retry");
    h.setUid("b");
    h.sdk.getIdToken = async (user) => user.uid;
    const result = await c.signIn("apple");
    assert.equal(result.uid, "b");
    assert.equal(result.firebaseIdToken, "b");
  },
);
await check("구독 중 즉시 취소돼도 native 인증을 시작하지 않음", async () => {
  const h = harness();
  const c = h.create();
  c.subscribe(({ operation }) => {
    if (operation.status === "running") c.cancel();
  });
  assert.equal((await c.signIn("google")).kind, "cancelled");
  await flush();
  assert.equal(h.calls.signIn.length, 0);
  assert.equal(c.getState().operation.status, "idle");
});
await check(
  "알 수 없는 오류는 get-help / 중복 실행 오류는 사용자 취소 아님",
  async () => {
    for (const code of [
      "auth/internal-error",
      "auth/cancelled-popup-request",
      "auth/account-exists-with-different-credential",
      "UNKNOWN",
    ]) {
      const error = { code, message: "secret-token" };
      assert.equal(isFirebaseProviderCancellation(error), false);
      const result = classifyFirebaseAuthFailure(error);
      assert.equal(result.nextAction, "get-help");
      assert.ok(!JSON.stringify(result).includes("secret-token"));
    }
    assert.equal(
      isFirebaseProviderCancellation({ code: "auth/popup-closed-by-user" }),
      true,
    );
  },
);
const config = {
  google: { webClientId: "web-client", iosClientId: "ios-client" },
  apple: { enabled: true },
  kakao: { providerId: "oidc.actual-project-id" },
};
function resetNative() {
  platform.OS = "ios";
  nativeUser = { uid: "a" };
  nativeCalls.length = 0;
  googleCalls.length = 0;
  providerResult = async () => ({ user: nativeUser });
  googleResult = async () => ({
    type: "success",
    data: { idToken: "google-id-token" },
  });
  appleResult = async () => ({ identityToken: "apple-id-token" });
}
await check(
  "Google credential 교환 및 iOS Apple hashed nonce / raw nonce 구분",
  async () => {
    resetNative();
    const sdk = createFirebaseAuthSdk(config);
    assert.equal(
      (await sdk.signInProvider("google", new AbortController().signal)).kind,
      "signed-in",
    );
    assert.equal(googleCalls[0].webClientId, "web-client");
    assert.equal(nativeCalls[0].token, "google-id-token");
    appleResult = async (options) => {
      assert.equal(options.nonce, "hashed:random-raw-nonce");
      return { identityToken: "apple-id-token" };
    };
    await sdk.signInProvider("apple", new AbortController().signal);
    assert.equal(nativeCalls[1].rawNonce, "random-raw-nonce");
    assert.equal(nativeCalls[1].idToken, "apple-id-token");
  },
);
await check("Kakao OIDC 실제 ID 및 Android Apple 웹 인증 사용", async () => {
  resetNative();
  const sdk = createFirebaseAuthSdk(config);
  await sdk.signInProvider("kakao", new AbortController().signal);
  assert.equal(nativeCalls[0].providerId, "oidc.actual-project-id");
  platform.OS = "android";
  await sdk.signInProvider("apple", new AbortController().signal);
  assert.equal(nativeCalls[1].providerId, "apple.com");
  assert.deepEqual(nativeCalls[1].scopes, ["email"]);
});
await check("Provider별 명시적 사용자 취소만 cancelled로 정규화", async () => {
  resetNative();
  const sdk = createFirebaseAuthSdk(config);
  googleResult = async () => ({ type: "cancelled", data: null });
  assert.equal(
    (await sdk.signInProvider("google", new AbortController().signal)).kind,
    "cancelled",
  );
  appleResult = async () => {
    throw { code: "ERR_REQUEST_CANCELED" };
  };
  assert.equal(
    (await sdk.signInProvider("apple", new AbortController().signal)).kind,
    "cancelled",
  );
  providerResult = async () => {
    throw { code: "auth/popup-closed-by-user" };
  };
  assert.equal(
    (await sdk.signInProvider("kakao", new AbortController().signal)).kind,
    "cancelled",
  );
  providerResult = async () => {
    throw { code: "auth/cancelled-popup-request" };
  };
  await assert.rejects(
    sdk.signInProvider("kakao", new AbortController().signal),
  );
});
await check(
  "Google·Apple 화면 취소 후 늦은 native 응답으로 Firebase 인증을 시작하지 않음",
  async () => {
    for (const provider of ["google", "apple"]) {
      resetNative();
      const sdk = createFirebaseAuthSdk(config);
      const native = deferred();
      if (provider === "google") googleResult = () => native.promise;
      else appleResult = () => native.promise;
      const abort = new AbortController();
      const result = sdk.signInProvider(provider, abort.signal);
      await flush();
      abort.abort();
      native.resolve(
        provider === "google"
          ? { type: "success", data: { idToken: "late-token" } }
          : { identityToken: "late-token" },
      );
      assert.equal((await result).kind, "cancelled");
      assert.equal(nativeCalls.length, 0);
    }
  },
);
await check("미설정 Provider는 native 호출 없이 명시적 설정 오류", async () => {
  resetNative();
  const sdk = createFirebaseAuthSdk({});
  for (const provider of ["google", "apple", "kakao"]) {
    await assert.rejects(
      sdk.signInProvider(provider, new AbortController().signal),
      (error) => error.reason === "provider-unavailable",
    );
  }
  assert.equal(nativeCalls.length, 0);
});
await check(
  "Identity용 강제 갱신 실패 재시도에도 forceRefresh 유지 / UID 변경 차단",
  async () => {
    const h = harness();
    const c = h.create();
    await c.signIn("google");
    let count = 0;
    h.sdk.getIdToken = async (_user, forceRefresh) => {
      assert.equal(forceRefresh, true);
      if (++count === 1) throw { code: "auth/network-request-failed" };
      return "fresh-proof";
    };
    assert.equal((await c.refreshProof("a")).kind, "failed");
    assert.equal((await c.retry()).firebaseIdToken, "fresh-proof");
    assert.equal(h.calls.signIn.length, 1);
    h.setUid("b");
    assert.equal((await c.refreshProof("a")).nextAction, "sign-in-again");
  },
);
console.log(`Firebase 인증 회귀 검사 ${passed}개 통과`);
