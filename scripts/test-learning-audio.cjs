const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const ts = require('typescript');
const source = ts.transpileModule(
  fs.readFileSync('src/features/learning/use-learning-audio.ts', 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText;
const flush = async () => {
  for (let i = 0; i < 15; i++) await Promise.resolve();
};
function harness(resolveMedia = async (media) => media.url) {
  const players = [],
    cleanups = [],
    states = [];
  let resolveMode;
  const dependencies = {
    '@/features/learning/api/resolve-learning-media': { resolveLearningMedia: resolveMedia },
    react: {
      useRef: (current) => ({ current }),
      useCallback: (fn) => fn,
      useEffect: (fn) => cleanups.push(fn()),
      useState: (value) => {
        const index = states.length;
        states.push(value);
        return [
          value,
          (next) => {
            states[index] = next;
          },
        ];
      },
    },
    'expo-audio': {
      setAudioModeAsync: () =>
        new Promise((resolve) => {
          resolveMode = resolve;
        }),
      createAudioPlayer: (source) => {
        let listener;
        const player = {
          source,
          fail: () => listener({ error: '403' }),
          currentTime: 0,
          duration: 10,
          isLoaded: true,
          plays: 0,
          removes: 0,
          addListener: (_, fn) => {
            listener = fn;
            return { remove() {} };
          },
          pause() {},
          play() {
            this.plays++;
          },
          remove() {
            this.removes++;
          },
          seekTo: async (seconds) => {
            player.currentTime = seconds;
          },
          finish: () => listener({ currentTime: 10, duration: 10, didJustFinish: true }),
        };
        players.push(player);
        return player;
      },
    },
    '@/features/audio/audio-session': { PLAYBACK_AUDIO_MODE: {} },
  };
  const module = { exports: {} };
  new Function('require', 'exports', 'module', source)(
    (name) => dependencies[name],
    module.exports,
    module,
  );
  const hook = module.exports.useLearningAudio();
  return {
    hook,
    players,
    states,
    load: () => resolveMode(),
    unmount: () => cleanups.forEach((fn) => fn?.()),
  };
}
test('pause retains the player and resumes from its position', async () => {
  const h = harness();
  const playback = h.hook.play(1, 2.5);
  h.load();
  await flush();
  assert.equal(h.players[0].currentTime, 2.5);
  h.players[0].currentTime = 4;
  h.hook.pause();
  assert.equal(h.hook.getPosition(), 4);
  assert.equal(h.players[0].removes, 0);
  assert.equal(h.hook.resume(), true);
  assert.equal(h.players.length, 1);
  assert.equal(h.players[0].currentTime, 4);
  h.players[0].finish();
  assert.equal(await playback, true);
  assert.equal(h.players[0].removes, 1);
  h.unmount();
});
test('pause during audio setup cannot unexpectedly autoplay when setup finishes', async () => {
  const h = harness();
  const playback = h.hook.play(1);
  h.hook.pause();
  h.load();
  await flush();
  assert.equal(h.players[0].plays, 0);
  assert.equal(h.hook.resume(), true);
  assert.equal(h.players[0].plays, 1);
  h.hook.stop();
  assert.equal(await playback, false);
  h.unmount();
});
test('leaving during setup cannot create a late player', async () => {
  const h = harness();
  const playback = h.hook.play(1);
  h.unmount();
  h.load();
  assert.equal(await playback, false);
  assert.equal(h.players.length, 0);
});

test('switching from a recording to the model immediately stops the old player', async () => {
  const h = harness();
  const first = h.hook.play('file:///my-recording.m4a');
  h.load();
  await flush();
  const second = h.hook.play(2);
  assert.equal(h.players[0].removes, 1);
  assert.equal(await first, false);
  h.load();
  await flush();
  assert.equal(h.players.length, 2);
  assert.equal(h.players[1].plays, 1);
  h.hook.stop();
  assert.equal(await second, false);
  assert.equal(h.players[1].removes, 1);
  h.unmount();
});

test('leaving comparison while its replacement audio loads prevents late playback', async () => {
  const h = harness();
  const first = h.hook.play(1);
  h.load();
  await flush();
  const second = h.hook.play('file:///my-recording.m4a');
  h.hook.stop();
  h.load();
  await flush();
  assert.equal(await first, false);
  assert.equal(await second, false);
  assert.equal(h.players.length, 1);
  assert.equal(h.players[0].removes, 1);
  h.unmount();
});

test('leaving during signed URL renewal cannot start a late player', async () => {
  let resolve, signal;
  const h = harness((_media, abortSignal) => {
    signal = abortSignal;
    return new Promise((r) => {
      resolve = r;
    });
  });
  const playback = h.hook.play({
    id: 'voice',
    url: 'https://example.com/old',
    expiresAt: '2020-01-01T00:00:00Z',
  });
  h.load();
  await flush();
  h.unmount();
  assert.equal(signal.aborted, true);
  resolve('https://example.com/new');
  assert.equal(await playback, false);
  assert.equal(h.players.length, 0);
});
test('media error forces a new signed URL on explicit retry', async () => {
  const flags = [];
  const h = harness(async (media, _signal, force) => {
    flags.push(force);
    return media.url;
  });
  const media = {
    id: 'voice',
    url: 'https://example.com/voice',
    expiresAt: '2099-01-01T00:00:00Z',
  };
  const first = h.hook.play(media);
  h.load();
  await flush();
  h.players[0].fail();
  assert.equal(await first, false);
  const next = h.hook.play(media);
  h.load();
  await flush();
  assert.deepEqual(flags, [false, true]);
  h.players[1].finish();
  assert.equal(await next, true);
  h.unmount();
});
