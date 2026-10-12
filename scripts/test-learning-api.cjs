const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const ts = require('typescript');
const examples = require('../docs/api/answer-learning-examples.json');
function load(file, deps) {
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = { exports: {} };
  new Function('require', 'exports', 'module', js)(
    (name) => {
      assert(name in deps, `Unmocked dependency: ${name}`);
      return deps[name];
    },
    mod.exports,
    mod,
  );
  return mod.exports;
}
const schema = load('src/features/learning/learning-content-schema.ts', { zod: require('zod') });
const uploadSchema = load('src/features/learning/learning-upload-schema.ts', {
  zod: require('zod'),
});
const units = load('src/features/learning/map-learning-unit.ts', {});
const details = load('src/features/learning/map-learning-detail.ts', {
  '@/features/learning/map-learning-unit': units,
});
const dependencies = {
  '@/features/learning/learning-content-schema': schema,
  '@/features/learning/map-learning-unit': units,
  '@/features/learning/map-learning-detail': details,
};
const abort = () => new AbortController().signal;
test('documented Part 1–5 contracts parse; Q5–7/Q8–10 remain ordered sets', () => {
  for (const [i, envelope] of examples.details.entries()) {
    const raw = schema.learningDetailSchema.parse(envelope.result);
    const mapped = details.mapLearningDetail(raw);
    assert.equal(mapped.unit.part, i + 1);
    assert.deepEqual(
      mapped.unit.lessonIds,
      mapped.lessons.map((l) => l.id),
    );
    assert.equal(Object.keys(mapped.lessons[0].answers)[0], i === 0 ? 'common' : 'IM3');
    schema.learningCatalogSchema.parse(examples.catalogs[i].result);
  }
  assert.deepEqual(
    details.mapLearningDetail(examples.details[2].result).unit.questionNumbers,
    [5, 6, 7],
  );
  assert.deepEqual(
    details.mapLearningDetail(examples.details[3].result).unit.questionNumbers,
    [8, 9, 10],
  );
});
test('malformed content, word timing and insecure media fail before UI', () => {
  const base = examples.details[1].result;
  const bad = structuredClone(base);
  bad.lessons[0].answer.sentences[0].words[0].end = -1;
  assert.throws(() => schema.learningDetailSchema.parse(bad));
  assert.throws(() => schema.learningDetailSchema.parse({ ...base, lessons: [] }));
  assert.throws(() =>
    schema.learningMediaSchema.parse({
      ...examples.media.result,
      url: 'http://insecure.example/voice',
    }),
  );
  const missing = structuredClone(examples.details[3].result);
  missing.lessons[0].tableFocus = null;
  assert.throws(() => schema.learningDetailSchema.parse(missing));
});
test('list uses selected grade and Part 1 common; wrong grade is rejected', async () => {
  const calls = [];
  let response = examples.catalogs[0];
  const api = load('src/features/learning/api/get-learning-units.ts', {
    ...dependencies,
    '@/lib/api/client': {
      apiFetchWithAuthRetry: async (...args) => {
        calls.push(args);
        return response;
      },
    },
  });
  const list = await api.getLearningUnits(1, 'AL', abort());
  assert.equal(calls[0][0], '/api/v1/learning/units?part=1&level=common');
  assert.equal(list[0].part, 1);
  response = examples.catalogs[1];
  await assert.rejects(api.getLearningUnits(2, 'IH', abort()));
});
test('detail IDs and grades must match the request; no whole question bank is required', async () => {
  const api = load('src/features/learning/api/get-learning-unit.ts', {
    ...dependencies,
    '@/lib/api/client': { apiFetchWithAuthRetry: async () => examples.details[1] },
  });
  assert.equal((await api.getLearningUnit('example-unit-p2', 'IM3', abort())).lessons.length, 1);
  await assert.rejects(api.getLearningUnit('wrong-unit', 'IM3', abort()));
  await assert.rejects(api.getLearningUnit('example-unit-p2', 'IH', abort()));
});
test('unexpired URLs do not call backend; expired URLs renew and IDs cannot change', async () => {
  let calls = 0,
    response = examples.media;
  const api = load('src/features/learning/api/resolve-learning-media.ts', {
    ...dependencies,
    '@/lib/api/client': {
      apiFetchWithAuthRetry: async () => {
        calls++;
        return response;
      },
    },
  });
  const media = examples.media.result;
  assert.equal(await api.resolveLearningMedia(media, abort()), media.url);
  assert.equal(calls, 0);
  assert.equal(
    await api.resolveLearningMedia({ ...media, expiresAt: '2020-01-01T00:00:00Z' }, abort()),
    media.url,
  );
  assert.equal(calls, 1);
  response = { result: { ...media, id: 'another' } };
  await assert.rejects(api.resolveLearningMedia(media, abort(), true));
});
test('completion verifies lesson, version and grade before updating the catalog', async () => {
  let call,
    response = examples.completion;
  const api = load('src/features/learning/api/put-learning-completion.ts', {
    zod: require('zod'),
    '@/lib/api/client': {
      apiFetch: async (...args) => {
        call = args;
        return response;
      },
    },
  });
  const body = {
    lessonId: 'example-p2-q3',
    level: 'IM3',
    contentVersion: 'example-v1',
    submissionId: examples.submission.result.id,
  };
  assert.equal((await api.putLearningCompletion(body)).completed, true);
  assert.equal(call[1].method, 'PUT');
  assert.deepEqual(JSON.parse(call[1].body), {
    level: 'IM3',
    contentVersion: 'example-v1',
    submissionId: body.submissionId,
  });
  response = { result: { ...examples.completion.result, level: 'AL' } };
  await assert.rejects(api.putLearningCompletion(body));
});
const jobs = load('src/features/learning/learning-submission.ts', { zod: require('zod') });
const availability = load('src/features/learning/learning-grading-availability.ts', {
  zod: require('zod'),
});
function uploadHarness({ status = 200, target = examples.upload, bytes = 1000 } = {}) {
  const calls = [];
  const api = load('src/features/learning/learning-submission-api.ts', {
    'expo-file-system': {
      File: class {
        exists = true;
        size = bytes;
        async upload(...args) {
          calls.push(['s3', ...args]);
          return { status };
        }
      },
      UploadType: { BINARY_CONTENT: 'binary' },
    },
    '@/features/learning/learning-upload-schema': uploadSchema,
    '@/features/learning/learning-submission': jobs,
    '@/features/learning/learning-grading-availability': availability,
    '@/lib/api/client': {
      apiFetch: async (path, options) => {
        calls.push(['api', path, options]);
        return path.endsWith('/upload-url') ? target : examples.submission;
      },
    },
  });
  return { api, calls };
}
test('S3 upload receives no bearer token; confirm follows successful PUT', async () => {
  const { api, calls } = uploadHarness();
  await api.uploadLearningSubmission(examples.submission.result.id, 'file:///answer.m4a', abort());
  assert.equal(calls.length, 3);
  assert(calls[0][1].endsWith('/upload-url'));
  assert.deepEqual(calls[1][2].headers, { 'Content-Type': 'audio/mp4' });
  assert(calls[2][1].endsWith('/submit'));
});
test('expired/mismatched upload URL, oversized file or S3 failure never queues grading', async () => {
  for (const config of [
    { target: { result: { ...examples.upload.result, expiresAt: '2020-01-01T00:00:00Z' } } },
    {
      target: {
        result: { ...examples.upload.result, submissionId: 'f11aa316-35be-4e49-b681-19a35d2c7bce' },
      },
    },
    { bytes: 8388609 },
    { status: 403 },
  ]) {
    const { api, calls } = uploadHarness(config);
    await assert.rejects(
      api.uploadLearningSubmission(examples.submission.result.id, 'file:///answer.m4a', abort()),
    );
    assert(!calls.some((c) => c[0] === 'api' && c[1].endsWith('/submit')));
  }
});
