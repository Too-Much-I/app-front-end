const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const ts = require('typescript');

function load(file, dependencies = {}) {
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
const { getLearningGradingAvailability: availability } = load(
  'src/features/learning/learning-grading-availability.ts',
  { zod: require('zod') },
);
const { getLearningTakeIssue: issue, isLearningTakeUsable: usable } = load(
  'src/features/learning/learning-progress.ts',
);

test('grading is ready only for a supported lesson and ready providers', () => {
  assert.equal(availability({ ready: true, lessonIds: ['q8'] }, 'q8').kind, 'ready');
  assert.equal(availability({ ready: true, lessonIds: ['q8'] }, 'q9').kind, 'unsupported');
  assert.equal(availability({ ready: false, lessonIds: ['q8'] }, 'q8').kind, 'unavailable');
  assert.equal(availability({ ready: false, lessonIds: ['q8'] }, 'q9').kind, 'unsupported');
  for (const data of [
    null,
    {},
    { ready: 'true', lessonIds: ['q8'] },
    { ready: true, lessonIds: null },
  ])
    assert.throws(() => availability(data, 'q8'));
});

test('recording guidance survives serialization and revisiting the practice stage', () => {
  for (const seconds of [0, 1, 2.99]) {
    const take = JSON.parse(
      JSON.stringify({ uri: 'file:///take.m4a', seconds, inputDetected: true }),
    );
    assert.match(issue(take), /3초/);
    assert.equal(usable(take), false);
  }
  assert.equal(usable({ uri: 'file:///take.m4a', seconds: NaN, inputDetected: true }), false);
  assert.equal(usable(null), false);
  assert.equal(issue(null), null);
});

test('saved recordings can proceed to comparison or submission regardless of input detection', () => {
  for (const inputDetected of [false, null, true]) {
    const take = JSON.parse(JSON.stringify({ uri: 'file:///take.m4a', seconds: 3, inputDetected }));
    assert.equal(issue(take), null);
    assert.equal(usable(take), true);
    assert.equal(take.inputDetected, inputDetected);
    assert.equal(usable({ ...take, seconds: 2.99 }), false);
  }
});

function supportHarness(api) {
  const slots = [];
  let cursor = 0;
  let effects = [];
  let current;
  const changed = (a, b) =>
    !a || a.length !== b.length || a.some((value, i) => !Object.is(value, b[i]));
  const react = {
    useState: (value) => {
      const index = cursor++;
      slots[index] ??= { value };
      return [
        slots[index].value,
        (next) => {
          slots[index].value = next;
        },
      ];
    },
    useRef: (value) => {
      const index = cursor++;
      slots[index] ??= { current: value };
      return slots[index];
    },
    useCallback: (fn, deps) => {
      const index = cursor++;
      if (changed(slots[index]?.deps, deps)) slots[index] = { deps, fn };
      return slots[index].fn;
    },
    useEffect: (fn, deps) => {
      const index = cursor++;
      if (changed(slots[index]?.deps, deps))
        effects.push(() => {
          slots[index]?.cleanup?.();
          slots[index] = { deps, cleanup: fn() };
        });
    },
  };
  const { useLearningGradingSupport: renderHook } = load(
    'src/features/learning/use-learning-grading-support.ts',
    {
      react,
      '@/features/learning/learning-submission-api': { getLearningGradingSupport: api },
    },
  );
  const render = (lesson = 'q8', enabled = true) => {
    cursor = 0;
    effects = [];
    current = renderHook(lesson, enabled);
    effects.forEach((run) => run());
    return current;
  };
  return {
    render,
    state: () => slots[0].value,
    unmount: () => slots.forEach((slot) => slot.cleanup?.()),
  };
}

test('Part 1 does not query grading; offline failure can be retried', async () => {
  let calls = 0;
  const h = supportHarness(async () => {
    calls++;
    if (calls === 1) throw new Error('offline');
    return { kind: 'ready' };
  });
  h.render('q1', false);
  assert.equal(calls, 0);
  h.render('q8');
  await Promise.resolve();
  assert.equal(h.state().kind, 'unavailable');
  await h.render('q8').refresh();
  assert.equal(h.state().kind, 'ready');
  assert.equal(calls, 2);
  h.unmount();
});

test('a stale capability response cannot enable grading on another question', async () => {
  const pending = [];
  const h = supportHarness(
    (lesson, signal) => new Promise((resolve) => pending.push({ lesson, signal, resolve })),
  );
  h.render('q8');
  h.render('q9');
  assert.equal(pending[0].signal.aborted, true);
  pending[1].resolve({ kind: 'unsupported', message: '준비 중' });
  await Promise.resolve();
  pending[0].resolve({ kind: 'ready' });
  await Promise.resolve();
  assert.equal(h.state().kind, 'unsupported');
  h.unmount();
});

test('refresh and unmount cancel old requests without a late state update', async () => {
  const pending = [];
  const h = supportHarness(
    (_lesson, signal) => new Promise((resolve) => pending.push({ signal, resolve })),
  );
  const controller = h.render();
  const refresh = controller.refresh();
  assert.equal(pending[0].signal.aborted, true);
  h.unmount();
  assert.equal(pending[1].signal.aborted, true);
  pending.forEach(({ resolve }) => resolve({ kind: 'ready' }));
  await refresh;
  assert.equal(h.state().kind, 'checking');
});
