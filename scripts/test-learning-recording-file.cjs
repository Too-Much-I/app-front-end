const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const ts = require('typescript');

function load(file, dependencies) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = { exports: {} };
  new Function('require', 'exports', 'module', code)(
    (name) => dependencies[name],
    mod.exports,
    mod,
  );
  return mod.exports;
}
function harness() {
  const original = 'file:///recorder/original.m4a';
  const files = new Map([[original, 4096]]);
  let resolveCopy, rejectCopy, destination;
  class Directory {
    constructor(root, name) {
      this.uri = `${root}/${name}`;
    }
    create() {}
  }
  class File {
    constructor(root, name) {
      this.uri = name ? `${root.uri}/${name}` : root;
    }
    get exists() {
      return files.has(this.uri);
    }
    get size() {
      return files.get(this.uri) ?? 0;
    }
    delete() {
      files.delete(this.uri);
    }
    copy(target) {
      destination = target.uri;
      return new Promise((resolve, reject) => {
        resolveCopy = (bytes) => {
          files.set(target.uri, bytes);
          resolve();
        };
        rejectCopy = reject;
      });
    }
  }
  const filesystem = { Directory, File, Paths: { cache: 'file:///cache' } };
  const validation = load('src/features/audio/recording-file.ts', {
    'expo-file-system': filesystem,
  });
  const { preserveLearningRecording } = load('src/features/learning/learning-recording-file.ts', {
    'expo-file-system': filesystem,
    '@/features/audio/recording-file': validation,
  });
  return {
    files,
    original,
    save: () => preserveLearningRecording(original, 1),
    finish: (bytes = 4096) => resolveCopy(bytes),
    fail: () => {
      files.set(destination, 17); // Native copy can leave partial output on disk-full/error.
      rejectCopy(new Error('copy failed'));
    },
  };
}
test('delayed native copy cannot publish a missing file or remove the recorder original', async () => {
  const h = harness();
  let published = false;
  const saving = h.save().then((uri) => {
    published = true;
    return uri;
  });
  await Promise.resolve();
  assert.equal(published, false);
  assert.equal(h.files.get(h.original), 4096);
  assert.equal(h.files.size, 1);
  h.finish();
  const uri = await saving;
  assert.equal(h.files.get(uri), 4096);
  assert.equal(h.files.get(h.original), 4096);
});
test('copy rejection retains original and removes partial output so saving can be retried', async () => {
  const h = harness();
  const saving = h.save();
  h.fail();
  await assert.rejects(saving, /copy failed/);
  assert.deepEqual([...h.files.keys()], [h.original]);
  const retry = h.save();
  h.finish();
  assert.equal(h.files.get(await retry), 4096);
});
test('empty copy is never accepted as a submit-ready recording', async () => {
  const h = harness();
  const saving = h.save();
  h.finish(0);
  await assert.rejects(saving, /유효한 녹음 파일/);
  assert.deepEqual([...h.files.keys()], [h.original]);
});
