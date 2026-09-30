// PR 머지 조건: 동작이 바뀌는 PR에는 사람이 쓴 학습 기록(docs/learning)이 있어야 한다.
// 규칙과 배경: docs/how-we-work.md, docs/learning/README.md
// 실행: BASE_SHA=<base> PR_BODY=<본문> node scripts/check-learning-record.mjs
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import { evaluateLearningRecord } from './code-review/learning.mjs';

const base = process.env.BASE_SHA;
if (!base) {
  // push(main) 등 PR이 아닌 실행에서는 판단할 대상이 없다.
  console.log('학습 기록 검사 생략: PR이 아닙니다.');
  process.exit(0);
}

function diffFiles(filter) {
  return execFileSync('git', ['diff', '--name-only', `--diff-filter=${filter}`, `${base}...HEAD`], {
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean);
}

const result = evaluateLearningRecord({
  changedFiles: diffFiles('ACMR'),
  addedFiles: diffFiles('A'),
  prBody: process.env.PR_BODY ?? '',
  readFile: (path) => readFileSync(path, 'utf8'),
});

if (result.ok) {
  console.log(`학습 기록 검사 통과 — ${result.reason}`);
} else {
  console.error(`학습 기록 검사 실패\n${result.reason}`);
  process.exitCode = 1;
}
