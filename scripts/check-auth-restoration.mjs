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
const mocks = {
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
const { SessionRestorationError } = load(
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

const originalFetch = globalThis.fetch;
const originalBase = process.env.EXPO_PUBLIC_IDENTITY_API_BASE_URL;
process.env.EXPO_PUBLIC_IDENTITY_API_BASE_URL = "https://identity.example.test";
const envelope = (result) => ({
  isSuccess: true,
  code: "OK",
  message: "ok",
  result,
});
try {
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
  if (originalBase === undefined)
    delete process.env.EXPO_PUBLIC_IDENTITY_API_BASE_URL;
  else process.env.EXPO_PUBLIC_IDENTITY_API_BASE_URL = originalBase;
}
console.log(`인증 복원 회귀 검사 ${passed}개 통과`);
