const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');

function compile(relative, dependencies) {
  const source = fs.readFileSync(path.join(__dirname, '..', relative), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const moduleValue = { exports: {} };
  new Function('require', 'exports', 'module', output)(
    (name) => {
      assert(name in dependencies, `Unexpected dependency: ${name}`);
      return dependencies[name];
    },
    moduleValue.exports,
    moduleValue,
  );
  return moduleValue.exports;
}
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
function harness(initial) {
  const states = [],
    effects = [],
    calls = [],
    saves = [];
  let playerPaused = false,
    playerPending = false;
  let next = 0,
    appListener;
  const AppState = {
    currentState: 'active',
    addEventListener: (_, listener) => {
      appListener = listener;
      return { remove() {} };
    },
  };
  const audio = {
    error: null,
    position: { source: null, seconds: 0, duration: 0 },
    stop() {
      playerPending = false;
      playerPaused = false;
    },
    pause() {
      playerPaused = true;
    },
    resume() {
      if (!playerPending || !playerPaused) return false;
      playerPaused = false;
      return true;
    },
    getPosition() {
      return 1.25;
    },
    // A cancelled native player can still send a late completion; exercise that race.
    play: (source, seconds) => {
      playerPending = true;
      return new Promise((resolve) =>
        calls.push({
          source,
          seconds,
          resolve: (ok) => {
            playerPending = false;
            resolve(ok);
          },
        }),
      );
    },
  };
  const { useLearningListening } = compile('src/features/learning/use-learning-listening.ts', {
    react: {
      useRef: (current) => ({ current }),
      useCallback: (callback) => callback,
      useEffect: (effect) => effects.push(effect),
      useState: (initial) => {
        const index = states.length;
        states.push(initial);
        return [
          initial,
          (next) => {
            states[index] = typeof next === 'function' ? next(states[index]) : next;
          },
        ];
      },
    },
    'react-native': { AppState },
    '@/features/learning/use-learning-audio': { useLearningAudio: () => audio },
  });
  function TestLearningListening() {
    return useLearningListening(
      [1, 2, 3].map((audio) => ({ audio, text: audio, label: '' })),
      true,
      () => next++,
      initial,
      (progress) => saves.push(progress),
    );
  }
  const hook = TestLearningListening();
  const cleanup = effects.map((effect) => effect());
  return {
    hook,
    calls,
    saves,
    states,
    get next() {
      return next;
    },
    background: () => {
      AppState.currentState = 'background';
      appListener('background');
    },
    unmount: () => cleanup.forEach((fn) => fn?.()),
  };
}

test('listening enters with autoplay and advances through every clip once', async () => {
  const h = harness();
  assert.deepEqual(
    h.calls.map((c) => c.source),
    [1],
  );
  h.calls[0].resolve(true);
  await flush();
  h.calls[1].resolve(true);
  await flush();
  h.calls[2].resolve(true);
  await flush();
  assert.deepEqual(
    h.calls.map((c) => c.source),
    [1, 2, 3],
  );
  assert.equal(h.next, 1);
  assert.equal(h.states[1], false);
  h.unmount();
});
test('next starts immediately and late completion cannot restart the old sequence', async () => {
  const h = harness();
  h.hook.move(1);
  assert.deepEqual(
    h.calls.map((c) => c.source),
    [1, 2],
  );
  h.calls[0].resolve(true);
  await flush();
  assert.equal(h.calls.length, 2);
  h.calls[1].resolve(true);
  await flush();
  assert.deepEqual(
    h.calls.map((c) => c.source),
    [1, 2, 3],
  );
  h.unmount();
});
test('next after the final sentence moves to the next stage exactly once', async () => {
  const h = harness();
  h.hook.move(1);
  h.hook.move(1);
  h.hook.move(1);
  h.hook.move(1);
  assert.equal(h.next, 1);
  for (const call of h.calls) call.resolve(true);
  await flush();
  assert.equal(h.next, 1);
  assert.equal(h.calls.length, 3);
  h.unmount();
});
test('pause, background, and unmount cancel continuation', async () => {
  for (const cancel of [(h) => h.hook.pause(), (h) => h.background(), (h) => h.unmount()]) {
    const h = harness();
    cancel(h);
    h.calls[0].resolve(true);
    await flush();
    assert.equal(h.calls.length, 1);
    assert.equal(h.next, 0);
  }
});
test('next still autoplays after pause; failed playback remains retryable', async () => {
  const h = harness();
  h.hook.pause();
  h.hook.move(1);
  h.calls[1].resolve(false);
  await flush();
  assert.equal(h.states[1], false);
  assert.equal(h.next, 0);
  h.hook.resume();
  assert.deepEqual(
    h.calls.map((c) => c.source),
    [1, 2, 2],
  );
  h.unmount();
});

test('completed sets go last only for the selected level; Part 1 uses common completion', () => {
  const { getLearningCatalogState } = compile('src/features/learning/learning-catalog-state.ts', {
    '@/features/learning/learning-progress': compile(
      'src/features/learning/learning-progress.ts',
      {},
    ),
  });
  const units = [
    { id: 'done', part: 3, lessonIds: ['a', 'b', 'c'] },
    { id: 'partial', part: 3, lessonIds: ['d', 'e', 'f'] },
    { id: 'new', part: 3, lessonIds: ['g', 'h', 'i'] },
    { id: 'read', part: 1, lessonIds: ['j'] },
  ];
  const keys = new Set(['a', 'b', 'c', 'd'].map((id) => `learning-complete:${id}:IH`));
  keys.add('learning-complete:j:common');
  const ih = getLearningCatalogState(units, keys, 'IH');
  assert.deepEqual(
    ih.all.map((u) => u.id),
    ['partial', 'new', 'done', 'read'],
  );
  assert.deepEqual(
    ih.completed.map((u) => u.id),
    ['done', 'read'],
  );
  assert.deepEqual(
    getLearningCatalogState(units, keys, 'AL').completed.map((u) => u.id),
    ['read'],
  );
  assert.deepEqual(
    units.map((u) => u.id),
    ['done', 'partial', 'new', 'read'],
  );
});

test('pause resumes the same clip and saves its offset without crediting skipped clips', async () => {
  const h = harness();
  h.hook.pause();
  assert.equal(h.saves.at(-1).seconds, 1.25);
  h.hook.resume();
  assert.equal(h.calls.length, 1, 'resume must not request a new clip');
  h.calls[0].resolve(true);
  await flush();
  assert.deepEqual(h.saves.at(-1).heard, [0]);
  h.hook.move(1);
  h.calls.at(-1).resolve(true);
  await flush();
  assert.deepEqual(h.saves.at(-1).heard, [0, 2]);
  h.unmount();
});
test('reentering listening seeks to the saved sentence and time', () => {
  const h = harness({ index: 1, seconds: 2.4, heard: [0] });
  assert.equal(h.calls[0].source, 2);
  assert.equal(h.calls[0].seconds, 2.4);
  h.unmount();
});
const progress = compile('src/features/learning/learning-progress.ts', {});
const catalog = compile('src/features/learning/learning-catalog-state.ts', {
  '@/features/learning/learning-progress': progress,
});
test('completion requires every actual sentence/round; review returns to the first missing step', () => {
  const p = {
    ...progress.EMPTY_LEARNING_PROGRESS,
    listen: { index: 2, seconds: 1, heard: [0, 2] },
    shadow: { index: 2, round: 2, accepted: [0, 1, 2, 3, 5, 6, 7, 8] },
    practiced: true,
  };
  assert.deepEqual(progress.getLearningStageCompletion(p, 3, 2), {
    listen: false,
    shadow: false,
    practice: true,
  });
  assert.equal(progress.getLearningReviewPosition(p, 3, 2, 'listen').listen.index, 1);
  assert.deepEqual(progress.getLearningReviewPosition(p, 3, 2, 'shadow').shadow, {
    index: 1,
    round: 1,
    accepted: p.shadow.accepted,
  });
  assert.equal(
    progress.getLearningStageCompletion(
      { ...p, shadow: { ...p.shadow, accepted: [0, 1, 2] } },
      3,
      1,
    ).shadow,
    true,
  );
  for (const take of [null, { uri: 'test', seconds: 1, inputDetected: true }])
    assert.equal(progress.isLearningTakeUsable(take), false);
});
test('sets keep question completion by level without resume checkpoints', () => {
  const unit = { id: 'set', part: 3, lessonIds: ['a', 'b', 'c'] };
  const s = catalog.getLearningUnitProgress(unit, new Set(['learning-complete:a:IH']), 'IH');
  assert.equal(s.completedCount, 1);
  assert.equal(s.completed, false);
  assert.equal(catalog.getLearningUnitProgress(unit, new Set(), 'AL').completedCount, 0);
  assert.equal('resumeIndex' in s, false);
  assert(s.questions.every((question) => !('progress' in question)));
});

const { getLearningQuestionLayout } = compile(
  'src/features/learning/learning-question-layout.ts',
  {},
);
test('explicit choices are separated without changing question wording', () => {
  const question =
    'Which quality matters most: practical experience, clear explanations, or patient encouragement? Give reasons.';
  assert.deepEqual(getLearningQuestionLayout(question), {
    prompt: 'Which quality matters most:',
    choices: ['practical experience', 'clear explanations', 'patient encouragement'],
    instruction: 'Give reasons.',
  });
  assert.equal(getLearningQuestionLayout('Do you prefer buses or trains?'), null);
});

const { getLearningPlaybackWordStates } = compile(
  'src/features/learning/learning-playback-words.ts',
  {},
);
test('word highlighting follows actual onset/end times and preserves silent pauses', () => {
  const words = [
    { text: 'Hello,', start: 0.8, end: 1.2 },
    { text: 'world.', start: 1.7, end: 2.3 },
  ];
  assert.deepEqual(getLearningPlaybackWordStates(words, -1), ['pending', 'pending']);
  assert.deepEqual(getLearningPlaybackWordStates(words, 0.5), ['pending', 'pending']);
  assert.deepEqual(getLearningPlaybackWordStates(words, 0.8), ['active', 'pending']);
  assert.deepEqual(getLearningPlaybackWordStates(words, 1.2), ['complete', 'pending']);
  assert.deepEqual(getLearningPlaybackWordStates(words, 1.7), ['complete', 'active']);
  assert.deepEqual(getLearningPlaybackWordStates(words, 2.3), ['complete', 'complete']);
  assert.deepEqual(
    getLearningPlaybackWordStates(words, 0.9),
    ['active', 'pending'],
    'seek back resets the highlight',
  );
  assert.deepEqual(getLearningPlaybackWordStates(words, NaN), ['pending', 'pending']);
});
test('overlapping timestamps never highlight two active words', () => {
  const words = [
    { text: 'a', start: 0, end: 0.5 },
    { text: 'man', start: 0.4, end: 0.9 },
  ];
  assert.deepEqual(getLearningPlaybackWordStates(words, 0.45), ['complete', 'active']);
});
