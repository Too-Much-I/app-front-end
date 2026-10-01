import { createHash, randomUUID } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, renameSync, rmdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import {
  REQUIRED_SECTIONS, NO_BEHAVIOR_CHANGE, DESIGN_SECTION, isLearningRecordPath,
  missingSections, readSectionContent,
} from "./learning.mjs";

const SKILL = ".agents/skills/review-completed-code/SKILL.md";
const DATA = "output/code-review";
const LABELS = ["useful", "out-of-scope", "unsupported", "incorrect", "deferred"];
const CHECKS = [
  ["exec", "tsc", "--noEmit"],
  ["lint"],
  ["check:architecture"],
  ["check:naming"],
];

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function reviewSessionKey(sessionId) {
  if (typeof sessionId !== "string" || !sessionId) throw new Error("session_id가 필요합니다.");
  return hash(sessionId).slice(0, 16);
}

function assertKey(key) {
  if (!/^[a-f0-9]{16}$/.test(key)) throw new Error("올바른 세션 키가 필요합니다.");
}

function atomicJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporary, path);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function eligible(path) {
  return !path.split("/").some((part) => part === ".." || part === "node_modules") &&
    !path.includes(".skeleton.") &&
    (/^(src|scripts)\/.*\.(ts|tsx|js|jsx|mjs|cjs)$/.test(path) ||
      /^[^/]+\.(ts|tsx|js|mjs|cjs|json)$/.test(path) || path === "pnpm-lock.yaml");
}

/** Git가 아는 실제 소스만 저장한다. 기존 dirty 내용도 시작점으로 보존한다. */
function snapshot(root) {
  const names = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { cwd: root, encoding: "utf8" });
  const result = {};
  for (const path of [...new Set(names.split("\0").filter(eligible))].sort()) {
    const absolute = join(root, path);
    if (!existsSync(absolute) || !lstatSync(absolute).isFile()) continue;
    if (lstatSync(absolute).size > 2 * 1024 * 1024) throw new Error(`리뷰 스냅샷 크기 초과: ${path}`);
    result[path] = readFileSync(absolute, "utf8");
  }
  return result;
}

function fingerprint(snapshotValue) {
  return hash(JSON.stringify(snapshotValue));
}

function revision(root) {
  const files = [SKILL, "scripts/code-review/core.mjs", "scripts/code-review/cli.mjs", "scripts/code-review/learning.mjs"];
  return hash(files.map((file) => readFileSync(join(root, file), "utf8")).join("\0")).slice(0, 12);
}

function activePath(root, key) {
  assertKey(key);
  return join(root, DATA, "sessions", `${key}.json`);
}

function runPath(root, id) {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("올바른 실행 ID가 필요합니다.");
  return join(root, DATA, "runs", `${id}.json`);
}

function active(root, key) {
  const path = activePath(root, key);
  if (!existsSync(path)) return null;
  return readJson(runPath(root, readJson(path).runId));
}

function save(root, run) {
  atomicJson(runPath(root, run.id), run);
}

/**
 * 설계 논의를 이 시점의 내용으로 고정한다. 구현 뒤 고쳐 써도 원래 기록이 남는다.
 * 설명할 동작 변화가 없다고 선언한 작업만 학습 기록 없이 시작한다.
 */
function learningSnapshot(root, learning) {
  if (learning === NO_BEHAVIOR_CHANGE) return { declared: NO_BEHAVIOR_CHANGE };
  if (!learning || !isLearningRecordPath(learning)) {
    throw new Error(`학습 기록 경로(docs/learning/YYYY-MM-DD-<작업>.md) 또는 "${NO_BEHAVIOR_CHANGE}" 선언이 필요합니다.`);
  }
  const absolute = join(root, learning);
  if (!existsSync(absolute)) throw new Error(`학습 기록이 없습니다: ${learning}`);
  const design = readSectionContent(readFileSync(absolute, "utf8"), DESIGN_SECTION);
  if (!design) {
    throw new Error(`"${DESIGN_SECTION}"가 비어 있습니다. 1·2단계 대화를 모아 쓰고 사용자가 확인한 뒤 시작하세요.`);
  }
  return { path: learning, design, capturedAt: new Date().toISOString() };
}

/** 리뷰 완료 시 사용자에게 전할 학습 기록 상태. 머지 조건은 CI가 판단한다. */
function learningStatus(root, run) {
  const learning = run.learning;
  if (!learning?.path) return learning ?? null;
  const absolute = join(root, learning.path);
  if (!existsSync(absolute)) return { path: learning.path, missing: REQUIRED_SECTIONS, designChanged: true };
  const markdown = readFileSync(absolute, "utf8");
  const current = readSectionContent(markdown, DESIGN_SECTION);
  return {
    path: learning.path,
    missing: missingSections(markdown),
    designChanged: current !== learning.design,
  };
}

export function beginReviewCycle(root, key, task, learning, mode = "review") {
  if (!task?.trim()) throw new Error("작업 설명이 필요합니다.");
  if (!["review", "checks-only"].includes(mode)) throw new Error("mode: review 또는 checks-only");
  const previous = active(root, key);
  if (previous && !["completed", "skipped", "cancelled"].includes(previous.phase)) {
    throw new Error(`진행 중인 실행 ${previous.id}: 재개하거나 cancel로 종료하세요.`);
  }
  const run = {
    schemaVersion: 1, id: randomUUID(), key, task, mode,
    revision: revision(root), startedAt: new Date().toISOString(), phase: "implementing",
    learning: learningSnapshot(root, learning),
    baseline: snapshot(root), findings: [], evaluations: [], checks: [], attempts: [],
  };
  save(root, run);
  atomicJson(activePath(root, key), { runId: run.id });
  return { runId: run.id, phase: run.phase };
}

export function readyReviewCycle(root, key, files) {
  const run = active(root, key);
  if (!run || !["implementing", "checks-failed", "stale"].includes(run.phase)) {
    throw new Error("begin 이후 구현 중인 실행에서만 ready를 호출할 수 있습니다.");
  }
  if (!files.length) throw new Error("구현한 파일 경로를 명시하세요.");
  const current = snapshot(root);
  const selected = [...new Set(files)].filter(eligible);
  const unknown = selected.find((path) => !(path in current) && !(path in run.baseline));
  if (unknown) throw new Error(`스냅샷에 없는 경로: ${unknown}`);
  run.files = selected.filter((path) => current[path] !== run.baseline[path]);
  run.phase = run.files.length ? "ready" : "skipped";
  run.readyAt = new Date().toISOString();
  run.expectedFingerprint = fingerprint(current);
  save(root, run);
  return { runId: run.id, phase: run.phase, files: run.files };
}

function executeChecks(root) {
  return CHECKS.map((args) => {
    const start = Date.now();
    const result = spawnSync("pnpm", args, { cwd: root, encoding: "utf8", timeout: 45_000, maxBuffer: 4 * 1024 * 1024 });
    return {
      command: `pnpm ${args.join(" ")}`, exitCode: result.status,
      durationMs: Date.now() - start,
      output: `${result.stdout ?? ""}${result.stderr ?? ""}${result.error?.message ?? ""}`.slice(-16_000),
    };
  });
}

export function handleReviewStop(root, event, runChecks = executeChecks) {
  const key = reviewSessionKey(event.session_id);
  const run = active(root, key);
  if (run?.phase === "completed") return ensureEvaluationQuestion(root, run, event);
  if (!run || run.phase !== "ready") return {};
  // 다른 Stop 훅이 시작한 continuation까지 다시 차단하지 않는다.
  if (event.stop_hook_active) return { systemMessage: "리뷰 대기: 다음 일반 턴에서 실행합니다." };
  const lock = join(root, DATA, "locks", run.id);
  mkdirSync(dirname(lock), { recursive: true });
  try {
    mkdirSync(lock);
  } catch (error) {
    if (error.code === "EEXIST") return { systemMessage: "같은 실행의 검사 훅이 이미 실행 중이거나 중단됐습니다. status로 확인하세요." };
    throw error;
  }
  try {
    // 중복 설정으로 동시에 호출돼도 검사·리뷰 요청은 한 번만 수행한다.
    const latest = active(root, key);
    if (!latest || latest.id !== run.id || latest.phase !== "ready") return {};
    return processReadyReview(root, latest, runChecks);
  } finally {
    rmdirSync(lock);
  }
}

function evaluationQuestion(run) {
  const pending = run.findings.filter((finding) => !run.evaluations.some((item) => item.findingId === finding.id));
  if (!pending.length) return null;
  return `리뷰 평가 (${run.id}): ${pending.map((finding) => `${finding.id} “${finding.title}”`).join(", ")} — 각각 유용함 / 범위 밖 / 근거 부족 / 사실과 다름 / 보류 중 어떻게 평가하시겠어요?`;
}

function ensureEvaluationQuestion(root, run, event) {
  const request = run.evaluationRequest;
  // 이전 버전 실행이나 이미 질문한 실행 때문에 후속 대화를 가로막지 않는다.
  if (!request || ["asked", "resolved", "missed"].includes(request.status)) return {};
  const text = evaluationQuestion(run);
  if (!text) {
    run.evaluationRequest = { status: "resolved" };
    save(root, run);
    return {};
  }
  const normalize = (value) => value.replace(/\s+/g, " ").trim();
  if (normalize(event.last_assistant_message ?? "").includes(normalize(text))) {
    run.evaluationRequest = { status: "asked", text, at: new Date().toISOString() };
    save(root, run);
    return {};
  }
  if (request.status === "reminded") {
    run.evaluationRequest = { status: "missed", text, at: new Date().toISOString() };
    save(root, run);
    return { systemMessage: "리뷰 평가 질문이 여전히 누락됐습니다. 누락을 기록하고 반복 종료 차단은 중단합니다." };
  }
  run.evaluationRequest = { status: "reminded", text };
  save(root, run);
  // 리뷰 continuation에서도 한 번 보정하되, 사용자 답변을 기다리는 루프는 만들지 않는다.
  return {
    decision: "block",
    reason: `작업과 리뷰는 완료됐지만 사용자 평가 질문이 빠졌습니다. 추가 검사/수정 없이 완료 보고와 제안 근거를 유지하고, 최종 답변 끝에 다음 문장을 그대로 추가하세요. 답변을 대신 평가하거나 기다리지 말고 턴을 종료하세요.\n\n${text}`,
  };
}

function processReadyReview(root, run, runChecks) {
  const before = snapshot(root);
  if (fingerprint(before) !== run.expectedFingerprint || revision(root) !== run.revision) {
    run.phase = "stale";
    save(root, run);
    return { systemMessage: "ready 이후 코드/리뷰 도구가 바뀌어 리뷰를 건너뛰었습니다. 현재 구현을 확인하고 다시 ready 하세요." };
  }
  // 검사 실패·프로세스 중단도 자동 무한 재시도하지 않는다.
  run.phase = "checking";
  save(root, run);
  run.checks = runChecks(root);
  run.attempts.push({ at: new Date().toISOString(), checks: run.checks });
  if (readJson(runPath(root, run.id)).phase !== "checking") {
    return { systemMessage: "검사 도중 종료된 리뷰 실행은 다시 활성화하지 않습니다." };
  }
  const after = snapshot(root);
  const changed = fingerprint(after) !== run.expectedFingerprint;
  if (changed || run.checks.length !== CHECKS.length || run.checks.some((check) => check.exitCode !== 0)) {
    run.phase = changed ? "stale" : "checks-failed";
    save(root, run);
    return { systemMessage: `리팩토링 리뷰 생략: ${run.phase}. 검사 기록: ${DATA}/runs/${run.id}.json. 완료로 보고하지 말고 검사 결과를 확인하세요.` };
  }
  run.verifiedAt = new Date().toISOString();
  run.changes = run.files.map((path) => ({ path, before: run.baseline[path] ?? null, after: after[path] ?? null }));
  if (run.mode === "checks-only") {
    run.phase = "completed";
    run.completedAt = new Date().toISOString();
    save(root, run);
    return { systemMessage: `검사 전용 실행 완료: ${run.id}. AI 구조 리뷰는 실행하지 않았습니다.` };
  }
  run.phase = "awaiting-review";
  run.reviewRequestedAt = new Date().toISOString();
  save(root, run);
  return {
    decision: "block",
    reason: `구현 검사 통과. ${SKILL}을 읽고 node scripts/code-review/cli.mjs packet ${run.id}로 변경 범위를 확인해 구조 리뷰하세요. 자동 수정하지 마세요. 결과 JSON을 작성하고 node scripts/code-review/cli.mjs submit ${run.id} <결과파일>로 기록한 뒤 사용자에게 제안과 평가 방법을 알려주세요. 지적이 없으면 빈 findings를 제출하세요. 학습 기록이 있으면 그 파일의 "시나리오 지도"에 깨질 수 있는 시나리오 3개(시작 조건·찾을 질문·파일:줄, 답과 힌트 없이)를 쓰고, submit 응답의 learning.missing을 사용자에게 알리세요. 사람이 쓰는 섹션은 대신 쓰지 마세요. 이 실행의 리뷰 요청은 한 번만 전달됩니다.`,
  };
}

export function reviewPacket(root, id) {
  const run = readJson(runPath(root, id));
  return {
    runId: run.id, task: run.task, phase: run.phase, revision: run.revision,
    changes: run.changes, checks: run.checks, learning: run.learning ?? null,
  };
}

export function submitReview(root, id, report) {
  const run = readJson(runPath(root, id));
  if (run.phase !== "awaiting-review") throw new Error("리뷰 대기 중인 실행이 아닙니다.");
  if (fingerprint(snapshot(root)) !== run.expectedFingerprint || revision(root) !== run.revision) {
    run.phase = "stale";
    save(root, run);
    throw new Error("리뷰 도중 코드가 변경됐습니다. 다시 ready 후 검사하세요.");
  }
  if (typeof report.summary !== "string" || !report.summary.trim() || !Array.isArray(report.findings)) {
    throw new Error("summary와 findings 배열이 필요합니다.");
  }
  for (const finding of report.findings) {
    const change = run.changes.find((item) => item.path === finding.file);
    if (!change || !Number.isInteger(finding.line) || finding.line < 1 ||
      finding.line > (change.after ?? change.before ?? "").split("\n").length ||
      !["title", "rule", "impact", "suggestion"].every((field) => typeof finding[field] === "string" && finding[field].trim())) {
      throw new Error("각 지적에 범위 안의 file/line, title/rule/impact/suggestion이 필요합니다.");
    }
  }
  run.findings = report.findings.map(({ file, line, title, rule, impact, suggestion }, index) => ({
    id: `F${index + 1}`, file, line, title, rule, impact, suggestion,
  }));
  run.summary = report.summary;
  run.phase = "completed";
  run.completedAt = new Date().toISOString();
  run.reviewDurationMs = Date.now() - Date.parse(run.reviewRequestedAt);
  const question = evaluationQuestion(run);
  if (question) run.evaluationRequest = { status: "pending", text: question };
  save(root, run);
  return {
    runId: id, findings: run.findings, awaitingHumanEvaluation: run.findings.length, evaluationQuestion: question,
    learning: learningStatus(root, run),
  };
}

export function evaluateFinding(root, id, findingId, label, note = "") {
  const run = readJson(runPath(root, id));
  if (!run.findings.some((finding) => finding.id === findingId)) throw new Error("존재하지 않는 지적입니다.");
  if (!LABELS.includes(label)) throw new Error(`평가: ${LABELS.join(", ")}`);
  // 수정된 평가도 이력으로 남기고 통계는 마지막 평가만 사용한다.
  run.evaluations.push({ findingId, label, note, at: new Date().toISOString() });
  save(root, run);
  return { runId: id, findingId, label };
}

export function cancelReviewCycle(root, key) {
  const run = active(root, key);
  if (!run) throw new Error("진행 중인 실행이 없습니다.");
  if (run.phase === "completed") throw new Error("완료 기록은 취소하지 않습니다.");
  run.phase = "cancelled";
  save(root, run);
  return { runId: run.id, phase: run.phase };
}

export function reviewStatistics(root) {
  const directory = join(root, DATA, "runs");
  if (!existsSync(directory)) return [];
  const groups = new Map();
  for (const file of readdirSync(directory).filter((name) => name.endsWith(".json"))) {
    const run = readJson(join(directory, file));
    const key = `${run.revision}:${run.mode}`;
    if (!groups.has(key)) groups.set(key, {
      revision: run.revision, mode: run.mode, runs: 0, completed: 0,
      findings: 0, evaluated: 0, useful: 0, outOfScope: 0, unsupported: 0, incorrect: 0, deferred: 0,
      checkAttempts: 0, failedCheckAttempts: 0, checkDurationMs: 0, reviewDurationMs: 0,
    });
    const group = groups.get(key);
    group.runs += 1;
    group.completed += Number(run.phase === "completed");
    group.findings += run.findings.length;
    group.checkAttempts += run.attempts.length;
    for (const attempt of run.attempts) {
      group.failedCheckAttempts += Number(attempt.checks.length !== CHECKS.length || attempt.checks.some((check) => check.exitCode !== 0));
      group.checkDurationMs += attempt.checks.reduce((total, check) => total + check.durationMs, 0);
    }
    group.reviewDurationMs += run.reviewDurationMs ?? 0;
    for (const finding of run.findings) {
      const evaluation = run.evaluations.findLast((item) => item.findingId === finding.id);
      if (!evaluation) continue;
      group.evaluated += 1;
      const field = evaluation.label === "out-of-scope" ? "outOfScope" : evaluation.label;
      group[field] += 1;
    }
  }
  return [...groups.values()].map((group) => {
    const decided = group.evaluated - group.deferred;
    return {
      ...group, unevaluated: group.findings - group.evaluated, decided,
      incorrectRate: decided ? group.incorrect / decided : null,
      lowValueRate: decided ? (group.incorrect + group.unsupported) / decided : null,
      usefulRate: decided ? group.useful / decided : null,
    };
  });
}

export function reviewSessionContext(sessionId) {
  const key = reviewSessionKey(sessionId);
  return {
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: `이 저장소의 코드 리뷰 세션 키: ${key}. 문서/상담에는 리뷰를 시작하지 않는다. 코드 구현 전 1·2단계 대화를 모아 docs/learning/YYYY-MM-DD-<작업>.md의 "설계 논의"를 쓰고(사용자 판단은 원문 인용, AI 발언은 "AI 제안" 표시, 반증은 사용자가 쓴다) 사용자 확인을 받은 뒤, node scripts/code-review/cli.mjs begin ${key} "작업 설명" <학습 기록 경로>로 기준 상태와 설계 논의를 저장한다. 설명할 동작 변화가 없다고 사용자가 선언한 작업만 경로 대신 "동작 변화 없음"을 쓴다. 구현을 마친 뒤 node scripts/code-review/cli.mjs ready ${key} <직접 구현한 파일 경로들>을 실행하면 Stop 훅이 필수 검사 후 리뷰를 요청한다. 현재 세션의 실행은 status ${key}로 확인한다. 재개 시 중복 begin하지 않는다. 사용자 평가를 대신 작성하지 않는다. 상세: docs/code-review-cycle.md.`,
    },
  };
}
