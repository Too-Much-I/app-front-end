// Native SDK 경계만 대체하고 실제 TypeScript 복원·저장·HTTP 코드를 검증한다.
// 실행: node scripts/check-auth-restoration.mjs (추가 테스트 러너 불필요)
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const modules = new Map();
const disk = new Map();
let failRead = false;
let failWrite = false;
let failDelete = false;
let failConsentWrite = false;
const mocks = {
  "@react-native-async-storage/async-storage": {
    __esModule: true,
    default: {
      getItem: async (key) => disk.get(key) ?? null,
      setItem: async (key, value) => {
        if (key === "consent-record" && failConsentWrite)
          throw new Error("write");
        disk.set(key, value);
      },
    },
  },
  "expo-crypto": { randomUUID: () => "test-request-id" },
  "react-native": { Platform: { OS: "ios" } },
  "expo-secure-store": {
    getItemAsync: async (key) => {
      if (failRead) throw new Error("storage read");
      return disk.get(key) ?? null;
    },
    setItemAsync: async (key, value) => {
      if (failWrite) throw new Error("storage write");
      disk.set(key, value);
    },
    deleteItemAsync: async (key) => {
      if (failDelete) throw new Error("storage delete");
      disk.delete(key);
    },
  },
};
function load(file) {
  const path = resolve(root, file);
  if (modules.has(path)) return modules.get(path).exports;
  const module = { exports: {} };
  modules.set(path, module);
  const source = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const localRequire = (name) => {
    if (name in mocks) return mocks[name];
    if (name.startsWith("@/")) return load(`src/${name.slice(2)}.ts`);
    if (name.startsWith(".")) return load(resolve(dirname(path), `${name}.ts`));
    return require(name);
  };
  new Function("require", "module", "exports", source)(
    localRequire,
    module,
    module.exports,
  );
  return module.exports;
}
const { createSessionController } = load(
  "src/features/auth/session-controller.ts",
);
const { createAuthCoordinator } = load("src/features/auth/auth-coordinator.ts");
const { SessionRestorationError, SessionRequestError } = load(
  "src/features/auth/session-restoration-types.ts",
);
const { ApiError, TransportConnectionError, serviceFetch } = load(
  "src/lib/api/transport.ts",
);
const storage = load("src/features/auth/auth-restoration-storage.ts");
const { reissueSession } = load("src/features/auth/api/reissue-session.ts");
const { getCurrentAccount } = load(
  "src/features/auth/api/get-current-account.ts",
);
const { classifyAuthRecovery } = load("src/features/auth/auth-recovery.ts");
const now = 1_800_000_000_000;
const oldSession = {
  schemaVersion: 1,
  accessToken: "old-access",
  refreshToken: "old-refresh",
  grantType: "Bearer",
  accessTokenExpiresAt: now + 120_000,
  refreshTokenExpiresAt: now + 500_000,
};
const newSession = {
  ...oldSession,
  accessToken: "new-access",
  refreshToken: "new-refresh",
  accessTokenExpiresAt: now + 300_000,
};
const active = (session) => ({ schemaVersion: 2, phase: "active", session });
function harness(initial = active(oldSession), replaySupported = true) {
  let record = initial;
  let time = now;
  const calls = { read: 0, write: [], reissue: [], account: 0, remove: 0 };
  const deps = {
    read: async () => {
      calls.read++;
      return record;
    },
    write: async (value) => {
      calls.write.push(value);
      record = structuredClone(value);
    },
    removeLegacy: async () => {
      calls.remove++;
    },
    reissue: async (...args) => {
      calls.reissue.push(args);
      return newSession;
    },
    getAccount: async () => {
      calls.account++;
      return "MEMBER";
    },
    createRequestId: () => "request-1",
    now: () => time,
  };
  return {
    deps,
    calls,
    create: () => createSessionController({ replaySupported }, deps),
    advance: (ms) => {
      time += ms;
    },
    record: () => record,
  };
}
let passed = 0;
async function check(name, run) {
  await run();
  passed++;
  console.log(`PASS ${name}`);
}

await check("세션 없음 / MEMBER / Guest 및 중복 복원 공유", async () => {
  assert.deepEqual(await harness(null).create().restore(), {
    kind: "login-required",
  });
  for (const accountType of ["MEMBER", "GUEST"]) {
    const h = harness();
    h.deps.getAccount = async () => accountType;
    const c = h.create();
    const first = c.restore();
    assert.equal(c.restore(), first);
    assert.deepEqual(await first, { kind: "ready", accountType });
    assert.equal(h.calls.read, 1);
    assert.equal(h.calls.reissue.length, 0);
  }
});
await check("로컬 유효 세션의 계정 401은 한 번 재발급 후 복원", async () => {
  const h = harness();
  const tokens = [];
  h.deps.getAccount = async (token) => {
    tokens.push(token);
    if (token === oldSession.accessToken) throw new ApiError(401, "expired");
    return "MEMBER";
  };
  const c = h.create();
  const first = c.restore();
  assert.equal(c.restore(), first);
  assert.deepEqual(await first, { kind: "ready", accountType: "MEMBER" });
  assert.deepEqual(tokens, ["old-access", "new-access"]);
  assert.equal(h.calls.reissue.length, 1);
  assert.equal(c.getSession().accessToken, "new-access");
});
await check("계정 401 재발급도 refresh 무효 시 로그인으로 복귀", async () => {
  const h = harness();
  h.deps.getAccount = async () => {
    throw new ApiError(401, "expired");
  };
  h.deps.reissue = async () => {
    throw new ApiError(401, "invalid", "INVALID_REFRESH_TOKEN");
  };
  assert.deepEqual(await h.create().restore(), { kind: "login-required" });
  assert.equal(h.record().phase, "signed-out");
});
await check("계정 401의 병합·탈퇴 코드는 재발급 없이 차단", async () => {
  for (const code of [
    "ACCOUNT_MERGED_TOKEN_REJECTED",
    "WITHDRAWAL_CLEANUP_PENDING",
  ]) {
    const h = harness();
    let calls = 0;
    h.deps.getAccount = async () => {
      calls++;
      throw new ApiError(401, "blocked", code);
    };
    const c = h.create();
    const result = await c.restore();
    assert.equal(result.action, "get-help");
    assert.deepEqual(await c.restore(), result);
    assert.equal(calls, 1);
    assert.equal(h.calls.reissue.length, 0);
  }
});
await check("재발급 후 계정 401은 저장·조회 실패 재개에서도 반복하지 않음", async () => {
  for (const interruption of ["none", "storage", "connection"]) {
    for (const expired of [false, true]) {
      const h = harness(
        active({
          ...oldSession,
          accessTokenExpiresAt: expired ? now - 1 : oldSession.accessTokenExpiresAt,
        }),
      );
      const write = h.deps.write;
      let interrupted = false;
      h.deps.write = async (record) => {
        if (
          interruption === "storage" &&
          !interrupted &&
          record.phase === "active" &&
          record.session.accessToken === "new-access"
        ) {
          interrupted = true;
          throw new SessionRestorationError("storage");
        }
        return write(record);
      };
      const tokens = [];
      h.deps.getAccount = async (token) => {
        tokens.push(token);
        if (
          interruption === "connection" &&
          !interrupted &&
          token === "new-access"
        ) {
          interrupted = true;
          throw new TransportConnectionError();
        }
        throw new ApiError(401, "expired");
      };
      const c = h.create();
      if (interruption !== "none")
        assert.equal((await c.restore()).reason, interruption);
      const result = await c.restore();
      assert.equal(result.action, "get-help");
      assert.equal(h.calls.reissue.length, 1);
      assert.equal(c.getSession(), null);
      const count = tokens.length;
      assert.deepEqual(await c.restore(), result);
      assert.equal(tokens.length, count);
    }
  }
});
await check("계정 조회의 403·503은 401 재발급 대상으로 보지 않음", async () => {
  for (const status of [403, 503]) {
    const h = harness();
    h.deps.getAccount = async () => {
      throw new ApiError(status, "failure");
    };
    assert.equal((await h.create().restore()).kind, "recovery-required");
    assert.equal(h.calls.reissue.length, 0);
  }
});
await check("복원 완료 뒤 새 복원은 다시 한 번 재발급 가능", async () => {
  const h = harness();
  let reject = true;
  h.deps.getAccount = async () => {
    if (reject) {
      reject = false;
      throw new ApiError(401, "expired");
    }
    return "MEMBER";
  };
  const c = h.create();
  assert.equal((await c.restore()).kind, "ready");
  reject = true;
  assert.equal((await c.restore()).kind, "ready");
  assert.equal(h.calls.reissue.length, 2);
});
await check("재발급 성공 후 저장 실패는 새 토큰 저장부터 재개", async () => {
  const h = harness(active({ ...oldSession, accessTokenExpiresAt: now - 1 }));
  const write = h.deps.write;
  let failed = false;
  h.deps.write = async (record) => {
    if (
      record.phase === "active" &&
      record.session.accessToken === "new-access" &&
      !failed
    ) {
      failed = true;
      throw new SessionRestorationError("storage");
    }
    return write(record);
  };
  const c = h.create();
  assert.equal((await c.restore()).reason, "storage");
  assert.equal(c.getSession(), null);
  assert.equal((await c.restore()).kind, "ready");
  assert.equal(h.calls.reissue.length, 1);
  assert.equal(h.calls.read, 1);
  assert.equal(c.getSession().accessToken, "new-access");
  const pendingIndex = h.calls.write.findIndex(
    (r) => r.phase === "refresh-pending",
  );
  assert.ok(pendingIndex >= 0);
  assert.equal(h.record().phase, "active");
});
await check("요청 ID 저장 실패 시 재발급을 보내지 않음", async () => {
  const h = harness(active({ ...oldSession, accessTokenExpiresAt: now - 1 }));
  const write = h.deps.write;
  h.deps.write = async (r) => {
    if (r.phase === "refresh-pending")
      throw new SessionRestorationError("storage");
    return write(r);
  };
  const c = h.create();
  assert.equal((await c.restore()).reason, "storage");
  assert.equal(h.calls.reissue.length, 0);
  h.deps.write = write;
  await c.restore();
  assert.equal(h.calls.reissue.length, 1);
});
await check("응답 유실 후 새 컨트롤러도 동일 요청 ID·토큰 사용", async () => {
  const h = harness(active({ ...oldSession, accessTokenExpiresAt: now - 1 }));
  let attempt = 0;
  h.deps.reissue = async (...args) => {
    h.calls.reissue.push(args);
    if (++attempt === 1) throw new TransportConnectionError();
    return newSession;
  };
  assert.equal((await h.create().restore()).reason, "connection");
  assert.equal((await h.create().restore()).kind, "ready");
  assert.deepEqual(h.calls.reissue[0], h.calls.reissue[1]);
});
await check(
  "멱등성 미확인 재발급의 불명확한 결과는 반복하지 않음",
  async () => {
    const h = harness(
      active({ ...oldSession, accessTokenExpiresAt: now - 1 }),
      false,
    );
    let count = 0;
    h.deps.reissue = async () => {
      count++;
      throw new TransportConnectionError();
    };
    const c = h.create();
    const result = await c.restore();
    assert.equal(result.reason, "refresh-uncertain");
    assert.equal(result.action, "get-help");
    await c.restore();
    await h.create().restore();
    assert.equal(count, 1);
  },
);
await check(
  "계정 조회 재시도는 재발급을 반복하지 않음 / 지연 만료는 갱신",
  async () => {
    const h = harness();
    let failed = true;
    h.deps.getAccount = async () => {
      if (failed) {
        failed = false;
        throw new ApiError(503, "server");
      }
      return "MEMBER";
    };
    const c = h.create();
    assert.equal((await c.restore()).reason, "server");
    assert.equal((await c.restore()).kind, "ready");
    assert.equal(h.calls.reissue.length, 0);
    h.advance(70_000);
    assert.equal((await c.restore()).kind, "ready");
    assert.equal(h.calls.reissue.length, 1);
  },
);
await check("무효 refresh 삭제 실패 후 정리만 재시도", async () => {
  const h = harness(active({ ...oldSession, accessTokenExpiresAt: now - 1 }));
  let rotations = 0;
  h.deps.reissue = async () => {
    rotations++;
    throw new ApiError(401, "invalid", "INVALID_REFRESH_TOKEN");
  };
  h.deps.removeLegacy = async () => {
    throw new SessionRestorationError("storage");
  };
  const c = h.create();
  assert.equal((await c.restore()).reason, "storage");
  assert.equal(h.record().phase, "signed-out");
  h.deps.removeLegacy = async () => {};
  assert.equal((await c.restore()).kind, "login-required");
  assert.equal(rotations, 1);
  assert.equal((await h.create().restore()).kind, "login-required");
});
await check(
  "재시도 중 / 도움받기 상태 및 기술 오류 메시지 비노출",
  async () => {
    let calls = 0;
    const c = createAuthCoordinator({
      restore: async () =>
        ++calls === 1
          ? { kind: "recovery-required", reason: "server", action: "retry" }
          : { kind: "ready", accountType: "GUEST" },
    });
    await c.bootstrap();
    assert.match(c.getState().state.message, /잠시 후/);
    const retry = c.retry();
    assert.equal(c.getState().state.isRetrying, true);
    await retry;
    assert.equal(c.getState().state.status, "guest");
    let blockedCalls = 0;
    const blocked = createAuthCoordinator({
      restore: async () => {
        blockedCalls++;
        throw new Error("secret token");
      },
    });
    await blocked.bootstrap();
    assert.equal(blocked.getState().state.nextAction, "get-help");
    assert.ok(!blocked.getState().state.message.includes("secret"));
    await blocked.retry();
    assert.equal(blockedCalls, 1);
  },
);
await check("v1 복원과 v2 우선 / 손상 v2는 v1으로 우회하지 않음", async () => {
  disk.clear();
  disk.set("auth-session.v1", JSON.stringify(oldSession));
  assert.deepEqual(
    await storage.readAuthRestorationRecord(),
    active(oldSession),
  );
  await storage.writeAuthRestorationRecord(active(newSession));
  assert.equal(
    (await storage.readAuthRestorationRecord()).session.accessToken,
    "new-access",
  );
  disk.set("auth-session.v2", "broken");
  await assert.rejects(
    storage.readAuthRestorationRecord(),
    (e) => e.reason === "session-format",
  );
  disk.set(
    "auth-session.v2",
    JSON.stringify({ schemaVersion: 2, phase: "signed-out" }),
  );
  assert.equal((await storage.readAuthRestorationRecord()).phase, "signed-out");
});
await check("읽기·쓰기·삭제 실패는 storage로 분류", async () => {
  failRead = true;
  await assert.rejects(
    storage.readAuthRestorationRecord(),
    (e) => e.reason === "storage",
  );
  failRead = false;
  failWrite = true;
  await assert.rejects(
    storage.writeAuthRestorationRecord(active(oldSession)),
    (e) => e.reason === "storage",
  );
  failWrite = false;
  failDelete = true;
  await assert.rejects(
    storage.removeLegacyAuthSession(),
    (e) => e.reason === "storage",
  );
  failDelete = false;
});

await check("문의 입력 경계: 공백·선택 이메일·형식·길이", async () => {
  const { validateSupportInquiry, SUPPORT_MESSAGE_LIMIT } = load(
    "src/features/support/support-inquiry.ts",
  );
  assert.notEqual(
    validateSupportInquiry({ message: "   ", replyEmail: "" }),
    null,
  );
  assert.equal(
    validateSupportInquiry({ message: "로그인이 되지 않아요", replyEmail: "" }),
    null,
  );
  assert.notEqual(
    validateSupportInquiry({ message: "문의", replyEmail: "invalid" }),
    null,
  );
  assert.equal(
    validateSupportInquiry({
      message: "문의",
      replyEmail: " user@example.com ",
    }),
    null,
  );
  assert.notEqual(
    validateSupportInquiry({
      message: "x".repeat(SUPPORT_MESSAGE_LIMIT + 1),
      replyEmail: "",
    }),
    null,
  );
});

await check("동시 401 및 늦은 401은 같은 재발급 결과를 공유", async () => {
  const h = harness();
  const c = h.create();
  const initial = await c.prepareRequest();
  const results = await Promise.all([
    c.recoverUnauthorized(initial.generation),
    c.recoverUnauthorized(initial.generation),
  ]);
  assert.deepEqual(results[0], results[1]);
  assert.equal(results[0].accessToken, "new-access");
  await c.recoverUnauthorized(initial.generation);
  assert.equal(h.calls.reissue.length, 1);
});
await check("요청 준비 중 저장 실패는 새 토큰 저장부터 재개", async () => {
  const h = harness();
  const c = h.create();
  await c.prepareRequest();
  h.advance(70_000);
  const write = h.deps.write;
  h.deps.write = async (record) => {
    if (record.phase === "active") throw new SessionRestorationError("storage");
    return write(record);
  };
  await assert.rejects(
    c.prepareRequest(),
    (e) => e instanceof SessionRequestError && e.result.reason === "storage",
  );
  h.deps.write = write;
  assert.equal((await c.prepareRequest()).accessToken, "new-access");
  assert.equal(h.calls.reissue.length, 1);
});
const consentItem = {
  currentVersion: "v2",
  consentedVersion: "v1",
  consentedAt: new Date(now).toISOString(),
  requiresConsent: true,
};
const consentRequired = {
  privacy: consentItem,
  terms: consentItem,
  qualityReview: { ...consentItem, consented: false },
};
const consentDone = {
  ...consentRequired,
  privacy: { ...consentItem, requiresConsent: false },
  terms: { ...consentItem, requiresConsent: false },
};
await check("회원 복원 후 재동의와 조회 재시도 / 무효 세션 전파", async () => {
  let calls = 0;
  const c = createAuthCoordinator(
    { restore: async () => ({ kind: "ready", accountType: "MEMBER" }) },
    {
      load: async () => {
        if (++calls === 1) throw new TransportConnectionError();
        return consentRequired;
      },
      accept: async () => consentDone,
    },
  );
  await c.bootstrap();
  assert.equal(c.getState().state.nextAction, "retry-consent-check");
  await c.retry();
  assert.equal(c.getState().state.status, "consent");
  await c.acceptConsent(false);
  assert.equal(c.getState().state.status, "authenticated");
  c.handleSessionResult({ kind: "login-required" });
  assert.equal(c.getState().state.status, "noSession");
  const invalid = createAuthCoordinator(
    { restore: async () => ({ kind: "ready", accountType: "MEMBER" }) },
    {
      load: async () => {
        throw new SessionRequestError({ kind: "login-required" });
      },
      accept: async () => consentDone,
    },
  );
  await invalid.bootstrap();
  assert.equal(invalid.getState().state.status, "noSession");
});
await check(
  "동의 제출 중 세션 무효화 뒤 늦은 성공이 메인을 열지 않음",
  async () => {
    let finish;
    const c = createAuthCoordinator(
      { restore: async () => ({ kind: "ready", accountType: "MEMBER" }) },
      {
        load: async () => consentRequired,
        accept: () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      },
    );
    await c.bootstrap();
    const submission = c.acceptConsent(false);
    c.handleSessionResult({ kind: "login-required" });
    finish(consentDone);
    await submission;
    assert.equal(c.getState().state.status, "noSession");
  },
);

const originalFetch = globalThis.fetch;
const originalLearningBase = process.env.EXPO_PUBLIC_LEARNING_API_BASE_URL;
process.env.EXPO_PUBLIC_LEARNING_API_BASE_URL = "https://learning.example.test";
const originalBase = process.env.EXPO_PUBLIC_IDENTITY_API_BASE_URL;
process.env.EXPO_PUBLIC_IDENTITY_API_BASE_URL = "https://identity.example.test";
const envelope = (result) => ({
  isSuccess: true,
  code: "OK",
  message: "ok",
  result,
});
try {
  await check(
    "공용 API 읽기 401 한 번 재시도 / 쓰기는 자동 재전송하지 않음",
    async () => {
      const { createAuthenticatedApiClient } = load(
        "src/lib/api/authenticated-client.ts",
      );
      const h = harness();
      const client = createAuthenticatedApiClient(h.create());
      let requests = 0;
      globalThis.fetch = async (_url, init) => {
        requests++;
        if (init.headers.Authorization === "Bearer old-access")
          return new Response("", { status: 401 });
        return new Response(JSON.stringify(envelope({ ok: true })));
      };
      assert.equal(
        (await client.apiFetchWithAuthRetry("/read")).result.ok,
        true,
      );
      assert.equal(requests, 2);
      assert.equal(h.calls.reissue.length, 1);
      requests = 0;
      globalThis.fetch = async () => {
        requests++;
        return new Response("", { status: 401 });
      };
      await assert.rejects(client.apiFetchWithAuthRetry("/read"));
      assert.equal(requests, 2);
      requests = 0;
      await assert.rejects(client.apiFetch("/write", { method: "POST" }));
      assert.equal(requests, 1);
    },
  );
  await check(
    "동의 PUT 성공 후 로컬 저장 실패는 PUT 반복 없이 복구",
    async () => {
      const { createAuthConsentController } = load(
        "src/features/auth/auth-consent-controller.ts",
      );
      let status = consentRequired;
      let puts = 0;
      globalThis.fetch = async (_url, init) => {
        if (init.method === "PUT") {
          puts++;
          status = consentDone;
        }
        return new Response(JSON.stringify(envelope(status)));
      };
      const consent = createAuthConsentController(harness().create());
      await consent.load();
      failConsentWrite = true;
      await assert.rejects(
        consent.accept(false),
        (e) => e.reason === "storage",
      );
      failConsentWrite = false;
      assert.deepEqual(await consent.accept(false), consentDone);
      assert.equal(puts, 1);
    },
  );
  await check("재전달 절대 만료 헤더 사용 및 누락 감지", async () => {
    let sent;
    const pair = {
      accessToken: "a",
      refreshToken: "r",
      grantType: "Bearer",
      accessTokenExpiresIn: 999999,
      refreshTokenExpiresIn: 999999,
    };
    globalThis.fetch = async (_url, init) => {
      sent = init;
      return new Response(JSON.stringify(envelope(pair)), {
        headers: {
          "Reissue-Access-Expires-At": new Date(now + 1000).toISOString(),
          "Reissue-Refresh-Expires-At": new Date(now + 9000).toISOString(),
        },
      });
    };
    const session = await reissueSession("r", "same-request", true);
    assert.equal(session.accessTokenExpiresAt, now + 1000);
    assert.equal(sent.headers["Idempotency-Key"], "same-request");
    globalThis.fetch = async () => new Response(JSON.stringify(envelope(pair)));
    await assert.rejects(
      reissueSession("r", "same-request", true),
      (e) => e.reason === "response-format",
    );
  });
  await check("/users/me 계정 종류 검증", async () => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify(envelope({ accountType: "GUEST" })));
    assert.equal(await getCurrentAccount("token"), "GUEST");
    globalThis.fetch = async () =>
      new Response(JSON.stringify(envelope({ accountType: "UNKNOWN" })));
    await assert.rejects(
      getCurrentAccount("token"),
      (e) => e.reason === "response-format",
    );
  });
  await check(
    "transport 연결 실패·timeout·서버 장애와 호출자 취소 구분",
    async () => {
      globalThis.fetch = async () => {
        throw new TypeError("network");
      };
      await assert.rejects(
        serviceFetch("https://example.test"),
        (e) => classifyAuthRecovery(e).reason === "connection",
      );
      globalThis.fetch = async () => new Response("", { status: 503 });
      await assert.rejects(
        serviceFetch("https://example.test"),
        (e) => classifyAuthRecovery(e).reason === "server",
      );
      globalThis.fetch = async (_url, { signal }) =>
        new Promise((_resolve, reject) => {
          if (signal.aborted) reject(signal.reason);
          else
            signal.addEventListener("abort", () => reject(signal.reason), {
              once: true,
            });
        });
      await assert.rejects(
        serviceFetch("https://example.test", {}, 1),
        (e) => e instanceof TransportConnectionError,
      );
      const c = new AbortController();
      const reason = new Error("caller cancellation");
      c.abort(reason);
      await assert.rejects(
        serviceFetch("https://example.test", { signal: c.signal }),
        (e) => e === reason,
      );
    },
  );
} finally {
  globalThis.fetch = originalFetch;
  if (originalLearningBase === undefined)
    delete process.env.EXPO_PUBLIC_LEARNING_API_BASE_URL;
  else process.env.EXPO_PUBLIC_LEARNING_API_BASE_URL = originalLearningBase;
  if (originalBase === undefined)
    delete process.env.EXPO_PUBLIC_IDENTITY_API_BASE_URL;
  else process.env.EXPO_PUBLIC_IDENTITY_API_BASE_URL = originalBase;
}
const settleIdentityWork = () =>
  new Promise((resolve) => setImmediate(resolve));
function identityHarness(origin = "noSession") {
  const calls = {
    firebase: 0,
    exchange: 0,
    prepare: 0,
    activate: 0,
    refresh: 0,
  };
  const proof = {
    kind: "proof-ready",
    uid: "member-uid",
    firebaseIdToken: "firebase-proof",
  };
  const login = {
    firebase: {
      signIn: async () => {
        calls.firebase++;
        return proof;
      },
      retry: async () => proof,
      refreshProof: async () => {
        calls.refresh++;
        return { ...proof, firebaseIdToken: "fresh-proof" };
      },
      cancel: () => {},
    },
    session: {
      prepareRequest: async () => ({
        accessToken: "guest-token",
        generation: 1,
      }),
      acceptSession: async () => {
        calls.activate++;
        return true;
      },
    },
    exchange: async () => {
      calls.exchange++;
      return { kind: "authenticated", session: newSession };
    },
    prepare: async (_proof, token) => {
      calls.prepare++;
      assert.equal(token, "guest-token");
      return { kind: "merge-required" };
    },
  };
  const coordinator = createAuthCoordinator(
    {
      restore: async () =>
        origin === "guest"
          ? { kind: "ready", accountType: "GUEST" }
          : { kind: "login-required" },
    },
    undefined,
    login,
  );
  return { calls, proof, login, coordinator };
}

await check("Identity 로그인 상태 전이 / Guest prepare 분기", async () => {
  const h = identityHarness();
  const states = [];
  h.coordinator.subscribe(({ state }) => states.push(state.status));
  await h.coordinator.bootstrap();
  await h.coordinator.signIn("google");
  assert.deepEqual(states, [
    "restoring",
    "noSession",
    "signingIn",
    "submittingProof",
    "activatingSession",
    "authenticated",
  ]);
  assert.equal(h.calls.exchange, 1);
  assert.equal(h.calls.prepare, 0);
  const guest = identityHarness("guest");
  await guest.coordinator.bootstrap();
  await guest.coordinator.signIn("google");
  assert.equal(guest.coordinator.getState().state.status, "mergeRequired");
  assert.equal(guest.calls.exchange, 0);
  assert.equal(guest.calls.prepare, 1);
});

await check(
  "Firebase 취소·실패·ignored는 Identity 요청을 보내지 않음",
  async () => {
    for (const result of [
      { kind: "cancelled" },
      { kind: "ignored", reason: "busy" },
      { kind: "failed", reason: "connection", nextAction: "retry" },
    ]) {
      const h = identityHarness();
      h.login.firebase.signIn = async () => result;
      await h.coordinator.bootstrap();
      await h.coordinator.signIn("google");
      assert.equal(h.calls.exchange, 0);
      assert.equal(
        h.coordinator.getState().state.status,
        result.kind === "failed" ? "loginError" : "noSession",
      );
    }
  },
);

await check(
  "Identity 응답 대기 중 중복 로그인 차단 / 취소 뒤 늦은 토큰 폐기",
  async () => {
    const h = identityHarness();
    let respond;
    h.login.exchange = () =>
      new Promise((resolve) => {
        respond = resolve;
      });
    await h.coordinator.bootstrap();
    const first = h.coordinator.signIn("google");
    await settleIdentityWork();
    await h.coordinator.signIn("apple");
    assert.equal(h.calls.firebase, 1);
    h.coordinator.cancelLogin();
    respond({ kind: "authenticated", session: newSession });
    await first;
    assert.equal(h.calls.activate, 0);
    assert.equal(h.coordinator.getState().state.status, "noSession");
  },
);

await check(
  "Identity 503 수동 재시도는 SNS 로그인 반복 없이 제출부터",
  async () => {
    const h = identityHarness();
    let requests = 0;
    h.login.exchange = async () => {
      if (++requests === 1) throw new ApiError(503, "private server detail");
      return { kind: "authenticated", session: newSession };
    };
    await h.coordinator.bootstrap();
    await h.coordinator.signIn("google");
    assert.equal(h.coordinator.getState().state.status, "loginError");
    assert.ok(
      !JSON.stringify(h.coordinator.getState()).includes(
        "private server detail",
      ),
    );
    await h.coordinator.retry();
    assert.equal(h.calls.firebase, 1);
    assert.equal(requests, 2);
    assert.equal(h.coordinator.getState().state.status, "authenticated");
  },
);

await check(
  "잘못된 Firebase 증명은 한 번 갱신, 재실패는 재로그인",
  async () => {
    const h = identityHarness();
    h.login.exchange = async () => {
      throw new ApiError(401, "invalid", "INVALID_FIREBASE_ID_TOKEN");
    };
    await h.coordinator.bootstrap();
    await h.coordinator.signIn("google");
    assert.equal(h.calls.refresh, 1);
    assert.equal(h.coordinator.getState().state.nextAction, "sign-in-again");
  },
);

await check("가입 요구사항 전달 및 이전 가입 흐름의 완료 무시", async () => {
  const h = identityHarness();
  const enrollment = {
    origin: "noSession",
    enrollmentId: "enrollment",
    missingRequirements: ["PROFILE"],
    expiresAt: now + 1000,
  };
  h.login.exchange = async () => ({ kind: "enrollment-required", enrollment });
  await h.coordinator.bootstrap();
  await h.coordinator.signIn("google");
  const old = h.coordinator.getState().state;
  assert.deepEqual(old.enrollment, enrollment);
  h.coordinator.cancelLogin();
  await h.coordinator.signIn("apple");
  await h.coordinator.completeEnrollment(old.flowId, newSession);
  assert.equal(h.calls.activate, 0);
  const current = h.coordinator.getState().state;
  await h.coordinator.completeEnrollment(current.flowId, newSession);
  assert.equal(h.calls.activate, 1);
  assert.equal(h.coordinator.getState().state.status, "authenticated");
});

await check(
  "저장 실패에도 새 세션으로 API 사용 / 재활성화 시 저장만 재시도",
  async () => {
    const h = harness(null);
    let fail = true;
    const write = h.deps.write;
    h.deps.write = async (record) => {
      if (fail) throw new Error("disk unavailable");
      await write(record);
    };
    const c = h.create();
    try {
      assert.equal(await c.acceptSession(newSession), true);
      await settleIdentityWork();
      assert.equal(
        (await c.prepareRequest()).accessToken,
        newSession.accessToken,
      );
      assert.equal(h.calls.reissue.length, 0);
      fail = false;
      c.retryPersistence();
      await settleIdentityWork();
      assert.equal(h.record().session.accessToken, newSession.accessToken);
    } finally {
      c.dispose();
    }
  },
);

await check(
  "느린 이전 세션 저장 뒤 최신 세션이 마지막으로 저장됨",
  async () => {
    const h = harness(null);
    const write = h.deps.write;
    let release;
    h.deps.write = async (record) => {
      if (record.session.accessToken === oldSession.accessToken)
        await new Promise((resolve) => {
          release = resolve;
        });
      await write(record);
    };
    const c = h.create();
    try {
      await c.acceptSession(oldSession);
      await settleIdentityWork();
      await c.acceptSession(newSession);
      release();
      await settleIdentityWork();
      assert.equal(h.record().session.accessToken, newSession.accessToken);
      assert.equal(
        (await c.prepareRequest()).accessToken,
        newSession.accessToken,
      );
    } finally {
      c.dispose();
    }
  },
);

await check(
  "진행 중인 복원의 늦은 결과가 새 로그인 세션을 덮어쓰지 않음",
  async () => {
    const h = harness();
    let release;
    h.deps.getAccount = () =>
      new Promise((resolve) => {
        release = resolve;
      });
    const c = h.create();
    try {
      const restoring = c.restore();
      await settleIdentityWork();
      const accepting = c.acceptSession(newSession);
      release("GUEST");
      await restoring;
      await accepting;
      assert.equal(
        (await c.prepareRequest()).accessToken,
        newSession.accessToken,
      );
    } finally {
      c.dispose();
    }
  },
);

await check("취소된 세션 확정은 토큰을 활성화·저장하지 않음", async () => {
  const h = harness(null);
  const c = h.create();
  const abort = new AbortController();
  abort.abort();
  assert.equal(await c.acceptSession(newSession, abort.signal), false);
  assert.equal(c.getSession(), null);
  assert.equal(h.calls.write.length, 0);
  c.dispose();
});

const { mapIdentityExchange, mapIdentityGuestPreparation } = load(
  "src/features/auth/identity-login-mapper.ts",
);
await check("Identity 응답 경계: 가입 요구사항·정책·만료 검증", async () => {
  const value = {
    type: "ENROLLMENT_REQUIRED",
    enrollmentId: "id",
    missingRequirements: ["PHONE_VERIFICATION"],
    expiresIn: 600000,
  };
  assert.equal(
    mapIdentityExchange(value, now).enrollment.expiresAt,
    now + 600000,
  );
  assert.throws(() => mapIdentityGuestPreparation(value, now));
  assert.throws(() =>
    mapIdentityExchange({ ...value, missingRequirements: ["UNKNOWN"] }, now),
  );
  assert.throws(() => mapIdentityExchange({ type: "MERGE_REQUIRED" }));
  assert.equal(
    mapIdentityGuestPreparation({ type: "MERGE_REQUIRED" }).kind,
    "merge-required",
  );
});

console.log(`인증 복원 회귀 검사 ${passed}개 통과`);
