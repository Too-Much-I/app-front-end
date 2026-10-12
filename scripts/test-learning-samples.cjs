const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
let now = 10000;
const cache = new Map();
function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file);
  if (file.endsWith('.json')) return JSON.parse(fs.readFileSync(file));
  const mod = { exports: {} };
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  new Function('require', 'exports', 'module', 'Date', js)(
    (name) => {
      if (name === 'react-native')
        return { Image: { resolveAssetSource: (asset) => ({ uri: `file://${asset}` }) } };
      if (name === 'zod') return require('zod');
      let target = name.startsWith('@/')
        ? path.join(root, 'src', name.slice(2))
        : path.resolve(path.dirname(file), name);
      if (/\.(m4a|mp3|png)$/.test(target)) return target;
      if (!path.extname(target)) target += '.ts';
      return load(target);
    },
    mod.exports,
    mod,
    { now: () => now },
  );
  cache.set(file, mod.exports);
  return mod.exports;
}
const api = load(path.join(root, 'examples/learning-sample/sample-api.ts'));
const content = require('../examples/learning-sample/content.json');
const manifest = require('../examples/learning-sample/manifest.json');
const signal = () => new AbortController().signal;
test('real sample has 2 cards per part, ordered sets, all levels and intact media', async () => {
  assert.equal(content.units.length, 10);
  assert.equal(manifest.lessons, 18);
  assert.equal(manifest.answers, 50);
  for (let part = 1; part <= 5; part++) {
    for (const level of ['IM3', 'IH', 'AL']) {
      const units = await api.getLearningUnits(part, level, signal());
      assert.equal(units.length, 2);
      for (const unit of units) {
        const d = await api.getLearningUnit(unit.id, level, signal());
        assert.equal(d.lessons.length, part === 3 || part === 4 ? 3 : 1);
        assert.deepEqual(
          d.lessons.map((l) => l.id),
          unit.lessonIds,
        );
        for (const l of d.lessons) {
          const a = l.answers[part === 1 ? 'common' : level];
          assert(a.sentences.every((s) => s.audio.url.startsWith('file://')));
          if (part === 2) assert(l.photo.width > 0 && l.photo.url.startsWith('file://'));
        }
      }
    }
  }
  for (const media of manifest.media) {
    const bytes = fs.readFileSync(path.join(root, 'examples/learning-sample/assets', media.file));
    assert.equal(bytes.length, media.sizeBytes);
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), media.sha256);
  }
});
test('sample grading advances through real UI contract and saves completion without network', async () => {
  for (const part of [2, 3, 4, 5]) {
    const unit = (await api.getLearningUnits(part, 'IH'))[0];
    const l = (await api.getLearningUnit(unit.id, 'IH')).lessons[0];
    const id = crypto.randomUUID();
    assert.equal((await api.getLearningGradingSupport(l.id, signal())).kind, 'ready');
    assert.equal(
      (await api.createLearningSubmission(id, l.id, 'IH', signal(), l.contentVersion)).status,
      'awaiting_audio',
    );
    await api.uploadLearningSubmission(id, 'file:///not-read-or-uploaded.m4a', signal());
    assert.equal((await api.getLearningSubmission(id, signal())).status, 'queued');
    now += 1200;
    assert.equal((await api.getLearningSubmission(id, signal())).status, 'transcribing');
    now += 1200;
    assert.equal((await api.getLearningSubmission(id, signal())).status, 'grading');
    now += 1200;
    const result = await api.getLearningSubmission(id, signal());
    assert.equal(result.status, 'completed');
    assert.equal(result.result.metCount, 2);
    assert.match(result.result.transcript, /실제 녹음 분석 아님/);
    assert.equal(
      (await api.createLearningSubmission(id, l.id, 'IH', signal(), l.contentVersion)).status,
      'completed',
    );
    await api.putLearningCompletion({
      lessonId: l.id,
      level: 'IH',
      contentVersion: l.contentVersion,
      submissionId: id,
    });
    assert((await api.getLearningUnits(part, 'IH'))[0].completedLessonIds.includes(l.id));
    assert(!(await api.getLearningUnits(part, 'AL'))[0].completedLessonIds.includes(l.id));
    await assert.rejects(api.createLearningSubmission(id, l.id, 'AL', signal(), l.contentVersion));
  }
});
test('sample adapter rejects cancelled requests, missing units and premature completion', async () => {
  const abort = new AbortController();
  abort.abort();
  await assert.rejects(api.getLearningUnits(2, 'IH', abort.signal));
  await assert.rejects(api.getLearningUnit('missing', 'IM3'));
  const unit = (await api.getLearningUnits(5, 'AL'))[1];
  const lesson = (await api.getLearningUnit(unit.id, 'AL')).lessons[0];
  await assert.rejects(
    api.putLearningCompletion({
      lessonId: lesson.id,
      level: 'AL',
      contentVersion: lesson.contentVersion,
    }),
  );
});
