// 네이티브 앱 실행 없이 임시 Git 저장소에서 실제 훅 상태 전이와 기록을 검증한다.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  beginReviewCycle,
  cancelReviewCycle,
  evaluateFinding,
  handleReviewStop,
  readyReviewCycle,
  reviewSessionKey,
  reviewStatistics,
  submitReview,
} from './code-review/core.mjs';
import { evaluateLearningRecord } from './code-review/learning.mjs';

const root = mkdtempSync(join(tmpdir(), 'code-review-hook-test-'));
const cli = resolve(dirname(fileURLToPath(import.meta.url)), 'code-review/cli.mjs');
const key = reviewSessionKey('session-A');
const LEARNING = 'docs/learning/2026-10-01-test.md';
const learningRecord = ({ design = '- 최종: 값이 2가 된다', rest = '' } = {}) =>
  `# 작업\n\n## 설계 논의\n<!-- 안내 -->\n${design}\n\n## 시나리오 지도\n\n${rest}`;
const event = {
  session_id: 'session-A',
  hook_event_name: 'Stop',
  cwd: root,
  stop_hook_active: false,
};
let assertions = 0;
const passed = () =>
  ['tsc', 'lint', 'architecture', 'naming'].map((command) => ({
    command,
    exitCode: 0,
    durationMs: 10,
    output: 'ok',
  }));

function write(path, value) {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), value);
}

function runRecord(id) {
  return JSON.parse(readFileSync(join(root, `output/code-review/runs/${id}.json`), 'utf8'));
}

function check(name, fn) {
  fn();
  assertions += 1;
  process.stdout.write(`통과: ${name}\n`);
}

try {
  execFileSync('git', ['init', '--quiet'], { cwd: root });
  write('.gitignore', 'output/\n');
  write('src/example.ts', 'export const value = 1;\n');
  write('src/learning.skeleton.ts', '미완성 문법\n');
  for (const path of [
    '.agents/skills/review-completed-code/SKILL.md',
    'scripts/code-review/core.mjs',
    'scripts/code-review/cli.mjs',
    'scripts/code-review/learning.mjs',
  ])
    write(path, 'fixture\n');
  write(LEARNING, learningRecord());

  check('명시적인 구현 시작이 없으면 검사/리뷰하지 않는다', () => {
    assert.deepEqual(
      handleReviewStop(root, event, () => assert.fail('검사 실행 금지')),
      {},
    );
  });
  let { runId } = beginReviewCycle(root, key, '첫 작업', LEARNING);
  check('스켈레톤만 변경하면 리뷰를 생략한다', () => {
    write('src/learning.skeleton.ts', '여전히 미완성\n');
    assert.equal(readyReviewCycle(root, key, ['src/learning.skeleton.ts']).phase, 'skipped');
    assert.deepEqual(handleReviewStop(root, event), {});
  });
  ({ runId } = beginReviewCycle(root, key, '실제 구현', LEARNING));
  check('구현 중에는 종료해도 검사하지 않는다', () => {
    assert.deepEqual(
      handleReviewStop(root, event, () => assert.fail('검사 실행 금지')),
      {},
    );
  });
  check('다른 세션은 이 실행을 가져가지 않는다', () => {
    assert.deepEqual(handleReviewStop(root, { ...event, session_id: 'session-B' }), {});
  });
  write('src/example.ts', 'export const value = 2;\n');
  readyReviewCycle(root, key, ['src/example.ts']);
  check('다른 훅의 continuation에서는 추가 차단하지 않는다', () => {
    assert.equal(handleReviewStop(root, { ...event, stop_hook_active: true }).decision, undefined);
    assert.equal(runRecord(runId).phase, 'ready');
  });
  check('컴파일 실패는 리뷰를 유발하지 않고 자동 반복도 하지 않는다', () => {
    const result = handleReviewStop(root, event, () =>
      passed().map((item, index) => ({ ...item, exitCode: index === 0 ? 1 : 0 })),
    );
    assert.equal(result.decision, undefined);
    assert.equal(runRecord(runId).phase, 'checks-failed');
    assert.deepEqual(
      handleReviewStop(root, event, () => assert.fail('반복 금지')),
      {},
    );
  });
  check('검사 재시도는 명시적 ready 후 가능하고 이력을 보존한다', () => {
    readyReviewCycle(root, key, ['src/example.ts']);
    assert.equal(handleReviewStop(root, event, passed).decision, 'block');
    assert.equal(runRecord(runId).attempts.length, 2);
    assert.deepEqual(
      handleReviewStop(root, event, () => assert.fail('중복 리뷰 금지')),
      {},
    );
  });
  check('리뷰 범위는 작업 시작 당시 dirty 내용을 기준으로 한다', () => {
    assert.deepEqual(runRecord(runId).changes, [
      {
        path: 'src/example.ts',
        before: 'export const value = 1;\n',
        after: 'export const value = 2;\n',
      },
    ]);
  });
  check('범위 밖의 지적은 기록하지 않는다', () => {
    assert.throws(() =>
      submitReview(root, runId, {
        summary: '검토',
        findings: [
          {
            file: 'src/other.ts',
            line: 1,
            title: '문제',
            rule: '규칙',
            impact: '영향',
            suggestion: '대안',
          },
        ],
      }),
    );
  });
  check('리뷰 제안과 사람의 평가를 별도로 기록한다', () => {
    const report = submitReview(root, runId, {
      summary: '구조 검토',
      findings: [
        {
          file: 'src/example.ts',
          line: 1,
          title: '이름',
          rule: '프로젝트 규칙',
          impact: '의미 불명확',
          suggestion: '도메인 이름 사용',
        },
      ],
    });
    assert.ok(report.evaluationQuestion.includes(runId));
    assert.ok(report.evaluationQuestion.includes('F1'));
    const reminder = handleReviewStop(
      root,
      { ...event, stop_hook_active: true, last_assistant_message: '완료했습니다.' },
      () => assert.fail('추가 검사 금지'),
    );
    assert.equal(reminder.decision, 'block');
    assert.equal(runRecord(runId).evaluationRequest.status, 'reminded');
    assert.deepEqual(
      handleReviewStop(root, {
        ...event,
        last_assistant_message: `완료했습니다.\n\n${report.evaluationQuestion}`,
      }),
      {},
    );
    assert.equal(runRecord(runId).evaluationRequest.status, 'asked');
    assert.deepEqual(handleReviewStop(root, { ...event, last_assistant_message: '다음 작업' }), {});
    assert.equal(reviewStatistics(root)[0].incorrectRate, null);
    assert.equal(reviewStatistics(root)[0].unevaluated, 1);
    evaluateFinding(root, runId, 'F1', 'deferred');
    assert.equal(reviewStatistics(root)[0].incorrectRate, null);
    evaluateFinding(root, runId, 'F1', 'incorrect', '이름은 이미 요구사항에서 정함');
    assert.equal(reviewStatistics(root)[0].incorrectRate, 1);
    evaluateFinding(root, runId, 'F1', 'out-of-scope');
    assert.equal(reviewStatistics(root)[0].incorrectRate, 0);
    assert.equal(runRecord(runId).evaluations.length, 3);
    assert.throws(() => evaluateFinding(root, runId, 'F2', 'useful'));
  });
  ({ runId } = beginReviewCycle(root, key, '수정 경쟁', LEARNING));
  write('src/example.ts', 'export const value = 3;\n');
  readyReviewCycle(root, key, ['src/example.ts']);
  check('ready 이후 바뀐 코드에는 예전 검사/리뷰를 적용하지 않는다', () => {
    write('src/example.ts', 'export const value = 4;\n');
    assert.equal(
      handleReviewStop(root, event, () => assert.fail('검사 실행 금지')).decision,
      undefined,
    );
    assert.equal(runRecord(runId).phase, 'stale');
  });
  check('검사 중 변경이 생기면 리뷰하지 않는다', () => {
    readyReviewCycle(root, key, ['src/example.ts']);
    handleReviewStop(root, event, () => {
      write('src/example.ts', 'export const value = 5;\n');
      return passed();
    });
    assert.equal(runRecord(runId).phase, 'stale');
  });
  check('리뷰 중 변경도 완료로 기록하지 않는다', () => {
    readyReviewCycle(root, key, ['src/example.ts']);
    handleReviewStop(root, event, passed);
    write('src/example.ts', 'export const value = 6;\n');
    assert.throws(() => submitReview(root, runId, { summary: '문제 없음', findings: [] }));
    assert.equal(runRecord(runId).phase, 'stale');
    cancelReviewCycle(root, key);
  });
  ({ runId } = beginReviewCycle(root, key, '비교 기준', LEARNING, 'checks-only'));
  write('src/example.ts', 'export const value = 7;\n');
  check('검사 전용 비교군은 AI 리뷰를 호출하지 않는다', () => {
    readyReviewCycle(root, key, ['src/example.ts']);
    assert.equal(handleReviewStop(root, event, passed).decision, undefined);
    assert.equal(runRecord(runId).phase, 'completed');
    assert.equal(reviewStatistics(root).find((group) => group.mode === 'checks-only').completed, 1);
  });
  ({ runId } = beginReviewCycle(root, key, '삭제와 신규 파일', LEARNING));
  rmSync(join(root, 'src/example.ts'));
  write('src/new.ts', 'export const next = 1;\n');
  check('삭제·신규 파일과 지적 0건도 기록한다', () => {
    readyReviewCycle(root, key, ['src/example.ts', 'src/new.ts']);
    handleReviewStop(root, event, passed);
    const report = submitReview(root, runId, { summary: '지적 없음', findings: [] });
    assert.equal(report.evaluationQuestion, null);
    assert.deepEqual(handleReviewStop(root, event), {});
    assert.equal(runRecord(runId).changes[0].after, null);
    assert.equal(runRecord(runId).changes[1].before, null);
    assert.equal(runRecord(runId).phase, 'completed');
  });
  check('실제 CLI가 공식 SessionStart/Stop JSON 계약을 따른다', () => {
    const start = spawnSync(process.execPath, [cli, 'hook'], {
      cwd: root,
      input: JSON.stringify({ ...event, hook_event_name: 'SessionStart' }),
      encoding: 'utf8',
    });
    assert.equal(start.status, 0);
    assert.equal(JSON.parse(start.stdout).hookSpecificOutput.hookEventName, 'SessionStart');
    const stop = spawnSync(process.execPath, [cli, 'hook'], {
      cwd: root,
      input: JSON.stringify(event),
      encoding: 'utf8',
    });
    assert.equal(stop.status, 0);
    assert.deepEqual(JSON.parse(stop.stdout), {});
    const broken = spawnSync(process.execPath, [cli, 'hook'], {
      cwd: root,
      input: 'invalid',
      encoding: 'utf8',
    });
    assert.equal(broken.status, 0);
    assert.match(JSON.parse(broken.stdout).systemMessage, /훅 실패/);
  });
  check('실제 Stop CLI가 검사 프로세스 4개를 실행하고 리뷰를 한 번 요청한다', () => {
    write(
      'bin/pnpm',
      `#!/usr/bin/env node\nrequire('node:fs').appendFileSync('checks.log', process.argv.slice(2).join(' ') + '\\n');\n`,
    );
    chmodSync(join(root, 'bin/pnpm'), 0o700);
    ({ runId } = beginReviewCycle(root, key, '프로세스 통합', LEARNING));
    write('src/new.ts', 'export const next = 2;\n');
    readyReviewCycle(root, key, ['src/new.ts']);
    const options = {
      cwd: root,
      input: JSON.stringify(event),
      encoding: 'utf8',
      env: { ...process.env, PATH: `${join(root, 'bin')}:${process.env.PATH}` },
    };
    const result = spawnSync(process.execPath, [cli, 'hook'], options);
    assert.equal(result.status, 0);
    assert.equal(JSON.parse(result.stdout).decision, 'block');
    assert.deepEqual(readFileSync(join(root, 'checks.log'), 'utf8').trim().split('\n'), [
      'exec tsc --noEmit',
      'lint',
      'check:architecture',
      'check:naming',
    ]);
    const second = spawnSync(process.execPath, [cli, 'hook'], options);
    assert.deepEqual(JSON.parse(second.stdout), {});
    assert.equal(runRecord(runId).checks.length, 4);
    cancelReviewCycle(root, key);
  });
  check('실제 검사 프로세스의 실패 종료 코드는 리뷰를 차단한다', () => {
    write('bin/pnpm', '#!/usr/bin/env node\nprocess.exitCode = 1;\n');
    chmodSync(join(root, 'bin/pnpm'), 0o700);
    ({ runId } = beginReviewCycle(root, key, '실패 프로세스', LEARNING));
    write('src/new.ts', 'export const next = 3;\n');
    readyReviewCycle(root, key, ['src/new.ts']);
    const result = spawnSync(process.execPath, [cli, 'hook'], {
      cwd: root,
      input: JSON.stringify(event),
      encoding: 'utf8',
      env: { ...process.env, PATH: `${join(root, 'bin')}:${process.env.PATH}` },
    });
    assert.equal(JSON.parse(result.stdout).decision, undefined);
    assert.equal(runRecord(runId).phase, 'checks-failed');
  });
  check('검사 도중 취소한 실행은 늦은 성공으로 부활하지 않는다', () => {
    readyReviewCycle(root, key, ['src/new.ts']);
    const result = handleReviewStop(root, event, () => {
      cancelReviewCycle(root, key);
      return passed();
    });
    assert.equal(result.decision, undefined);
    assert.equal(runRecord(runId).phase, 'cancelled');
  });
  function completeWithFinding(value) {
    ({ runId } = beginReviewCycle(root, key, '평가 질문 검증', LEARNING));
    write('src/new.ts', `export const next = ${value};\n`);
    readyReviewCycle(root, key, ['src/new.ts']);
    handleReviewStop(root, event, passed);
    return submitReview(root, runId, {
      summary: '검토',
      findings: [
        {
          file: 'src/new.ts',
          line: 1,
          title: '이름',
          rule: '기준',
          impact: '영향',
          suggestion: '제안',
        },
      ],
    });
  }
  check('첫 완료 보고에 질문이 있으면 추가 continuation이 없다', () => {
    const report = completeWithFinding(4);
    assert.deepEqual(
      handleReviewStop(root, { ...event, last_assistant_message: report.evaluationQuestion }),
      {},
    );
    assert.equal(runRecord(runId).evaluationRequest.status, 'asked');
  });
  check('질문 보완을 무시해도 무한 차단하지 않고 누락을 기록한다', () => {
    completeWithFinding(5);
    assert.equal(handleReviewStop(root, event).decision, 'block');
    assert.equal(handleReviewStop(root, event).decision, undefined);
    assert.equal(runRecord(runId).evaluationRequest.status, 'missed');
    assert.deepEqual(handleReviewStop(root, event), {});
    assert.equal(runRecord(runId).evaluations.length, 0);
  });
  check('사용자가 이미 평가한 지적은 다시 묻지 않는다', () => {
    completeWithFinding(6);
    evaluateFinding(root, runId, 'F1', 'deferred');
    assert.deepEqual(handleReviewStop(root, event), {});
    assert.equal(runRecord(runId).evaluationRequest.status, 'resolved');
  });
  check('학습 기록 없이, 또는 설계 논의가 비어 있으면 구현을 시작하지 않는다', () => {
    const blank = 'docs/learning/2026-10-01-blank.md';
    write(
      blank,
      learningRecord({
        design:
          '- 쟁점:\n  - 처음 판단:\n  - 바뀐 계기:\n  - 최종:\n- 다룬 실패 범위:\n- 다루지 않은 것:\n- 반증:',
      }),
    );
    assert.throws(() => beginReviewCycle(root, key, '경로 없음'), /학습 기록 경로/);
    assert.throws(
      () => beginReviewCycle(root, key, 'README', 'docs/learning/README.md'),
      /학습 기록 경로/,
    );
    assert.throws(() => beginReviewCycle(root, key, '빈 설계 논의', blank), /비어 있습니다/);
    assert.throws(
      () => beginReviewCycle(root, key, '없는 파일', 'docs/learning/none.md'),
      /없습니다/,
    );
  });
  check('시작 시점의 설계 논의를 고정하고, 완료 때 바뀐 기록과 빈 섹션을 알린다', () => {
    write(LEARNING, learningRecord());
    ({ runId } = beginReviewCycle(root, key, '설계 논의 고정', LEARNING));
    assert.equal(runRecord(runId).learning.design, '- 최종: 값이 2가 된다');
    write(
      LEARNING,
      learningRecord({ design: '- 최종: 나중에 고친 설계', rest: '## 흐름 설명\n설명함\n' }),
    );
    write('src/new.ts', 'export const next = 7;\n');
    readyReviewCycle(root, key, ['src/new.ts']);
    handleReviewStop(root, event, passed);
    const report = submitReview(root, runId, { summary: '지적 없음', findings: [] });
    assert.equal(runRecord(runId).learning.design, '- 최종: 값이 2가 된다');
    assert.equal(report.learning.designChanged, true);
    assert.deepEqual(report.learning.missing, ['내가 찾은 것', '설계와 달라진 것']);
  });
  check('동작 변화 없음 선언은 학습 기록 없이 시작한다', () => {
    ({ runId } = beginReviewCycle(root, key, '포맷', '동작 변화 없음'));
    assert.deepEqual(runRecord(runId).learning, { declared: '동작 변화 없음' });
    cancelReviewCycle(root, key);
  });
  check('CI 머지 조건: 문서만·선언·완성된 학습 기록만 통과', () => {
    const filled = `## 설계 논의\n- 최종: A\n## 내가 찾은 것\nB\n## 흐름 설명\nC\n## 설계와 달라진 것\nD\n`;
    const files = { 'docs/learning/2026-10-01-a.md': filled };
    const decide = (changedFiles, prBody = '', addedFiles = changedFiles) =>
      evaluateLearningRecord({ changedFiles, addedFiles, prBody, readFile: (path) => files[path] })
        .ok;
    assert.equal(decide(['docs/a.md', 'README.md']), true);
    assert.equal(decide(['src/a.ts']), false);
    assert.equal(decide(['src/a.ts'], '동작 변화 없음: 포맷만 변경'), true);
    assert.equal(decide(['src/a.ts'], '<!-- 동작 변화 없음: 예시 -->'), false);
    assert.equal(decide(['src/a.ts'], '동작 변화 없음:'), false);
    // 템플릿 자리표시를 그대로 두면 사유를 쓰지 않은 것이다.
    assert.equal(decide(['src/a.ts'], '동작 변화 없음: <사유>'), false);
    assert.equal(decide(['src/a.ts'], '동작 변화 없음: <실제 사유>'), false);
    assert.equal(decide(['src/a.ts', 'docs/learning/2026-10-01-a.md']), true);
    files['docs/learning/2026-10-01-b.md'] = filled.replace('D\n', '<!-- 템플릿 -->\n');
    assert.equal(decide(['src/a.ts', 'docs/learning/2026-10-01-b.md']), false);
    assert.equal(decide(['src/a.ts', 'docs/learning/README.md']), false);
    // 제목 표기(# 개수, # 뒤 공백, 제목 안 띄어쓰기)는 너그럽게 받는다.
    files['docs/learning/2026-10-01-c.md'] =
      `### 설계 논의\nA\n##내가 찾은 것\nB\n## 흐름설명\nC\n#### 설계와  달라진 것 ##\nD\n`;
    assert.equal(decide(['src/a.ts', 'docs/learning/2026-10-01-c.md']), true);
    // 이미 채워진 이전 작업의 기록을 수정만 한 PR은 통과하지 않는다.
    const oldRecord = ['src/a.ts', 'docs/learning/2026-10-01-a.md'];
    assert.equal(decide(oldRecord, '', ['src/a.ts']), false);
    // 5단계 생략 선언은 설계 논의만 요구한다. 학습 기록 파일과 설계 논의는 그대로 필요하다.
    files['docs/learning/2026-10-01-d.md'] =
      `## 설계 논의\n- 최종: A\n## 내가 찾은 것\n<!-- 사람이 쓴다 -->\n## 흐름 설명\n## 설계와 달라진 것\n`;
    files['docs/learning/2026-10-01-e.md'] = `## 설계 논의\n- 최종:\n## 내가 찾은 것\nB\n`;
    const designOnly = ['src/a.ts', 'docs/learning/2026-10-01-d.md'];
    const emptyDesign = ['src/a.ts', 'docs/learning/2026-10-01-e.md'];
    assert.equal(decide(designOnly), false);
    assert.equal(decide(designOnly, '5단계 생략: 예상 가능한 API 연결'), true);
    assert.equal(decide(emptyDesign, '5단계 생략: 예상 가능한 API 연결'), false);
    assert.equal(decide(['src/a.ts'], '5단계 생략: 예상 가능한 API 연결'), false);
    assert.equal(decide(designOnly, '<!-- 5단계 생략: 예시 -->'), false);
    assert.equal(decide(designOnly, '5단계 생략: <사유>'), false);
    assert.equal(decide(oldRecord, '5단계 생략: 예상 가능한 API 연결', ['src/a.ts']), false);
  });
  process.stdout.write(`코드 리뷰 훅 검사 ${assertions}개 통과\n`);
} finally {
  rmSync(root, { recursive: true, force: true });
}
