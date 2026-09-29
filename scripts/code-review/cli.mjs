import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  beginReviewCycle, cancelReviewCycle, evaluateFinding, handleReviewStop,
  readyReviewCycle, reviewPacket, reviewSessionContext, reviewStatistics, submitReview,
} from "./core.mjs";

const [command, ...args] = process.argv.slice(2);
const hook = command === "hook";

try {
  const event = hook ? JSON.parse(readFileSync(0, "utf8")) : null;
  const root = execFileSync("git", ["rev-parse", "--show-toplevel"], {
    cwd: event?.cwd ?? process.cwd(), encoding: "utf8",
  }).trim();
  let result;
  switch (command) {
    case "hook":
      if (event.hook_event_name === "SessionStart") result = reviewSessionContext(event.session_id);
      else if (event.hook_event_name === "Stop") result = handleReviewStop(root, event);
      else result = {};
      break;
    case "begin": result = beginReviewCycle(root, args[0], args[1], args[2]); break;
    case "ready": result = readyReviewCycle(root, args[0], args.slice(1)); break;
    case "submit": result = submitReview(root, args[0], JSON.parse(readFileSync(args[1], "utf8"))); break;
    case "rate": result = evaluateFinding(root, args[0], args[1], args[2], args[3]); break;
    case "cancel": result = cancelReviewCycle(root, args[0]); break;
    case "stats": result = reviewStatistics(root); break;
    case "packet": result = reviewPacket(root, args[0]); break;
    case "status": {
      if (!/^[a-f0-9]{16}$/.test(args[0] ?? "")) throw new Error("올바른 세션 키가 필요합니다.");
      const { runId } = JSON.parse(readFileSync(join(root, "output/code-review/sessions", `${args[0]}.json`), "utf8"));
      const run = JSON.parse(readFileSync(join(root, "output/code-review/runs", `${runId}.json`), "utf8"));
      result = { runId, phase: run.phase, files: run.files, checks: run.checks, findings: run.findings, evaluationRequest: run.evaluationRequest };
      break;
    }
    default: throw new Error("명령: begin <세션키> <작업> [review|checks-only], ready <세션키> <파일...>, packet <실행ID>, submit <실행ID> <JSON>, rate <실행ID> <F번호> <평가> [메모], status <세션키>, cancel <세션키>, stats");
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (hook) {
    // 훅 장애가 사용자 대화를 반복 차단하지 않도록 실패 사실만 알린다.
    process.stdout.write(`${JSON.stringify({ systemMessage: `코드 리뷰 훅 실패: ${message}. 리뷰 완료를 의미하지 않습니다.` })}\n`);
  } else {
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}
