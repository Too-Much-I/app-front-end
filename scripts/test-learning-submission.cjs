const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const ts = require('typescript');

function load(file, dependencies) {
  const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = { exports: {} };
  new Function('require', 'exports', 'module', compiled)(
    (name) => dependencies[name],
    mod.exports,
    mod,
  );
  return mod.exports;
}
const { parseLearningSubmission } = load('src/features/learning/learning-submission.ts', {
  zod: require('zod'),
});
const { ApiError } = load('src/lib/api/transport.ts', {});
const submissionErrors = load('src/features/learning/learning-submission-error.ts', {
  '@/lib/api/transport': { ApiError },
});
const id = 'd11aa316-35be-4e49-b681-19a35d2c7bce';
const result = {
  checklistVersion: 'test-v1',
  transcript: 'It costs eighty-five dollars.',
  totalCount: 1,
  metCount: 1,
  items: [
    {
      id: 'fee',
      label: '등록비',
      verdict: 'met',
      probability: 0.98,
      feedback: '정확해요.',
    },
  ],
};
const completed = {
  id,
  lessonId: 'lesson',
  contentVersion: 'v1',
  level: 'IM3',
  status: 'completed',
  result,
  error: null,
};
function harness(api = {}) {
  const states = [],
    cleanups = [],
    results = [],
    calls = [];
  const dependencies = {
    react: {
      useRef: (current) => ({ current }),
      useEffect: (fn) => cleanups.push(fn()),
      useState: (initial) => {
        const index = states.length;
        states.push(initial);
        return [initial, (next) => (states[index] = next)];
      },
    },
    '@/features/learning/learning-submission-error': submissionErrors,
    'expo-crypto': { randomUUID: () => id },
    '@/features/learning/learning-submission-api': {
      createLearningSubmission: async (jobId) => {
        calls.push(jobId);
        return completed;
      },
      ...api,
    },
  };
  const { useLearningSubmission: createTestController } = load(
    'src/features/learning/use-learning-submission.ts',
    dependencies,
  );
  const hook = createTestController(
    'lesson',
    'IM3',
    { uri: 'file:///take.m4a' },
    (r) => results.push(r),
    'v1',
  );
  return { hook, states, results, calls, unmount: () => cleanups.forEach((f) => f?.()) };
}
test('invalid counts and missing results cannot complete practice', () => {
  assert.equal(parseLearningSubmission(completed).status, 'completed');
  assert.throws(() => parseLearningSubmission({ ...completed, result: null }));
  assert.throws(() =>
    parseLearningSubmission({ ...completed, result: { ...result, metCount: 2 } }),
  );
  assert.throws(() => parseLearningSubmission({ ...completed, status: 'unexpected' }));
});
test('double taps create only one request', async () => {
  const h = harness();
  await Promise.all([h.hook.submit(), h.hook.submit()]);
  assert.equal(h.calls.length, 1);
  assert.equal(h.results.length, 1);
});
test('a lost upload response reuses its submission ID and recovers the accepted job', async () => {
  const ids = [];
  let uploads = 0;
  const h = harness({
    createLearningSubmission: async (jobId) => {
      ids.push(jobId);
      return ids.length === 1
        ? { ...completed, status: 'awaiting_audio', result: null }
        : completed;
    },
    uploadLearningSubmission: async () => {
      uploads++;
      throw new Error('network response lost');
    },
  });
  await h.hook.submit();
  assert.equal(h.states[0].kind, 'error');
  await h.hook.submit();
  assert.deepEqual(ids, [id, id]);
  assert.equal(uploads, 1);
  assert.equal(h.results.length, 1);
});
test('leaving during submission prevents a late result from completing another screen', async () => {
  let respond;
  const h = harness({
    createLearningSubmission: () => new Promise((resolve) => (respond = resolve)),
  });
  const task = h.hook.submit();
  h.unmount();
  respond(completed);
  await task;
  assert.equal(h.results.length, 0);
});
test('a result for a different lesson is rejected', async () => {
  const h = harness({
    createLearningSubmission: async () => ({ ...completed, lessonId: 'other' }),
  });
  await h.hook.submit();
  assert.equal(h.results.length, 0);
  assert.equal(h.states[0].kind, 'error');
});

test('stopping during upload ignores its late response and resumes the same job without another upload', async () => {
  let finishUpload;
  let uploads = 0;
  let reads = 0;
  const ids = [];
  const h = harness({
    createLearningSubmission: async (jobId) => {
      ids.push(jobId);
      return ids.length === 1
        ? { ...completed, status: 'awaiting_audio', result: null }
        : completed;
    },
    uploadLearningSubmission: () => {
      uploads++;
      return new Promise((resolve) => {
        finishUpload = resolve;
      });
    },
    getLearningSubmission: async () => {
      reads++;
      return completed;
    },
  });
  const first = h.hook.submit();
  await Promise.resolve();
  h.hook.stopWaiting();
  assert.equal(h.states[0].kind, 'paused');
  await h.hook.submit();
  finishUpload();
  await first;
  assert.deepEqual(ids, [id, id]);
  assert.equal(uploads, 1);
  assert.equal(reads, 0);
  assert.equal(h.results.length, 1);
  assert.equal(h.states[0].kind, 'idle');
});

test('stopping a poll releases the screen and ignores a completed result already in flight', async () => {
  let respond;
  let polling;
  const started = new Promise((resolve) => {
    polling = resolve;
  });
  const h = harness({
    createLearningSubmission: async () => ({ ...completed, status: 'grading', result: null }),
    getLearningSubmission: () =>
      new Promise((resolve) => {
        respond = resolve;
        polling();
      }),
  });
  const task = h.hook.submit();
  await started;
  h.hook.stopWaiting();
  respond(completed);
  await task;
  assert.equal(h.states[0].kind, 'paused');
  assert.equal(h.results.length, 0);
});

test('stop waiting immediately aborts a pending creation and prevents an upload', async () => {
  let respond;
  let signal;
  let uploads = 0;
  const h = harness({
    createLearningSubmission: (_id, _lesson, _level, requestSignal) => {
      signal = requestSignal;
      return new Promise((resolve) => {
        respond = resolve;
      });
    },
    uploadLearningSubmission: async () => {
      uploads++;
    },
  });
  const task = h.hook.submit();
  h.hook.stopWaiting();
  assert.equal(signal.aborted, true);
  respond({ ...completed, status: 'awaiting_audio', result: null });
  await task;
  assert.equal(uploads, 0);
  assert.equal(h.states[0].kind, 'paused');
});

test('unsupported checklists and permanent errors do not offer resubmission', async () => {
  const h = harness({
    createLearningSubmission: async () => {
      throw new ApiError(409, '준비 중', 'CHECKLIST_NOT_READY', { retryable: false });
    },
  });
  await h.hook.submit();
  assert.deepEqual(h.states[0], { kind: 'error', message: '준비 중', canRetry: false });
  assert.equal(
    submissionErrors.getLearningSubmissionError(new ApiError(401, '권한 없음')).canRetry,
    false,
  );
  assert.equal(
    submissionErrors.getLearningSubmissionError(new ApiError(503, '일시 오류')).canRetry,
    true,
  );
  assert.equal(
    submissionErrors.getLearningSubmissionError(
      new ApiError(503, '재시도 불가', 'FAIL', { retryable: false }),
    ).canRetry,
    false,
  );
});

test('a wrong content version cannot upload audio or complete a lesson', async () => {
  let uploads = 0;
  const h = harness({
    createLearningSubmission: async () => ({
      ...completed,
      contentVersion: 'another',
      status: 'awaiting_audio',
      result: null,
    }),
    uploadLearningSubmission: async () => {
      uploads++;
    },
  });
  await h.hook.submit();
  assert.equal(uploads, 0);
  assert.equal(h.results.length, 0);
  assert.equal(h.states[0].kind, 'error');
  h.unmount();
});
