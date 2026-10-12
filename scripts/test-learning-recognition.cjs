// Deterministic native-boundary regressions. This does not test a device's recognition accuracy.
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

const matching = compile('src/features/learning/learning-speech-match.ts', {});
const flush = async () => {
  for (let index = 0; index < 20; index++) await Promise.resolve();
};
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

function harness(context) {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  let completed = 0,
    nativeState = 'inactive',
    aborted = 0;
  const states = [],
    starts = [],
    events = new Map(),
    appEvents = new Set(),
    effects = [],
    cleanups = [];
  const emit = (event, value) => {
    if (event === 'start') nativeState = 'recognizing';
    if (event === 'end') nativeState = 'inactive';
    for (const listener of [...(events.get(event) ?? [])]) listener(value);
  };
  const speech = {
    getStateAsync: async () => nativeState,
    getSupportedLocales: async () => ({ locales: ['en-US'], installedLocales: ['en-US'] }),
    requestMicrophonePermissionsAsync: async () => ({ granted: true }),
    start: (options) => starts.push(options),
    stop: () => undefined,
    abort: () => {
      aborted++;
      nativeState = 'inactive';
    },
    addListener: (event, listener) => {
      if (!events.has(event)) events.set(event, new Set());
      events.get(event).add(listener);
      return { remove: () => events.get(event).delete(listener) };
    },
  };
  const AppState = {
    currentState: 'active',
    addEventListener: (_, listener) => {
      appEvents.add(listener);
      return { remove: () => appEvents.delete(listener) };
    },
  };
  const { useLearningRecognition } = compile('src/features/learning/use-learning-recognition.ts', {
    react: {
      useRef: (value) => ({ current: value }),
      useCallback: (callback) => callback,
      useEffect: (callback) => effects.push(callback),
      useState: (initial) => {
        const slot = states.length;
        states.push(initial);
        return [
          initial,
          (next) => {
            states[slot] = typeof next === 'function' ? next(states[slot]) : next;
          },
        ];
      },
    },
    'react-native': { AppState, Platform: { OS: 'ios' } },
    'expo-speech-recognition': {
      ExpoSpeechRecognitionModule: speech,
      useSpeechRecognitionEvent: (event, listener) => speech.addListener(event, listener),
    },
    '@/features/learning/learning-speech-match': matching,
  });
  function TestLearningRecognition() {
    return useLearningRecognition(() => completed++);
  }
  const hook = TestLearningRecognition();
  for (const effect of effects) cleanups.push(effect());
  context.after(() => {
    for (const cleanup of cleanups) cleanup?.();
  });
  return {
    hook,
    speech,
    starts,
    emit,
    get state() {
      return states[0];
    },
    get inputLevel() {
      return states[1];
    },
    get completed() {
      return completed;
    },
    get aborted() {
      return aborted;
    },
    appState(next) {
      AppState.currentState = next;
      for (const listener of appEvents) listener(next);
    },
  };
}

test('a missing native start recovers; retries remain on-device', async (context) => {
  const h = harness(context);
  await h.hook.start('This is a park.');
  assert.equal(h.state.status, 'preparing');
  context.mock.timers.tick(12000);
  assert.equal(h.state.status, 'unavailable');
  assert.equal(h.aborted, 1);
  await h.hook.start('This is a park.');
  assert.equal(h.starts.length, 2);
  assert(h.starts.every((options) => options.requiresOnDeviceRecognition));
  assert(h.starts.every((options) => options.recordingOptions.persist === false));
});

test('interim words update immediately; microphone volume never counts as speech', async (context) => {
  const h = harness(context);
  await h.hook.start('A man is standing beside a man.');
  h.emit('start');
  assert.equal(h.starts[0].volumeChangeEventOptions.enabled, true);
  h.emit('volumechange', { value: 7 });
  assert.equal(h.inputLevel, 0.7);
  assert.equal(h.state.transcript, '');
  assert.equal(h.completed, 0);
  h.emit('result', { isFinal: false, results: [{ transcript: 'A man' }] });
  assert.equal(h.state.transcript, 'A man');
  assert.equal(h.state.status, 'listening');
  assert.equal(h.completed, 0);
  // An updated hypothesis replaces highlights; guessed words are not permanently locked in.
  h.emit('result', { isFinal: false, results: [{ transcript: 'A' }] });
  assert.equal(h.state.transcript, 'A');
  await h.hook.cancel();
  assert.equal(h.inputLevel, 0);
  h.emit('volumechange', { value: 10 });
  assert.equal(h.inputLevel, 0);
});

test('a hung preflight does not trap the preparing screen', async (context) => {
  const h = harness(context);
  h.speech.getSupportedLocales = () => new Promise(() => {});
  const pending = h.hook.start('This is a park.');
  await flush();
  context.mock.timers.tick(12000);
  await pending;
  assert.equal(h.state.status, 'unavailable');
  assert.equal(h.starts.length, 0);
});

test('late permission after cancellation cannot start the microphone', async (context) => {
  const h = harness(context);
  const permission = deferred();
  h.speech.requestMicrophonePermissionsAsync = () => permission.promise;
  const pending = h.hook.start('This is a park.');
  await flush();
  await h.hook.cancel();
  permission.resolve({ granted: true });
  await pending;
  assert.equal(h.state.status, 'idle');
  assert.equal(h.starts.length, 0);
});

test('permission sheet return waits for the foreground', async (context) => {
  const h = harness(context);
  h.appState('inactive');
  const pending = h.hook.start('This is a park.');
  await flush();
  assert.equal(h.starts.length, 0);
  h.appState('active');
  await pending;
  assert.equal(h.starts.length, 1);
});

test('below 70%, unfinished interim, or late cancelled results never advance', async (context) => {
  const h = harness(context);
  await h.hook.start('I do not like it.');
  h.emit('start');
  h.emit('result', { isFinal: true, results: [{ transcript: 'I like it' }] });
  h.emit('end');
  assert.equal(h.completed, 0);
  assert.equal(h.state.status, 'preparing', 'A partial final continues the same sentence');
  await h.hook.start('I do not like it.');
  h.emit('start');
  h.emit('result', { isFinal: false, results: [{ transcript: 'I do not like it' }] });
  assert.equal(h.completed, 0);
  await h.hook.cancel();
  h.emit('result', { isFinal: true, results: [{ transcript: 'I do not like it' }] });
  h.emit('end');
  assert.equal(h.completed, 0);
});

test('70% final recognition advances once, while interim recognition leaves time to finish', async (context) => {
  const h = harness(context);
  await h.hook.start('I usually walk to the quiet park after my lunch');
  h.emit('start');
  h.emit('result', {
    isFinal: false,
    results: [{ transcript: 'I usually walk the park my lunch' }],
  });
  assert.equal(h.completed, 0);
  assert.equal(h.state.status, 'listening');
  h.emit('result', {
    isFinal: true,
    results: [{ transcript: 'I usually walk the park my lunch' }],
  });
  assert.equal(h.state.status, 'complete');
  assert.equal(h.completed, 0);
  h.emit('end');
  h.emit('end');
  assert.equal(h.completed, 1);
});

test('an interim 70% result does not pass when the final result is revised below the threshold', async (context) => {
  const h = harness(context);
  await h.hook.start('I usually walk to the quiet park after my lunch');
  h.emit('start');
  h.emit('result', {
    isFinal: false,
    results: [{ transcript: 'I usually walk the park my lunch' }],
  });
  h.emit('result', { isFinal: true, results: [{ transcript: 'I usually walk park my lunch' }] });
  h.emit('end');
  assert.equal(h.completed, 0);
  assert.equal(h.state.status, 'preparing');
});

test('final matching result advances exactly once and only after native end', async (context) => {
  const h = harness(context);
  await h.hook.start('This is a park.');
  h.emit('start');
  context.mock.timers.tick(30000);
  assert.equal(h.state.status, 'listening', 'There is no speaking countdown');
  h.emit('result', { isFinal: true, results: [{ transcript: 'This is a park' }] });
  assert.equal(h.completed, 0);
  h.emit('end');
  h.emit('end');
  assert.equal(h.completed, 1);
});

test('backgrounding cancels recognition without completing the sentence', async (context) => {
  const h = harness(context);
  await h.hook.start('This is a park.');
  h.emit('start');
  h.appState('background');
  await flush();
  assert.equal(h.state.status, 'idle');
  assert.equal(h.completed, 0);
  assert.equal(h.aborted, 1);
});

test('success feedback clears only an ended transcript before the next blank round', async (context) => {
  const h = harness(context);
  await h.hook.start('This is a park.');
  h.emit('start');
  h.emit('result', { isFinal: true, results: [{ transcript: 'This is a park' }] });
  h.hook.clearCompleted();
  assert.equal(h.state.status, 'complete', 'Native end is still pending');
  assert.equal(h.state.transcript, 'This is a park');
  h.emit('end');
  h.hook.clearCompleted();
  assert.equal(h.state.status, 'idle');
  assert.equal(h.state.transcript, '');
  assert.equal(h.aborted, 0, 'Resetting the display must not abort the next native session');
  await h.hook.start('This is a park.');
  h.emit('start');
  h.emit('result', { isFinal: false, results: [{ transcript: 'This is' }] });
  h.hook.clearCompleted();
  assert.equal(h.state.status, 'listening');
  assert.equal(h.state.transcript, 'This is');
  assert.equal(h.completed, 1);
});

test('a final prefix survives automatic restart; speaking from the middle completes the sentence', async (context) => {
  const h = harness(context);
  const text = 'This picture was taken in a craft room';
  await h.hook.start(text, 'sentence:round-0');
  h.emit('start');
  h.emit('result', { isFinal: true, results: [{ transcript: 'this picture was' }] });
  h.emit('end');
  assert.equal(h.completed, 0);
  assert.deepEqual(h.state.matched, [true, true, true, false, false, false, false, false]);
  context.mock.timers.tick(200);
  await flush();
  assert.equal(h.starts.length, 2);
  assert.equal(h.starts[1].requiresOnDeviceRecognition, true);
  assert(h.starts[1].contextualStrings.includes('craft'));
  h.emit('start');
  assert.equal(h.state.matched.filter(Boolean).length, 3);
  h.emit('result', { isFinal: false, results: [{ transcript: 'taken in a' }] });
  assert.equal(h.state.matched.filter(Boolean).length, 6);
  assert.equal(h.completed, 0);
  h.emit('result', { isFinal: true, results: [{ transcript: 'taken in a' }] });
  h.emit('end');
  assert.equal(h.completed, 1);
});

test('an isolated missing word fills its own box without erasing the earlier words', async (context) => {
  const h = harness(context);
  const text = 'I usually walk to the quiet park after my lunch';
  await h.hook.start(text);
  h.emit('start');
  h.emit('result', { isFinal: true, results: [{ transcript: 'I walk the park my lunch' }] });
  h.emit('end');
  context.mock.timers.tick(200);
  await flush();
  h.emit('start');
  h.emit('result', { isFinal: false, results: [{ transcript: 'usually' }] });
  assert.equal(h.state.matched[1], true);
  assert.equal(h.state.matched.filter(Boolean).length, 7);
  // Repeated partial callbacks don't count as new utterances, and a revised guess is removed.
  h.emit('result', { isFinal: false, results: [{ transcript: 'unrelated' }] });
  assert.equal(h.state.matched[1], false);
  assert.equal(h.state.matched.filter(Boolean).length, 6);
  h.emit('result', { isFinal: true, results: [{ transcript: 'usually' }] });
  h.emit('end');
  assert.equal(h.completed, 1);
});

test('duplicate final results cannot fill two occurrences of a repeated word', async (context) => {
  const h = harness(context);
  await h.hook.start('the park and the station near the river');
  h.emit('start');
  const final = { isFinal: true, results: [{ transcript: 'the' }] };
  h.emit('result', final);
  h.emit('result', final);
  h.emit('end');
  assert.deepEqual(h.state.matched, [true, false, false, false, false, false, false, false]);
  assert.equal(h.completed, 0);
});

test('pause and retry preserve confirmed words, but an identical sentence in a new round resets them', async (context) => {
  const h = harness(context);
  const text = 'This picture was taken in a craft room';
  await h.hook.start(text, 'round-0');
  h.emit('start');
  h.emit('result', { isFinal: true, results: [{ transcript: 'this picture was' }] });
  h.emit('end');
  await h.hook.cancel({ preserveProgress: true });
  context.mock.timers.tick(200);
  await flush();
  assert.equal(h.starts.length, 1, 'Pause cancels automatic restart');
  await h.hook.start(text, 'round-0');
  h.emit('start');
  assert.equal(h.state.matched.filter(Boolean).length, 3);
  await h.hook.cancel({ preserveProgress: true });
  await h.hook.start(text, 'round-1');
  h.emit('start');
  assert.equal(h.state.matched.filter(Boolean).length, 0);
});

test('hypotheses are chosen individually rather than unioned into a fake pass', async (context) => {
  const h = harness(context);
  await h.hook.start('I usually walk to the quiet park after my lunch');
  h.emit('start');
  h.emit('result', {
    isFinal: true,
    results: [{ transcript: 'usually quiet after lunch' }, { transcript: 'I walk to the park my' }],
  });
  assert.equal(h.state.matched.filter(Boolean).length, 6);
  assert.equal(h.state.transcript, 'I walk to the park my');
  h.emit('end');
  assert.equal(h.completed, 0);
});

test('silence and failures stop automatic restart and never credit an interim guess', async (context) => {
  const h = harness(context);
  await h.hook.start('This picture was taken in a craft room');
  h.emit('start');
  h.emit('result', { isFinal: true, results: [{ transcript: 'this picture' }] });
  h.emit('end');
  context.mock.timers.tick(200);
  await flush();
  h.emit('start');
  h.emit('result', { isFinal: false, results: [{ transcript: 'was taken' }] });
  h.emit('error', { error: 'no-speech' });
  h.emit('result', { isFinal: true, results: [{ transcript: 'was taken in a craft room' }] });
  h.emit('end');
  context.mock.timers.tick(30000);
  await flush();
  assert.equal(h.starts.length, 2);
  assert.equal(h.state.status, 'retry');
  assert.equal(h.state.matched.filter(Boolean).length, 2);
  assert.equal(h.completed, 0);
});

test('leaving or backgrounding during automatic restart cannot reopen the microphone', async (context) => {
  const h = harness(context);
  await h.hook.start('This picture was taken in a craft room');
  h.emit('start');
  h.emit('result', { isFinal: true, results: [{ transcript: 'this picture' }] });
  h.emit('end');
  h.appState('background');
  await flush();
  context.mock.timers.tick(30000);
  await flush();
  assert.equal(h.starts.length, 1);
  assert.equal(h.state.status, 'idle');
  assert.deepEqual(h.state.matched, []);
  assert.equal(h.completed, 0);
});
