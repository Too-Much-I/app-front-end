// Offline bridge: validate the Java catalog export with the app's actual runtime schemas.
// No HTTP, audio upload, STT, or grading request is made here.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(
  path.join(root, 'src/features/learning/learning-content-schema.ts'),
  'utf8',
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const schemaModule = { exports: {} };
new Function('require', 'exports', 'module', compiled)(
  (name) => {
    if (name !== 'zod') throw new Error('Unexpected schema dependency');
    return require('zod');
  },
  schemaModule.exports,
  schemaModule,
);

function validateLearningContractExport(input) {
  if (!input || !Array.isArray(input.catalogs) || !Array.isArray(input.details))
    throw new Error('Expected catalogs[] and details[]');
  if (!input.catalogs.length || !input.details.length) throw new Error('Empty contract export');
  const { learningCatalogSchema, learningDetailSchema } = schemaModule.exports;
  const parse = (schema, value, kind, index) => {
    if (value && 'isSuccess' in value && value.isSuccess !== true)
      throw new Error(`${kind}[${index}] is not a success response`);
    const parsed = schema.safeParse(value?.result ?? value);
    // Never print the private content or signed URLs from the input file.
    if (!parsed.success) throw new Error(`${kind}[${index}] violates the app schema`);
    return parsed.data;
  };
  const catalogs = input.catalogs.map((c, i) => parse(learningCatalogSchema, c, 'catalogs', i));
  const details = input.details.map((d, i) => parse(learningDetailSchema, d, 'details', i));
  const expected = new Map();
  const catalogKeys = new Set();
  for (const c of catalogs) {
    const catalogKey = `${c.part}:${c.level}`;
    if (catalogKeys.has(catalogKey)) throw new Error('Duplicate catalog');
    catalogKeys.add(catalogKey);
    if ((c.part === 1) !== (c.level === 'common')) throw new Error('Invalid catalog level');
    for (const u of c.units) expected.set(`${catalogKey}:${u.id}`, u);
  }
  let answers = 0;
  const versions = new Set();
  for (const detail of details) {
    const level = detail.lessons[0].level;
    const key = `${detail.unit.part}:${level}:${detail.unit.id}`;
    const unit = expected.get(key);
    if (!unit) throw new Error('Unexpected or duplicate unit detail');
    if (
      detail.lessons.some(
        (l, i) =>
          l.level !== level ||
          l.id !== unit.lessons[i]?.id ||
          l.questionNumber !== unit.lessons[i]?.questionNumber,
      ) ||
      unit.lessons.length !== detail.lessons.length
    )
      throw new Error('Catalog and detail disagree');
    expected.delete(key);
    answers += detail.lessons.length;
    detail.lessons.forEach((lesson) => versions.add(lesson.contentVersion));
  }
  if (expected.size) throw new Error('Some catalog units have no detail response');
  if (versions.size !== 1) throw new Error('Mixed content versions');
  return {
    catalogs: catalogs.length,
    details: details.length,
    answers,
    contentVersions: versions.size,
  };
}

module.exports = { validateLearningContractExport };

if (require.main === module) {
  try {
    const file = process.argv[2];
    if (!file) throw new Error('Usage: node scripts/validate-learning-contract.cjs <export.json>');
    console.log(
      JSON.stringify(validateLearningContractExport(JSON.parse(fs.readFileSync(file, 'utf8')))),
    );
  } catch (error) {
    console.error(error instanceof SyntaxError ? 'Invalid JSON export' : error.message);
    process.exitCode = 1;
  }
}
